/**
 * VAD AudioWorklet 处理器
 * 支持 VAD 检测和音频数据传输
 */

class VADProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 1536; // Silero VAD 推荐的帧大小
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
    this.sendingEnabled = false;

    // 监听主线程消息
    this.port.onmessage = (event) => {
      if (event.data.type === 'configure') {
        this.sendingEnabled = event.data.sendingEnabled;
      }
    };
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];

    if (!input || !input[0]) {
      return true;
    }

    const inputChannel = input[0]; // 单声道

    // 将数据添加到缓冲区
    for (let i = 0; i < inputChannel.length; i++) {
      this.buffer[this.bufferIndex++] = inputChannel[i];

      // 当缓冲区满时，发送数据
      if (this.bufferIndex >= this.bufferSize) {
        // 复制缓冲区数据
        const chunk = new Float32Array(this.buffer);

        // 发送给 VAD 检测 (始终发送用于 VAD)
        this.port.postMessage({
          type: 'audio',
          data: chunk,
          forVAD: true,
          forSending: this.sendingEnabled,
        });

        // 重置缓冲区
        this.bufferIndex = 0;
      }
    }

    return true;
  }
}

registerProcessor('vad-processor', VADProcessor);
