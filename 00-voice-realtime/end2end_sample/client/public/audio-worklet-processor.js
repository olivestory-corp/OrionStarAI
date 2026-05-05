/**
 * AudioWorklet 处理器
 * 实时捕获音频数据并发送给主线程
 */

class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 4096; // 缓冲区大小
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];

    // 如果没有输入，返回 true 继续处理
    if (!input || !input[0]) {
      return true;
    }

    const inputChannel = input[0]; // 单声道

    // 将数据添加到缓冲区
    for (let i = 0; i < inputChannel.length; i++) {
      this.buffer[this.bufferIndex++] = inputChannel[i];

      // 当缓冲区满时，发送数据
      if (this.bufferIndex >= this.bufferSize) {
        // 复制缓冲区数据（避免引用问题）
        const chunk = new Float32Array(this.buffer);
        this.port.postMessage(chunk);

        // 重置缓冲区
        this.bufferIndex = 0;
      }
    }

    return true; // 继续处理
  }
}

registerProcessor('audio-processor', AudioProcessor);
