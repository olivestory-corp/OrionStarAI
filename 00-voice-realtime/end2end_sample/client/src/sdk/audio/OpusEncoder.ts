/**
 * OpusEncoder - Opus 编码器
 * 纯 TypeScript 实现，使用 WebCodecs API
 *
 * 从 core/audio/opusEncoder.ts 迁移，移除 React 依赖
 */

export class OpusEncoder {
  private encoder: AudioEncoder | null = null;
  private isInitialized = false;
  private readonly inputSampleRate = 48000;
  private readonly encoderSampleRate = 48000;
  private readonly channels = 1;
  private readonly frameSize = 960; // 20ms @ 48kHz

  // 编码输出队列
  private queue: ArrayBuffer[] = [];
  private readonly frameDurationMs = 20;
  private readonly maxQueueFrames = Math.ceil(800 / 20); // 500ms

  // 队列模式
  private autoCleanup = true;

  // 音频缓冲区
  private audioBuffer: Float32Array = new Float32Array(0);

  // 时间戳追踪
  private currentTimestamp = 0;
  private readonly frameDurationUs = (960 / 48000) * 1000000;

  // 淡入控制
  private shouldFadeIn = false;
  private readonly fadeInDurationSamples = 2400; // 50ms @ 48kHz

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    if (typeof AudioEncoder === 'undefined') {
      throw new Error('WebCodecs API 不支持（需要 Chrome 94+）');
    }

    const encConfig = {
      codec: 'opus',
      sampleRate: this.encoderSampleRate,
      numberOfChannels: this.channels,
      bitrate: 24000,
    };

    const encSupport = await AudioEncoder.isConfigSupported(encConfig);
    if (!encSupport.supported) {
      throw new Error('浏览器不支持 Opus 编码');
    }

    this.encoder = new AudioEncoder({
      output: (chunk) => {
        const buffer = new ArrayBuffer(chunk.byteLength);
        chunk.copyTo(buffer);
        this.queue.push(buffer);

        if (this.autoCleanup && this.queue.length > this.maxQueueFrames) {
          this.queue.shift();
        }
      },
      error: (e) => {
        console.error('[OpusEncoder] ❌ 编码错误:', e);
      }
    });

    this.encoder.configure(encConfig);
    this.isInitialized = true;
    console.log('[OpusEncoder] ✅ 初始化成功');
  }

  /**
   * 编码 PCM 数据
   * @param pcmData Float32Array PCM 数据 (48kHz)
   */
  encode(pcmData: Float32Array): void {
    if (!this.isInitialized || !this.encoder) {
      console.error('[OpusEncoder] 编码器未初始化');
      return;
    }

    // 淡入效果
    if (this.shouldFadeIn) {
      const samplesToFade = Math.min(pcmData.length, this.fadeInDurationSamples);
      for (let i = 0; i < samplesToFade; i++) {
        pcmData[i] *= i / samplesToFade;
      }
      this.shouldFadeIn = false;
    }

    // 追加到缓冲区
    const newBuffer = new Float32Array(this.audioBuffer.length + pcmData.length);
    newBuffer.set(this.audioBuffer);
    newBuffer.set(pcmData, this.audioBuffer.length);
    this.audioBuffer = newBuffer;

    // 处理完整帧
    while (this.audioBuffer.length >= this.frameSize) {
      const frame = this.audioBuffer.slice(0, this.frameSize);
      this.audioBuffer = this.audioBuffer.slice(this.frameSize);

      const audioData = new AudioData({
        format: 'f32-planar',
        sampleRate: this.encoderSampleRate,
        numberOfFrames: this.frameSize,
        numberOfChannels: this.channels,
        timestamp: this.currentTimestamp,
        data: frame,
      });

      this.currentTimestamp += this.frameDurationUs;
      this.encoder.encode(audioData);
      audioData.close();
    }
  }

  /**
   * 启用保留模式（停止自动清理）
   */
  startRetentionMode(): void {
    this.autoCleanup = false;
  }

  /**
   * 恢复自动清理模式
   */
  stopRetentionMode(): void {
    this.autoCleanup = true;
    while (this.queue.length > this.maxQueueFrames) {
      this.queue.shift();
    }
  }

  /**
   * 清空队列和缓冲区
   */
  clearQueue(): void {
    this.queue = [];
    this.audioBuffer = new Float32Array(0);
    this.shouldFadeIn = true;
    console.log('[OpusEncoder] 队列已清空');
  }

  /**
   * 获取所有可用帧（Base64 格式）
   */
  getFrames(): string[] {
    if (this.queue.length === 0) return [];

    const frames: string[] = [];
    while (this.queue.length > 0) {
      const buffer = this.queue.shift()!;
      frames.push(this.arrayBufferToBase64(buffer));
    }
    return frames;
  }

  /**
   * 获取队列信息
   */
  getQueueInfo(): { frameCount: number; durationMs: number; autoCleanup: boolean } {
    return {
      frameCount: this.queue.length,
      durationMs: this.queue.length * this.frameDurationMs,
      autoCleanup: this.autoCleanup
    };
  }

  /**
   * 刷新编码器
   */
  async flush(): Promise<void> {
    if (!this.encoder) return;
    await this.encoder.flush();
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const uint8Array = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    return btoa(binary);
  }

  destroy(): void {
    if (this.encoder) {
      this.encoder.close();
      this.encoder = null;
    }
    this.queue = [];
    this.audioBuffer = new Float32Array(0);
    this.currentTimestamp = 0;
    this.autoCleanup = true;
    this.isInitialized = false;
  }
}
