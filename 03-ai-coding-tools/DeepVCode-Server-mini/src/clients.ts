/**
 * DeepV Code Server - API Client Integration
 * DeepV Code 服务器 - API 客户端集成
 *
 * Supports different AI providers (Vertex AI / OpenRouter)
 * 支持不同的 AI 提供商（Vertex AI / OpenRouter）
 *
 * Dynamically selects appropriate client for actual API calls based on model configuration
 * 根据模型配置动态选择合适的客户端进行实际 API 调用
 */

import { UnifiedChatRequest, UnifiedChatResponse, StreamingChunk } from './chat.js';
import { configManager } from './config.js';
import { JWT } from 'google-auth-library';

/**
 * Model Configuration
 * 模型配置
 */
export interface ModelConfig {
  name: string;
  displayName: string;
  creditsPerRequest: number;
  available: boolean;
  maxToken: number;
  // vertex = Gemini + Claude via Vertex AI; openai = OpenAI API format
  // vertex = Gemini + Claude via Vertex AI; openai = OpenAI API 格式
  api_format: 'vertex' | 'openai';
  // Provider name (e.g., openrouter, vertex-ai)
  // 提供商名称（例如 openrouter, vertex-ai）
  provider?: string;
  max_output_length?: number;
  config?: Record<string, any>;
  // Actual Vertex AI model ID (used for API calls)
  // 实际的 Vertex AI 模型 ID（用于 API 调用）
  vertexModelId?: string;
}

/**
 * Model Database - Model Configuration Mapping
 * 模型数据库 - 模型配置映射
 *
 * Should be loaded from database in production, here for demo purposes
 * 实际应该从数据库加载，这里为演示用途
 *
 * Last updated: 2025-05-14
 * 最后更新: 2025-05-14
 */
const MODEL_DATABASE: Record<string, ModelConfig> = {
  // ============================================
  // Vertex AI Models (Claude + Gemini)
  // ============================================
  // Vertex AI 模型 (Claude + Gemini)
  // ============================================

  // Claude Models - Latest versions (2025)
  // Claude 模型 - 最新版本 (2025)
  'claude-sonnet-4@20250514': {
    name: 'claude-sonnet-4@20250514',
    displayName: 'Claude-Sonnet-4 (May 2025)',
    creditsPerRequest: 8,
    available: true,
    maxToken: 200000,
    api_format: 'vertex',
    provider: 'vertex-ai',
    max_output_length: 8192,
  },
  'claude-sonnet-4-5@20250929': {
    name: 'claude-sonnet-4-5@20250929',
    displayName: 'Claude-Sonnet-4.5 (Sep 2025)',
    creditsPerRequest: 9,
    available: true,
    maxToken: 200000,
    api_format: 'vertex',
    provider: 'vertex-ai',
    max_output_length: 8192,
  },
  'claude-haiku-4-5@20251001': {
    name: 'claude-haiku-4-5@20251001',
    displayName: 'Claude-Haiku-4.5 (Oct 2025)',
    creditsPerRequest: 1,
    available: true,
    maxToken: 200000,
    api_format: 'vertex',
    provider: 'vertex-ai',
    max_output_length: 4096,
  },
  'claude-opus-4-5@20251101': {
    name: 'claude-opus-4-5@20251101',
    displayName: 'Claude-Opus-4.5 (Nov 2025)',
    creditsPerRequest: 15,
    available: true,
    maxToken: 200000,
    api_format: 'vertex',
    provider: 'vertex-ai',
    max_output_length: 8192,
  },

  // Gemini Models - Latest versions (2025)
  // Gemini 模型 - 最新版本 (2025)
  // Note: Gemini models use global region
  // 注意: Gemini 模型使用 global 区域
  'gemini-2.5-flash': {
    name: 'gemini-2.5-flash',
    displayName: 'Gemini-2.5-Flash',
    creditsPerRequest: 1,
    available: true,
    maxToken: 1048576,
    api_format: 'vertex',
    provider: 'vertex-ai',
  },
  'gemini-2.5-pro': {
    name: 'gemini-2.5-pro',
    displayName: 'Gemini-2.5-Pro',
    creditsPerRequest: 4,
    available: true,
    maxToken: 1048576,
    api_format: 'vertex',
    provider: 'vertex-ai',
  },
  'gemini-2.5-flash-lite': {
    name: 'gemini-2.5-flash-lite',
    displayName: 'Gemini-2.5-Flash-Lite',
    creditsPerRequest: 0.3,
    available: true,
    maxToken: 1048576,
    api_format: 'vertex',
    provider: 'vertex-ai',
  },
  'gemini-3-pro-preview': {
    name: 'gemini-3-pro-preview',
    displayName: 'Gemini-3-Pro-Preview',
    creditsPerRequest: 5,
    available: true,
    maxToken: 2000000,
    api_format: 'vertex',
    provider: 'vertex-ai',
  },

  // ============================================
  // OpenRouter Models - Latest versions (2025)
  // ============================================
  // OpenRouter 模型 - 最新版本 (2025)
  // ============================================

  // OpenAI GPT Models
  // OpenAI GPT 模型
  'openai/gpt-5.1-codex': {
    name: 'openai/gpt-5.1-codex',
    displayName: 'GPT-5.1-Codex',
    creditsPerRequest: 4.1,
    available: true,
    maxToken: 390000,
    api_format: 'openai',
    provider: 'openrouter',
  },
  'openai/gpt-5.2': {
    name: 'openai/gpt-5.2',
    displayName: 'GPT-5.2',
    creditsPerRequest: 6.4,
    available: true,
    maxToken: 390000,
    api_format: 'openai',
    provider: 'openrouter',
  },

  // X.AI Grok Models
  // X.AI Grok 模型
  'x-ai/grok-code-fast-1': {
    name: 'x-ai/grok-code-fast-1',
    displayName: 'Grok-Code-Fast-1',
    creditsPerRequest: 1.2,
    available: true,
    maxToken: 200000,
    api_format: 'openai',
    provider: 'openrouter',
  },
  'x-ai/grok-4.1-fast': {
    name: 'x-ai/grok-4.1-fast',
    displayName: 'Grok-4.1-Fast',
    creditsPerRequest: 0.5,
    available: true,
    maxToken: 1800000,
    api_format: 'openai',
    provider: 'openrouter',
  },

  // MiniMax Models
  // MiniMax 模型
  'minimax/minimax-m2:free': {
    name: 'minimax/minimax-m2:free',
    displayName: 'MiniMax-M2 (Free)',
    creditsPerRequest: 0.1,
    available: true,
    maxToken: 400000,
    api_format: 'openai',
    provider: 'openrouter',
  },

  // Mistral Codestral Models
  // Mistral Codestral 模型
  'codestral-2': {
    name: 'codestral-2',
    displayName: 'Mistral-Codestral-2',
    creditsPerRequest: 0.8,
    available: true,
    maxToken: 256000,
    api_format: 'openai',
    provider: 'openrouter',
  },
};

/**
 * Get model configuration
 * 获取模型配置
 */
export function getModelConfig(modelName: string): ModelConfig | null {
  return MODEL_DATABASE[modelName] || null;
}

/**
 * API Call Context Information
 * API 调用的上下文信息
 */
export interface APICallContext {
  modelName: string;
  modelConfig: ModelConfig;
  request: UnifiedChatRequest;
  userUuid?: string;
  requestId?: string;
}

/**
 * Gemini models with thinking process support (Updated to 2025)
 * 支持思考过程的 Gemini 模型列表 (已更新至 2025)
 *
 * References parent project src/routes/chat/strategies/gemini.ts
 * 参考父项目 src/routes/chat/strategies/gemini.ts
 */
const THINKING_ENABLED_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-preview',
  'gemini-2.5-pro',
  'gemini-2.5-pro-preview',
  'gemini-2.5-flash-lite',
  'gemini-3-pro-preview'
];

/**
 * Sanitize parameters object, remove unsupported Vertex AI fields
 * 清理 parameters 对象，移除 Vertex AI 不支持的字段
 *
 * References parent project src/routes/chat/strategies/gemini.ts
 * 参考父项目 src/routes/chat/strategies/gemini.ts
 */
function sanitizeParameters(params: any): any {
  if (!params || typeof params !== 'object') {
    return params;
  }

  const sanitized: any = {};

  // Keep only Vertex AI supported fields
  // 只保留 Vertex AI 支持的字段
  if (params.type) sanitized.type = params.type;
  if (params.description) sanitized.description = params.description;
  if (params.enum) sanitized.enum = params.enum;
  if (params.required) sanitized.required = params.required;

  // Recursively process properties
  // 递归处理 properties
  if (params.properties && typeof params.properties === 'object') {
    sanitized.properties = {};
    for (const [key, value] of Object.entries(params.properties)) {
      sanitized.properties[key] = sanitizeParameters(value);
    }
  }

  // Handle items (array type)
  // 处理 items（数组类型）
  if (params.items) {
    sanitized.items = sanitizeParameters(params.items);
  }

  // Note: Don't copy unsupported fields like $schema, additionalProperties, $ref
  // 注意：不复制 $schema, additionalProperties, $ref 等不支持的字段

  return sanitized;
}

/**
 * Sanitize OpenAI/OpenRouter function parameters - strictly follow OpenAI schema specification
 * 清理 OpenAI/OpenRouter 函数参数 - 严格遵循 OpenAI schema 规范
 *
 * Consistent with parent project (deepx-code-server) implementation
 * 与父级项目 (deepx-code-server) 的实现保持一致
 */
function sanitizeOpenAIFunctionParameters(params: any): any {
  if (!params || typeof params !== 'object') {
    return {
      type: 'object',
      properties: {},
      required: []
    };
  }

  return normalizeOpenAISchemaObject(params);
}

/**
 * 递归标准化 OpenAI JSON Schema 对象
 */
function normalizeOpenAISchemaObject(obj: any): any {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const normalized: any = {};

  // 处理 type 字段 - 转换为小写
  if (obj.type) {
    normalized.type = normalizeOpenAITypeName(obj.type);
  } else {
    normalized.type = 'object'; // 默认类型
  }

  // 处理 properties
  if (obj.properties && typeof obj.properties === 'object') {
    normalized.properties = {};
    for (const [key, value] of Object.entries(obj.properties)) {
      normalized.properties[key] = normalizeOpenAISchemaObject(value);
    }
  } else if (normalized.type === 'object') {
    normalized.properties = {};
  }

  // 处理 items（数组类型）
  if (obj.items && normalized.type === 'array') {
    normalized.items = normalizeOpenAISchemaObject(obj.items);
  }

  // 处理 required 数组
  if (obj.required && Array.isArray(obj.required)) {
    normalized.required = [...obj.required];
  } else if (normalized.type === 'object' && normalized.properties) {
    normalized.required = [];
  }

  // 复制其他有效字段 - 并验证类型
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

      // 验证和转换类型
      if (expectedType === 'number') {
        // 数值字段必须是数字，不能是字符串
        if (typeof value === 'number') {
          normalized[name] = value;
        } else if (typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value)) {
          // 如果是数字格式的字符串，转换为数字
          normalized[name] = parseFloat(value);
        }
        // 否则跳过这个无效的字段
      } else if (expectedType === 'string') {
        if (typeof value === 'string') {
          normalized[name] = value;
        }
        // 否则跳过
      } else if (expectedType === 'array') {
        if (Array.isArray(value)) {
          normalized[name] = value;
        }
        // 否则跳过
      } else if (expectedType === 'any') {
        // default 字段可以是任何类型
        normalized[name] = value;
      }
    }
  }

  return normalized;
}

/**
 * 标准化 OpenAI 类型名称为小写
 * 处理 STRING, BOOLEAN 等大写格式
 */
function normalizeOpenAITypeName(type: string): string {
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
 * 清理工具定义，使其兼容 Vertex AI
 * 移除 $schema 等不支持的字段
 */
function sanitizeToolsForVertexAI(tools: any[]): any[] {
  return tools.map((tool: any) => {
    const sanitizedTool: any = {};

    // 处理 googleSearch 工具
    if (tool.googleSearch !== undefined) {
      sanitizedTool.googleSearch = tool.googleSearch;
    }

    // 处理 urlContext 工具
    if (tool.urlContext !== undefined) {
      sanitizedTool.urlContext = tool.urlContext;
    }

    // 处理 codeExecution 工具
    if (tool.codeExecution !== undefined) {
      sanitizedTool.codeExecution = tool.codeExecution;
    }

    // 处理 functionDeclarations
    if (tool.functionDeclarations && Array.isArray(tool.functionDeclarations)) {
      sanitizedTool.functionDeclarations = tool.functionDeclarations.map((func: any) => {
        const sanitizedFunc: any = {
          name: func.name,
        };

        if (func.description) {
          sanitizedFunc.description = func.description;
        }

        // 清理 parameters
        if (func.parameters) {
          sanitizedFunc.parameters = sanitizeParameters(func.parameters);
        }

        return sanitizedFunc;
      });
    }

    return sanitizedTool;
  });
}

/**
 * 创建 Claude 兼容的 input_schema
 * Claude 要求 input_schema.type 必须是 'object'
 * 参考父项目 src/routes/chat/strategies/claude.ts 的 createImprovedJsonSchema
 */
function createClaudeInputSchema(source: any): any {
  if (!source || typeof source !== 'object') {
    return { type: 'object', properties: {}, additionalProperties: false };
  }

  // 创建基础 schema，type 必须是 'object'
  const inputSchema: any = {
    type: 'object',
    additionalProperties: false
  };

  // 处理 properties
  if (source.properties && Object.keys(source.properties).length > 0) {
    const properties: any = {};

    for (const [propName, originalProp] of Object.entries(source.properties)) {
      if (originalProp) {
        properties[propName] = convertClaudeSchemaProperty(originalProp as any);
      }
    }

    inputSchema.properties = properties;
  } else {
    inputSchema.properties = {};
  }

  // 智能处理 required 字段
  if (source.required && Array.isArray(source.required) && source.required.length > 0) {
    inputSchema.required = source.required;
  } else if (inputSchema.properties && Object.keys(inputSchema.properties).length > 0) {
    // 如果没有明确的 required 定义，自动将所有 properties 设为 required
    inputSchema.required = Object.keys(inputSchema.properties);
  }

  return inputSchema;
}

/**
 * 递归转换 schema 属性为 Claude 兼容格式
 */
function convertClaudeSchemaProperty(prop: any): any {
  const convertedProp: any = {
    type: convertTypeToString(prop.type || 'string')
  };

  if (prop.description) {
    convertedProp.description = prop.description;
  }

  if (prop.enum && Array.isArray(prop.enum)) {
    convertedProp.enum = prop.enum;
  }

  // 处理数组类型
  if (convertedProp.type === 'array' && prop.items) {
    convertedProp.items = convertClaudeSchemaProperty(prop.items);
  }

  // 处理嵌套对象
  if (convertedProp.type === 'object' && prop.properties) {
    convertedProp.properties = {};
    for (const [propName, subProp] of Object.entries(prop.properties)) {
      convertedProp.properties[propName] = convertClaudeSchemaProperty(subProp as any);
    }

    if (prop.required && Array.isArray(prop.required)) {
      convertedProp.required = prop.required;
    }

    convertedProp.additionalProperties = false;
  }

  return convertedProp;
}

/**
 * 转换类型为字符串，支持多种类型格式
 */
function convertTypeToString(type: any): string {
  if (typeof type === 'string') {
    return type.toLowerCase();
  }

  // 支持数字枚举类型（某些 SDK 使用）
  switch (type) {
    case 0:
    case 'STRING':
      return 'string';
    case 1:
    case 'NUMBER':
      return 'number';
    case 2:
    case 'INTEGER':
      return 'integer';
    case 3:
    case 'BOOLEAN':
      return 'boolean';
    case 4:
    case 'ARRAY':
      return 'array';
    case 5:
    case 'OBJECT':
      return 'object';
    default:
      return 'string';
  }
}

/**
 * 检查模型是否支持思考过程
 */
function isThinkingEnabledModel(modelName: string): boolean {
  return THINKING_ENABLED_MODELS.some(m => modelName.includes(m) || modelName.startsWith(m));
}

/**
 * 处理 contents，使其兼容 Gemini API
 * - 移除 functionCall 和 functionResponse 中的 id 字段（Gemini API不支持）
 * - 通过 id 映射修正 functionResponse 的 name 字段
 * - 保留 thoughtSignature 在 part 级别
 */
function processContentsForGemini(contents: any[]): any[] {
  // 第一步：构建 functionCall ID 到函数名的映射表
  const functionCallIdToNameMap = new Map<string, string>();

  for (const content of contents) {
    if (content.parts) {
      for (const part of content.parts) {
        if (part.functionCall?.id && part.functionCall?.name) {
          functionCallIdToNameMap.set(part.functionCall.id, part.functionCall.name);
        }
      }
    }
  }

  // 第二步：处理 contents，移除不支持的 id 字段
  return contents.map(content => {
    if (!content.parts) return content;

    return {
      ...content,
      parts: content.parts.map((part: any) => {
        const newPart: any = { ...part };

        // 处理 functionCall：移除 id 字段，保留 thoughtSignature 在 part 级别
        if (newPart.functionCall && 'id' in newPart.functionCall) {
          const { id, ...functionCallWithoutId } = newPart.functionCall;
          newPart.functionCall = functionCallWithoutId;
          // thoughtSignature 保持在 part 级别（newPart.thoughtSignature）
        }

        // 处理 functionResponse：移除 id 字段，修正 name
        if (newPart.functionResponse) {
          const { id, name, ...functionResponseRest } = newPart.functionResponse;

          // 通过 id 查找对应的函数名
          let actualFunctionName = name;
          if (id && functionCallIdToNameMap.has(id)) {
            actualFunctionName = functionCallIdToNameMap.get(id);
          }

          newPart.functionResponse = {
            name: actualFunctionName || 'unknown_function',
            ...functionResponseRest
          };
        }

        return newPart;
      })
    };
  });
}

/**
 * 将统一格式的聊天请求转换为 Vertex AI Gemini 格式
 * 参考父项目 src/routes/chat/strategies/gemini.ts
 *
 * 特别处理：
 * 1. 移除 functionCall 和 functionResponse 中的 id 字段（Gemini API不支持）
 * 2. 修正 functionResponse 的 name 字段（通过 id 映射找到正确的函数名）
 * 3. 保留 thoughtSignature 字段（必须在 part 级别与 functionCall 同级）
 */
function convertToGeminiFormat(
  request: UnifiedChatRequest,
  modelName?: string
): Record<string, any> {
  // 处理 contents - 移除不支持的 id 字段
  const processedContents = processContentsForGemini(request.contents);

  const vertexRequest: Record<string, any> = {
    contents: processedContents,
  };

  // 可选字段
  if (request.systemInstruction) {
    // 如果 systemInstruction 是字符串，转换为标准格式
    if (typeof request.systemInstruction === 'string') {
      vertexRequest.systemInstruction = {
        parts: [{ text: request.systemInstruction }]
      };
    } else {
      vertexRequest.systemInstruction = request.systemInstruction;
    }
  }

  // 处理 generationConfig
  if (request.generationConfig) {
    vertexRequest.generationConfig = { ...request.generationConfig };
  } else {
    vertexRequest.generationConfig = {};
  }

  // 处理 thinkingConfig
  // 优先使用客户端传入的 thinkingConfig
  const clientThinkingConfig = (request.generationConfig as any)?.thinkingConfig;
  if (clientThinkingConfig) {
    // 客户端明确设置了 thinkingConfig，使用客户端的配置
    vertexRequest.generationConfig.thinkingConfig = clientThinkingConfig;
  } else if (request.stream && modelName && isThinkingEnabledModel(modelName)) {
    // 客户端没有设置，且满足条件，自动启用思考过程
    vertexRequest.generationConfig.thinkingConfig = {
      includeThoughts: true,
      thinkingBudget: -1  // -1 表示动态思考预算，让模型自行决定
    };
  }

  // 处理 tools - 需要清理不支持的字段
  if (request.tools && request.tools.length > 0) {
    vertexRequest.tools = sanitizeToolsForVertexAI(request.tools);
  }

  // 🆕 处理 toolConfig（控制工具调用行为）
  if (request.toolConfig) {
    vertexRequest.toolConfig = request.toolConfig;
  }

  if (request.safetySettings) {
    vertexRequest.safetySettings = request.safetySettings;
  }

  return vertexRequest;
}

/**
 * 清理工具调用ID，确保符合Claude要求的格式
 * Claude ID只能包含字母、数字、下划线和连字符
 */
function cleanToolUseId(id: string): string {
  if (!id) return 'tool_call_1';

  // 替换不允许的字符为下划线
  let cleanId = id.replace(/[^a-zA-Z0-9_-]/g, '_');

  // 确保ID不以数字开头
  if (/^[0-9]/.test(cleanId)) {
    cleanId = 'tool_' + cleanId;
  }

  // 确保ID不为空
  if (!cleanId || cleanId.trim() === '') {
    cleanId = 'tool_call_1';
  }

  return cleanId;
}

/**
 * 将统一格式的聊天请求转换为 Anthropic Claude 格式 (用于 rawPredict)
 * 参考父项目 src/routes/chat/strategies/claude.ts 的实现
 */
function convertToClaudeFormat(
  request: UnifiedChatRequest
): Record<string, any> {
  // 转换消息格式: GenAI contents -> Anthropic messages
  const claudeMessages: Array<{ role: string; content: any }> = [];

  for (const content of request.contents) {
    // GenAI 使用 'model', Anthropic 使用 'assistant'
    const role = content.role === 'model' ? 'assistant' : content.role;

    // 跳过 system 角色（单独处理）
    if (role === 'system') continue;

    // 转换 parts 到 Anthropic content 格式
    const anthropicContent: any[] = [];

    for (const part of content.parts) {
      if (part.text) {
        anthropicContent.push({
          type: 'text',
          text: part.text
        });
      } else if (part.inlineData) {
        // 处理图片等媒体数据
        anthropicContent.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: part.inlineData.mimeType,
            data: part.inlineData.data
          }
        });
      } else if (part.functionCall) {
        // 处理工具调用
        // 🔧 关键修复：使用原始ID，而不是生成新ID
        const toolId = (part.functionCall as any).id || `call_${Date.now()}`;
        anthropicContent.push({
          type: 'tool_use',
          id: cleanToolUseId(toolId),
          name: part.functionCall.name,
          input: part.functionCall.args
        });
      } else if (part.functionResponse) {
        // 处理工具响应
        // 🔧 关键修复：使用原始ID，而不是生成新ID
        const toolId = (part.functionResponse as any).id || `call_${Date.now()}`;
        anthropicContent.push({
          type: 'tool_result',
          tool_use_id: cleanToolUseId(toolId),
          content: typeof part.functionResponse.response === 'string'
            ? part.functionResponse.response
            : JSON.stringify(part.functionResponse.response)
        });
      }
    }

    if (anthropicContent.length > 0) {
      // 如果只有一个文本内容，可以简化
      if (anthropicContent.length === 1 && anthropicContent[0].type === 'text') {
        claudeMessages.push({ role, content: anthropicContent[0].text });
      } else {
        claudeMessages.push({ role, content: anthropicContent });
      }
    }
  }

  // 构建 Claude rawPredict 请求体
  // 注意: Claude 3 Haiku 最大 output tokens 是 4096，其他模型是 8192
  const isHaiku = request.model.toLowerCase().includes('haiku');
  const defaultMaxTokens = isHaiku ? 4096 : 8192;
  const maxTokens = request.generationConfig?.maxOutputTokens
    ? Math.min(request.generationConfig.maxOutputTokens, isHaiku ? 4096 : 8192)
    : defaultMaxTokens;

  const claudeRequest: Record<string, any> = {
    anthropic_version: 'vertex-2023-10-16',
    max_tokens: maxTokens,
    messages: claudeMessages
  };

  // 处理生成参数
  // ⚠️ 重要：Claude 不允许同时指定 temperature 和 top_p
  // 参考 Anthropic 文档：https://docs.anthropic.com/claude/reference/parameters
  // 优先级：temperature > top_p > top_k
  // 只能指定其中一个，不能同时指定

  const hasTemperature = request.generationConfig?.temperature !== undefined;
  const hasTopP = request.generationConfig?.topP !== undefined;
  const hasTopK = request.generationConfig?.topK !== undefined;

  // 只设置 temperature（如果指定）
  if (hasTemperature) {
    claudeRequest.temperature = request.generationConfig?.temperature;
  }
  // 否则，只设置 top_p（如果指定且没有 temperature）
  else if (hasTopP) {
    claudeRequest.top_p = request.generationConfig?.topP;
  }
  // 最后，只设置 top_k（如果指定且没有 temperature 和 top_p）
  else if (hasTopK) {
    claudeRequest.top_k = request.generationConfig?.topK;
  }

  // 处理 system instruction
  if (request.systemInstruction) {
    let systemText = '';
    if (typeof request.systemInstruction === 'string') {
      systemText = request.systemInstruction;
    } else if ('parts' in request.systemInstruction && Array.isArray(request.systemInstruction.parts)) {
      systemText = request.systemInstruction.parts
        .map((p: any) => p.text || '')
        .filter((t: string) => t)
        .join('\n');
    }
    if (systemText) {
      // 移除可能导致 Claude 混淆的文本工具调用示例
      // 这里的正则匹配 [tool_call: ...] 格式的示例并将其替换为空或注释
      // 注意：这可能会影响用户自定义的 prompt，但为了修复工具调用问题，这是必要的权衡
      // 只有当请求中包含 tools 定义时才执行此清理
      if (request.tools && request.tools.length > 0) {
        // 匹配 <example>...</example> 块中包含 [tool_call: 的内容
        // 这是一个简单的启发式清理
        systemText = systemText.replace(/<example>[\s\S]*?\[tool_call:[\s\S]*?<\/example>/g, '');

        // 或者更激进地，移除所有 [tool_call: ...] 文本
        // systemText = systemText.replace(/\[tool_call:[^\]]+\]/g, '');
      }

      claudeRequest.system = systemText;
    }
  }

  // 处理工具定义 - 转换为 Claude 格式
  if (request.tools && request.tools.length > 0) {
    const claudeTools: any[] = [];

    for (const tool of request.tools) {
      if (tool.functionDeclarations && Array.isArray(tool.functionDeclarations)) {
        for (const func of tool.functionDeclarations) {
          const inputSchema = createClaudeInputSchema(func.parameters);
          claudeTools.push({
            name: func.name,
            description: func.description || '',
            input_schema: inputSchema
          });
        }
      }
    }

    if (claudeTools.length > 0) {
      // 为最后一个工具添加 cache_control（Claude prompt caching）
      claudeTools[claudeTools.length - 1].cache_control = { type: 'ephemeral' };
      claudeRequest.tools = claudeTools;
    }
  }

  // 流式响应标识
  if (request.stream) {
    claudeRequest.stream = true;
  }

  return claudeRequest;
}

/**
 * 将统一格式的聊天请求转换为 Vertex AI 格式（Claude 或 Gemini）
 */
function convertToVertexFormat(
  request: UnifiedChatRequest,
  modelName: string
): Record<string, any> {
  const isClaude = modelName.toLowerCase().includes('claude');

  if (isClaude) {
    return convertToClaudeFormat(request);
  } else {
    return convertToGeminiFormat(request, modelName);
  }
}

/**
 * 将统一格式的聊天请求转换为 OpenAI 格式（OpenRouter）
 */
function convertToOpenAIFormat(
  request: UnifiedChatRequest,
  modelName: string
): Record<string, any> {
  // 将 GenAI 格式转换为 OpenAI/OpenRouter 兼容格式
  const messages: Array<{ role: string; content: string | any[]; tool_calls?: any[]; tool_call_id?: string }> = [];

  // 处理 system instruction
  if (request.systemInstruction) {
    let systemText = '';
    if (typeof request.systemInstruction === 'string') {
      systemText = request.systemInstruction;
    } else if ('parts' in request.systemInstruction) {
      systemText = request.systemInstruction.parts
        .map((p: any) => p.text || '')
        .join('');
    }
    if (systemText) {
      messages.push({ role: 'system', content: systemText });
    }
  }

  // 处理 contents
  for (const content of request.contents) {
    const role = content.role === 'model' ? 'assistant' : 'user';

    // 检查是否包含 functionCall 或 functionResponse
    const textParts: string[] = [];
    const toolCalls: any[] = [];
    let toolCallId: string | undefined;
    let toolResult: string | undefined;

    for (const part of content.parts) {
      if (part.text) {
        textParts.push(part.text);
      }
      if (part.functionCall) {
        // GenAI functionCall -> OpenAI tool_calls
        toolCalls.push({
          id: (part.functionCall as any).id || `call_${Date.now()}`,
          type: 'function',
          function: {
            name: part.functionCall.name,
            arguments: JSON.stringify(part.functionCall.args || {})
          }
        });
      }
      if (part.functionResponse) {
        // GenAI functionResponse -> OpenAI tool message
        toolCallId = (part.functionResponse as any).id || `call_${Date.now()}`;
        toolResult = typeof part.functionResponse.response === 'string'
          ? part.functionResponse.response
          : JSON.stringify(part.functionResponse.response);
      }
    }

    if (toolCalls.length > 0) {
      // Assistant message with tool calls
      messages.push({
        role: 'assistant',
        content: textParts.join('') || '',
        tool_calls: toolCalls
      });
    } else if (toolCallId && toolResult !== undefined) {
      // Tool result message
      messages.push({
        role: 'tool',
        content: toolResult,
        tool_call_id: toolCallId
      });
    } else {
      // Regular message
      messages.push({ role, content: textParts.join('') });
    }
  }

  const openaiRequest: Record<string, any> = {
    model: modelName,
    messages,
  };

  // 处理 tools (GenAI functionDeclarations -> OpenAI tools)
  if (request.tools && request.tools.length > 0) {
    const openaiTools: any[] = [];
    for (const tool of request.tools) {
      if (tool.functionDeclarations) {
        for (const func of tool.functionDeclarations) {
          const parameters = sanitizeOpenAIFunctionParameters(
            func.parameters || { type: 'object', properties: {} }
          );
          openaiTools.push({
            type: 'function',
            function: {
              name: func.name,
              description: func.description || '',
              parameters
            }
          });
        }
      }
    }
    if (openaiTools.length > 0) {
      openaiRequest.tools = openaiTools;
    }
  }

  // 处理 generation config
  if (request.generationConfig) {
    if (request.generationConfig.temperature !== undefined) {
      openaiRequest.temperature = request.generationConfig.temperature;
    }
    if (request.generationConfig.topP !== undefined) {
      openaiRequest.top_p = request.generationConfig.topP;
    }
    if (request.generationConfig.maxOutputTokens !== undefined) {
      openaiRequest.max_tokens = request.generationConfig.maxOutputTokens;
    }
  }

  // 处理 stream
  if (request.stream) {
    openaiRequest.stream = true;
  }

  return openaiRequest;
}

/**
 * 令牌缓存（避免频繁生成）
 */
interface TokenCache {
  token: string;
  expiresAt: number;
}
const tokenCache = new Map<string, TokenCache>();
const jwtClients = new Map<string, JWT>();

/**
 * 使用服务账户凭证生成访问令牌（使用 google-auth-library）
 */
async function generateAccessTokenFromServiceAccount(credentialsData: any): Promise<string> {
  // 检查缓存中是否有有效的令牌
  const cacheKey = credentialsData.client_email;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.token;
  }

  try {
    // 使用 google-auth-library 的 JWT 类
    let jwtClient = jwtClients.get(cacheKey);

    if (!jwtClient) {
      // 创建 JWT 客户端（第一次使用时）
      jwtClient = new JWT({
        email: credentialsData.client_email,
        key: credentialsData.private_key,
        scopes: ['https://www.googleapis.com/auth/cloud-platform']
      });
      jwtClients.set(cacheKey, jwtClient);
    }

    // 获取访问令牌
    const response = await jwtClient.authorize();
    const accessToken = response.access_token;

    if (!accessToken) {
      throw new Error('No access token received from JWT client');
    }

    // 缓存令牌（假设有效期为 3600 秒）
    tokenCache.set(cacheKey, {
      token: accessToken,
      expiresAt: Date.now() + 3540000 // 提前 60 秒过期（3600 - 60）
    });

    return accessToken;
  } catch (error) {
    throw new Error(
      `Failed to generate access token from service account: ` +
      (error instanceof Error ? error.message : String(error))
    );
  }
}

/**
 * 获取 Vertex AI 访问令牌（使用服务账户凭证）
 * 支持两种认证方式：
 * 1. 使用服务账户凭证文件（推荐）✅ 已实现
 * 2. 使用 API 密钥（备用）✅ 已实现
 */
async function getVertexAccessToken(credential: any): Promise<string> {
  // 方案 1: 如果配置了 Google API 密钥，直接使用
  const apiKey = process.env.GOOGLE_API_KEY || process.env.VERTEX_AI_API_KEY;
  if (apiKey && apiKey !== 'your_google_api_key_here') {
    console.log('[Vertex Auth] Using API Key authentication');
    return apiKey;
  }

  // 方案 2: 使用服务账户凭证生成访问令牌
  if (credential.credentialsData) {
    try {
      const token = await generateAccessTokenFromServiceAccount(credential.credentialsData);
      return token;
    } catch (error) {
      throw new Error(
        'Vertex AI authentication failed: ' +
        'Could not generate access token from service account credentials. ' +
        'Error: ' + (error instanceof Error ? error.message : String(error))
      );
    }
  }

  // 都不可用
  throw new Error(
    'Vertex AI authentication failed: ' +
    'No API key configured and service account credentials not available. ' +
    'Please set GOOGLE_API_KEY in .env or ensure service account JSON files exist.'
  );
}

/**
 * 调用 Vertex AI API
 */
async function callVertexAPI(
  context: APICallContext
): Promise<globalThis.Response> {
  const { modelName, modelConfig, request, requestId } = context;

  // 构建 Vertex AI 格式的请求
  const vertexRequest = convertToVertexFormat(request, modelName);

  console.log(`[Vertex API] Calling model: ${modelName}`, {
    requestId,
    stream: request.stream,
  });

  // 从配置管理器获取 Vertex AI 凭证和项目 ID
  const vertexConfig = configManager.getVertexConfig();
  if (!vertexConfig.enabled || vertexConfig.credentials.length === 0) {
    throw new Error('Vertex AI is not configured. Please set up credentials.');
  }

  // 使用第一个可用的凭证（可以实现智能选择）
  const credential = vertexConfig.credentials[0];
  const projectId = credential.projectId;

  // 获取访问令牌
  const accessToken = await getVertexAccessToken(credential);

  // 使用 vertexModelId（如果有的话），否则使用模型名称
  const actualModelId = modelConfig.vertexModelId || modelName;

  // 根据模型名称判断 publisher、location 和 API 方法：
  // - Claude 模型使用 anthropic publisher, us-east5 区域, rawPredict/streamRawPredict 方法
  //   参考: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/partner-models/claude/use-claude
  // - Gemini 模型使用 google publisher, global 区域, generateContent/streamGenerateContent 方法
  const isClaude = modelName.toLowerCase().includes('claude');
  const publisher = isClaude ? 'anthropic' : 'google';
  const location = isClaude ? 'us-east5' : 'global';
  const domain = isClaude
    ? 'https://us-east5-aiplatform.googleapis.com'
    : 'https://aiplatform.googleapis.com';
  const method = isClaude
    ? (request.stream ? 'streamRawPredict' : 'rawPredict')
    : (request.stream ? 'streamGenerateContent' : 'generateContent');

  // Gemini 流式请求需要 ?alt=sse 参数
  const sseParam = (!isClaude && request.stream) ? '?alt=sse' : '';

  const endpoint = `/v1/projects/${projectId}/locations/${location}/publishers/${publisher}/models/${actualModelId}:${method}${sseParam}`;

  const response = await fetch(`${domain}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify(vertexRequest),
  });

  return response;
}

/**
 * 调用 OpenRouter API
 */
async function callOpenRouterAPI(
  context: APICallContext
): Promise<globalThis.Response> {
  const { modelName, request, requestId } = context;

  // 构建 OpenAI 格式的请求
  const openaiRequest = convertToOpenAIFormat(request, modelName);

  // 从配置管理器获取 OpenRouter API 密钥
  const openRouterConfig = configManager.getOpenRouterConfig();
  if (!openRouterConfig.enabled || !openRouterConfig.apiKey) {
    throw new Error('OpenRouter is not configured. Please set OPENROUTER_API_KEY.');
  }

  const apiKey = openRouterConfig.apiKey;
  const baseUrl = openRouterConfig.baseUrl;

  const endpoint = '/chat/completions';

  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://github.com/deepx-labs/dvcode-prox',
      'X-Title': 'DeepV Code Proxy',
    },
    body: JSON.stringify(openaiRequest),
  });

  if (!request.stream && response.ok) {
    try {
      const clone = response.clone();
      const text = await clone.text();
      console.log(`[OpenRouter API] Raw Response for ${modelName}:`, text.substring(0, 5000));
    } catch (e) {
      console.error('[OpenRouter API] Failed to log raw response:', e);
    }
  }

  return response;
}

/**
 * 根据模型配置调用相应的 API
 */
export async function callAIAPI(
  context: APICallContext
): Promise<globalThis.Response> {
  const { modelConfig } = context;

  switch (modelConfig.api_format) {
    case 'vertex':
      return callVertexAPI(context);

    case 'openai':
      return callOpenRouterAPI(context);

    default:
      throw new Error(`Unsupported API format: ${modelConfig.api_format}`);
  }
}

/**
 * 将 Claude Anthropic 格式响应转换为统一格式
 */
function convertClaudeResponseToUnified(
  claudeResponse: Record<string, any>
): UnifiedChatResponse {
  // Claude 响应格式: { content: [{type: 'text', text: '...'}, {type: 'tool_use', ...}], stop_reason, usage }
  const contentParts = claudeResponse.content || [];
  const parts: any[] = [];

  for (const item of contentParts) {
    if (item.type === 'text' && item.text) {
      parts.push({ text: item.text });
    } else if (item.type === 'tool_use') {
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

  // 如果没有有效内容，添加空文本
  if (parts.length === 0) {
    parts.push({ text: '' });
  }

  // 转换 stop_reason
  let finishReason = 'STOP';
  if (claudeResponse.stop_reason) {
    switch (claudeResponse.stop_reason) {
      case 'end_turn':
        finishReason = 'STOP';
        break;
      case 'tool_use':
        finishReason = 'TOOL_USE';
        break;
      case 'max_tokens':
        finishReason = 'MAX_TOKENS';
        break;
      case 'stop_sequence':
        finishReason = 'STOP';
        break;
      default:
        finishReason = claudeResponse.stop_reason.toUpperCase();
    }
  }

  return {
    candidates: [
      {
        content: {
          role: 'model',
          parts,
        },
        finishReason,
        index: 0,
      },
    ],
    usageMetadata: {
      promptTokenCount: claudeResponse.usage?.input_tokens || 0,
      candidatesTokenCount: claudeResponse.usage?.output_tokens || 0,
      totalTokenCount:
        (claudeResponse.usage?.input_tokens || 0) +
        (claudeResponse.usage?.output_tokens || 0),
    },
  };
}

/**
 * 解析 API 响应为统一格式
 */
export function parseAPIResponse(
  response: Record<string, any>,
  format: 'vertex' | 'openai',
  modelName?: string
): UnifiedChatResponse {
  // 检查是否是 Claude 模型（需要特殊处理）
  const isClaude = modelName?.toLowerCase().includes('claude');

  switch (format) {
    case 'vertex':
      if (isClaude) {
        // Claude 通过 Vertex AI rawPredict 返回的是 Anthropic 格式
        return convertClaudeResponseToUnified(response);
      }
      // Gemini 返回的已经是 GenAI 标准格式
      return response as UnifiedChatResponse;

    case 'openai':
      // 转换 OpenAI 格式为 GenAI 格式
      return convertOpenAIResponseToUnified(response);

    default:
      return response as UnifiedChatResponse;
  }
}

/**
 * 将 OpenAI 格式响应转换为统一格式
 */
function convertOpenAIResponseToUnified(
  openaiResponse: Record<string, any>
): UnifiedChatResponse {
  const choice = openaiResponse.choices?.[0];
  const parts: any[] = [];

  // 处理文本内容
  const text = choice?.message?.content;
  if (text) {
    parts.push({ text });
  }

  // 处理工具调用 (OpenAI tool_calls -> GenAI functionCall)
  if (choice?.message?.tool_calls && Array.isArray(choice.message.tool_calls)) {
    for (const toolCall of choice.message.tool_calls) {
      if (toolCall.type === 'function') {
        let args = {};
        try {
          args = JSON.parse(toolCall.function.arguments || '{}');
        } catch (e) {
          // Ignore parsing errors, continue with empty args
        }

        parts.push({
          functionCall: {
            id: toolCall.id,
            name: toolCall.function.name,
            args
          }
        });
      }
    }
  }

  // 如果没有任何内容，添加空文本
  if (parts.length === 0) {
    parts.push({ text: '' });
  }

  // 转换 finish_reason
  let finishReason = 'STOP';
  if (choice?.finish_reason) {
    switch (choice.finish_reason) {
      case 'stop':
        finishReason = 'STOP';
        break;
      case 'tool_calls':
        finishReason = 'TOOL_USE';
        break;
      case 'length':
        finishReason = 'MAX_TOKENS';
        break;
      case 'content_filter':
        finishReason = 'SAFETY';
        break;
      default:
        finishReason = choice.finish_reason.toUpperCase();
    }
  }

  return {
    candidates: [
      {
        content: {
          role: 'model',
          parts,
        },
        finishReason,
        index: 0,
      },
    ],
    usageMetadata: {
      promptTokenCount: openaiResponse.usage?.prompt_tokens || 0,
      candidatesTokenCount: openaiResponse.usage?.completion_tokens || 0,
      totalTokenCount: openaiResponse.usage?.total_tokens || 0,
    },
  };
}

/**
 * 处理流式响应（OpenAI SSE 格式转换为统一格式）
 */
export async function handleStreamResponse(
  apiResponse: Response,
  format: 'vertex' | 'openai'
): Promise<void> {
  const reader = apiResponse.body?.getReader();
  if (!reader) {
    throw new Error('No stream reader available');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const dataStr = line.substring(6);
        if (dataStr === '[DONE]') {
          continue;
        }

        try {
          const json = JSON.parse(dataStr);

          if (format === 'openai') {
            // 转换 OpenAI 流式格式
            convertOpenAIStreamChunk(json);
          }
        } catch (e) {
          // 忽略解析错误
        }
      }
    }
  }
}

/**
 * 转换 OpenAI 流式响应块为统一格式
 */
function convertOpenAIStreamChunk(chunk: Record<string, any>): StreamingChunk {
  const choice = chunk.choices?.[0];
  const text = choice?.delta?.content || '';

  return {
    candidates: [
      {
        content: {
          role: 'model',
          parts: [{ text }],
        },
        index: 0,
      },
    ],
  };
}
