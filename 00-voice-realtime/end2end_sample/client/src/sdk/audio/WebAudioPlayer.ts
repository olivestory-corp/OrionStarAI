/**
 * WebAudioPlayer - Web Audio API 播放器
 * 纯 TypeScript 实现，作为 IAudioPlayerBridge 的默认实现
 */

import { IAudioPlayerBridge } from '../types';

export class WebAudioPlayer implements IAudioPlayerBridge {
  private audioContext: AudioContext | null = null;
  private audioWorkletNode: AudioWorkletNode | null = null;
  private gainNode: GainNode | null = null;
  private workletInitialized = false;
  private initializingWorklet = false;

  private _isPlaying = false;
  private _volume = 1.0;
  private readonly sampleRate: number;

  // 进度追踪
  private totalQueuedSamples = 0;
  private playedSamples = 0;
  private minValidTurnId = 0;

  // 回调
  private onProgressCallback: ((played: number, total: number) => void) | null = null;
  private onPlayingChangeCallback: ((isPlaying: boolean) => void) | null = null;

  constructor(sampleRate: number = 48000) {
    this.sampleRate = sampleRate;
  }

  get isPlaying(): boolean {
    return this._isPlaying;
  }

  get volume(): number {
    return this._volume;
  }

  async init(): Promise<void> {
    await this.initAudioContext();
    await this.initAudioWorklet();
    console.log('[WebAudioPlayer] ✅ 初始化完成');
  }

  private async initAudioContext(): Promise<void> {
    if (!this.audioContext) {
      this.audioContext = new AudioContext({ sampleRate: this.sampleRate });
      console.log(`[WebAudioPlayer] 🎵 AudioContext 创建: ${this.sampleRate}Hz`);
    }
  }

  private async initAudioWorklet(): Promise<AudioWorkletNode | null> {
    if (this.audioWorkletNode) return this.audioWorkletNode;
    if (this.initializingWorklet) {
      while (this.initializingWorklet) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      return this.audioWorkletNode;
    }

    this.initializingWorklet = true;

    try {
      await this.initAudioContext();

      if (!this.workletInitialized && this.audioContext!.state !== 'closed') {
        const baseUrl = typeof window !== 'undefined'
          ? window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'))
          : '';
        const workletUrl = `${baseUrl}/audio-stream-processor.js`;

        await this.audioContext!.audioWorklet.addModule(workletUrl);
        this.workletInitialized = true;
      }

      const workletNode = new AudioWorkletNode(this.audioContext!, 'audio-stream-processor');

      workletNode.port.onmessage = (event) => {
        if (event.data.type === 'queue-status') {
          if (event.data.queueLength === 0) {
            this.setPlaying(false);
          }
        } else if (event.data.type === 'playback-progress') {
          this.playedSamples = event.data.playedSamples;
          this.onProgressCallback?.(this.playedSamples, this.totalQueuedSamples);
        }
      };

      const gainNode = this.audioContext!.createGain();
      gainNode.gain.value = this._volume;
      this.gainNode = gainNode;

      workletNode.connect(gainNode);
      gainNode.connect(this.audioContext!.destination);

      this.audioWorkletNode = workletNode;
      return workletNode;
    } catch (error) {
      console.error('[WebAudioPlayer] ❌ AudioWorklet 初始化失败:', error);
      return null;
    } finally {
      this.initializingWorklet = false;
    }
  }

  async play(data: Float32Array, turnId: number = 0): Promise<void> {
    if (data.length === 0) return;

    // 检查 turnId
    if (turnId < this.minValidTurnId) {
      console.log(`[WebAudioPlayer] 🚫 丢弃过期音频, turnId: ${turnId}`);
      return;
    }

    const workletNode = await this.initAudioWorklet();
    if (!workletNode) return;

    // 再次检查（await 期间可能发生 stop）
    if (turnId < this.minValidTurnId) return;

    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    if (turnId < this.minValidTurnId) return;

    this.setPlaying(true);
    this.totalQueuedSamples += data.length;

    workletNode.port.postMessage({
      type: 'audio-data',
      audioData: data
    });
  }

  stop(newTurnId?: number): void {
    console.log(`[WebAudioPlayer] 🛑 停止播放, newTurnId: ${newTurnId}`);

    if (newTurnId !== undefined) {
      this.minValidTurnId = newTurnId;
    }

    this.setPlaying(false);
    this.totalQueuedSamples = 0;
    this.playedSamples = 0;

    if (this.audioWorkletNode) {
      this.audioWorkletNode.port.postMessage({ type: 'clear' });
    }

    if (this.audioContext && this.audioContext.state === 'running') {
      this.audioContext.suspend().catch(e => console.warn('[WebAudioPlayer] suspend 失败:', e));
    }
  }

  flush(): void {
    // WebAudioPlayer 无需 flush
  }

  setVolume(volume: number): void {
    this._volume = Math.max(0, Math.min(1, volume));
    if (this.gainNode) {
      this.gainNode.gain.value = this._volume;
      console.log(`[WebAudioPlayer] 🔊 音量: ${(this._volume * 100).toFixed(0)}%`);
    }
  }

  resetProgress(): void {
    this.totalQueuedSamples = 0;
    this.playedSamples = 0;
    if (this.audioWorkletNode) {
      this.audioWorkletNode.port.postMessage({ type: 'reset-progress' });
    }
  }

  onPlaybackProgress(callback: (played: number, total: number) => void): void {
    this.onProgressCallback = callback;
  }

  onPlayingChange(callback: (isPlaying: boolean) => void): void {
    this.onPlayingChangeCallback = callback;
  }

  private setPlaying(playing: boolean): void {
    if (this._isPlaying !== playing) {
      this._isPlaying = playing;
      this.onPlayingChangeCallback?.(playing);
    }
  }

  destroy(): void {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.audioWorkletNode = null;
    this.gainNode = null;
    this.workletInitialized = false;
    this._isPlaying = false;
  }
}
