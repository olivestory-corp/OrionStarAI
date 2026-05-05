/**
 * SpeechAudioCache - 人声音频缓存服务
 *
 * 在 VAD 检测到人声期间缓存音频数据，供声纹识别等场景使用。
 *
 * 使用方式：
 * 1. VAD 检测到语音开始时调用 startCaching()
 * 2. 语音期间调用 addAudioFrame() 添加音频帧
 * 3. VAD 检测到语音结束时调用 stopCaching()
 * 4. 需要使用时调用 getLastSpeechAudio() 获取最近一次完整的人声音频
 */

export interface SpeechAudioCacheConfig {
  /** 最大缓存时长（毫秒），超过则丢弃旧数据 */
  maxDurationMs?: number;
  /** 采样率 */
  sampleRate?: number;
}

const DEFAULT_CONFIG = {
  maxDurationMs: 30000, // 最多缓存 30 秒
  sampleRate: 16000,    // 16kHz（声纹模型通常需要）
};

export class SpeechAudioCache {
  private config: Required<SpeechAudioCacheConfig>;
  private currentBuffer: Float32Array[] = [];
  private lastCompleteSpeech: Float32Array | null = null;
  private isCaching = false;
  private enabled = false;

  constructor(config: SpeechAudioCacheConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 启用缓存功能
   */
  enable(): void {
    this.enabled = true;
    console.log('[SpeechAudioCache] ✅ 缓存已启用');
  }

  /**
   * 禁用缓存功能
   */
  disable(): void {
    this.enabled = false;
    this.clear();
    console.log('[SpeechAudioCache] ❌ 缓存已禁用');
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * 开始缓存（VAD 检测到语音开始时调用）
   */
  startCaching(): void {
    if (!this.enabled) return;
    this.isCaching = true;
    this.currentBuffer = [];
    console.log('[SpeechAudioCache] 🎤 开始缓存语音');
  }

  /**
   * 添加音频帧
   */
  addAudioFrame(frame: Float32Array): void {
    if (!this.enabled || !this.isCaching) return;

    this.currentBuffer.push(new Float32Array(frame));

    // 检查是否超过最大时长
    const totalSamples = this.currentBuffer.reduce((sum, f) => sum + f.length, 0);
    const maxSamples = (this.config.maxDurationMs / 1000) * this.config.sampleRate;

    if (totalSamples > maxSamples) {
      while (this.currentBuffer.length > 0) {
        const currentTotal = this.currentBuffer.reduce((sum, f) => sum + f.length, 0);
        if (currentTotal <= maxSamples) break;
        this.currentBuffer.shift();
      }
    }
  }

  /**
   * 停止缓存
   */
  stopCaching(): void {
    if (!this.enabled) return;

    if (this.isCaching && this.currentBuffer.length > 0) {
      const totalLength = this.currentBuffer.reduce((sum, f) => sum + f.length, 0);
      this.lastCompleteSpeech = new Float32Array(totalLength);

      let offset = 0;
      for (const frame of this.currentBuffer) {
        this.lastCompleteSpeech.set(frame, offset);
        offset += frame.length;
      }

      const durationMs = (totalLength / this.config.sampleRate) * 1000;
      console.log(`[SpeechAudioCache] 💾 语音缓存完成: ${(durationMs / 1000).toFixed(2)}s`);
    }

    this.isCaching = false;
    this.currentBuffer = [];
  }

  /**
   * 获取最近一次完整的人声音频
   */
  getLastSpeechAudio(): Float32Array | null {
    return this.lastCompleteSpeech;
  }

  /**
   * 获取最近一次语音的时长（毫秒）
   */
  getLastSpeechDuration(): number {
    if (!this.lastCompleteSpeech) return 0;
    return (this.lastCompleteSpeech.length / this.config.sampleRate) * 1000;
  }

  hasAudio(): boolean {
    return this.lastCompleteSpeech !== null && this.lastCompleteSpeech.length > 0;
  }

  clear(): void {
    this.currentBuffer = [];
    this.lastCompleteSpeech = null;
    this.isCaching = false;
  }

  getConfig(): Required<SpeechAudioCacheConfig> {
    return { ...this.config };
  }

  setSampleRate(sampleRate: number): void {
    this.config.sampleRate = sampleRate;
  }
}

// 导出单例
export const speechAudioCache = new SpeechAudioCache();
