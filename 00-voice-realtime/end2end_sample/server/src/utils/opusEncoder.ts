import { OpusEncoder } from '@discordjs/opus';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Opus 编码器封装 - Server 端 (Server → Client)
 *
 * 用途：将 Gemini 返回的 PCM 24kHz 编码为 Opus 格式
 * 输入：PCM 24kHz Base64 (Int16)
 * 输出：Opus Base64
 */
export class OpusEncoderWrapper {
  private encoder: OpusEncoder;
  private readonly sampleRate = 24000; // Gemini 输出采样率
  private readonly channels = 1;
  private readonly frameSize = 480; // 20ms @ 24kHz = 480 samples
  private readonly bitrate = 16000; // 64 kbps - 高质量语音

  // 音频缓冲区：累积音频样本到 frameSize 才编码
  private audioBuffer: Buffer = Buffer.alloc(0);

  // Debug: 保存编码后的Opus数据
  private debugOpusData: Buffer[] = [];
  private debugEnabled = true;
  private sessionId: string;

  // 🆕 Turn-ID 追踪
  private currentTurnId: string | null = null;

  constructor() {
    this.encoder = new OpusEncoder(this.sampleRate, this.channels);
    this.sessionId = Date.now().toString();

    // 确保 debug 目录存在
    const debugDir = path.join(__dirname, '../../debug');
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }

    console.log('[OpusEncoder] ✅ Server→Client 编码器创建成功');
    console.log(`[OpusEncoder] 配置: ${this.sampleRate}Hz, ${this.channels}ch, ${this.bitrate}bps`);
    console.log(`[OpusEncoder] Session ID: ${this.sessionId}`);
  }

  /**
   * 设置当前 Turn-ID
   */
  setTurnId(turnId: string): void {
    this.currentTurnId = turnId;
  }

  /**
   * 编码 PCM 数据为 Opus
   *
   * @param pcmBase64 - PCM 24kHz Base64 (Int16)
   * @returns Opus Base64，如果缓冲区未满返回 null
   */
  encode(pcmBase64: string): string | null {
    try {
      // Base64 → Buffer (Int16)
      const pcmBuffer = Buffer.from(pcmBase64, 'base64');

      // 追加到缓冲区
      this.audioBuffer = Buffer.concat([this.audioBuffer, pcmBuffer]);

      // 检查是否有完整帧（frameSize * 2 bytes per sample）
      const frameSizeBytes = this.frameSize * 2;

      if (this.audioBuffer.length < frameSizeBytes) {
        // 缓冲区不足一帧，返回 null
        return null;
      }

      // 提取一帧数据
      const frameBuffer = this.audioBuffer.slice(0, frameSizeBytes);
      this.audioBuffer = this.audioBuffer.slice(frameSizeBytes);

      // 编码为 Opus（@discordjs/opus 的 encode 方法只需要一个 Buffer 参数）
      const opusData = this.encoder.encode(frameBuffer);

      if (!opusData || opusData.length === 0) {
        console.error(`[OpusEncoder] ❌ 编码返回空数据 (Turn: ${this.currentTurnId})`);
        return null;
      }

      // Debug: 保存编码后的Opus数据
      if (this.debugEnabled) {
        this.debugOpusData.push(opusData);
      }

      // 转 Base64
      return opusData.toString('base64');
    } catch (error) {
      console.error('[OpusEncoder] 编码失败:', error);
      return null;
    }
  }

  /**
   * 刷新剩余的缓冲数据
   * 在音频流结束时调用
   *
   * @returns 编码后的 Opus Base64 数组
   */
  flush(): string[] {
    const results: string[] = [];
    const frameSizeBytes = this.frameSize * 2;

    // 编码所有完整帧
    while (this.audioBuffer.length >= frameSizeBytes) {
      const frameBuffer = this.audioBuffer.slice(0, frameSizeBytes);
      this.audioBuffer = this.audioBuffer.slice(frameSizeBytes);

      try {
        const opusData = this.encoder.encode(frameBuffer);
        if (opusData && opusData.length > 0) {
          // Debug: 保存编码后的Opus数据
          if (this.debugEnabled) {
            this.debugOpusData.push(opusData);
          }
          results.push(opusData.toString('base64'));
        }
      } catch (error) {
        console.error('[OpusEncoder] flush 编码失败:', error);
      }
    }

    // 保留不足一帧的数据，等待后续数据到来
    if (this.audioBuffer.length > 0) {
      const remainingSamples = this.audioBuffer.length / 2;
      const remainingMs = (remainingSamples / this.sampleRate) * 1000;
      //console.log(`[OpusEncoder] flush 保留不足一帧的数据: ${remainingSamples} samples (${remainingMs.toFixed(1)}ms)`);
    }

    if (results.length > 0) {
      //console.log(`[OpusEncoder] flush 完成，编码 ${results.length} 帧`);
    }

    return results;
  }

  /**
   * 获取当前缓冲区状态
   */
  getBufferInfo() {
    return {
      bufferedBytes: this.audioBuffer.length,
      bufferedSamples: this.audioBuffer.length / 2,
      bufferedMs: (this.audioBuffer.length / 2 / this.sampleRate) * 1000
    };
  }

  /**
   * 清空缓冲区 (用于打断)
   */
  clear(): void {
    const bufferedMs = (this.audioBuffer.length / 2 / this.sampleRate) * 1000;
    if (bufferedMs > 0) {
      console.log(`[OpusEncoder] 🧹 清空缓冲区: ${bufferedMs.toFixed(1)}ms 数据`);
    }
    this.audioBuffer = Buffer.alloc(0);
  }

  /**
   * 清理资源
   */
  close() {
    // 保存调试文件
    if (this.debugEnabled && this.debugOpusData.length > 0) {
      this.saveDebugAudio();
    }

    this.audioBuffer = Buffer.alloc(0);
    console.log('[OpusEncoder] 编码器已关闭');
  }

  /**
   * 保存调试音频文件
   */
  private saveDebugAudio() {
    try {
      // 合并所有Opus数据
      const totalFrames = this.debugOpusData.length;
      const totalBytes = this.debugOpusData.reduce((sum, buf) => sum + buf.length, 0);

      console.log(`[OpusEncoder] 💾 保存调试音频: ${totalFrames} frames, ${totalBytes} bytes`);

      // 创建 OGG/Opus 文件
      const oggBuffer = this.createOggOpusFile(this.debugOpusData);

      // 保存到 debug 目录
      const debugDir = path.join(__dirname, '../../debug');
      const filename = `server_output_${this.sessionId}.ogg`;
      const filepath = path.join(debugDir, filename);

      fs.writeFileSync(filepath, oggBuffer);
      console.log(`[OpusEncoder] ✅ 调试音频已保存: ${filepath}`);

      // 清空调试数据
      this.debugOpusData = [];
    } catch (error) {
      console.error('[OpusEncoder] ❌ 保存调试音频失败:', error);
    }
  }

  /**
   * 创建 OGG/Opus 文件
   * 简化版 OGG 容器，包含 Opus 音频流
   */
  private createOggOpusFile(opusFrames: Buffer[]): Buffer {
    const buffers: Buffer[] = [];
    let granulePosition = 0;
    const serialNumber = Math.floor(Math.random() * 0xFFFFFFFF);
    let sequenceNumber = 0;

    // OpusHead 头（识别头）
    const opusHead = Buffer.alloc(19);
    opusHead.write('OpusHead', 0, 'ascii');
    opusHead.writeUInt8(1, 8); // Version
    opusHead.writeUInt8(this.channels, 9); // Channel count
    opusHead.writeUInt16LE(0, 10); // Pre-skip
    opusHead.writeUInt32LE(this.sampleRate, 12); // Input sample rate
    opusHead.writeUInt16LE(0, 16); // Output gain
    opusHead.writeUInt8(0, 18); // Channel mapping family

    buffers.push(this.createOggPage(opusHead, 0, serialNumber, sequenceNumber++, true, false));

    // OpusTags 头（注释头）
    const vendor = 'OpusEncoderWrapper';
    const opusTags = Buffer.alloc(8 + 4 + vendor.length + 4);
    opusTags.write('OpusTags', 0, 'ascii');
    opusTags.writeUInt32LE(vendor.length, 8);
    opusTags.write(vendor, 12, 'ascii');
    opusTags.writeUInt32LE(0, 12 + vendor.length); // User comment list length

    buffers.push(this.createOggPage(opusTags, 0, serialNumber, sequenceNumber++, false, false));

    // 音频数据页
    opusFrames.forEach((frame, index) => {
      // 每帧 20ms @ 24kHz = 480 samples
      granulePosition += 480;
      const isLast = index === opusFrames.length - 1;

      buffers.push(this.createOggPage(frame, granulePosition, serialNumber, sequenceNumber++, false, isLast));
    });

    return Buffer.concat(buffers);
  }

  /**
   * 创建 OGG 页
   */
  private createOggPage(
    payload: Buffer,
    granulePosition: number,
    serialNumber: number,
    sequenceNumber: number,
    isBOS: boolean,
    isEOS: boolean
  ): Buffer {
    const headerType = (isBOS ? 0x02 : 0) | (isEOS ? 0x04 : 0);
    const segments = Math.ceil(payload.length / 255);
    const segmentTable = Buffer.alloc(segments);

    for (let i = 0; i < segments - 1; i++) {
      segmentTable[i] = 255;
    }
    segmentTable[segments - 1] = payload.length % 255;

    const header = Buffer.alloc(27 + segments);

    // OGG 页头
    header.write('OggS', 0, 'ascii'); // Capture pattern
    header.writeUInt8(0, 4); // Version
    header.writeUInt8(headerType, 5); // Header type
    header.writeBigUInt64LE(BigInt(granulePosition), 6); // Granule position
    header.writeUInt32LE(serialNumber, 14); // Serial number
    header.writeUInt32LE(sequenceNumber, 18); // Sequence number
    header.writeUInt32LE(0, 22); // CRC (暂时为0，后面计算)
    header.writeUInt8(segments, 26); // Segment count

    // Segment table
    segmentTable.copy(header, 27);

    // 计算 CRC
    const page = Buffer.concat([header, payload]);
    const crc = this.calculateCRC(page);
    page.writeUInt32LE(crc, 22);

    return page;
  }

  /**
   * 计算 OGG CRC32
   */
  private calculateCRC(data: Buffer): number {
    const crcTable = this.getCRCTable();
    let crc = 0;

    for (let i = 0; i < data.length; i++) {
      crc = (crc << 8) ^ crcTable[((crc >>> 24) ^ data[i]) & 0xFF];
    }

    return crc >>> 0;
  }

  /**
   * 获取 CRC 表
   */
  private getCRCTable(): number[] {
    const table: number[] = [];
    for (let i = 0; i < 256; i++) {
      let r = i << 24;
      for (let j = 0; j < 8; j++) {
        r = (r & 0x80000000) ? ((r << 1) ^ 0x04c11db7) : (r << 1);
      }
      table[i] = r >>> 0;
    }
    return table;
  }
}
