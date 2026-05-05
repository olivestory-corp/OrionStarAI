/**
 * VADManager - VAD 管理器
 * 自动检测环境选择合适的 VAD 适配器
 * 纯 TypeScript 实现
 */

import { EventEmitter } from 'events';
import { IVADBridge } from '../types';
import { WebVADAdapter } from './adapters/WebVADAdapter';
import { BridgeVADAdapter } from './adapters/BridgeVADAdapter';

export interface VADManagerConfig {
  /** 自定义 VAD 适配器 */
  vadBridge?: IVADBridge;
}

/**
 * VAD 管理器
 *
 * Events:
 * - 'maybe_speech_start': VAD 可能开始（用于 UI 展示"说话中"状态）
 * - 'maybe_speech_end': VAD 可能结束（超时丢弃时重置 UI 状态）
 * - 'speech_start': 检测到语音开始（确认有效后）
 * - 'speech_end': 检测到语音结束
 * - 'audio_data': 原始音频数据 (Int16Array)
 * - 'filter': 过滤（误触发，filter=true）
 * - 'valid_audio': 检测到有效音频（filter=false），用于立即打断 LLM
 * - 'ready': VAD 就绪
 */
export class VADManager extends EventEmitter {
  private vadBridge: IVADBridge;
  private _isReady = false;
  private _isListening = false;
  private _userSpeaking = false;

  constructor(config: VADManagerConfig = {}) {
    super();

    // 使用注入的 Bridge，或自动检测
    this.vadBridge = config.vadBridge ?? this.detectDefaultVAD();
  }

  /**
   * 自动检测环境选择 VAD 适配器
   */
  private detectDefaultVAD(): IVADBridge {
    if (typeof window !== 'undefined' && ((window as any).AndroidVad || (window as any).Android)) {
      console.log('[VADManager] 检测到 Android 环境，使用 BridgeVADAdapter');
      return new BridgeVADAdapter();
    }
    console.log('[VADManager] 使用 WebVADAdapter');
    return new WebVADAdapter();
  }

  get isReady(): boolean {
    return this._isReady;
  }

  get isListening(): boolean {
    return this._isListening;
  }

  get userSpeaking(): boolean {
    return this._userSpeaking;
  }

  /**
   * 初始化 VAD
   */
  async initialize(): Promise<void> {
    console.log('[VADManager] 🔄 初始化...');

    // 注册回调
    this.vadBridge.onVadStart(() => {
      this._userSpeaking = true;
      this.emit('speech_start');
    });

    this.vadBridge.onVadEnd(() => {
      this._userSpeaking = false;
      this.emit('speech_end');
    });

    this.vadBridge.onAudioData((data) => {
      this.emit('audio_data', data);
    });

    if (this.vadBridge.onFilter) {
      this.vadBridge.onFilter((reason) => {
        this.emit('filter', reason);
      });
    }

    // 注册有效音频回调（用于立即打断 LLM）
    if (this.vadBridge.onValidAudio) {
      this.vadBridge.onValidAudio(() => {
        this.emit('valid_audio');
      });
    }

    // 注册 VAD 可能开始回调（用于 UI 展示）
    if (this.vadBridge.onVadMaybeStart) {
      this.vadBridge.onVadMaybeStart(() => {
        this.emit('maybe_speech_start');
      });
    }

    // 注册 VAD 可能结束回调（用于重置 UI 状态）
    if (this.vadBridge.onVadMaybeEnd) {
      this.vadBridge.onVadMaybeEnd(() => {
        this.emit('maybe_speech_end');
      });
    }

    // 初始化适配器
    await this.vadBridge.init();

    this._isReady = true;
    this._isListening = this.vadBridge.isListening;
    this.emit('ready');
    console.log('[VADManager] ✅ 初始化完成');
  }

  /**
   * 开始监听
   */
  start(): void {
    if (!this._isReady) {
      console.warn('[VADManager] VAD 未就绪');
      return;
    }
    this.vadBridge.start();
    this._isListening = true;
    console.log('[VADManager] ▶️ 开始监听');
  }

  /**
   * 停止监听
   */
  stop(): void {
    this.vadBridge.stop();
    this._isListening = false;
    this._userSpeaking = false;
    console.log('[VADManager] ⏸️ 停止监听');
  }

  /**
   * 暂停 VAD（别名，用于兼容）
   */
  pause(): void {
    this.stop();
  }

  /**
   * 恢复 VAD（别名，用于兼容）
   */
  resume(): void {
    this.start();
  }

  /**
   * 销毁管理器
   */
  destroy(): void {
    this.vadBridge.destroy();
    this.removeAllListeners();
    this._isReady = false;
    this._isListening = false;
    this._userSpeaking = false;
    console.log('[VADManager] ♻️ 已销毁');
  }
}
