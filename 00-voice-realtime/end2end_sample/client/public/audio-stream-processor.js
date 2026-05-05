// AudioWorklet 处理器：用于流式音频播放
class AudioStreamProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferQueue = [];
    this.currentBuffer = null;
    this.currentIndex = 0;
    this.totalPlayedSamples = 0; // 🆕 已播放的总采样数
    this.lastReportedSamples = 0; // 🆕 上次报告的采样数
    this.reportInterval = 4800; // 🆕 每 100ms (48000Hz * 0.1s) 报告一次

    // 监听来自主线程的消息
    this.port.onmessage = (event) => {
      if (event.data.type === 'audio-data') {
        // 接收音频数据并加入队列
        this.bufferQueue.push(event.data.audioData);
      } else if (event.data.type === 'clear') {
        // 清空队列
        this.bufferQueue = [];
        this.currentBuffer = null;
        this.currentIndex = 0;
        this.totalPlayedSamples = 0;
        this.lastReportedSamples = 0;
      } else if (event.data.type === 'reset-progress') {
        // 🆕 重置进度
        this.totalPlayedSamples = 0;
        this.lastReportedSamples = 0;
      }
    };
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    const channel = output[0];

    if (!channel) {
      return true;
    }

    let outputIndex = 0;
    const frameCount = channel.length;

    while (outputIndex < frameCount) {
      // 如果当前buffer用完了，从队列取下一个
      if (!this.currentBuffer || this.currentIndex >= this.currentBuffer.length) {
        if (this.bufferQueue.length > 0) {
          this.currentBuffer = this.bufferQueue.shift();
          this.currentIndex = 0;

          // 通知主线程队列状态
          this.port.postMessage({
            type: 'queue-status',
            queueLength: this.bufferQueue.length
          });
        } else {
          // 没有数据了，输出静音
          for (let i = outputIndex; i < frameCount; i++) {
            channel[i] = 0;
          }
          break;
        }
      }

      // 从当前buffer复制数据到输出
      if (this.currentBuffer) {
        const remaining = this.currentBuffer.length - this.currentIndex;
        const toCopy = Math.min(remaining, frameCount - outputIndex);

        for (let i = 0; i < toCopy; i++) {
          channel[outputIndex + i] = this.currentBuffer[this.currentIndex + i];
        }

        this.currentIndex += toCopy;
        outputIndex += toCopy;

        // 🆕 更新已播放采样数
        this.totalPlayedSamples += toCopy;
      }
    }

    // 🆕 定期报告播放进度
    if (this.totalPlayedSamples - this.lastReportedSamples >= this.reportInterval) {
      this.port.postMessage({
        type: 'playback-progress',
        playedSamples: this.totalPlayedSamples
      });
      this.lastReportedSamples = this.totalPlayedSamples;
    }

    return true; // 保持处理器运行
  }
}

registerProcessor('audio-stream-processor', AudioStreamProcessor);
