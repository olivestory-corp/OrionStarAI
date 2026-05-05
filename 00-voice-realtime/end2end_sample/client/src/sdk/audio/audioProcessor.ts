/**
 * 音频处理工具函数
 * 纯 TypeScript 实现
 */

/**
 * Float32Array 转 Int16Array (PCM)
 */
export function float32ToInt16(buffer: Float32Array): Int16Array {
  const int16 = new Int16Array(buffer.length);
  for (let i = 0; i < buffer.length; i++) {
    const s = Math.max(-1, Math.min(1, buffer[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return int16;
}

/**
 * Int16Array 转 Float32Array
 */
export function int16ToFloat32(buffer: Int16Array): Float32Array {
  const float32 = new Float32Array(buffer.length);
  for (let i = 0; i < buffer.length; i++) {
    const normalized = buffer[i] / 32768.0;
    float32[i] = Math.max(-1.0, Math.min(1.0, normalized));
  }
  return float32;
}

/**
 * ArrayBuffer 转 Base64
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Base64 转 ArrayBuffer
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * 重采样音频（简单线性插值）
 */
export function resampleAudio(
  sourceBuffer: Float32Array,
  sourceRate: number,
  targetRate: number
): Float32Array {
  if (sourceRate === targetRate) {
    return sourceBuffer;
  }

  const ratio = sourceRate / targetRate;
  const targetLength = Math.round(sourceBuffer.length / ratio);
  const result = new Float32Array(targetLength);

  for (let i = 0; i < targetLength; i++) {
    const srcIndex = i * ratio;
    const srcIndexFloor = Math.floor(srcIndex);
    const srcIndexCeil = Math.min(srcIndexFloor + 1, sourceBuffer.length - 1);
    const t = srcIndex - srcIndexFloor;

    // 线性插值
    result[i] = sourceBuffer[srcIndexFloor] * (1 - t) + sourceBuffer[srcIndexCeil] * t;
  }

  return result;
}
