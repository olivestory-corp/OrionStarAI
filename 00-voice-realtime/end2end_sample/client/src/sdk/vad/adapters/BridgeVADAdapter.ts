/**
 * BridgeVADAdapter - Android Bridge VAD 适配器
 * 通过 window.DeepVBridge 与 Android Native VAD 通信
 *
 * 策略：
 * 1. VAD Start 时开始累积音频，不立即触发回调
 * 2. 收到 filter=false 时标记为有效音频
 * 3. VAD End 时：
 *    - 如果有有效音频，立即发送
 *    - 如果没有，等待 1000ms 看是否有后续 filter=false
 * 4. filter=true 时触发 onFilter 回调（用于打断 LLM）
 */

import { IVADBridge } from '../../types';

// Android 接口类型定义
interface AndroidVadInterface {
  notifyReady: () => void;
  stopVad: () => void;
  startVad?: () => void;
}

// 等待超时时间（ms）
const WAIT_VALID_AUDIO_MS = 1000;

export class BridgeVADAdapter implements IVADBridge {
  private _isReady = false;
  private _isListening = false;
  private isPaused = false;  // PTT 模式下暂停 VAD

  // 回调
  private onStartCallback: (() => void) | null = null;
  private onEndCallback: (() => void) | null = null;
  private onAudioCallback: ((data: Int16Array) => void) | null = null;
  private onFilterCallback: ((reason: string) => void) | null = null;
  private onValidAudioCallback: (() => void) | null = null;
  private onMaybeStartCallback: (() => void) | null = null;
  private onMaybeEndCallback: (() => void) | null = null;

  // 音频缓冲策略相关
  private audioBuffer: Int16Array[] = [];
  private currentSid: string | null = null;
  private hasValidAudio = false;
  private isWaitingForValidAudio = false;
  private waitTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private isVadActive = false;  // VAD 是否正在进行中
  private isStreaming = false;  // 是否正在实时流式发送

  get isReady(): boolean {
    return this._isReady;
  }

  get isListening(): boolean {
    return this._isListening;
  }

  async init(): Promise<void> {
    if (this._isReady) return;

    console.log('[BridgeVADAdapter] 🔄 初始化中...');

    // 挂载全局对象供 Android 调用
    (window as any).DeepVBridge = {
      onVadStart: (sid: string) => {
        console.log('[BridgeVADAdapter] 🎤 VAD Start (Android)', sid);
        this.handleVadStart(sid);
      },
      onVadEnd: (sid: string) => {
        console.log('[BridgeVADAdapter] 🛑 VAD End (Android)', sid);
        this.handleVadEnd(sid);
      },
      onAudioData: (base64: string) => {
        this.handleAudioData(base64);
      },
      onFilterVadData: (sid: string, filter: boolean, speakId: number, reason: string) => {
        console.log('[BridgeVADAdapter] 🔍 FilterVadData:', sid, 'filter=', filter, 'reason=', reason);
        this.handleFilterVadData(sid, filter, reason);
      },
      // 兼容旧版 onFilter 回调
      onFilter: (reason: string) => {
        console.log('[BridgeVADAdapter] VAD Filtered (legacy)', reason);
        this.onFilterCallback?.(reason);
      },
      onBridgeReady: () => {
        console.log('[BridgeVADAdapter] Android VAD Service Connected');
      }
    };

    // 通知 Android 网页已就绪
    const androidVad = (window as any).AndroidVad as AndroidVadInterface | undefined;
    if (androidVad?.notifyReady) {
      androidVad.notifyReady();
    } else {
      console.warn('[BridgeVADAdapter] window.AndroidVad not found');
    }

    // Android Bridge 不需要加载 WASM，立即就绪
    this._isReady = true;
    console.log('[BridgeVADAdapter] ✅ 初始化完成');
  }

  /**
   * 处理 VAD 开始
   */
  private handleVadStart(sid: string): void {
    // PTT 模式下忽略 VAD 触发
    if (this.isPaused) {
      console.log('[BridgeVADAdapter] ⏸️ VAD 已暂停，忽略 VAD Start');
      return;
    }

    // 取消之前的等待
    this.cancelWaitTimeout();

    // 重置状态
    this.audioBuffer = [];
    this.currentSid = sid;
    this.hasValidAudio = false;
    this.isWaitingForValidAudio = false;
    this.isVadActive = true;
    this.isStreaming = false;

    // 立即触发 onMaybeStartCallback（用于 UI 展示"说话中"状态）
    this.onMaybeStartCallback?.();

    // 注意：不立即触发 onStartCallback，等到确认有效音频后再触发
  }

  /**
   * 处理 VAD 结束
   */
  private handleVadEnd(sid: string): void {
    // PTT 模式下忽略 VAD 触发
    if (this.isPaused) {
      console.log('[BridgeVADAdapter] ⏸️ VAD 已暂停，忽略 VAD End');
      return;
    }

    this.isVadActive = false;

    if (this.isStreaming) {
      // 已经在流式发送中，触发 speech_end
      console.log('[BridgeVADAdapter] 🛑 VAD 结束，停止流式发送');
      this._isListening = false;
      this.onEndCallback?.();
      this.cleanupState();
    } else if (this.hasValidAudio) {
      // 有有效音频但还没开始流式发送（理论上不应该发生），发送缓冲区
      console.log('[BridgeVADAdapter] ✅ VAD 结束，发送缓冲区');
      this.flushAudioToCallback();
    } else {
      // 没有有效音频，进入等待状态
      console.log(`[BridgeVADAdapter] ⏳ 没有有效音频，等待 ${WAIT_VALID_AUDIO_MS}ms`);
      this.isWaitingForValidAudio = true;

      this.waitTimeoutId = setTimeout(() => {
        if (this.isWaitingForValidAudio) {
          console.log('[BridgeVADAdapter] ⌛ 等待超时，丢弃音频');
          this.cleanupState();
          // 通知上层重置 UI 状态
          this.onMaybeEndCallback?.();
        }
      }, WAIT_VALID_AUDIO_MS);
    }
  }

  /**
   * 处理音频数据
   */
  private handleAudioData(base64: string): void {
    try {
      // Base64 -> Int16Array (16kHz)
      const binaryString = atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const int16Data16k = new Int16Array(bytes.buffer);

      // 重采样: 16kHz -> 48kHz (3倍上采样)
      const ratio = 3;
      const newLength = int16Data16k.length * ratio;
      const int16Data48k = new Int16Array(newLength);

      for (let i = 0; i < newLength; i++) {
        const originalIndex = i / ratio;
        const index1 = Math.floor(originalIndex);
        const index2 = Math.min(index1 + 1, int16Data16k.length - 1);
        const weight = originalIndex - index1;

        // 线性插值
        int16Data48k[i] = int16Data16k[index1] * (1 - weight) + int16Data16k[index2] * weight;
      }

      if (this.isStreaming) {
        // 已经在流式发送中，直接发送
        this.onAudioCallback?.(int16Data48k);
      } else {
        // 还没开始流式发送，累积到缓冲区
        this.audioBuffer.push(int16Data48k);
      }
    } catch (e) {
      console.error('[BridgeVADAdapter] 解码音频失败:', e);
    }
  }

  /**
   * 处理 Filter VAD 数据
   */
  private handleFilterVadData(sid: string, filter: boolean, reason: string): void {
    if (filter) {
      // filter=true: 被过滤（如回声消除），清空缓冲区并触发 onFilter
      console.log('[BridgeVADAdapter] 🚫 音频被过滤，清空缓冲区');
      this.audioBuffer = [];
      this.onFilterCallback?.(reason);
    } else {
      // filter=false: 有效音频
      const wasValid = this.hasValidAudio;
      this.hasValidAudio = true;

      // 首次收到有效音频时
      if (!wasValid) {
        console.log('[BridgeVADAdapter] 🎯 首次收到有效音频，立即开始流式发送');

        // 通知上层打断 LLM
        this.onValidAudioCallback?.();

        // 开始流式发送
        this.startStreaming();
      }

      // 如果正在等待期间收到有效音频，立即发送
      if (this.isWaitingForValidAudio) {
        console.log('[BridgeVADAdapter] ✅ 等待期间收到有效音频，立即发送');
        this.cancelWaitTimeout();
        this.startStreaming();
        // 发送完缓冲区后触发 speech_end
        this._isListening = false;
        this.onEndCallback?.();
        this.cleanupState();
      }
    }
  }

  /**
   * 开始流式发送
   * 发送缓冲区中的音频，并切换到实时发送模式
   */
  private startStreaming(): void {
    if (this.isStreaming) return;

    this.isStreaming = true;
    this._isListening = true;

    // 1. 触发 speech_start
    this.onStartCallback?.();

    // 2. 发送缓冲区中的音频
    if (this.audioBuffer.length > 0) {
      const totalLength = this.audioBuffer.reduce((sum, arr) => sum + arr.length, 0);
      console.log(`[BridgeVADAdapter] 📤 发送缓冲区 ${this.audioBuffer.length} 个音频块，共 ${totalLength} 样本`);

      for (const chunk of this.audioBuffer) {
        this.onAudioCallback?.(chunk);
      }

      // 清空缓冲区（后续音频直接发送）
      this.audioBuffer = [];
    }

    // 注意：不触发 speech_end，等 onVadEnd 时再触发
  }

  /**
   * 发送累积的音频到回调
   */
  private flushAudioToCallback(): void {
    if (this.audioBuffer.length === 0) {
      console.log('[BridgeVADAdapter] 缓冲区为空，跳过');
      this.cleanupState();
      return;
    }

    // 1. 触发 speech_start
    this._isListening = true;
    this.onStartCallback?.();

    // 2. 发送所有累积的音频数据
    const totalLength = this.audioBuffer.reduce((sum, arr) => sum + arr.length, 0);
    console.log(`[BridgeVADAdapter] 📤 发送 ${this.audioBuffer.length} 个音频块，共 ${totalLength} 样本`);

    for (const chunk of this.audioBuffer) {
      this.onAudioCallback?.(chunk);
    }

    // 3. 触发 speech_end
    this._isListening = false;
    this.onEndCallback?.();

    // 4. 清理状态
    this.cleanupState();
  }

  /**
   * 取消等待超时
   */
  private cancelWaitTimeout(): void {
    if (this.waitTimeoutId) {
      clearTimeout(this.waitTimeoutId);
      this.waitTimeoutId = null;
    }
  }

  /**
   * 清理状态
   */
  private cleanupState(): void {
    this.audioBuffer = [];
    this.currentSid = null;
    this.hasValidAudio = false;
    this.isWaitingForValidAudio = false;
    this.isVadActive = false;
    this.isStreaming = false;
    this.cancelWaitTimeout();
  }

  start(): void {
    console.log('[BridgeVADAdapter] start() - Android 端自动管理');
    const androidVad = (window as any).AndroidVad as AndroidVadInterface | undefined;
    if (androidVad?.startVad) {
      androidVad.startVad();
    }
    this._isListening = true;
  }

  stop(): void {
    console.log('[BridgeVADAdapter] stop()');
    const androidVad = (window as any).AndroidVad as AndroidVadInterface | undefined;
    if (androidVad?.stopVad) {
      androidVad.stopVad();
    }
    this._isListening = false;
    this.cleanupState();
  }

  destroy(): void {
    this.stop();
    delete (window as any).DeepVBridge;
    this._isReady = false;
    this._isListening = false;
    console.log('[BridgeVADAdapter] ♻️ 已销毁');
  }

  onVadStart(callback: () => void): void {
    this.onStartCallback = callback;
  }

  onVadEnd(callback: () => void): void {
    this.onEndCallback = callback;
  }

  onAudioData(callback: (data: Int16Array) => void): void {
    this.onAudioCallback = callback;
  }

  onFilter(callback: (reason: string) => void): void {
    this.onFilterCallback = callback;
  }

  onValidAudio(callback: () => void): void {
    this.onValidAudioCallback = callback;
  }

  onVadMaybeStart(callback: () => void): void {
    this.onMaybeStartCallback = callback;
  }

  onVadMaybeEnd(callback: () => void): void {
    this.onMaybeEndCallback = callback;
  }
}