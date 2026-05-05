/**
 * OpusDecoder - Opus 解码器
 * 纯 TypeScript 实现，使用 WebCodecs API
 *
 * 从 core/audio/opusDecoder.ts 迁移，移除 React 依赖
 */

export class OpusDecoder {
  private decoder: AudioDecoder | null = null;
  private isInitialized = false;
  private readonly sampleRate = 48000;
  private readonly channels = 1;

  // 最小有效 turnId
  private minValidTurnId: number = 0;

  // 解码完成回调
  private onDecoded: ((pcmData: Float32Array, turnId: number) => void) | null = null;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    if (typeof AudioDecoder === 'undefined') {
      throw new Error('WebCodecs API 不支持（需要 Chrome 94+）');
    }

    const decConfig = {
      codec: 'opus',
      sampleRate: this.sampleRate,
      numberOfChannels: this.channels,
    };

    const decSupport = await AudioDecoder.isConfigSupported(decConfig);
    if (!decSupport.supported) {
      throw new Error('浏览器不支持 Opus 解码');
    }

    this.decoder = new AudioDecoder({
      output: (audioData) => {
        try {
          const turnId = audioData.timestamp;

          // 检查 turnId 是否有效
          if (turnId < this.minValidTurnId) {
            console.log(`[OpusDecoder] 🚫 丢弃过期音频, turnId: ${turnId}, minValid: ${this.minValidTurnId}`);
            audioData.close();
            return;
          }

          const frames = audioData.numberOfFrames;
          const channels = audioData.numberOfChannels;

          const pcmData = new Float32Array(frames * channels);
          audioData.copyTo(pcmData, { planeIndex: 0 });
          audioData.close();

          if (this.onDecoded) {
            this.onDecoded(pcmData, turnId);
          }
        } catch (error) {
          console.error('[OpusDecoder] ❌ 提取 PCM 失败:', error);
        }
      },
      error: (error) => {
        console.error('[OpusDecoder] ❌ 解码错误:', error);
      },
    });

    this.decoder.configure(decConfig);
    this.isInitialized = true;
    console.log('[OpusDecoder] ✅ 初始化成功');
  }

  /**
   * 设置解码完成回调
   */
  setOnDecoded(callback: (pcmData: Float32Array, turnId: number) => void): void {
    this.onDecoded = callback;
  }

  /**
   * 解码 Opus 数据
   * @param opusBase64 Opus Base64 数据
   * @param turnId Turn ID（用于打断过滤）
   */
  decode(opusBase64: string, turnId: number = 0): void {
    if (!this.isInitialized || !this.decoder) {
      console.error('[OpusDecoder] ❌ 解码器未初始化');
      return;
    }

    try {
      const opusData = this.base64ToArrayBuffer(opusBase64);

      const chunk = new EncodedAudioChunk({
        type: 'key',
        timestamp: turnId,
        data: opusData,
      });

      this.decoder.decode(chunk);
    } catch (error) {
      console.error('[OpusDecoder] ❌ 解码失败:', error);
    }
  }

  /**
   * 设置最小有效 turnId
   */
  setMinValidTurnId(turnId: number): void {
    console.log(`[OpusDecoder] 🔄 设置最小有效 turnId: ${turnId}`);
    this.minValidTurnId = turnId;
  }

  /**
   * 刷新解码器
   */
  async flush(): Promise<void> {
    if (!this.decoder) return;
    await this.decoder.flush();
  }

  /**
   * 清空解码器（打断时调用）
   */
  async clear(): Promise<void> {
    if (!this.decoder) return;

    try {
      console.log('[OpusDecoder] 🧹 清空解码器...');
      this.decoder.reset();
      this.decoder.configure({
        codec: 'opus',
        sampleRate: this.sampleRate,
        numberOfChannels: this.channels,
      });
    } catch (error) {
      console.error('[OpusDecoder] ❌ clear 失败:', error);
    }
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  destroy(): void {
    if (this.decoder) {
      this.decoder.close();
      this.decoder = null;
    }
    this.onDecoded = null;
    this.isInitialized = false;
  }
}
