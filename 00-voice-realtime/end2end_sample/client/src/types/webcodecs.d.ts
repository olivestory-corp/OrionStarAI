/**
 * WebCodecs API 类型定义
 * https://www.w3.org/TR/webcodecs/
 */

interface AudioEncoderConfig {
  codec: string;
  sampleRate: number;
  numberOfChannels: number;
  bitrate?: number;
}

interface AudioEncoderInit {
  output: (chunk: EncodedAudioChunk, metadata?: any) => void;
  error: (error: DOMException) => void;
}

interface AudioEncoderSupport {
  supported: boolean;
  config?: AudioEncoderConfig;
}

declare class AudioEncoder {
  constructor(init: AudioEncoderInit);
  static isConfigSupported(config: AudioEncoderConfig): Promise<AudioEncoderSupport>;
  configure(config: AudioEncoderConfig): void;
  encode(data: AudioData): void;
  flush(): Promise<void>;
  reset(): void;
  close(): void;
  readonly state: 'unconfigured' | 'configured' | 'closed';
}

interface AudioDecoderConfig {
  codec: string;
  sampleRate: number;
  numberOfChannels: number;
}

interface AudioDecoderInit {
  output: (frame: AudioData) => void;
  error: (error: DOMException) => void;
}

interface AudioDecoderSupport {
  supported: boolean;
  config?: AudioDecoderConfig;
}

declare class AudioDecoder {
  constructor(init: AudioDecoderInit);
  static isConfigSupported(config: AudioDecoderConfig): Promise<AudioDecoderSupport>;
  configure(config: AudioDecoderConfig): void;
  decode(chunk: EncodedAudioChunk): void;
  flush(): Promise<void>;
  reset(): void;
  close(): void;
  readonly state: 'unconfigured' | 'configured' | 'closed';
}

interface AudioDataInit {
  format: string;
  sampleRate: number;
  numberOfFrames: number;
  numberOfChannels: number;
  timestamp: number;
  data: AllowSharedBufferSource;
}

declare class AudioData {
  constructor(init: AudioDataInit);
  readonly format: string;
  readonly sampleRate: number;
  readonly numberOfFrames: number;
  readonly numberOfChannels: number;
  readonly duration: number;
  readonly timestamp: number;
  allocationSize(options: { planeIndex: number }): number;
  copyTo(destination: AllowSharedBufferSource, options: { planeIndex: number }): void;
  clone(): AudioData;
  close(): void;
}

interface EncodedAudioChunkInit {
  type: 'key' | 'delta';
  timestamp: number;
  duration?: number;
  data: AllowSharedBufferSource;
}

declare class EncodedAudioChunk {
  constructor(init: EncodedAudioChunkInit);
  readonly type: 'key' | 'delta';
  readonly timestamp: number;
  readonly duration: number | null;
  readonly byteLength: number;
  copyTo(destination: AllowSharedBufferSource): void;
}

type AllowSharedBufferSource = ArrayBufferView | ArrayBuffer;
