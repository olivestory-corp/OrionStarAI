import WebSocket from 'ws';
import { wsManager } from './wsManager';
import { OpusDecoderWrapper } from './utils/opusDecoder';
import { OpusEncoderWrapper } from './utils/opusEncoder';
import { AdapterFactory } from './adapters/AdapterFactory';
import { BaseModelAdapter } from './adapters/BaseModelAdapter';
import { UnifiedClientMessage, UnifiedServerMessage } from '../../shared/types/protocol';

/**
 * 处理客户端 WebSocket 连接
 */
export function handleClientConnection(clientWs: WebSocket): void {
  const clientId = wsManager.addClient(clientWs);

  // 创建 Opus 编解码器（每个客户端一个）
  const opusDecoder = new OpusDecoderWrapper(); // Client → Server
  const opusEncoder = new OpusEncoderWrapper(); // Server → Client
  opusDecoder.initializeDebugFile(clientId);

  // 模型适配器（延迟初始化）
  let modelAdapter: BaseModelAdapter | null = null;

  clientWs.on('message', async (data: WebSocket.Data) => {
    try {
      const message: UnifiedClientMessage = JSON.parse(data.toString());
      const connection = wsManager.getClient(clientId);
      if (!connection) return;

      // 📌 提取 Turn-ID
      const turnId = message.turnId;
      // if (turnId) {
      //   console.log(`[${clientId}] 📌 Turn-ID: ${turnId} | Type: ${message.type}`);
      // }

      // 处理不同类型的消息
      switch (message.type) {
        case 'setup':
          // 建立 AI 连接
          console.log(`[${clientId}] 收到 setup 消息:`, JSON.stringify(message.setup, null, 2));
          const modelType = 'openai';
          console.log(`[${clientId}] 正在连接 ${modelType}...`);

          try {
            // 提取并保存客户端工具
            const clientTools = message.setup!.config?.tools || [];
            wsManager.setClientTools(clientId, clientTools);

            // 创建适配器
            modelAdapter = AdapterFactory.create(modelType, clientId);

            // 设置客户端工具到适配器
            modelAdapter.setClientTools(clientTools);

            // 设置消息回调
            modelAdapter.onMessage((serverMessage: UnifiedServerMessage) => {
              // 🎵 编码音频
              if (serverMessage.type === 'audio_output' && serverMessage.audioOutput) {
                opusEncoder.setTurnId(String(serverMessage.turnId ?? 'unknown'));

                let hasAudioData = false;

                // 处理音频分片
                const processedChunks = serverMessage.audioOutput.chunks.map(chunk => {
                  if (serverMessage.audioOutput!.format === 'pcm16') {
                    hasAudioData = true;
                    // PCM → Opus
                    const opusBase64 = opusEncoder.encode(chunk.data);
                    return opusBase64 ? {
                      ...chunk,
                      data: opusBase64
                    } : null;
                  }
                  return chunk;
                }).filter(Boolean);

                serverMessage.audioOutput.chunks = processedChunks as any;
                serverMessage.audioOutput.format = 'opus'; // 更新格式

                // 🔥 定期 flush：如果有音频数据但缓冲区有积压
                if (hasAudioData) {
                  const bufferInfo = opusEncoder.getBufferInfo();
                  // 如果缓冲区有数据且超过 10ms，立即 flush
                  if (bufferInfo.bufferedMs >= 10) {
                    const flushedFrames = opusEncoder.flush();

                    if (flushedFrames.length > 0) {
                      //console.log(`[${clientId}] 🔄 定期 flush 产生 ${flushedFrames.length} 帧 (缓冲: ${bufferInfo.bufferedMs.toFixed(1)}ms)`);

                      // 将 flush 的数据添加到当前消息的 chunks
                      flushedFrames.forEach(opusBase64 => {
                        serverMessage.audioOutput!.chunks.push({
                          data: opusBase64,
                          sequence: serverMessage.audioOutput!.chunks.length,
                          isLast: false
                        });
                      });
                    }
                  }
                }
              }

              // 🔥 在 turn_complete 时 flush 编码器
              if (serverMessage.type === 'turn_complete') {
                console.log(`[${clientId}] 🔥 Turn 完成，flush Opus 编码器`);
                const flushedFrames = opusEncoder.flush();

                if (flushedFrames.length > 0) {
                  console.log(`[${clientId}] 📤 发送 flush 的 ${flushedFrames.length} 帧音频`);

                  // 发送 flush 的音频数据
                  if (clientWs.readyState === WebSocket.OPEN) {
                    clientWs.send(JSON.stringify({
                      type: 'audio_output',
                      turnId: serverMessage.turnId,
                      timestamp: Date.now(),
                      audioOutput: {
                        format: 'opus',
                        sampleRate: 24000,
                        channels: 1,
                        chunks: flushedFrames.map((data, i) => ({
                          data,
                          sequence: i,
                          isLast: i === flushedFrames.length - 1
                        })),
                        isFinal: true
                      }
                    } as UnifiedServerMessage));
                  }
                }
              }

              // 发送给客户端（过滤掉 null 消息）
              if (serverMessage && clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(JSON.stringify(serverMessage));
              }
            });

            // 构建连接配置，包含音色
            const connectConfig = {
              ...message.setup!.config,
              voiceName: message.setup!.config?.voice || 'alloy'
            };
            console.log(`[${clientId}] 使用音色: ${connectConfig.voiceName}`);

            // 连接 AI
            await modelAdapter.connect(connectConfig);

            // 保存适配器
            wsManager.setAIAdapter(clientId, modelAdapter, modelType);

            // 发送就绪消息
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({
                type: 'ready',
                timestamp: Date.now(),
                turnId: turnId
              } as UnifiedServerMessage));
            }

            console.log(`[${clientId}] ✅ AI 连接完成，模型: ${modelType}`);
          } catch (error) {
            console.error(`[${clientId}] AI 连接失败:`, error);
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({
                type: 'error',
                timestamp: Date.now(),
                turnId: turnId,
                error: {
                  code: 'CONNECTION_FAILED',
                  message: 'AI 连接失败'
                }
              } as UnifiedServerMessage));
            }
          }
          break;

        case 'audio_input':
          // 音频输入
          if (!modelAdapter) {
            console.error(`[${clientId}] ❌ 音频输入失败: AI 适配器未初始化`);
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({
                type: 'error',
                timestamp: Date.now(),
                turnId: turnId,
                error: {
                  code: 'AI_NOT_CONNECTED',
                  message: 'AI 未连接，请先发送 setup 消息'
                }
              } as UnifiedServerMessage));
            }
            return;
          }

          // 🎵 解码音频
          opusDecoder.setTurnId(String(turnId));

          const decodedChunks = message.audioInput!.chunks.map(chunk => {
            if (message.audioInput!.format === 'opus') {
              const pcmBase64 = opusDecoder.decode(chunk.data);
              return pcmBase64 ? {
                ...chunk,
                data: pcmBase64
              } : null;
            }
            return chunk;
          }).filter(Boolean);

          //console.log(`[${clientId}] 解码音频: ${decodedChunks.length} 帧，isFinal: ${message.audioInput!.isFinal}`);

          message.audioInput!.chunks = decodedChunks as any;
          message.audioInput!.format = 'pcm16'; // 更新格式

          // 转换并发送
          modelAdapter.setTurnId(turnId);
          const audioMessage = modelAdapter.transformClientMessage(message);
          modelAdapter.send(audioMessage);
          break;

        case 'text_input':
          // 文本输入
          if (!modelAdapter) {
            console.error(`[${clientId}] ❌ 文本输入失败: AI 适配器未初始化`);
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({
                type: 'error',
                timestamp: Date.now(),
                turnId: turnId,
                error: {
                  code: 'AI_NOT_CONNECTED',
                  message: 'AI 未连接，请先发送 setup 消息'
                }
              } as UnifiedServerMessage));
            }
            return;
          }

          modelAdapter.setTurnId(turnId);
          const textMessage = modelAdapter.transformClientMessage(message);
          modelAdapter.send(textMessage);
          break;

        case 'clear_audio_buffer':
          // 清除音频缓冲区
          if (!modelAdapter) {
            console.error(`[${clientId}] ❌ 清除缓冲区失败: AI 适配器未初始化`);
            return;
          }

          console.log(`[${clientId}] 🧹 请求清除音频缓冲区`);
          modelAdapter.setTurnId(turnId);
          const clearMessage = modelAdapter.transformClientMessage(message);

          // 只有当适配器返回有效消息时才发送 (Gemini 可能返回 null)
          if (clearMessage) {
            modelAdapter.send(clearMessage);
          }
          break;

        case 'interrupt':
          // 中断
          if (!modelAdapter) {
            console.error(`[${clientId}] ❌ 中断失败: AI 适配器未初始化`);
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({
                type: 'error',
                timestamp: Date.now(),
                turnId: turnId,
                error: {
                  code: 'AI_NOT_CONNECTED',
                  message: 'AI 未连接，请先发送 setup 消息'
                }
              } as UnifiedServerMessage));
            }
            return;
          }

          console.log(`[${clientId}] 🛑 中断 Turn-ID: ${message.interrupt!.interruptedTurnId}`);

          // 1. 清空音频编码器缓冲区 (停止发送旧音频)
          opusEncoder.clear();

          // 2. 调用适配器中断 (标记打断状态，发送中断信号给 AI)
          modelAdapter.interrupt();
          break;

        case 'tool_result':
          // 工具执行结果
          if (!modelAdapter) {
            console.warn(`[${clientId}] 模型未连接，无法处理工具结果`);
            return;
          }

          if (message.toolResult) {
            const { toolCallId, result, error } = message.toolResult;
            // 如果有错误，也可以传递给 adapter，目前假设 result 包含错误信息或者 adapter 能处理
            const finalResult = error ? { error } : result;
            modelAdapter.handleClientToolResult(toolCallId, finalResult);
          }
          break;

        case 'ping':
          // 心跳
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({
              type: 'pong',
              timestamp: Date.now()
            } as UnifiedServerMessage));
          }
          break;

        default:
          console.warn(`[${clientId}] 未知消息类型: ${message.type}`);
      }

    } catch (error) {
      console.error(`[${clientId}] 消息处理失败:`, error);
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({
          type: 'error',
          timestamp: Date.now(),
          error: {
            code: 'PROCESSING_ERROR',
            message: '消息处理失败'
          }
        } as UnifiedServerMessage));
      }
    }
  });

  clientWs.on('close', () => {
    console.log(`[${clientId}] 客户端断开连接`);
    opusDecoder.close();
    opusEncoder.close();
    if (modelAdapter) {
      modelAdapter.close();
    }
    wsManager.removeClient(clientId);
  });

  clientWs.on('error', (error) => {
    console.error(`[${clientId}] WebSocket 错误:`, error);
  });

  // 响应ping保活
  clientWs.on('pong', () => {
    const connection = wsManager.getClient(clientId);
    if (connection) {
      connection.lastActivity = new Date();
    }
  });
}