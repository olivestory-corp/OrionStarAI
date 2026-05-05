/**
 * DeepV Code Server - Chat Core Module
 * DeepV Code 服务器 - 聊天处理核心模块
 *
 * Handles standardized chat requests and responses supporting real API calls (Vertex AI / OpenRouter)
 * 处理标准化的聊天请求和响应，支持真实的 API 调用（Vertex AI / OpenRouter）
 *
 * References parent project chat implementation
 * 参考父级项目的聊天功能实现
 */

import { Response } from 'express';

/**
 * GenAI Configuration Object
 * Google Generative AI format configuration object
 *
 * 谷歌生成式 AI 格式的配置对象
 * Corresponds to GenerateContentConfig interface from @google/genai library
 * 对应 @google/genai 库的 GenerateContentConfig 接口
 */
export interface GenAIConfig {
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
  responseMimeType?: string;
  systemInstruction?: Content | { parts: Part[] } | string;
  tools?: Tool[];
  toolConfig?: ToolConfig;
  safetySettings?: SafetySetting[];
  thinkingConfig?: {
    includeThoughts?: boolean;
    thinkingBudget?: number;
  };
  stream?: boolean;
}

/**
 * Unified Chat Request Format
 * 统一的聊天请求格式
 *
 * Supports two formats:
 * 1. Client GenAI format: { model, contents, config: { ... } }
 * 2. Flattened format: { model, contents, systemInstruction, generationConfig, tools, ... }
 *
 * 支持两种格式:
 * 1. 客户端 GenAI 格式: { model, contents, config: { ... } }
 * 2. 扁平化格式: { model, contents, systemInstruction, generationConfig, tools, ... }
 */
export interface UnifiedChatRequest {
  model: string;
  contents: Content[];
  // GenAI 格式 (客户端使用)
  config?: GenAIConfig;
  // 扁平化格式 (内部使用)
  systemInstruction?: Content | { parts: Part[] } | string;
  generationConfig?: GenerationConfig;
  tools?: Tool[];
  toolConfig?: ToolConfig;
  safetySettings?: SafetySetting[];
  stream?: boolean;
}

/**
 * Normalize client GenAI format requests to internal unified format
 * 将客户端的 GenAI 格式请求规范化为内部统一格式
 *
 * Client format: { model, contents, config: { systemInstruction, tools, temperature, ... } }
 * 客户端格式: { model, contents, config: { systemInstruction, tools, temperature, ... } }
 *
 * Internal format: { model, contents, systemInstruction, generationConfig, tools, ... }
 * 内部格式: { model, contents, systemInstruction, generationConfig, tools, ... }
 */
export function normalizeRequest(request: UnifiedChatRequest): UnifiedChatRequest {
  // If no config object, return directly (already flattened format)
  // 如果没有 config 对象，直接返回（已经是扁平化格式）
  if (!request.config) {
    return request;
  }

  const config = request.config;
  const normalized: UnifiedChatRequest = {
    model: request.model,
    contents: request.contents,
  };

  // Extract systemInstruction
  // 提取 systemInstruction
  if (config.systemInstruction) {
    normalized.systemInstruction = config.systemInstruction;
  }

  // Build generationConfig
  // 构建 generationConfig
  const generationConfig: GenerationConfig = {};
  if (config.temperature !== undefined) generationConfig.temperature = config.temperature;
  if (config.topP !== undefined) generationConfig.topP = config.topP;
  if (config.topK !== undefined) generationConfig.topK = config.topK;
  if (config.maxOutputTokens !== undefined) generationConfig.maxOutputTokens = config.maxOutputTokens;
  if (config.responseMimeType !== undefined) generationConfig.responseMimeType = config.responseMimeType;

  // Handle thinking config (Gemini 2.5+ thinking mode)
  // 处理 thinkingConfig（Gemini 2.5+ 思考模式）
  if (config.thinkingConfig) {
    (generationConfig as any).thinkingConfig = config.thinkingConfig;
  }

  if (Object.keys(generationConfig).length > 0) {
    normalized.generationConfig = generationConfig;
  }

  // Extract tools
  // 提取 tools
  if (config.tools) {
    normalized.tools = config.tools;
  }

  // Extract toolConfig
  // 提取 toolConfig
  if (config.toolConfig) {
    normalized.toolConfig = config.toolConfig;
  }

  // Extract safetySettings
  // 提取 safetySettings
  if (config.safetySettings) {
    normalized.safetySettings = config.safetySettings;
  }

  // Extract stream flag
  // 提取 stream 标志
  if (config.stream !== undefined) {
    normalized.stream = config.stream;
  } else if (request.stream !== undefined) {
    normalized.stream = request.stream;
  }

  return normalized;
}

/**
 * Chat Content Block
 * 聊天内容块
 */
export interface Content {
  role: 'user' | 'model' | 'system';
  parts: Part[];
}

/**
 * Content Part
 * 内容部分
 *
 * Supports Gemini 2.5+ thoughtSignature field
 * 支持 Gemini 2.5+ 的 thoughtSignature 字段
 */
export interface Part {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
  functionCall?: {
    id?: string;
    name: string;
    args: Record<string, any>;
  };
  functionResponse?: {
    id?: string;
    name: string;
    response: Record<string, any>;
  };
  // Gemini 2.5+ thinking signature for maintaining thinking context in multi-turn conversations
  // Gemini 2.5+ 思考签名，用于多轮对话中保持思考上下文
  thoughtSignature?: string;
  // Gemini thinking mode marker
  // Gemini 思考模式标记
  thought?: boolean;
}

/**
 * 生成配置
 */
export interface GenerationConfig {
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
  stopSequences?: string[];
  candidateCount?: number;
  responseMimeType?: string;
}

/**
 * 工具定义
 */
export interface Tool {
  functionDeclarations?: FunctionDeclaration[];
}

/**
 * 函数声明
 */
export interface FunctionDeclaration {
  name: string;
  description?: string;
  parameters?: Record<string, any>;
}

/**
 * 工具配置
 */
export interface ToolConfig {
  functionCallingConfig?: {
    mode: 'AUTO' | 'ANY' | 'NONE';
    allowedFunctionNames?: string[];
  };
}

/**
 * 安全设置
 */
export interface SafetySetting {
  category: string;
  threshold: string;
}

/**
 * Unified Chat Response Format
 * 统一的聊天响应格式
 *
 * Follows Google Generative AI standard format
 * 遵循 Google Generative AI 标准格式
 */
export interface UnifiedChatResponse {
  candidates?: Candidate[];
  promptFeedback?: PromptFeedback;
  usageMetadata?: UsageMetadata;
}

/**
 * 候选响应
 */
export interface Candidate {
  content: Content;
  finishReason?: string;
  index?: number;
  safetyRatings?: SafetyRating[];
  citationMetadata?: CitationMetadata;
}

/**
 * 安全评分
 */
export interface SafetyRating {
  category: string;
  probability: string;
  probability_score?: number;
  severity?: string;
  severity_score?: number;
}

/**
 * 引用元数据
 */
export interface CitationMetadata {
  citationSources?: Array<{
    startIndex?: number;
    endIndex?: number;
    uri?: string;
    license?: string;
  }>;
}

/**
 * 提示反馈
 */
export interface PromptFeedback {
  blockReason?: string;
  safetyRatings?: SafetyRating[];
}

/**
 * Usage Statistics
 * 使用统计
 *
 * Consistent with parent project format
 * 与父项目格式保持一致
 */
export interface UsageMetadata {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
  // Cache-related fields
  // 缓存相关字段
  cachedContentInputTokenCount?: number;
  cachedContentTokenCount?: number;
  cacheReadInputTokens?: number;
  cacheWriteInputTokens?: number;
  // Cost statistics
  // 费用统计
  creditsUsage?: number;
}

/**
 * Streaming Response Format (Server-Sent Events)
 * 流式响应格式 (Server-Sent Events)
 *
 * Each message format: data: {...JSON...}\n\n
 * 每条消息格式: data: {...JSON...}\n\n
 */
export interface StreamingChunk {
  candidates?: Array<{
    content: Content;
    finishReason?: string;
    index?: number;
  }>;
  usageMetadata?: UsageMetadata;
}

/**
 * Generate mock chat response for testing
 * 生成模拟的聊天响应
 */
export function generateMockChatResponse(model: string, userMessage: string): UnifiedChatResponse {
  const responseText = generateMockResponseText(model, userMessage);

  return {
    candidates: [
      {
        content: {
          role: 'model',
          parts: [{ text: responseText }]
        },
        finishReason: 'STOP',
        index: 0,
        safetyRatings: []
      }
    ],
    usageMetadata: {
      promptTokenCount: calculateTokenCount(userMessage),
      candidatesTokenCount: calculateTokenCount(responseText),
      totalTokenCount: calculateTokenCount(userMessage) + calculateTokenCount(responseText)
    }
  };
}

/**
 * Generate mock streaming response chunks
 * 生成模拟的流式响应块
 */
export function generateMockStreamingChunks(model: string, userMessage: string): StreamingChunk[] {
  const responseText = generateMockResponseText(model, userMessage);
  const chunks: StreamingChunk[] = [];

  // Split response into multiple chunks to simulate streaming output
  // 将响应分成多个块，模拟流式输出
  const chunkSize = Math.ceil(responseText.length / 3);
  for (let i = 0; i < responseText.length; i += chunkSize) {
    const chunk = responseText.substring(i, i + chunkSize);
    chunks.push({
      candidates: [
        {
          content: {
            role: 'model',
            parts: [{ text: chunk }]
          },
          index: 0
        }
      ]
    });
  }

  // Last chunk includes complete metadata
  // 最后一个块包含完整的 metadata
  if (chunks.length > 0) {
    chunks[chunks.length - 1].usageMetadata = {
      promptTokenCount: calculateTokenCount(userMessage),
      candidatesTokenCount: calculateTokenCount(responseText),
      totalTokenCount: calculateTokenCount(userMessage) + calculateTokenCount(responseText)
    };
  }

  return chunks;
}

/**
 * Generate mock response text based on model and user message
 * 生成模拟的响应文本，根据模型和用户消息生成相应的回复
 */
function generateMockResponseText(model: string, userMessage: string): string {
  const modelResponses: Record<string, string> = {
    'claude-haiku-4-5@20251001': `I'm Claude Haiku, a fast and efficient model. Your message was: "${userMessage}". I can help with various tasks including coding, writing, analysis, and more.`,
    'claude-opus-4-5@20251101': `I'm Claude Opus 4.5, the most capable model in the Claude family. Your question about "${userMessage}" is quite interesting. Let me provide you with a comprehensive response...`,
    'claude-sonnet-4-5@20250929': `I'm Claude Sonnet 4.5, a balanced model offering good performance and efficiency. Regarding "${userMessage}", I can provide detailed assistance.`,
    'claude-sonnet-4@20250514': `This is Claude Sonnet 4. Your message "${userMessage}" has been received and processed. I'm ready to help with your task.`,
    'gemini-2.5-flash': `Hello! I'm Gemini 2.5 Flash, Google's fast and multimodal model. You asked about "${userMessage}". I can help with that!`,
    'gemini-2.5-flash-lite': `I'm Gemini Flash Lite, a lightweight and fast model. Your question: "${userMessage}" - let me assist you with this.`,
    'gemini-2.5-pro': `I'm Gemini 2.5 Pro, a more advanced model with enhanced capabilities. For your question about "${userMessage}", here's my detailed response...`,
    'gemini-3-pro-preview': `This is Gemini 3 Pro Preview, the latest and most advanced model. Your prompt about "${userMessage}" is being processed with cutting-edge capabilities.`,
    'openai/gpt-5.1-codex': `I'm GPT-5.1 Codex, specialized for code generation and technical tasks. Your code-related question: "${userMessage}" can be addressed as follows...`,
    'openai/gpt-5.2': `This is GPT-5.2, the latest GPT model. Your message "${userMessage}" has been analyzed and here's my response...`,
    'x-ai/grok-4.1-fast': `I'm Grok 4.1 Fast, xAI's fast inference model. You asked: "${userMessage}". Let me provide you with a quick answer...`,
    'x-ai/grok-code-fast-1': `This is Grok Code Fast 1, optimized for code tasks. Your coding question "${userMessage}" will be addressed with code examples and explanations.`
  };

  return modelResponses[model] || `This is a mock response for model ${model}. Your message: "${userMessage}"`;
}

/**
 * Calculate simple token count (approximate)
 * 计算简单的 token 数量（近似值）
 *
 * Should use tokenizer in production, here for demo only
 * 实际应该使用 tokenizer，这里仅为演示
 *
 * Estimation: English ~1 token = 4 chars, Chinese ~1 token = 1-2 chars
 * 简单估算: 英文约 1 token = 4 个字符，中文约 1 token = 1-2 个字符
 */
function calculateTokenCount(text: string): number {
  const englishTokens = (text.match(/[a-zA-Z\s]+/g) || []).join('').length / 4;
  const chineseTokens = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  return Math.ceil(englishTokens + chineseTokens + 10); // At least 10 tokens / 至少 10 个 tokens
}

/**
 * Validate unified chat request
 * 验证统一的聊天请求
 */
export function validateChatRequest(request: any): { valid: boolean; error?: string } {
  if (!request.model) {
    return { valid: false, error: 'Model is required' };
  }

  if (!request.contents || !Array.isArray(request.contents)) {
    return { valid: false, error: 'Contents array is required' };
  }

  if (request.contents.length === 0) {
    return { valid: false, error: 'Contents array cannot be empty' };
  }

  // 验证每个 content
  for (const content of request.contents) {
    if (!content.role) {
      return { valid: false, error: 'Each content item must have a role' };
    }

    if (!content.parts || !Array.isArray(content.parts) || content.parts.length === 0) {
      return { valid: false, error: 'Each content item must have a parts array with at least one item' };
    }

    // 验证每个 part
    for (const part of content.parts) {
      if (!part.text && !part.inlineData && !part.functionCall && !part.functionResponse) {
        return { valid: false, error: 'Each part must have text, inlineData, functionCall, or functionResponse' };
      }
    }
  }

  return { valid: true };
}

/**
 * Parse responses from different AI providers and convert to unified format
 * 解析来自不同 AI 提供商的响应并转换为统一格式
 */
export function parseProviderResponse(response: any, provider: string): UnifiedChatResponse {
  switch (provider.toLowerCase()) {
    case 'vertex':
    case 'gemini':
      // Google Generative AI 格式已经是标准格式
      return response as UnifiedChatResponse;

    case 'claude':
      // Claude 返回 Anthropic 格式，需要转换
      return convertClaudeResponseToUnified(response);

    case 'openai':
    case 'openrouter':
      // OpenAI 格式，需要转换
      return convertOpenAIResponseToUnified(response);

    default:
      return response as UnifiedChatResponse;
  }
}

/**
 * Convert Claude format response to unified format
 * 将 Claude 格式的响应转换为统一格式
 */
function convertClaudeResponseToUnified(claudeResponse: any): UnifiedChatResponse {
  const contentParts = claudeResponse.content || [];
  const parts: any[] = [];

  for (const item of contentParts) {
    if (item.type === 'text' && item.text) {
      parts.push({ text: item.text });
    } else if (item.type === 'tool_use') {
      // Convert tool_use (Claude tool_use -> GenAI functionCall)
      // 工具调用转换 (Claude tool_use -> GenAI functionCall)
      parts.push({
        functionCall: {
          id: item.id,
          name: item.name,
          args: item.input || {}
        }
      });
    }
  }

  // If no valid content, add empty text
  // 如果没有有效内容，添加空文本
  if (parts.length === 0) {
    parts.push({ text: '' });
  }

  return {
    candidates: [
      {
        content: {
          role: 'model',
          parts
        },
        finishReason: claudeResponse.stop_reason?.toUpperCase() || 'STOP',
        index: 0
      }
    ],
    usageMetadata: {
      promptTokenCount: claudeResponse.usage?.input_tokens || 0,
      candidatesTokenCount: claudeResponse.usage?.output_tokens || 0,
      totalTokenCount:
        (claudeResponse.usage?.input_tokens || 0) + (claudeResponse.usage?.output_tokens || 0)
    }
  };
}

/**
 * Convert OpenAI format response to unified format
 * 将 OpenAI 格式的响应转换为统一格式
 */
function convertOpenAIResponseToUnified(openaiResponse: any): UnifiedChatResponse {
  const choice = openaiResponse.choices?.[0];
  const text = choice?.message?.content || '';

  return {
    candidates: [
      {
        content: {
          role: 'model',
          parts: [{ text }]
        },
        finishReason: choice?.finish_reason?.toUpperCase() || 'STOP',
        index: 0
      }
    ],
    usageMetadata: {
      promptTokenCount: openaiResponse.usage?.prompt_tokens || 0,
      candidatesTokenCount: openaiResponse.usage?.completion_tokens || 0,
      totalTokenCount: openaiResponse.usage?.total_tokens || 0
    }
  };
}

/**
 * Build SSE streaming response
 * 构建 SSE 流式响应
 */
export function buildSSEResponse(chunk: StreamingChunk): string {
  return `data: ${JSON.stringify(chunk)}\n\n`;
}

/**
 * Send complete streaming response to client
 * 发送完整的流式响应到客户端
 */
export async function sendStreamingResponse(
  res: any,
  chunks: StreamingChunk[]
): Promise<void> {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  for (const chunk of chunks) {
    res.write(buildSSEResponse(chunk));
    // Add small delay to simulate streaming transmission
    // 添加小延迟来模拟流式传输
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  res.write('data: [DONE]\n\n');
  res.end();
}

/**
 * Error Response Format
 * 错误响应格式
 */
export interface ErrorResponse {
  code: number;
  success: false;
  error: {
    message: string;
    type: string;
    param?: string;
  };
}

/**
 * Create error response
 * 创建错误响应
 */
export function createErrorResponse(
  message: string,
  type: string = 'invalid_request_error',
  param?: string
): ErrorResponse {
  return {
    code: 400,
    success: false,
    error: {
      message,
      type,
      param
    }
  };
}
