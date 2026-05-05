/**
 * DeepV Code Server - API Route Definitions
 * DeepV Code 服务器 - API 路由定义
 *
 * Contains definitions and handlers for all API endpoints
 * 包含所有 API 端点的定义和处理
 *
 * Core features: Chat interface and model list interface
 * 核心功能: 聊天接口和模型列表接口
 */

import { Router, Request, Response } from 'express';
import {
  UnifiedChatRequest,
  UnifiedChatResponse,
  validateChatRequest,
  sendStreamingResponse,
  createErrorResponse,
  StreamingChunk,
  normalizeRequest
} from './chat.js';
import {
  getModelConfig,
  callAIAPI,
  parseAPIResponse,
  APICallContext,
  handleStreamResponse as handleStreamResponseUtil
} from './clients.js';

const router = Router();

// DEBUG logging utility
// DEBUG 日志工具
const DEBUG = process.env.DEBUG === 'true';
function debugLog(label: string, data?: any) {
  if (DEBUG) {
    const timestamp = new Date().toISOString();
    if (data === undefined) {
      console.log(`[${timestamp}] [DEBUG] ${label}`);
    } else {
      console.log(`[${timestamp}] [DEBUG] ${label}:`, JSON.stringify(data, null, 2));
    }
  }
}

/**
 * Claude Streaming State
 * Claude 流式处理状态
 *
 * Used for accumulating tool call parameters and token statistics
 * 用于累积工具调用参数和 token 统计
 */
interface ClaudeStreamState {
  currentToolCall: {
    id: string;
    name: string;
    partialJson: string;
    isComplete: boolean;
  } | null;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
}

/**
 * OpenAI Streaming State
 * OpenAI 流式处理状态
 */
interface OpenAIStreamState {
  toolCalls: Map<number, {
    id: string;
    name: string;
    arguments: string;
  }>;
  usage: any | null;
}

/**
 * Clean tool call ID to ensure Claude required format
 * 清理工具调用ID，确保符合Claude要求的格式
 */
function cleanToolUseId(id: string): string {
  if (!id) return 'tool_call_1';
  // Replace disallowed characters with underscore
  // 替换不允许的字符为下划线
  let cleanId = id.replace(/[^a-zA-Z0-9_-]/g, '_');
  // Ensure ID doesn't start with digit
  // 确保ID不以数字开头
  if (/^[0-9]/.test(cleanId)) {
    cleanId = 'tool_' + cleanId;
  }
  // Ensure ID is not empty
  // 确保ID不为空
  if (!cleanId || cleanId.trim() === '') {
    cleanId = 'tool_call_1';
  }
  return cleanId;
}

/**
 * Convert OpenAI/OpenRouter streaming response chunk to GenAI unified format
 * 转换 OpenAI/OpenRouter 流式响应块为 GenAI 统一格式
 */
function convertOpenAIStreamChunk(openaiChunk: any, state: OpenAIStreamState): StreamingChunk | null {
  const choice = openaiChunk.choices?.[0];
  const delta = choice?.delta;

  // Handle usage (OpenRouter may send in last chunk)
  // 处理 Usage (OpenRouter 可能会在最后一个 chunk 发送)
  if (openaiChunk.usage) {
    state.usage = openaiChunk.usage;
    return {
      candidates: [{
        content: { role: 'model', parts: [] },
        index: 0
      }],
      usageMetadata: {
        promptTokenCount: openaiChunk.usage.prompt_tokens || 0,
        candidatesTokenCount: openaiChunk.usage.completion_tokens || 0,
        totalTokenCount: openaiChunk.usage.total_tokens || 0
      }
    };
  }

  if (!delta) return null;

  const parts: any[] = [];

  // 1. Handle text content
  // 1. 处理文本内容
  if (delta.content) {
    parts.push({ text: delta.content });
  }

  // 2. Handle tool calls
  // 2. 处理工具调用 (tool_calls)
  if (delta.tool_calls && Array.isArray(delta.tool_calls)) {
    for (const tc of delta.tool_calls) {
      const index = tc.index ?? 0;
      let currentTC = state.toolCalls.get(index);

      if (!currentTC) {
        currentTC = {
          id: tc.id || `call_${Date.now()}_${index}`,
          name: tc.function?.name || '',
          arguments: ''
        };
        state.toolCalls.set(index, currentTC);
      }

      if (tc.function?.name) {
        currentTC.name = tc.function.name;
      }

      if (tc.function?.arguments) {
        currentTC.arguments += tc.function.arguments;
      }

      // Check if JSON is complete and send if so
      // 检查 JSON 是否完整，如果完整则发送
      if (currentTC.arguments.trim()) {
        try {
          const args = JSON.parse(currentTC.arguments);
          parts.push({
            functionCall: {
              id: currentTC.id,
              name: currentTC.name,
              args: args
            }
          });
          // Remove from state after sending to avoid duplicates
          // 发送后从状态中移除，避免重复发送
          state.toolCalls.delete(index);
        } catch (e) {
          // JSON is not yet complete, continue accumulating
          // JSON 尚不完整，继续累积
        }
      }
    }
  }

  if (parts.length === 0 && !choice?.finish_reason) {
    return null;
  }

  const chunk: StreamingChunk = {
    candidates: [{
      content: {
        role: 'model',
        parts: parts
      },
      index: choice?.index || 0,
      finishReason: choice?.finish_reason === 'stop' ? 'STOP' :
                   choice?.finish_reason === 'tool_calls' ? 'TOOL_USE' :
                   choice?.finish_reason ? choice.finish_reason.toUpperCase() : undefined
    }]
  };

  return chunk;
}

/**
 * Convert Claude Anthropic streaming response chunk to GenAI unified format
 * 转换 Claude Anthropic 流式响应块为 GenAI 统一格式
 */
function convertClaudeStreamChunk(claudeChunk: any, state: ClaudeStreamState): StreamingChunk | null {
  switch (claudeChunk.type) {
    case 'message_start':
      // Message start, record input_tokens and cache tokens
      // 消息开始，记录 input_tokens 和缓存 tokens
      if (claudeChunk.message?.usage) {
        const usage = claudeChunk.message.usage;
        state.inputTokens = usage.input_tokens || 0;
        state.cacheCreationTokens = usage.cache_creation_input_tokens || 0;
        state.cacheReadTokens = usage.cache_read_input_tokens || 0;
      }
      return null;

    case 'content_block_start':
      // Tool call start
      // 工具调用开始
      if (claudeChunk.content_block?.type === 'tool_use') {
        state.currentToolCall = {
          id: cleanToolUseId(claudeChunk.content_block.id),
          name: claudeChunk.content_block.name || '',
          partialJson: '',
          isComplete: false
        };
        return null;
      }
      // Text block start
      // 文本块开始
      if (claudeChunk.content_block?.type === 'text') {
        return null;
      }
      break;

    case 'content_block_delta':
      // Text delta update
      // 文本增量更新
      if (claudeChunk.delta?.type === 'text_delta' && claudeChunk.delta?.text) {
        return {
          candidates: [{
            content: {
              role: 'model',
              parts: [{ text: claudeChunk.delta.text }]
            },
            index: 0
          }]
        };
      }
      // Tool call parameters delta
      // 工具调用参数增量
      if (claudeChunk.delta?.type === 'input_json_delta' && state.currentToolCall) {
        state.currentToolCall.partialJson += claudeChunk.delta.partial_json || '';

        // Try parsing JSON to mark if complete
        // 尝试解析JSON，标记是否完整
        if (state.currentToolCall.partialJson.trim()) {
          try {
            JSON.parse(state.currentToolCall.partialJson);
            state.currentToolCall.isComplete = true; // JSON is complete / JSON已完整
          } catch (e) {
            state.currentToolCall.isComplete = false; // JSON is not yet complete / JSON还不完整
          }
        }

        return null; // Accumulating, don't send yet (wait for content_block_stop) / 累积中，暂不发送（等待content_block_stop）
      }
      break;

    case 'content_block_stop':
      // Content block end - if tool call, send complete functionCall
      // 内容块结束 - 如果是工具调用，发送完整的 functionCall
      if (state.currentToolCall) {
        const toolCall = state.currentToolCall;
        let args = {};

        // Only send functionCall when JSON parses successfully and marked as complete
        // 只有当JSON解析成功且标记为完整时，才发送functionCall
        if (toolCall.isComplete && toolCall.partialJson) {
          try {
            args = JSON.parse(toolCall.partialJson);
          } catch (e) {
            args = {};
          }
        }

        const chunk: StreamingChunk = {
          candidates: [{
            content: {
              role: 'model',
              parts: [{
                functionCall: {
                  id: toolCall.id,
                  name: toolCall.name,
                  args: args
                }
              } as any]
            },
            index: 0
          }]
        };

        state.currentToolCall = null;
        return chunk;
      }
      return null;

    case 'message_stop':
      // Message end
      // 消息结束
      return {
        candidates: [{
          content: {
            role: 'model',
            parts: []
          },
          finishReason: 'STOP',
          index: 0
        }]
      };

    case 'message_delta':
      // Message delta, contains stop_reason and usage
      // 消息增量，包含 stop_reason 和 usage
      if (claudeChunk.usage?.output_tokens) {
        state.outputTokens = claudeChunk.usage.output_tokens;
      }

      const finishReason = claudeChunk.delta?.stop_reason;
      const chunk: StreamingChunk = {
        candidates: [{
          content: {
            role: 'model',
            parts: []
          },
          finishReason: finishReason === 'end_turn' ? 'STOP' :
                       finishReason === 'tool_use' ? 'TOOL_USE' :
                       finishReason ? 'STOP' : undefined,
          index: 0
        }]
      };

      // Add usage statistics
      // 添加 usage 统计
      if (state.inputTokens > 0 || state.outputTokens > 0) {
        const totalInput = state.inputTokens +
                          state.cacheCreationTokens +
                          state.cacheReadTokens;
        chunk.usageMetadata = {
          promptTokenCount: totalInput,
          candidatesTokenCount: state.outputTokens,
          totalTokenCount: totalInput + state.outputTokens,
          // Cache-related fields
          // 缓存字段
          cachedContentTokenCount: state.cacheReadTokens,
          cacheReadInputTokens: state.cacheReadTokens,
          cacheWriteInputTokens: state.cacheCreationTokens
        };
      }

      return chunk;
  }

  return null;
}

/**
 * Convert Gemini Vertex AI streaming response chunk to GenAI unified format
 * 转换 Gemini Vertex AI 流式响应块为 GenAI 统一格式
 *
 * Handle text, functionCall, usageMetadata, etc.
 * 处理文本、functionCall、usageMetadata 等
 *
 * References parent project src/routes/chat/strategies/gemini.ts implementation
 * 参考父项目 src/routes/chat/strategies/gemini.ts 的实现
 */
function convertGeminiStreamChunk(geminiChunk: any): StreamingChunk | null {
  const candidate = geminiChunk.candidates?.[0];

  if (!candidate) {
    // May only contain usageMetadata
    // 可能只包含 usageMetadata
    if (geminiChunk.usageMetadata) {
      return {
        candidates: [{
          content: {
            role: 'model',
            parts: []
          },
          index: 0
        }],
        usageMetadata: buildUsageMetadata(geminiChunk.usageMetadata)
      };
    }
    return null;
  }

  const parts: any[] = [];
  let hasContent = false;

  if (candidate.content?.parts) {
    for (const part of candidate.content.parts) {
      // Handle tool calls (functionCall) - process first
      // 处理工具调用 (functionCall) - 优先处理
      if (part.functionCall) {
        const functionCallPart: any = {
          functionCall: {
            name: part.functionCall.name,
            args: part.functionCall.args || {}
          }
        };

        // Preserve ID (if any) - generate unique ID if not present
        // 保留 ID（如果有）- 生成唯一 ID 如果没有
        if (part.functionCall.id) {
          functionCallPart.functionCall.id = part.functionCall.id;
        } else {
          functionCallPart.functionCall.id = `gemini_tool_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        }

        // Preserve thoughtSignature (Gemini 2.5/3.0 thinking signature) - at part level
        // 保留 thoughtSignature（Gemini 2.5/3.0 思考签名）- 在 part 级别
        if (part.thoughtSignature) {
          functionCallPart.thoughtSignature = part.thoughtSignature;
        }

        parts.push(functionCallPart);
        hasContent = true;
        continue; // functionCall done / functionCall 处理完毕
      }

      // Handle empty text but with thoughtSignature case
      // 处理空文本但有 thoughtSignature 的情况
      if (part.thoughtSignature && !part.text) {
        parts.push({
          text: '',
          thoughtSignature: part.thoughtSignature
        });
        hasContent = true;
        continue;
      }

      // Handle text content
      // 处理文本内容
      if (part.text !== undefined) {
        // Support thinking mode: part.thought === true means thinking content
        // Convert to reasoning field for client use
        // 支持思考模式: part.thought === true 表示思考内容
        // 转换为客户端可用的 reasoning 字段
        const isThinking = part.thought === true;
        const partData: any = isThinking
          ? { reasoning: part.text }   // Thinking content uses reasoning field / 思考内容使用 reasoning 字段
          : { text: part.text };       // Normal text uses text field / 普通文本使用 text 字段

        // Preserve thoughtSignature
        // 保留 thoughtSignature
        if (part.thoughtSignature) {
          partData.thoughtSignature = part.thoughtSignature;
        }

        parts.push(partData);
        hasContent = true;
      }
    }
  }

  // If no content but has finishReason, still return
  // 如果没有内容但有 finishReason，仍需返回
  if (!hasContent && !candidate.finishReason && !geminiChunk.usageMetadata) {
    return null;
  }

  const chunk: StreamingChunk = {
    candidates: [{
      content: {
        role: 'model',
        parts: parts.length > 0 ? parts : []
      },
      index: candidate.index || 0,
      finishReason: candidate.finishReason
    }]
  };

  // 添加 usageMetadata
  if (geminiChunk.usageMetadata) {
    chunk.usageMetadata = buildUsageMetadata(geminiChunk.usageMetadata);
  }

  return chunk;
}

/**
 * Build standardized usageMetadata
 * 构建标准化的 usageMetadata
 */
function buildUsageMetadata(usage: any): any {
  return {
    promptTokenCount: usage.promptTokenCount || 0,
    candidatesTokenCount: usage.candidatesTokenCount || 0,
    totalTokenCount: usage.totalTokenCount || 0,
    // Cache-related fields
    // 缓存相关字段
    cachedContentTokenCount: usage.cachedContentTokenCount || 0,
    cacheReadInputTokens: usage.cachedContentTokenCount || usage.cacheReadInputTokens || 0,
    cacheWriteInputTokens: usage.cacheCreationInputTokenCount || usage.cacheWriteInputTokens || 0,
    // If creditsUsage exists, preserve it
    // 如果有 creditsUsage，也保留
    ...(usage.creditsUsage !== undefined && { creditsUsage: usage.creditsUsage })
  };
}

/**
 * Model Information Type Definition
 * 模型信息类型定义
 */
export interface ModelInfo {
  name: string;
  displayName: string;
  creditsPerRequest: number;
  available: boolean;
  maxToken: number;
  highVolumeThreshold?: number;
  highVolumeCredits?: number;
}

/**
 * API 响应格式
 */
export interface ApiResponse<T = any> {
  code: number;
  success: boolean;
  data: T;
  message: string;
}

/**
 * POST /v1/chat/messages
 * 处理非流式聊天请求
 *
 * 请求格式（Google Generative AI 标准）:
 * {
 *   "model": "claude-haiku-4-5@20251001",
 *   "contents": [
 *     {
 *       "role": "user",
 *       "parts": [{"text": "Hello!"}]
 *     }
 *   ],
 *   "generationConfig": {
 *     "temperature": 0.7,
 *     "maxOutputTokens": 1024
 *   }
 * }
 *
 * 响应格式:
 * {
 *   "candidates": [...],
 *   "usageMetadata": {...}
 * }
 */
router.post('/v1/chat/messages', async (req: Request, res: Response) => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    // 规范化请求格式（支持 GenAI config 格式）
    const rawRequest = req.body as UnifiedChatRequest;
    const request = normalizeRequest(rawRequest);

    // 1. 验证请求
    const validation = validateChatRequest(request);
    if (!validation.valid) {
      return res.status(400).json(createErrorResponse(validation.error || 'Invalid request'));
    }

    // 2. 获取模型配置
    const modelConfig = getModelConfig(request.model);
    if (!modelConfig) {
      return res.status(400).json(
        createErrorResponse(`Model not found: ${request.model}`)
      );
    }

    // 3. 准备 API 调用上下文
    const apiContext: APICallContext = {
      modelName: request.model,
      modelConfig,
      request: {
        ...request,
        stream: false, // 非流式请求
      },
      requestId,
    };

    // 4. 调用 AI API
    debugLog(`Calling upstream API`, { api_format: modelConfig.api_format, model: request.model });
    const apiResponse = await callAIAPI(apiContext);

    debugLog(`Upstream API response`, {
      status: apiResponse.status,
      statusText: apiResponse.statusText,
      headers: Object.fromEntries(apiResponse.headers.entries())
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      debugLog(`Upstream API error`, { status: apiResponse.status, error: errorText });
      return res.status(apiResponse.status).json(
        createErrorResponse(`API error: ${errorText.substring(0, 200)}`)
      );
    }

    // 5. 解析响应
    const apiData = await apiResponse.json();
    debugLog(`Upstream API raw response (first 500 chars)`,
      JSON.stringify(apiData).substring(0, 500)
    );

    const unifiedResponse = parseAPIResponse(apiData, modelConfig.api_format, request.model);
    debugLog(`Unified response sent to client`, {
      candidates: unifiedResponse.candidates?.length || 0,
      usageMetadata: unifiedResponse.usageMetadata
    });

    // 6. 返回统一格式的响应
    res.json(unifiedResponse);
  } catch (error) {
    res.status(500).json(
      createErrorResponse(error instanceof Error ? error.message : 'Internal server error')
    );
  }
});

/**
 * POST /v1/chat/stream
 * 处理流式聊天请求（Server-Sent Events）
 *
 * 请求格式同上，但需要 stream: true
 * {
 *   "model": "gemini-2.5-flash",
 *   "contents": [...],
 *   "stream": true
 * }
 *
 * 响应格式 (SSE):
 * data: {"candidates":[...]}\n\n
 * data: {"candidates":[...]}\n\n
 * ...
 * data: [DONE]\n\n
 */
router.post('/v1/chat/stream', async (req: Request, res: Response) => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // 初始化 Claude 流式处理状态
  const claudeState: ClaudeStreamState = {
    currentToolCall: null,
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationTokens: 0,
    cacheReadTokens: 0
  };

  // 初始化 OpenAI 流式处理状态
  const openaiState: OpenAIStreamState = {
    toolCalls: new Map(),
    usage: null
  };

  try {
    // 规范化请求格式（支持 GenAI config 格式）
    const rawRequest = req.body as UnifiedChatRequest;
    const request = normalizeRequest(rawRequest);

    // 1. 验证请求
    const validation = validateChatRequest(request);
    if (!validation.valid) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.write(`data: ${JSON.stringify(createErrorResponse(validation.error || 'Invalid request'))}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    // 2. 获取模型配置
    const modelConfig = getModelConfig(request.model);
    if (!modelConfig) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.write(
        `data: ${JSON.stringify(createErrorResponse(`Model not found: ${request.model}`))}\n\n`
      );
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    // 3. 准备 API 调用上下文
    const apiContext: APICallContext = {
      modelName: request.model,
      modelConfig,
      request: {
        ...request,
        stream: true, // 流式请求
      },
      requestId,
    };

    // 4. 设置流式响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Connection', 'keep-alive');

    // 5. 调用 AI API（流式）
    debugLog(`Calling upstream API (streaming)`, { api_format: modelConfig.api_format, model: request.model });
    const apiResponse = await callAIAPI(apiContext);

    debugLog(`Upstream API response (streaming)`, {
      status: apiResponse.status,
      statusText: apiResponse.statusText
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      debugLog(`Upstream API error (streaming)`, { status: apiResponse.status, error: errorText });
      res.write(`data: ${JSON.stringify(createErrorResponse(`API error: ${errorText.substring(0, 200)}`))}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    // 6. 转发流式响应
    // 处理不同格式的流式响应并统一为 SSE 格式
    debugLog(`Starting stream processing for ${request.model}`);
    const reader = apiResponse.body?.getReader();
    if (!reader) {
      res.write(`data: ${JSON.stringify(createErrorResponse('No stream reader available'))}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';
    const isClaude = request.model.toLowerCase().includes('claude');
    let chunkCount = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          debugLog(`Stream ended, total chunks processed: ${chunkCount}`);
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          // Claude 流式响应格式: event: xxx \n data: {...}
          // OpenAI/Gemini 格式: data: {...}
          if (line.startsWith('data: ')) {
            const dataStr = line.substring(6);

            if (dataStr === '[DONE]') {
              debugLog(`Received [DONE] from upstream`);
              res.write('data: [DONE]\n\n');
              continue;
            }

            try {
              const json = JSON.parse(dataStr);
              debugLog(`Upstream chunk ${++chunkCount} (raw)`, {
                type: json.type || json.event,
                preview: JSON.stringify(json).substring(0, 200)
              });

              // 将 API 响应转换为统一 SSE 格式
              let unifiedChunk: StreamingChunk | null = null;

              if (modelConfig.api_format === 'openai') {
                // 转换 OpenAI/OpenRouter SSE 格式
                unifiedChunk = convertOpenAIStreamChunk(json, openaiState);
              } else if (isClaude) {
                // 转换 Claude Anthropic SSE 格式
                unifiedChunk = convertClaudeStreamChunk(json, claudeState);
              } else {
                // Gemini Vertex AI 格式 - 需要处理 functionCall 等特殊情况
                unifiedChunk = convertGeminiStreamChunk(json);
              }

              if (unifiedChunk) {
                debugLog(`Converted chunk ${chunkCount} (unified)`, {
                  candidates: unifiedChunk.candidates?.length,
                  hasUsageMetadata: !!unifiedChunk.usageMetadata,
                  preview: JSON.stringify(unifiedChunk).substring(0, 200)
                });
                res.write(`data: ${JSON.stringify(unifiedChunk)}\n\n`);
              }
            } catch (parseError) {
              debugLog(`Chunk ${++chunkCount} parse error`, { error: String(parseError) });
              // 忽略解析错误，继续处理下一个块
            }
          }
        }
      }

      debugLog(`Sending [DONE] to client`);
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (streamError) {
      res.write(`data: ${JSON.stringify(createErrorResponse('Stream processing error'))}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    }
  } catch (error) {
    res.setHeader('Content-Type', 'text/event-stream');
    const errorData = createErrorResponse(
      error instanceof Error ? error.message : 'Internal server error'
    );
    res.write(`data: ${JSON.stringify(errorData)}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  }
});

/**
 * 可用模型列表 - 最新的模型配置（2025-05-14）
 * 从 clients.ts MODEL_DATABASE 同步而来
 */
const AVAILABLE_MODELS: ModelInfo[] = [
  // ============================================
  // Claude 模型 - 最新版本 (2025)
  // ============================================
  {
    name: 'claude-sonnet-4@20250514',
    displayName: 'Claude-Sonnet-4 (May 2025)',
    creditsPerRequest: 8,
    available: true,
    maxToken: 200000
  },
  {
    name: 'claude-sonnet-4-5@20250929',
    displayName: 'Claude-Sonnet-4.5 (Sep 2025)',
    creditsPerRequest: 9,
    available: true,
    maxToken: 200000
  },
  {
    name: 'claude-haiku-4-5@20251001',
    displayName: 'Claude-Haiku-4.5 (Oct 2025)',
    creditsPerRequest: 1,
    available: true,
    maxToken: 200000
  },
  {
    name: 'claude-opus-4-5@20251101',
    displayName: 'Claude-Opus-4.5 (Nov 2025)',
    creditsPerRequest: 15,
    available: true,
    maxToken: 200000
  },

  // ============================================
  // Gemini 模型 - 最新版本 (2025)
  // ============================================
  {
    name: 'gemini-2.5-flash',
    displayName: 'Gemini-2.5-Flash',
    creditsPerRequest: 1,
    available: true,
    maxToken: 1048576
  },
  {
    name: 'gemini-2.5-pro',
    displayName: 'Gemini-2.5-Pro',
    creditsPerRequest: 4,
    available: true,
    maxToken: 1048576
  },
  {
    name: 'gemini-2.5-flash-lite',
    displayName: 'Gemini-2.5-Flash-Lite',
    creditsPerRequest: 0.3,
    available: true,
    maxToken: 1048576
  },
  {
    name: 'gemini-3-pro-preview',
    displayName: 'Gemini-3-Pro-Preview',
    creditsPerRequest: 5,
    available: true,
    maxToken: 2000000
  },

  // ============================================
  // OpenRouter 模型 - 最新版本 (2025)
  // ============================================
  {
    name: 'openai/gpt-5.1-codex',
    displayName: 'GPT-5.1-Codex',
    creditsPerRequest: 4.1,
    available: true,
    maxToken: 390000
  },
  {
    name: 'openai/gpt-5.2',
    displayName: 'GPT-5.2',
    creditsPerRequest: 6.4,
    available: true,
    maxToken: 390000
  },
  {
    name: 'x-ai/grok-code-fast-1',
    displayName: 'Grok-Code-Fast-1',
    creditsPerRequest: 1.2,
    available: true,
    maxToken: 200000
  },
  {
    name: 'x-ai/grok-4.1-fast',
    displayName: 'Grok-4.1-Fast',
    creditsPerRequest: 0.5,
    available: true,
    maxToken: 1800000
  },
  {
    name: 'minimax/minimax-m2:free',
    displayName: 'MiniMax-M2 (Free)',
    creditsPerRequest: 0.1,
    available: true,
    maxToken: 400000
  },
  {
    name: 'codestral-2',
    displayName: 'Mistral-Codestral-2',
    creditsPerRequest: 0.8,
    available: true,
    maxToken: 256000
  }
];

/**
 * GET /web-api/models
 * 获取可用模型列表
 *
 * 返回所有可用的 AI 模型信息，客户端可用此接口展示模型选择列表。
 *
 * @returns 返回包含所有可用模型的响应
 *
 * @example
 * curl http://localhost:3001/web-api/models
 */
router.get('/web-api/models', (req: Request, res: Response) => {
  const response: ApiResponse<ModelInfo[]> = {
    code: 200,
    success: true,
    data: AVAILABLE_MODELS,
    message: '获取成功'
  };

  res.json(response);
});

/**
 * GET /web-api/models/:modelName
 * 获取单个模型的详细信息
 *
 * @param modelName - 模型名称
 * @returns 返回指定模型的详细信息
 *
 * @example
 * curl http://localhost:3001/web-api/models/gemini-2.5-flash
 */
router.get('/web-api/models/:modelName', (req: Request, res: Response) => {
  const { modelName } = req.params;

  const model = AVAILABLE_MODELS.find(m => m.name === modelName);

  if (!model) {
    return res.status(404).json({
      code: 404,
      success: false,
      data: null,
      message: `模型 ${modelName} 不存在`
    });
  }

  const response: ApiResponse<ModelInfo> = {
    code: 200,
    success: true,
    data: model,
    message: '获取成功'
  };

  res.json(response);
});

/**
 * POST /web-api/models/filter
 * 过滤模型列表
 *
 * 支持按多个条件过滤模型:
 * - available: 可用性
 * - minMaxToken: 最小 token 数
 * - maxMaxToken: 最大 token 数
 * - minCredits: 最小费用
 * - maxCredits: 最大费用
 *
 * @example
 * curl -X POST http://localhost:3001/web-api/models/filter \
 *   -H "Content-Type: application/json" \
 *   -d '{"available":true,"maxCredits":5}'
 */
router.post('/web-api/models/filter', (req: Request, res: Response) => {
  const { available, minMaxToken, maxMaxToken, minCredits, maxCredits } = req.body;

  let filtered = AVAILABLE_MODELS;

  // 按可用性过滤
  if (available !== undefined) {
    filtered = filtered.filter(m => m.available === available);
  }

  // 按最小 token 数过滤
  if (minMaxToken !== undefined) {
    filtered = filtered.filter(m => m.maxToken >= minMaxToken);
  }

  // 按最大 token 数过滤
  if (maxMaxToken !== undefined) {
    filtered = filtered.filter(m => m.maxToken <= maxMaxToken);
  }

  // 按最小费用过滤
  if (minCredits !== undefined) {
    filtered = filtered.filter(m => m.creditsPerRequest >= minCredits);
  }

  // 按最大费用过滤
  if (maxCredits !== undefined) {
    filtered = filtered.filter(m => m.creditsPerRequest <= maxCredits);
  }

  const response: ApiResponse<ModelInfo[]> = {
    code: 200,
    success: true,
    data: filtered,
    message: '获取成功'
  };

  res.json(response);
});

/**
 * GET /web-api/models/stats/summary
 * 获取模型统计信息
 *
 * @returns 返回模型统计信息 (总数、可用数、费用范围等)
 *
 * @example
 * curl http://localhost:3001/web-api/models/stats/summary
 */
router.get('/web-api/models/stats/summary', (req: Request, res: Response) => {
  const available = AVAILABLE_MODELS.filter(m => m.available);
  const credits = AVAILABLE_MODELS.map(m => m.creditsPerRequest);
  const maxTokens = AVAILABLE_MODELS.map(m => m.maxToken);

  const stats = {
    total: AVAILABLE_MODELS.length,
    available: available.length,
    minCredits: Math.min(...credits),
    maxCredits: Math.max(...credits),
    minMaxToken: Math.min(...maxTokens),
    maxMaxToken: Math.max(...maxTokens),
    averageCredits: Number((credits.reduce((a, b) => a + b, 0) / credits.length).toFixed(2))
  };

  const response: ApiResponse<typeof stats> = {
    code: 200,
    success: true,
    data: stats,
    message: '获取成功'
  };

  res.json(response);
});

/**
 * POST /auth/jwt/deepvlab-login
 * DeepVLab 登录接口 (Mock)
 *
 * 返回固定的 Mock JWT Token，用于开发和测试
 * 实际生产环境应该验证用户凭证并生成真实的 JWT Token
 *
 * @example
 * curl -X POST http://localhost:3001/auth/jwt/deepvlab-login \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "plat": "deepvlab",
 *     "token": "test_token",
 *     "user_id": "test_user_123"
 *   }'
 *
 * @returns {
 *   "success": true,
 *   "accessToken": "eyJ...",
 *   "refreshToken": "eyJ...",
 *   "expiresIn": 1296000,
 *   "invitationBound": false,
 *   "user": {
 *     "openId": "4b6fe175-e11b-422b-921d-61570f98e979",
 *     "userId": "4b6fe175-e11b-422b-921d-61570f98e979",
 *     "name": "xiao yang",
 *     "email": "xiaoyang@gmail.com",
 *     "avatar": "...",
 *     "permissions": ["user"]
 *   }
 * }
 */
router.post('/auth/jwt/deepvlab-login', (req: Request, res: Response) => {
  try {
    const { plat, token, user_id } = req.body;

    // 基本参数验证
    if (!plat || !token || !user_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: plat, token, user_id',
        code: 'INVALID_REQUEST'
      });
    }

    // 验证 plat 参数
    if (plat !== 'deepvlab') {
      return res.status(400).json({
        success: false,
        error: 'Invalid plat value, must be "deepvlab"',
        code: 'INVALID_PLAT'
      });
    }

    // 生成 Mock JWT Token (有效期1年)
    const now = Math.floor(Date.now() / 1000);
    const expiresIn = 365 * 24 * 60 * 60; // 1年，单位秒
    const expireTime = now + expiresIn;

    // Mock AccessToken (格式: header.payload.signature)
    // 注意: 这是 Mock Token，实际应使用真实的 JWT 库生成
    const accessTokenPayload = {
      iss: 'deepvlab-auth-server',
      sub: 'test_user_uuid_' + Math.random().toString(36).substr(2, 8),
      aud: 'deepvlab-api',
      exp: expireTime,
      iat: now,
      jti: 'test_jti_' + Math.random().toString(36).substr(2, 12),
      user: {
        userUuid: 'bdc71657-8ee4-11f0-a6c8-4201cxxx0007',
        openId: '4b6fe175-e11b-422b-921d-6xxxxf98e979',
        userId: user_id,
        name: 'biao yang',
        email: 'yangbiao0514@gmail.com',
        avatar: 'https://lh3.googleusercontent.com/a/ACg8ocJGv8zc8cBpUtycqvJpjcbZ0U20rCRR8_b-J6g=s96-c'
      },
      session: {
        sessionId: 'test_session_' + Math.random().toString(36).substr(2, 8),
        deviceId: 'web_test_device',
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.get('User-Agent') || 'Mock-Client'
      },
      permissions: ['user'],
      tokenType: 'access'
    };

    // Mock RefreshToken
    const refreshTokenPayload = {
      iss: 'deepvlab-auth-server',
      sub: accessTokenPayload.user.userUuid,
      aud: 'deepvlab-api',
      exp: now + 15 * 24 * 60 * 60, // 刷新令牌有效期 15 天
      iat: now,
      jti: 'test_refresh_jti_' + Math.random().toString(36).substr(2, 12),
      sessionId: accessTokenPayload.session.sessionId,
      tokenType: 'refresh',
      accessTokenId: accessTokenPayload.jti
    };

    // 生成 Mock JWT (实际应使用真实库)
    const mockAccessToken = Buffer.from(
      JSON.stringify({
        header: { alg: 'HS256', typ: 'JWT' },
        payload: accessTokenPayload
      })
    ).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_') +
      '.' + Buffer.from(JSON.stringify(accessTokenPayload)).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_') +
      '.mock_signature_' + Math.random().toString(36).substr(2, 20);

    const mockRefreshToken = Buffer.from(
      JSON.stringify({
        header: { alg: 'HS256', typ: 'JWT' },
        payload: refreshTokenPayload
      })
    ).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_') +
      '.' + Buffer.from(JSON.stringify(refreshTokenPayload)).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_') +
      '.mock_signature_' + Math.random().toString(36).substr(2, 20);

    // 返回响应
    res.json({
      success: true,
      accessToken: mockAccessToken,
      refreshToken: mockRefreshToken,
      expiresIn: expiresIn,
      invitationBound: false,
      user: {
        openId: accessTokenPayload.user.openId,
        userId: accessTokenPayload.user.userId,
        name: accessTokenPayload.user.name,
        email: accessTokenPayload.user.email,
        avatar: accessTokenPayload.user.avatar,
        permissions: accessTokenPayload.permissions
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * POST /v1/chat/count-tokens
 * Token 计数接口
 *
 * 根据模型和输入内容计算 token 数量
 * 当前实现为 Mock，直接返回固定数据用于开发测试
 * 生产环境应该实现真实的 token 计数逻辑
 *
 * @param {Object} req.body
 * @param {string} req.body.model - 模型名称
 * @param {Array} req.body.contents - 聊天内容数组
 * @param {Array} [req.body.tools] - 工具定义（可选）
 *
 * @returns {
 *   "input_tokens": 2778,
 *   "total_tokens": 2778,
 *   "totalTokens": 2778
 * }
 *
 * @example
 * curl -X POST 'http://localhost:3001/v1/chat/count-tokens' \
 *   -H 'Content-Type: application/json' \
 *   -H 'Authorization: Bearer your_token' \
 *   -d '{
 *     "model": "claude-haiku-4-5@20251001",
 *     "contents": [
 *       {"role": "user", "parts": [{"text": "Hello, how are you?"}]}
 *     ]
 *   }'
 */
router.post('/v1/chat/count-tokens', (req: Request, res: Response) => {
  try {
    const { model, contents, tools } = req.body;

    // 基本参数验证
    if (!model || !contents) {
      return res.status(400).json({
        error: 'Missing required parameters: model, contents',
        code: 'INVALID_REQUEST'
      });
    }

    // 验证 contents 是否是数组
    if (!Array.isArray(contents)) {
      return res.status(400).json({
        error: 'contents must be an array',
        code: 'INVALID_CONTENTS'
      });
    }

    // 返回固定的 Mock Token 计数响应
    // 实际生产环境应该根据真实的 token 计数逻辑返回动态数据
    res.json({
      input_tokens: 2778,
      total_tokens: 2778,
      totalTokens: 2778
    });

  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

export default router;
