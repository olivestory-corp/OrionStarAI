/**
 * WebVADAdapter - Web 端 VAD 适配器
 * 使用 @ricky0123/vad-web 库
 * 纯 TypeScript 实现，无 React 依赖
 */

import { MicVAD } from '@ricky0123/vad-web';
import * as ort from 'onnxruntime-web';
import { IVADBridge } from '../../types';

// 配置 ONNX Runtime WASM 路径
const ONNX_CDN = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.23.2/dist/';
ort.env.wasm.wasmPaths = ONNX_CDN;
ort.env.wasm.numThreads = 1;

export class WebVADAdapter implements IVADBridge {
  private vad: MicVAD | null = null;
  private _isReady = false;
  private _isListening = false;
  private isPaused = false;
  private isPTTMode = false;  // PTT 模式：音频继续流动，但忽略 VAD 语音事件

  // 回调
  private onStartCallback: (() => void) | null = null;
  private onEndCallback: (() => void) | null = null;
  private onAudioCallback: ((data: Int16Array) => void) | null = null;
  private onFilterCallback: ((reason: string) => void) | null = null;

  get isReady(): boolean {
    return this._isReady;
  }

  get isListening(): boolean {
    return this._isListening;
  }

  async init(): Promise<void> {
    if (this._isReady) return;

    try {
      console.log('[WebVADAdapter] 🔄 初始化中...');

      this.vad = await MicVAD.new({
        model: 'v5',
        onnxWASMBasePath: ONNX_CDN,
        baseAssetPath: '/',
        onSpeechRealStart: () => {
          if (this.isPaused || !this._isListening) return;
          console.log('[WebVADAdapter] 🎤 Speech Start');
          this.onStartCallback?.();
        },
        onSpeechEnd: () => {
          if (this.isPaused || !this._isListening) return;
          console.log('[WebVADAdapter] 🛑 Speech End');
          this.onEndCallback?.();
        },
        onVADMisfire: () => {
          if (this.isPaused || !this._isListening) return;
          this.onFilterCallback?.('misfire');
        },
        positiveSpeechThreshold: 0.4,
        redemptionMs: 600,
        minSpeechMs: 300
      });

      // 设置原始音频流
      this.setupRawAudioStream();

      this._isReady = true;
      console.log('[WebVADAdapter] ✅ 初始化完成');

      // 如果未暂停，自动启动
      if (!this.isPaused) {
        this.start();
      }
    } catch (error) {
      console.error('[WebVADAdapter] ❌ 初始化失败:', error);
      this._isReady = true; // 避免永久等待
      throw error;
    }
  }

  private setupRawAudioStream(): void {
    if (!this.vad) return;

    try {
      const vadAny = this.vad as any;
      const stream = vadAny._stream as MediaStream;
      const audioContext = vadAny._audioContext as AudioContext;

      if (!stream || !audioContext) {
        console.warn('[WebVADAdapter] 无法获取音频流');
        return;
      }

      const sourceNode = audioContext.createMediaStreamSource(stream);
      const bufferSize = 4096;
      const processor = audioContext.createScriptProcessor(bufferSize, 1, 1);

      processor.onaudioprocess = (event) => {
        // PTT 模式下：音频继续采集（isPTTMode=true 时不检查 isPaused）
        // 普通模式下：暂停时不采集
        if (!this.vad) return;
        if (!this.isPTTMode && (this.isPaused || !this._isListening)) return;

        const inputData = event.inputBuffer.getChannelData(0);

        // Float32 -> Int16 PCM
        const int16Data = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        this.onAudioCallback?.(int16Data);
      };

      sourceNode.connect(processor);
      processor.connect(audioContext.destination);

      vadAny._rawProcessor = processor;
      vadAny._rawSource = sourceNode;
    } catch (e) {
      console.error('[WebVADAdapter] 设置原始音频流失败:', e);
    }
  }

  start(): void {
    console.log('[WebVADAdapter] start()');
    this.isPaused = false;
    this.isPTTMode = false;  // 退出 PTT 模式

    if (this.vad) {
      this.vad.start();
      this._isListening = true;
    }
  }

  stop(): void {
    console.log('[WebVADAdapter] stop()');
    this.isPaused = true;
    this.isPTTMode = true;  // 进入 PTT 模式，音频继续采集

    if (this.vad) {
      // 不调用 vad.pause()，保持音频流
      this._isListening = false;
    }
  }

  /**
   * 进入 PTT 模式
   * 音频继续采集，但忽略 VAD 语音检测事件
   */
  enterPTTMode(): void {
    console.log('[WebVADAdapter] 🎤 进入 PTT 模式');
    this.isPTTMode = true;
    this.isPaused = true;  // 标记暂停，让 VAD 回调被忽略
  }

  /**
   * 退出 PTT 模式
   */
  exitPTTMode(): void {
    console.log('[WebVADAdapter] 🎤 退出 PTT 模式');
    this.isPTTMode = false;
    this.isPaused = false;
    this._isListening = true;
  }

  destroy(): void {
    if (this.vad) {
      const vadAny = this.vad as any;
      if (vadAny._rawProcessor) {
        vadAny._rawProcessor.disconnect();
        vadAny._rawSource.disconnect();
      }
      this.vad.destroy();
      this.vad = null;
    }
    this._isReady = false;
    this._isListening = false;
    console.log('[WebVADAdapter] ♻️ 已销毁');
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
}
