/**
 * AudioManager - 音频管理器
 * 整合编码器、解码器和播放器
 */

import { EventEmitter } from 'events';
import { IAudioPlayerBridge } from '../types';
import { OpusEncoder } from './OpusEncoder';
import { OpusDecoder } from './OpusDecoder';
import { WebAudioPlayer } from './WebAudioPlayer';

export interface AudioManagerConfig {
  sampleRate?: number;
  audioPlayer?: IAudioPlayerBridge;
}

/**
 * 音频管理器
 *
 * Events:
 * - 'playing_change': boolean
 * - 'progress': { playedSamples, totalSamples }
 * - 'volume_change': number
 */
export class AudioManager extends EventEmitter {
  private encoder: OpusEncoder;
  private decoder: OpusDecoder;
  private player: IAudioPlayerBridge;
  private readonly sampleRate: number;

  private _volume = 1.0;
  private _isPlaying = false;

  // 字幕相关
  private subtitleText = '';
  private subtitleProgress = 0;
  private totalAudioSamples = 0;

  constructor(config: AudioManagerConfig = {}) {
    super();
    this.sampleRate = config.sampleRate ?? 48000;
    this.encoder = new OpusEncoder();
    this.decoder = new OpusDecoder();
    this.player = config.audioPlayer ?? new WebAudioPlayer(this.sampleRate);
  }

  /**
   * 初始化音频管理器
   */
  async initialize(): Promise<void> {
    await Promise.all([
      this.encoder.initialize(),
      this.decoder.initialize(),
      this.player.init(),
    ]);

    // 设置解码回调 -> 播放
    this.decoder.setOnDecoded((pcmData, turnId) => {
      this.totalAudioSamples += pcmData.length;
      this.player.play(pcmData, turnId);
    });

    // 设置播放器回调
    this.player.onPlaybackProgress?.((played, total) => {
      if (this.totalAudioSamples > 0) {
        this.subtitleProgress = Math.min(played / this.totalAudioSamples, 1);
        this.emit('progress', { playedSamples: played, totalSamples: this.totalAudioSamples });
      }
    });

    this.player.onPlayingChange?.((isPlaying) => {
      this._isPlaying = isPlaying;
      this.emit('playing_change', isPlaying);
    });

    console.log('[AudioManager] ✅ 初始化完成');
  }

  // ==================== 播放控制 ====================

  get isPlaying(): boolean {
    return this._isPlaying;
  }

  get volume(): number {
    return this._volume;
  }

  /**
   * 设置音量
   */
  setVolume(value: number): void {
    this._volume = Math.max(0, Math.min(1, value));
    this.player.setVolume(this._volume);
    this.emit('volume_change', this._volume);
  }

  /**
   * 播放 Float32 PCM 数据
   */
  playAudioFloat32(data: Float32Array, turnId?: number): void {
    this.totalAudioSamples += data.length;
    this.player.play(data, turnId ?? 0);
  }

  /**
   * 停止播放
   */
  stopAudio(newTurnId?: number): void {
    console.log(`[AudioManager] 🛑 停止音频, newTurnId: ${newTurnId}`);

    // 清除字幕
    this.subtitleText = '';
    this.subtitleProgress = 0;
    this.totalAudioSamples = 0;
    this.player.resetProgress();

    // 清空解码器
    this.decoder.clear();
    if (newTurnId !== undefined) {
      this.decoder.setMinValidTurnId(newTurnId);
    }

    // 停止播放器
    this.player.stop(newTurnId);
  }

  /**
   * 刷新缓冲区
   */
  flushBuffer(): void {
    this.player.flush();
  }

  // ==================== 编码控制 ====================

  /**
   * 编码 PCM 数据
   */
  encodePCM(pcmData: Float32Array): void {
    this.encoder.encode(pcmData);
  }

  /**
   * 获取编码后的 Opus 帧
   */
  getEncodedFrames(): string[] {
    return this.encoder.getFrames();
  }

  /**
   * 刷新编码器
   */
  async flushEncoder(): Promise<void> {
    await this.encoder.flush();
  }

  /**
   * 开始保留模式
   */
  startRetentionMode(): void {
    this.encoder.startRetentionMode();
  }

  /**
   * 停止保留模式
   */
  stopRetentionMode(): void {
    this.encoder.stopRetentionMode();
  }

  /**
   * 清空编码器队列
   */
  clearEncoderQueue(): void {
    this.encoder.clearQueue();
  }

  // ==================== 解码控制 ====================

  /**
   * 解码 Opus 数据
   */
  decodeOpus(opusBase64: string, turnId: number = 0): void {
    this.decoder.decode(opusBase64, turnId);
  }

  /**
   * 刷新解码器
   */
  async flushDecoder(): Promise<void> {
    await this.decoder.flush();
  }

  // ==================== 字幕相关 ====================

  get currentSubtitleText(): string {
    return this.subtitleText;
  }

  get currentSubtitleProgress(): number {
    return this.subtitleProgress;
  }

  /**
   * 设置字幕文本
   */
  setSubtitleText(text: string): void {
    this.subtitleText = text;
  }

  /**
   * 追加字幕文本
   */
  appendSubtitleText(text: string): void {
    this.subtitleText += text;
  }

  /**
   * 重置播放进度
   */
  resetPlaybackProgress(): void {
    this.totalAudioSamples = 0;
    this.subtitleProgress = 0;
    this.player.resetProgress();
  }

  // ==================== 生命周期 ====================

  /**
   * 销毁管理器
   */
  destroy(): void {
    this.encoder.destroy();
    this.decoder.destroy();
    this.player.destroy();
    this.removeAllListeners();
    console.log('[AudioManager] ♻️ 已销毁');
  }
}
