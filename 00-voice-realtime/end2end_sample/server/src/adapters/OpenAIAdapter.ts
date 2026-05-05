import WebSocket from 'ws';
import { BaseModelAdapter } from './BaseModelAdapter';
import { UnifiedClientMessage, UnifiedServerMessage } from '../../../shared/types/protocol';
import { getCurrentAgentPrompt } from '../agents';

/**
 * OpenAI 模型适配器
 */
export class OpenAIAdapter extends BaseModelAdapter {
  private ws: WebSocket | null = null;
  private sessionReady: boolean = false;

  // 🔥 待激活的 turnId，等 response.created 时才真正设置
  private pendingTurnId: number | null = null;

  /**
   * 处理客户端工具执行结果 - 无脑透传给 OpenAI
   * Client 已处理 silent 等特殊逻辑，Server 只做透传
   */
  handleClientToolResult(toolCallId: string, result: any): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn(`[OpenAIAdapter][${this.clientId}] WebSocket 未连接，无法发送工具结果`);
      return;
    }

    console.log(`[OpenAIAdapter][${this.clientId}] 📤 透传工具结果到 OpenAI: ${toolCallId}`);

    // 发送工具结果给 OpenAI
    const toolResponse = {
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: toolCallId,
        output: typeof result === 'string' ? result : JSON.stringify(result || { status: 'success' })
      }
    };

    this.ws.send(JSON.stringify(toolResponse));

    // 触发 response.create 让 AI 继续响应
    this.ws.send(JSON.stringify({ type: 'response.create' }));
    console.log(`[OpenAIAdapter][${this.clientId}] ✅ 工具结果已透传，触发响应`);
  }

  /**
   * 计算并返回本次交互的成本
   */
  private calculateCost(usage: any): { amount: number; details: any } | null {
    try {
      const inDetails = usage.input_token_details || {};
      const outDetails = usage.output_token_details || {};
      const cachedDetails = inDetails.cached_tokens_details || {};

      // 1. 获取总数
      const totalTxtIn = inDetails.text_tokens || 0;
      const totalAudIn = inDetails.audio_tokens || 0;
      const txtOut = outDetails.text_tokens || 0;
      const audOut = outDetails.audio_tokens || 0;

      // 2. 获取缓存数
      const cachedTxtIn = cachedDetails.text_tokens || 0;
      const cachedAudIn = cachedDetails.audio_tokens || 0;

      // 3. 计算未缓存数 (实际计费高昂的部分)
      const realTxtIn = Math.max(0, totalTxtIn - cachedTxtIn);
      const realAudIn = Math.max(0, totalAudIn - cachedAudIn);

      // 4. 定价 (OpenAI Realtime API Public Pricing)
      // 参考: https://openai.com/api/pricing/
      const P_TXT_IN = 4.00;          // $5.00 / 1M
      const P_TXT_IN_CACHE = 0.40;    // $2.50 / 1M (50% off)
      const P_AUD_IN = 32.00;        // $100.00 / 1M
      const P_AUD_IN_CACHE = 0.400;   // $10.00 / 1M (90% off)
      const P_TXT_OUT = 16.00;        // $20.00 / 1M
      const P_AUD_OUT = 64.00;       // $200.00 / 1M

      // 5. 计算成本
      const cTxtIn = (realTxtIn / 1000000) * P_TXT_IN;
      const cTxtInCache = (cachedTxtIn / 1000000) * P_TXT_IN_CACHE;

      const cAudIn = (realAudIn / 1000000) * P_AUD_IN;
      const cAudInCache = (cachedAudIn / 1000000) * P_AUD_IN_CACHE;

      const cTxtOut = (txtOut / 1000000) * P_TXT_OUT;
      const cAudOut = (audOut / 1000000) * P_AUD_OUT;

      const total = cTxtIn + cTxtInCache + cAudIn + cAudInCache + cTxtOut + cAudOut;

      console.log(`[OpenAIAdapter][${this.clientId}] 💰 本次交互成本: ${total.toFixed(6)}`);

      return {
        amount: total,
        details: {
          textInput: cTxtIn,
          textInputCached: cTxtInCache,
          audioInput: cAudIn,
          audioInputCached: cAudInCache,
          textOutput: cTxtOut,
          audioOutput: cAudOut
        }
      };

    } catch (e) {
      console.error('Cost calc error:', e);
      return null;
    }
  }

  /**
   * 连接到 OpenAI Realtime API
   */
  async connect(config: any): Promise<WebSocket> {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error('OPENAI_API_KEY 未设置');
    }

    console.log(`[OpenAIAdapter][${this.clientId}] 正在连接...`);

    // 构建 WebSocket URL
    const model = config.model || 'gpt-realtime-2025-08-28';
    const wsUrl = `wss://api.openai.com/v1/realtime?model=${model}`;

    console.log(`[OpenAIAdapter][${this.clientId}] 端点: ${wsUrl}`);
    console.log(`[OpenAIAdapter][${this.clientId}] 模型: ${model}`);

    // 建立连接
    this.ws = new WebSocket(wsUrl, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'OpenAI-Beta': 'realtime=v1'
      },
    });

    // 事件处理
    this.ws.on('open', () => {
      console.log(`[OpenAIAdapter][${this.clientId}] WebSocket 连接成功`);

      // 所有工具由客户端管理
      const allTools = [...this.clientTools];

      console.log(`[OpenAIAdapter][${this.clientId}] 工具列表: ${allTools.length} 个 (全部来自客户端)`);

      // 转换工具声明为 OpenAI 格式
      const openaiTools = allTools.map(tool => ({
        type: 'function',
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }));

      // 发送 session 配置
      const sessionConfig = {
        type: 'session.update',
        session: {
          modalities: config.responseModalities || ['text', 'audio'],
          instructions: config.systemInstruction || getCurrentAgentPrompt(),
          voice: config.voiceName || 'marin',
          input_audio_format: 'pcm16',
          output_audio_format: 'pcm16',
          input_audio_transcription: {
            model: 'whisper-1'
          },
          turn_detection: null, // 禁用服务端 VAD，使用客户端 VAD
          tools: openaiTools,
          tool_choice: 'auto',
          temperature: config.temperature || 0.8
        }
      };

      console.log(`[OpenAIAdapter][${this.clientId}] 发送 session 配置`);
      console.log(`[OpenAIAdapter][${this.clientId}] 注册工具数量: ${openaiTools.length}`);
      this.ws!.send(JSON.stringify(sessionConfig));
    });

    this.ws.on('message', async (data: WebSocket.Data) => {
      try {
        const rawMessage = JSON.parse(data.toString());

        if (rawMessage.type === 'response.audio.delta') {
        //  console.log(`[OpenAIAdapter][${this.clientId}] 音频流:${rawMessage.type} `);
        } else {
        //  console.log(`[OpenAIAdapter][${this.clientId}] 事件:${data.toString()} `);
        }
        // 记录事件类型
        if (rawMessage.type) {
          // console.log(`[OpenAIAdapter][${this.clientId}] 事件: ${rawMessage.type}`);

          // 🔍 专门记录转录相关事件
          // if (rawMessage.type.includes('transcript')) {
          //   console.log(`[OpenAIAdapter][${this.clientId}] 📝 转录事件:`, JSON.stringify(rawMessage, null, 2));
          // }
        }

        // 处理 session 就绪
        if (rawMessage.type === 'session.created' || rawMessage.type === 'session.updated') {
          this.sessionReady = true;
          console.log(`[OpenAIAdapter][${this.clientId}] Session 就绪`);
        }

        // 🔥 处理 response.created - AI 开始响应，激活待处理的 turnId
        if (rawMessage.type === 'response.created') {
          this.activatePendingTurn();
          console.log(`[OpenAIAdapter][${this.clientId}] 📢 Response 开始, 当前 Turn-ID: ${this.turnId}`);
        }

        // 🆕 处理 response.done 并计算成本
        let costInfo: { amount: number; details: any } | null = null;
        if (rawMessage.type === 'response.done') {
          console.log(`[OpenAIAdapter][${this.clientId}] 响应 token 使用情况:`, data.toString());

          if (rawMessage.response.usage) {
            costInfo = this.calculateCost(rawMessage.response.usage);
          }
        }

        // 处理工具调用 - 直接透传给客户端，不等待结果
        if (rawMessage.type === 'response.function_call_arguments.done') {
          console.log(`[OpenAIAdapter][${this.clientId}] 🔄 透传工具调用到客户端: ${rawMessage.name}`);

          try {
            const args = JSON.parse(rawMessage.arguments);

            // 🔥 直接透传给客户端，不阻塞等待
            // 客户端执行后会发送 tool_result（silent 等特殊工具由客户端处理）
            this.emitMessage({
              type: 'tool_call',
              turnId: this.turnId || undefined,
              timestamp: Date.now(),
              toolCall: {
                toolCallId: rawMessage.call_id,
                name: rawMessage.name,
                arguments: args
              }
            });

            console.log(`[OpenAIAdapter][${this.clientId}] ✅ 工具调用已透传: ${rawMessage.name}`);
          } catch (error: any) {
            console.error(`[OpenAIAdapter][${this.clientId}] 解析工具参数失败:`, error);
          }
        }

        // 转换为统一格式（传递 cost 信息）
        const unifiedMessage = this.transformServerMessage(rawMessage, costInfo);

        // 回调
        if (unifiedMessage) {
          this.emitMessage(unifiedMessage);
        }
      } catch (error) {
        console.error(`[OpenAIAdapter][${this.clientId}] 处理消息失败:`, error);
      }
    });

    this.ws.on('error', (error) => {
      console.error(`[OpenAIAdapter][${this.clientId}] WebSocket 错误:`, error);
      this.emitMessage({
        type: 'error',
        turnId: this.turnId || undefined,
        timestamp: Date.now(),
        error: {
          code: 'WEBSOCKET_ERROR',
          message: '连接错误',
          details: error
        }
      });
    });

    this.ws.on('close', () => {
      console.log(`[OpenAIAdapter][${this.clientId}] WebSocket 连接关闭`);
      this.sessionReady = false;

      // 通知客户端 AI 已断开
      this.emitMessage({
        type: 'ai_disconnected',
        timestamp: Date.now(),
        turnId: this.turnId || undefined
      });
    });

    return this.ws;
  }

  /**
   * 关闭连接
   */
  close(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.sessionReady = false;
    }
  }

  /**
   * 统一消息 → OpenAI 格式
   */
  transformClientMessage(message: UnifiedClientMessage): any {
    switch (message.type) {
      case 'audio_input':
        // 音频输入 → input_audio_buffer.append
        if (!message.audioInput) {
          throw new Error('audio_input 消息缺少 audioInput 字段');
        }

        // 🔥 如果是最后一块音频，需要提交并触发响应
        if (message.audioInput.isFinal) {
          console.log(`[OpenAIAdapter][${this.clientId}] 🎤 音频输入结束，提交缓冲区`);

          // 返回多个消息：append + commit + response.create
          return [
            {
              type: 'input_audio_buffer.append',
              audio: message.audioInput.chunks[0]?.data || ''
            },
            {
              type: 'input_audio_buffer.commit'
            },
            {
              type: 'response.create'
            }
          ];
        }

        // 普通音频块，只追加
        return {
          type: 'input_audio_buffer.append',
          audio: message.audioInput.chunks[0]?.data || ''
        };

      case 'text_input':
        // 文本输入 → conversation.item.create (+ response.create if not silent)
        if (!message.textInput) {
          throw new Error('text_input 消息缺少 textInput 字段');
        }

        const textItem = {
          type: 'conversation.item.create',
          item: {
            type: 'message',
            role: message.textInput.role || 'user',
            content: [{
              type: 'input_text',
              text: message.textInput.text
            }]
          }
        };

        // 如果 silent 为 true，只发送 item.create
        if (message.textInput.silent) {
          console.log(`[OpenAIAdapter][${this.clientId}] 🤫 Silent 文本输入: "${message.textInput.text}"`);
          return textItem;
        }

        // 🔥 发送 response.cancel 先打断之前的响应，再发送新消息
        // 避免在之前的 response 还在生成时触发新的 response.create
        console.log(`[OpenAIAdapter][${this.clientId}] 📝 文本输入(带打断): "${message.textInput.text.substring(0, 30)}..."`);
        return [
          { type: 'response.cancel' },  // 先打断
          textItem,
          { type: 'response.create' }
        ];

      case 'interrupt':
        // 中断 → response.cancel
        console.log(`[OpenAIAdapter][${this.clientId}] 发送中断消息`);
        return {
          type: 'response.cancel'
        };

      case 'clear_audio_buffer':
        // 清除音频缓冲区 → input_audio_buffer.clear
        console.log(`[OpenAIAdapter][${this.clientId}] 🧹 清除音频缓冲区`);
        return {
          type: 'input_audio_buffer.clear'
        };

      default:
        throw new Error(`不支持的消息类型: ${message.type}`);
    }
  }

  /**
   * OpenAI 格式 → 统一消息
   */
  transformServerMessage(rawMessage: any, costInfo?: { amount: number; details: any } | null): UnifiedServerMessage | null {
    // 如果已被打断，忽略后续消息（除了 response.done）
    if (this.isInterrupted && rawMessage.type !== 'response.done') {
      console.log(`[OpenAIAdapter][${this.clientId}] 🚫 已打断，忽略消息: ${rawMessage.type}`);
      return null;
    }

    const baseMessage: UnifiedServerMessage = {
      type: 'audio_output',
      turnId: this.turnId || undefined,
      timestamp: Date.now()
    };

    // 根据事件类型转换
    switch (rawMessage.type) {
      case 'session.created':
      case 'session.updated':
        return {
          ...baseMessage,
          type: 'ready'
        };

      case 'response.audio.delta':
        // 音频流
        return {
          ...baseMessage,
          type: 'audio_output',
          audioOutput: {
            format: 'pcm16',
            sampleRate: 24000,
            channels: 1,
            chunks: [{
              data: rawMessage.delta,
              sequence: 0,
              isLast: false
            }],
            isFinal: false
          }
        };

      case 'response.audio.done':
        // 音频完成（不发送数据，只标记完成）
        return null;

      case 'response.text.delta':
        // 文本流
        return {
          ...baseMessage,
          type: 'text_output',
          textOutput: {
            text: rawMessage.delta,
            role: 'assistant',
            isFinal: false
          }
        };

      case 'response.text.done':
        // 文本完成
        return {
          ...baseMessage,
          type: 'text_output',
          textOutput: {
            text: rawMessage.text || '',
            role: 'assistant',
            isFinal: true
          }
        };

      case 'response.done':
        // 响应完成（包含 cost 信息）
        //console.log(`[OpenAIAdapter][${this.clientId}] Turn 完成: ${this.turnId}`);
        return {
          ...baseMessage,
          type: 'turn_complete',
          turnComplete: {
            duration: 0
          },
          ...(costInfo ? { cost: costInfo } : {})
        };

      case 'conversation.item.input_audio_transcription.completed':
        // 输入音频转写结果
        console.log(`[OpenAIAdapter][${this.clientId}] 📝 输入转录:`, rawMessage.transcript);
        return {
          ...baseMessage,
          type: 'transcription',
          transcription: {
            text: rawMessage.transcript,
            language: rawMessage.language
          }
        };

      case 'response.audio_transcript.delta':
        // 输出音频转写增量
        //console.log(`[OpenAIAdapter][${this.clientId}] 📝 输出转录增量:`, rawMessage.delta);
        return {
          ...baseMessage,
          type: 'text_output',
          textOutput: {
            text: rawMessage.delta,
            role: 'assistant',
            isFinal: false
          }
        };

      case 'response.audio_transcript.done':
        // 输出音频转写完成
        console.log(`[OpenAIAdapter][${this.clientId}] 📝 输出转录完成:`, rawMessage.transcript);
        return {
          ...baseMessage,
          type: 'text_output',
          textOutput: {
            text: rawMessage.transcript,
            role: 'assistant',
            isFinal: true
          }
        };

      case 'response.function_call_arguments.done':
        // 工具调用（已在 onMessage 中处理，不需要重复发送）
        return null;

      case 'error':
        // 错误
        return {
          ...baseMessage,
          type: 'error',
          error: {
            code: rawMessage.error?.code || 'UNKNOWN_ERROR',
            message: rawMessage.error?.message || '未知错误',
            details: rawMessage.error
          }
        };

      default:
        // 忽略其他事件
        return null;
    }
  }

  /**
   * 发送消息到 OpenAI
   */
  send(message: any): void {
    if (!this.ws) {
      console.warn(`[OpenAIAdapter][${this.clientId}] WebSocket 未初始化`);
      return;
    }

    if (this.ws.readyState !== WebSocket.OPEN) {
      console.warn(`[OpenAIAdapter][${this.clientId}] WebSocket 未连接 (状态: ${this.ws.readyState})`);
      return;
    }

    if (!this.sessionReady) {
      console.warn(`[OpenAIAdapter][${this.clientId}] Session 未就绪，延迟发送`);
      // 可以考虑添加消息队列
      return;
    }

    try {
      // 🔥 支持发送消息数组（用于音频结束时的 commit + response.create）
      if (Array.isArray(message)) {
        console.log(`[OpenAIAdapter][${this.clientId}] 📤 发送 ${message.length} 个消息`);
        message.forEach((msg, index) => {
          setTimeout(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
              this.ws.send(JSON.stringify(msg));
            }
          }, index * 50); // 每个消息间隔 50ms
        });
        return;
      }

      // 单个消息
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error(`[OpenAIAdapter][${this.clientId}] 发送消息失败:`, error);
    }
  }

  /**
   * 中断当前对话
   */
  interrupt(): void {
    console.log(`[OpenAIAdapter][${this.clientId}] 🛑 触发中断`);

    // 标记为已打断（与 GeminiAdapter 保持一致）
    this.markAsInterrupted();

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // 发送 response.cancel 消息
      this.ws.send(JSON.stringify({ type: 'response.cancel' }));
      console.log(`[OpenAIAdapter][${this.clientId}] 📤 已发送中断信号`);
    }
  }

  /**
   * 🔥 重写 setTurnId：只暂存到 pendingTurnId，等 response.created 时再激活
   */
  override setTurnId(turnId: number): void {
    this.pendingTurnId = turnId;
    //console.log(`[OpenAIAdapter][${this.clientId}] 📌 设置待激活 Turn-ID: ${turnId}`);
  }

  /**
   * 🔥 激活待处理的 turnId（收到 response.created 时调用）
   */
  private activatePendingTurn(): void {
    if (this.pendingTurnId !== null && this.pendingTurnId !== this.turnId) {
      console.log(`[OpenAIAdapter][${this.clientId}] ✅ 激活新 Turn-ID: ${this.pendingTurnId} (旧: ${this.turnId})`);
      this.turnId = this.pendingTurnId;
      this.isInterrupted = false;  // 新 turn 开始，重置打断状态
    }
  }
}
