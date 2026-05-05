/**
 * OpenRouter API Client
 * OpenRouter API 客户端
 *
 * Handles communication with OpenRouter API
 * 处理与 OpenRouter API 的通信
 */

import { UnifiedChatRequest, UnifiedChatResponse, Content, Part } from '../types.js';

export class OpenRouterClient {
  private readonly baseUrl: string;
  // State for accumulating tool_calls - aligns with parent project (openai.ts)
  // 状态用于累积 tool_calls - 与父级项目 (openai.ts) 一致
  private accumulatedToolCalls: Map<number, {
    id?: string;
    type?: string;
    function: { name?: string; arguments: string };
    isComplete: boolean;
    sent: boolean;  // Track if already sent to prevent duplicates / 追踪是否已发送以防止重复
  }> = new Map();

  constructor(baseUrl: string = 'https://openrouter.ai/api/v1') {
    this.baseUrl = baseUrl;
  }

  /**
   * Send chat request to OpenRouter API
   * 发送聊天请求到 OpenRouter API
   */
  async chat(request: UnifiedChatRequest, apiKey: string): Promise<Response> {
    const url = `${this.baseUrl}/chat/completions`;

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': apiKey.startsWith('Bearer ') ? apiKey : `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://github.com/deepx-labs/dvcode-prox',
      'X-Title': 'DeepV Code Proxy'
    };

    // Convert Google format to OpenAI format
    // 将 Google 格式转换为 OpenAI 格式
    const openAIBody = this.transformRequest(request);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(openAIBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter API Error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      return response;
    } catch (error) {
      console.error('[OpenRouter] Request failed:', error);
      throw error;
    }
  }

  /**
   * Transform Google Request -> OpenAI Request
   * 转换 Google 格式请求为 OpenAI 格式
   */
  private transformRequest(request: UnifiedChatRequest): any {
    const messages: any[] = [];

    // Handle System Instruction
    // 处理系统指令
    if (request.systemInstruction) {
      let systemText = '';
      if ('parts' in request.systemInstruction) {
        systemText = request.systemInstruction.parts.map(p => p.text).join('');
      }
      messages.push({ role: 'system', content: systemText });
    }

    // Handle Contents
    // 处理内容
    for (const content of request.contents) {
      const role = content.role === 'model' ? 'assistant' : 'user';
      const text = content.parts.map(p => p.text).join('');
      messages.push({ role, content: text });
    }

    const body: any = {
      model: request.model,
      messages,
      stream: request.stream || false,
      temperature: request.generationConfig?.temperature,
      max_tokens: request.generationConfig?.maxOutputTokens,
      top_p: request.generationConfig?.topP,
      stop: request.generationConfig?.stopSequences
    };

    // Transform tools from Google Generative AI format to OpenAI format
    // 从 Google Generative AI 格式转换工具到 OpenAI 格式
    if (request.tools && request.tools.length > 0) {
      const openaiTools: any[] = [];
      for (const tool of request.tools) {
        if (tool.functionDeclarations) {
          for (const func of tool.functionDeclarations) {
            openaiTools.push({
              type: 'function',
              function: {
                name: func.name,
                description: func.description || '',
                parameters: this.transformParameters(func.parameters)
              }
            });
          }
        }
      }
      if (openaiTools.length > 0) {
        body.tools = openaiTools;
      }
    }

    // Handle toolConfig
    // 处理工具配置
    if (request.toolConfig?.functionCallingConfig) {
      const config = request.toolConfig.functionCallingConfig;
      if (config.mode === 'ANY') {
        body.tool_choice = 'required';
      } else if (config.mode === 'NONE') {
        body.tool_choice = 'none';
      } else {
        body.tool_choice = 'auto';
      }
    }

    return body;
  }

  /**
   * Normalize parameters to OpenAI schema standard (consistent with parent project)
   * 将参数规范化为 OpenAI schema 标准（与父级项目一致）
   */
  private transformParameters(params: Record<string, any> | undefined): Record<string, any> {
    if (!params || typeof params !== 'object') {
      return {
        type: 'object',
        properties: {},
        required: []
      };
    }

    return this.normalizeSchemaObject(params);
  }

  /**
   * Recursively normalize JSON Schema object - aligned with parent project
   * 递归规范化 JSON Schema 对象 - 与父级项目一致
   */
  private normalizeSchemaObject(obj: any): any {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    const normalized: any = {};

    // Process type field - convert to lowercase
    // 处理 type 字段 - 转换为小写
    if (obj.type) {
      normalized.type = this.normalizeTypeName(obj.type);
    } else {
      normalized.type = 'object'; // Default type / 默认类型
    }

    // Process properties
    // 处理 properties
    if (obj.properties && typeof obj.properties === 'object') {
      normalized.properties = {};
      for (const [key, value] of Object.entries(obj.properties)) {
        normalized.properties[key] = this.normalizeSchemaObject(value);
      }
    } else if (normalized.type === 'object') {
      normalized.properties = {};
    }

    // Process items for array types
    // 处理数组类型的 items
    if (obj.items && normalized.type === 'array') {
      normalized.items = this.normalizeSchemaObject(obj.items);
    }

    // Process required array
    // 处理 required 数组
    if (obj.required && Array.isArray(obj.required)) {
      normalized.required = [...obj.required];
    } else if (normalized.type === 'object' && normalized.properties) {
      normalized.required = [];
    }

    // Copy other valid fields with type validation
    // 复制其他有效的字段并进行类型验证
    const validFields = [
      { name: 'description', type: 'string' },
      { name: 'enum', type: 'array' },
      { name: 'minimum', type: 'number' },
      { name: 'maximum', type: 'number' },
      { name: 'minLength', type: 'number' },
      { name: 'maxLength', type: 'number' },
      { name: 'minItems', type: 'number' },
      { name: 'maxItems', type: 'number' },
      { name: 'pattern', type: 'string' },
      { name: 'default', type: 'any' }
    ];

    for (const fieldSpec of validFields) {
      const { name, type: expectedType } = fieldSpec;
      if (obj[name] !== undefined) {
        const value = obj[name];

        // Validate and convert types
        // 验证和转换类型
        if (expectedType === 'number') {
          // Numeric fields must be numbers, not strings
          // 数字字段必须是数字，不能是字符串
          if (typeof value === 'number') {
            normalized[name] = value;
          } else if (typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value)) {
            // If it's a numeric string, convert to number
            // 如果是数字格式的字符串，转换为数字
            normalized[name] = parseFloat(value);
          }
          // Otherwise skip this invalid field
          // 否则跳过此无效字段
        } else if (expectedType === 'string') {
          if (typeof value === 'string') {
            normalized[name] = value;
          }
        } else if (expectedType === 'array') {
          if (Array.isArray(value)) {
            normalized[name] = value;
          }
        } else if (expectedType === 'any') {
          // default can be any type
          // default 可以是任何类型
          normalized[name] = value;
        }
      }
    }

    return normalized;
  }

  /**
   * Normalize type name to lowercase (handles STRING, BOOLEAN, etc.)
   * 将类型名称规范化为小写（处理 STRING、BOOLEAN 等）
   */
  private normalizeTypeName(type: string): string {
    if (typeof type !== 'string') {
      return 'string';
    }

    const typeMap: Record<string, string> = {
      'OBJECT': 'object',
      'STRING': 'string',
      'NUMBER': 'number',
      'INTEGER': 'integer',
      'BOOLEAN': 'boolean',
      'ARRAY': 'array',
      'NULL': 'null'
    };

    const upperType = type.toUpperCase();
    return typeMap[upperType] || type.toLowerCase();
  }

  /**
   * Transform OpenAI Response -> Google Response
   * 转换 OpenAI 响应为 Google 格式
   */
  public async transformResponse(response: Response): Promise<UnifiedChatResponse> {
    const data = await response.json();

    const candidates = data.choices?.map((choice: any, index: number) => ({
      index: choice.index || index,
      finishReason: choice.finish_reason?.toUpperCase() || 'STOP',
      content: {
        role: 'model',
        parts: [{ text: choice.message?.content || '' }]
      }
    })) || [];

    return {
      candidates,
      usageMetadata: {
        promptTokenCount: data.usage?.prompt_tokens || 0,
        candidatesTokenCount: data.usage?.completion_tokens || 0,
        totalTokenCount: data.usage?.total_tokens || 0
      }
    };
  }

  /**
   * Transform OpenAI Stream Chunk -> Google Stream Chunk (SSE format)
   * 转换 OpenAI 流式块为 Google 格式 (SSE 格式)
   *
   * Aligns with parent project's processAndForwardChunk implementation
   * 与父级项目的 processAndForwardChunk 实现一致
   */
  public transformStreamChunk(chunkStr: string, finishReason?: string): string {
    // Input is a raw SSE data line value (JSON string) from OpenAI
    // 输入是来自 OpenAI 的原始 SSE 数据行值（JSON 字符串）
    // Output should be a SSE data line value (JSON string) in Google format
    // 输出应为 Google 格式的 SSE 数据行值（JSON 字符串）
    // Note: tool_calls arguments come in incremental chunks, need to accumulate
    // 注意: tool_calls 参数分块到达，需要累积 (参考父级项目的实现)

    try {
      if (chunkStr === '[DONE]') {
        // Clear state on stream end
        // 流结束时清除状态
        this.accumulatedToolCalls.clear();
        return '[DONE]';
      }

      const chunk = JSON.parse(chunkStr);
      const choice = chunk.choices?.[0];
      const delta = choice?.delta || {};

      if (!choice) return '';

      // Build content parts
      // 构建内容部分
      const parts: any[] = [];

      // Add text content
      // 添加文本内容
      if (delta.content) {
        parts.push({ text: delta.content });
      }

      // Accumulate tool_calls (align with parent project implementation)
      // 累积 tool_calls (与父级项目的实现一致)
      if (delta.tool_calls && delta.tool_calls.length > 0) {
        for (const toolCall of delta.tool_calls) {
          const index = toolCall.index ?? 0;

          // Initialize accumulator for this index
          // 为此索引初始化累积器
          if (!this.accumulatedToolCalls.has(index)) {
            this.accumulatedToolCalls.set(index, {
              id: toolCall.id,
              type: toolCall.type || 'function',
              function: {
                name: toolCall.function?.name || '',
                arguments: ''
              },
              isComplete: false,
              sent: false
            });
          }

          const accumulated = this.accumulatedToolCalls.get(index)!;

          // Accumulate id (usually only in first chunk)
          // 累积 id（通常仅在第一个块中）
          if (toolCall.id) {
            accumulated.id = toolCall.id;
          }

          // Accumulate function name (usually only in first chunk)
          // 累积函数名称（通常仅在第一个块中）
          if (toolCall.function?.name) {
            accumulated.function.name = toolCall.function.name;
          }

          // Key: accumulate function arguments (split across multiple chunks)
          // 关键：累积函数参数（分散在多个块中）
          if (toolCall.function?.arguments) {
            accumulated.function.arguments += toolCall.function.arguments;

            // Try to parse JSON to detect if complete
            // 尝试解析 JSON 以检测是否完整
            if (accumulated.function.arguments.trim()) {
              try {
                JSON.parse(accumulated.function.arguments);
                accumulated.isComplete = true;
              } catch (parseError) {
                // JSON still incomplete, keep accumulating
                // JSON 仍然不完整，继续累积
              }
            }
          }
        }
      }

      // Handle reasoning (OpenAI format -> GenAI format)
      // 处理推理（OpenAI 格式 -> GenAI 格式）
      if (delta.reasoning) {
        parts.push({
          reasoning: delta.reasoning
        });
      }

      // Get finish reason from the chunk or parameter
      // 从块或参数获取 finish reason
      const chunkFinishReason = choice?.finish_reason || finishReason;

      // Add tool calls only when finish_reason === 'tool_calls' (like parent project)
      // 仅当 finish_reason === 'tool_calls' 时添加工具调用（如父级项目）
      if (chunkFinishReason === 'tool_calls' && this.accumulatedToolCalls.size > 0) {
        for (const [index, toolCall] of this.accumulatedToolCalls.entries()) {
          // Only send complete, unsent tool calls with valid names
          // 仅发送完整的、未发送的、有效名称的工具调用
          if (toolCall.isComplete && !toolCall.sent && toolCall.function.name) {
            parts.push({
              functionCall: {
                id: toolCall.id || `call_${Date.now()}_${index}`,
                name: toolCall.function.name,
                args: this.parseToolCallArguments(toolCall.function.arguments)
              }
            });

            // Mark as sent to prevent duplicates (key mechanism from parent project)
            // 标记为已发送以防止重复（来自父级项目的关键机制）
            toolCall.sent = true;
          }
        }
      }

      // If no content, skip this chunk
      // 如果没有内容，跳过此块
      if (parts.length === 0) return '';

      // Google Stream format: Array of candidates
      // Google 流式格式：候选对象数组
      const googleChunk: UnifiedChatResponse = {
        candidates: [{
          index: choice.index || 0,
          content: {
            role: 'model',
            parts
          }
        }]
      };

      // Add finish reason if present
      // 如果存在，添加 finish reason
      if (chunkFinishReason && googleChunk.candidates) {
        googleChunk.candidates[0].finishReason = chunkFinishReason.toUpperCase();
      }

      // Add usage metadata if present (usually in the final chunk)
      // 如果存在，添加使用元数据（通常在最后的块中）
      if (chunk.usage) {
        googleChunk.usageMetadata = {
          promptTokenCount: chunk.usage.prompt_tokens || 0,
          candidatesTokenCount: chunk.usage.completion_tokens || 0,
          totalTokenCount: chunk.usage.total_tokens || 0
        };
      }

      return JSON.stringify(googleChunk);
    } catch (e) {
      console.error('[OpenRouter] Error transforming stream chunk:', e);
      return '';
    }
  }

  /**
   * Parse tool call arguments safely (aligned with parent project)
   * 安全地解析工具调用参数（与父级项目一致）
   */
  private parseToolCallArguments(argumentsJson: string | undefined): Record<string, any> {
    if (!argumentsJson || typeof argumentsJson !== 'string') {
      return {};
    }

    try {
      return JSON.parse(argumentsJson);
    } catch (error) {
      console.warn('[OpenRouter] Tool call arguments JSON parse failed', {
        error: error instanceof Error ? error.message : String(error),
        argumentsLength: argumentsJson.length,
        preview: argumentsJson.substring(0, 100)
      });
      // Return empty object instead of throwing to avoid interrupting response
      // 返回空对象而不是抛出异常以避免中断响应
      return {};
    }
  }

  }