import { OpusEncoder } from '@discordjs/opus';
import fs from 'fs';
import path from 'path';

/**
 * Opus 解码器封装 - 使用 @discordjs/opus
 */
export class OpusDecoderWrapper {
  private decoder: OpusEncoder;
  private readonly sampleRate = 48000; // ⚠️ WebCodecs Opus 编码器固定输出 48kHz！
  private readonly channels = 1;

  private opusPackets: Buffer[] = []; // 存储原始 Opus 包用于封装 OGG
  private oggFilePath: string = '';

  // 🆕 保存解码后的 PCM 数据
  private pcmPackets: Buffer[] = []; // 存储解码后的 PCM 48kHz
  private pcm16kPackets: Buffer[] = []; // 存储重采样后的 PCM 16kHz
  private pcmFilePath: string = '';
  private pcm16kFilePath: string = '';

  // 🆕 Turn-ID 追踪
  private currentTurnId: string | null = null;

  constructor() {
    this.decoder = new OpusEncoder(this.sampleRate, this.channels);
    console.log('[OpusDecoder] ✅ 解码器创建成功 (使用 @discordjs/opus)');
  }

  /**
   * 设置当前 Turn-ID
   */
  setTurnId(turnId: string): void {
    this.currentTurnId = turnId;
  }

  initializeDebugFile(sessionId: string) {
    const debugDir = path.join(__dirname, '../../debug');
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.oggFilePath = path.join(debugDir, `audio_${sessionId}_${timestamp}.ogg`);
    this.pcmFilePath = path.join(debugDir, `pcm_48k_${sessionId}_${timestamp}.raw`);
    this.pcm16kFilePath = path.join(debugDir, `pcm_16k_${sessionId}_${timestamp}.raw`);

    console.log(`[OpusDecoder] 将保存 OGG 文件: ${this.oggFilePath}`);
    console.log(`[OpusDecoder] 将保存 PCM 48kHz: ${this.pcmFilePath}`);
    console.log(`[OpusDecoder] 将保存 PCM 16kHz: ${this.pcm16kFilePath}`);
  }

  decode(opusBase64: string): string | null {
    try {
      // Base64 → Buffer
      const opusData = Buffer.from(opusBase64, 'base64');

      // 保存到内存用于 OGG 封装
      this.opusPackets.push(Buffer.from(opusData));

      // 解码 - @discordjs/opus 解码为 48kHz PCM
      const pcmBuffer48k = this.decoder.decode(opusData);

      if (!pcmBuffer48k || pcmBuffer48k.length === 0) {
        console.error(`[OpusDecoder] ❌ 解码返回空数据 (Turn: ${this.currentTurnId})`);
        return null;
      }

      // 🆕 保存解码后的 PCM 48kHz
      this.pcmPackets.push(Buffer.from(pcmBuffer48k));

      // 重采样：48000 Hz → 16000 Hz
      const pcmBuffer16k = this.resample48kTo16k(pcmBuffer48k);

      // 🆕 保存重采样后的 PCM 16kHz
      this.pcm16kPackets.push(Buffer.from(pcmBuffer16k));

      // 转 Base64（发送 16kHz 数据给 LLM）
      return pcmBuffer16k.toString('base64');
    } catch (error) {
      console.error(`[OpusDecoder] 解码失败 (Turn: ${this.currentTurnId}):`, error);
      return null;
    }
  }

  /**
   * 重采样：48000 Hz → 16000 Hz (3:1 降采样)
   *
   * 方法：低通滤波 + 抽取（防止混叠）
   * - 使用简单的 3 点移动平均低通滤波器
   * - 截止频率约 8kHz（16kHz 采样率的奈奎斯特频率）
   */
  private resample48kTo16k(buffer48k: Buffer): Buffer {
    const samples48k = buffer48k.length / 2; // Int16
    const samples16k = Math.floor(samples48k / 3);

    // 转换为 Int16 数组便于处理
    const input = new Int16Array(samples48k);
    for (let i = 0; i < samples48k; i++) {
      input[i] = buffer48k.readInt16LE(i * 2);
    }

    // 输出数组
    const output = new Int16Array(samples16k);

    // 简单 3 点移动平均低通滤波器（抗混叠）
    // 系数：[0.25, 0.5, 0.25] - 截止频率约为采样率的 1/6
    for (let i = 0; i < samples16k; i++) {
      const srcIdx = i * 3;

      // 防止越界
      if (srcIdx >= samples48k) break;

      // 低通滤波：加权平均
      let sum = 0;
      let weight = 0;

      // 中心样本
      sum += input[srcIdx] * 0.5;
      weight += 0.5;

      // 左边样本
      if (srcIdx > 0) {
        sum += input[srcIdx - 1] * 0.25;
        weight += 0.25;
      }

      // 右边样本
      if (srcIdx + 1 < samples48k) {
        sum += input[srcIdx + 1] * 0.25;
        weight += 0.25;
      }

      // 归一化并四舍五入
      output[i] = Math.round(sum / weight);
    }

    // 转换回 Buffer
    const buffer16k = Buffer.alloc(samples16k * 2);
    for (let i = 0; i < samples16k; i++) {
      buffer16k.writeInt16LE(output[i], i * 2);
    }

    return buffer16k;
  }

  close() {
    // 封装原始 Opus 帧为可播放的 Ogg 格式
    if (this.opusPackets.length > 0) {
      this.convertToOggOpus();
    }

    // 🆕 保存 PCM 数据
    if (this.pcmPackets.length > 0) {
      this.savePCMData();
    }
  }

  /**
   * 🆕 保存 PCM 数据到文件
   */
  private savePCMData() {
    try {
      // 合并所有 PCM 48kHz 包
      const pcm48kData = Buffer.concat(this.pcmPackets);
      fs.writeFileSync(this.pcmFilePath, pcm48kData);
      console.log(`[OpusDecoder] ✅ PCM 48kHz 已保存: ${this.pcmFilePath}`);
      console.log(`[OpusDecoder] 播放命令: ffplay -f s16le -ar 48000 -ac 1 "${this.pcmFilePath}"`);

      // 合并所有 PCM 16kHz 包
      const pcm16kData = Buffer.concat(this.pcm16kPackets);
      fs.writeFileSync(this.pcm16kFilePath, pcm16kData);
      console.log(`[OpusDecoder] ✅ PCM 16kHz 已保存: ${this.pcm16kFilePath}`);
      console.log(`[OpusDecoder] 播放命令: ffplay -f s16le -ar 16000 -ac 1 "${this.pcm16kFilePath}"`);
    } catch (error) {
      console.error(`[OpusDecoder] ⚠️ 保存 PCM 失败:`, error);
    }
  }

  /**
   * 将原始 Opus 帧封装为 Ogg Opus 容器格式（可直接播放）
   */
  private convertToOggOpus() {
    try {
      console.log(`[OpusDecoder] 封装 ${this.opusPackets.length} 个 Opus 包到 Ogg 容器`);

      const oggData = this.encapsulateOpusToOgg(this.opusPackets);
      fs.writeFileSync(this.oggFilePath, oggData);

      console.log(`[OpusDecoder] ✅ OGG 文件已保存: ${this.oggFilePath}`);
      console.log(`[OpusDecoder] 播放命令: ffplay "${this.oggFilePath}"`);
    } catch (error) {
      console.error(`[OpusDecoder] ⚠️ OGG 封装失败:`, error);
    }
  }

  /**
   * 将 Opus 包封装到 Ogg 容器中
   * 参考标准: RFC 7845 (Ogg Encapsulation for the Opus Audio Codec)
   */
  private encapsulateOpusToOgg(opusPackets: Buffer[]): Buffer {
    const pages: Buffer[] = [];

    // Ogg 页序列号
    let sequenceNumber = 0;

    // 音频样本总计数（granule position）
    let granulePosition = 0;

    // 每个 Opus 包的样本数（20ms @ 48kHz = 960 samples）
    const samplesPerPacket = 960;

    // 1. 创建 OpusHead 页（识别头）
    const opusHead = this.createOpusHeadPage(sequenceNumber++);
    pages.push(opusHead);

    // 2. 创建 OpusTags 页（注释头）
    const opusTags = this.createOpusTagsPage(sequenceNumber++);
    pages.push(opusTags);

    // 3. 封装音频数据包
    for (let i = 0; i < opusPackets.length; i++) {
      granulePosition += samplesPerPacket;

      const isLastPacket = (i === opusPackets.length - 1);
      const page = this.createOggPage({
        data: opusPackets[i],
        sequenceNumber: sequenceNumber++,
        granulePosition,
        isFirstPage: false,
        isLastPage: isLastPacket,
      });

      pages.push(page);
    }

    return Buffer.concat(pages);
  }

  /**
   * 创建 OpusHead 页（Ogg Opus 识别头）
   */
  private createOpusHeadPage(sequenceNumber: number): Buffer {
    const head = Buffer.alloc(19);

    head.write('OpusHead', 0);           // Magic Signature (8 bytes)
    head.writeUInt8(1, 8);                // Version (1)
    head.writeUInt8(1, 9);                // Channel Count (1 = mono)
    head.writeUInt16LE(0, 10);            // Pre-skip (0)
    head.writeUInt32LE(48000, 12);        // Input Sample Rate (48000 Hz)
    head.writeUInt16LE(0, 16);            // Output Gain (0 dB)
    head.writeUInt8(0, 18);               // Channel Mapping Family (0 = mono/stereo)

    return this.createOggPage({
      data: head,
      sequenceNumber,
      granulePosition: 0,
      isFirstPage: true,
      isLastPage: false,
    });
  }

  /**
   * 创建 OpusTags 页（注释头）
   */
  private createOpusTagsPage(sequenceNumber: number): Buffer {
    const vendor = 'gemini-live-encoder';
    const vendorLength = Buffer.byteLength(vendor);

    const tags = Buffer.alloc(8 + 4 + vendorLength + 4);

    tags.write('OpusTags', 0);            // Magic Signature
    tags.writeUInt32LE(vendorLength, 8);  // Vendor String Length
    tags.write(vendor, 12);               // Vendor String
    tags.writeUInt32LE(0, 12 + vendorLength); // User Comment List Length (0)

    return this.createOggPage({
      data: tags,
      sequenceNumber,
      granulePosition: 0,
      isFirstPage: false,
      isLastPage: false,
    });
  }

  /**
   * 创建 Ogg 页
   */
  private createOggPage(options: {
    data: Buffer;
    sequenceNumber: number;
    granulePosition: number;
    isFirstPage: boolean;
    isLastPage: boolean;
  }): Buffer {
    const { data, sequenceNumber, granulePosition, isFirstPage, isLastPage } = options;

    // Ogg 页头结构 (27 bytes)
    const header = Buffer.alloc(27);

    // Capture Pattern
    header.write('OggS', 0);

    // Version
    header.writeUInt8(0, 4);

    // Header Type Flag
    let headerType = 0;
    if (isFirstPage) headerType |= 0x02;  // Beginning of Stream
    if (isLastPage) headerType |= 0x04;   // End of Stream
    header.writeUInt8(headerType, 5);

    // Granule Position (64-bit)
    header.writeBigUInt64LE(BigInt(granulePosition), 6);

    // Stream Serial Number (固定值)
    header.writeUInt32LE(0x12345678, 14);

    // Page Sequence Number
    header.writeUInt32LE(sequenceNumber, 18);

    // CRC Checksum (稍后计算)
    header.writeUInt32LE(0, 22);

    // Number of Page Segments
    const numSegments = Math.ceil(data.length / 255);
    header.writeUInt8(numSegments, 26);

    // Segment Table
    const segmentTable = Buffer.alloc(numSegments);
    let remaining = data.length;
    for (let i = 0; i < numSegments; i++) {
      const segmentSize = Math.min(remaining, 255);
      segmentTable.writeUInt8(segmentSize, i);
      remaining -= segmentSize;
    }

    // 组装完整页
    const page = Buffer.concat([header, segmentTable, data]);

    // 计算 CRC32
    const crc = this.calculateCRC32(page);
    page.writeUInt32LE(crc, 22);

    return page;
  }

  /**
   * 计算 Ogg CRC32 校验和
   */
  private calculateCRC32(buffer: Buffer): number {
    const table = this.getCRC32Table();
    let crc = 0;

    for (let i = 0; i < buffer.length; i++) {
      crc = (crc << 8) ^ table[((crc >>> 24) ^ buffer[i]) & 0xFF];
    }

    return crc >>> 0;
  }

  /**
   * Ogg CRC32 查找表
   */
  private getCRC32Table(): number[] {
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