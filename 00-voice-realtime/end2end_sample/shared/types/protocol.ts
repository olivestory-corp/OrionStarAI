/**
 * ============================================
 * 统一通信协议 - 客户端和服务端共享
 * ============================================
 */

/**
 * 客户端消息类型
 */
export type ClientMessageType =
  | 'setup'           // 建立 AI 连接
  | 'audio_input'     // 音频输入
  | 'text_input'      // 文本输入
  | 'interrupt'       // 中断当前对话
  | 'clear_audio_buffer' // 清除音频缓冲区
  | 'get_map_data'    // 获取地图数据
  | 'tool_result'     // 工具执行结果
  | 'ping';           // 心跳

/**
 * 服务端消息类型
 */
export type ServerMessageType =
  | 'ready'               // AI 连接成功
  | 'audio_output'        // 音频输出
  | 'text_output'         // 文本输出
  | 'transcription'       // 转写结果
  | 'tool_call'           // 工具调用
  | 'tool_result'         // 工具执行结果
  | 'turn_complete'       // 轮次完成
  | 'interrupted'         // 已中断
  | 'error'               // 错误
  | 'ai_disconnected'     // AI 连接已断开
  | 'map_data'            // 地图数据
  | 'pong'                // 心跳响应
  | 'show_html'           // 显示 HTML 界面
  | 'ui_generating';      // UI 生成中（Loading 状态）

/**
 * 音频分片
 */
export interface AudioChunk {
  data: string;           // Base64 编码的音频数据
  sequence: number;       // 分片序号
  isLast?: boolean;       // 是否最后一片
}

/**
 * 模型配置（统一格式，由适配器转换）
 */
export interface ModelConfig {
  systemInstruction?: string;      // 系统提示词
  temperature?: number;             // 温度
  maxTokens?: number;               // 最大 token 数
  voice?: string;                   // 语音名称（客户端传入）
  voiceName?: string;               // 语音名称（适配器使用）
  responseModalities?: string[];   // 响应模式（audio, text）
  tools?: ToolDeclaration[];       // 工具声明（统一格式）
}

/**
 * 工具声明（统一格式）
 */
export interface ToolDeclaration {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

/**
 * 性能指标
 */
export interface TurnMetrics {
  encodeTimeMs?: number;              // 编码耗时
  networkTimeMs?: number;             // 网络耗时
  llmProcessTimeMs?: number;          // LLM 处理耗时
  decodeTimeMs?: number;              // 解码耗时
  totalTimeMs: number;                // 总耗时
}

/**
 * 统一的客户端消息结构
 */
export interface UnifiedClientMessage {
  // 🎯 核心字段
  type: ClientMessageType;
  turnId: number;                    // Turn-ID（递增数字，用于标识对话轮次和打断过滤）
  timestamp: number;                 // 客户端时间戳

  // 🎵 音频输入（type = 'audio_input'）
  audioInput?: {
    format: 'opus' | 'pcm16' | 'pcm_float32';  // 音频格式
    sampleRate: number;                         // 采样率
    channels: number;                           // 声道数
    chunks: AudioChunk[];                       // 音频分片
    isFinal?: boolean;                          // 是否为最后一块音频
  };

  // 📝 文本输入（type = 'text_input'）
  textInput?: {
    text: string;                               // 文本内容
    role?: 'user' | 'assistant' | 'system';     // 角色（默认 user）
    silent?: boolean;                           // 🆕 是否保持沉默（不触发回复）
  };

  // ⚙️ 设置（type = 'setup'）
  setup?: {
    modelType: 'openai';             // AI 模型类型
    config?: ModelConfig;                       // 模型配置
  };

  // ⚠️ 中断（type = 'interrupt'）
  interrupt?: {
    interruptedTurnId: number;                  // 被中断的 Turn-ID
  };

  // 🧹 清除音频缓冲区（type = 'clear_audio_buffer'）
  clearAudioBuffer?: {
    clearAll?: boolean;                         // 是否清除所有（默认 true）
  };

  // 🔧 工具执行结果（type = 'tool_result'）
  toolResult?: {
    toolCallId: string;               // 工具调用 ID
    result: any;                      // 执行结果
    error?: string;                   // 错误信息（如果失败）
  };
}

/**
 * 统一的服务端消息结构
 */
export interface UnifiedServerMessage {
  // 🎯 核心字段
  type: ServerMessageType;
  turnId?: number;                   // Turn-ID（回显客户端，用于打断过滤）
  timestamp: number;                 // 服务端时间戳

  // 🎵 音频输出（type = 'audio_output'）
  audioOutput?: {
    format: 'opus' | 'pcm16' | 'pcm_float32';
    sampleRate: number;
    channels: number;
    chunks: AudioChunk[];
    isFinal?: boolean;                // 是否最终输出
  };

  // 📝 文本输出（type = 'text_output'）
  textOutput?: {
    text: string;
    role: 'assistant' | 'system';
    isFinal?: boolean;                // 是否最终输出（流式）
  };

  // 📄 转写结果（type = 'transcription'）
  transcription?: {
    text: string;
    language?: string;
    confidence?: number;
  };

  // 🔧 工具调用（type = 'tool_call'）
  toolCall?: {
    toolCallId: string;               // 工具调用 ID
    name: string;                     // 工具名称
    arguments: Record<string, any>;   // 参数
  };

  // 🔧 工具执行结果（type = 'tool_result'）
  toolResult?: {
    toolCallId: string;               // 工具调用 ID
    result: any;                      // 执行结果
    error?: string;                   // 错误信息（如果失败）
  };

  // ✅ 轮次完成（type = 'turn_complete'）
  turnComplete?: {
    duration: number;                 // 总耗时（ms）
    metrics?: TurnMetrics;            // 性能指标
  };

  // 💰 成本信息（type = 'turn_complete' 时携带）
  cost?: {
    amount: number;                   // 本次交互成本（美元）
    details?: {                       // 详细成本拆分
      textInput?: number;
      textInputCached?: number;
      audioInput?: number;
      audioInputCached?: number;
      textOutput?: number;
      audioOutput?: number;
    };
  };

  // ❌ 错误（type = 'error'）
  error?: {
    code: string;                     // 错误码
    message: string;                  // 错误信息
    details?: any;                    // 详细信息
  };

  // 🗺️ 地图数据（type = 'map_data'）
  mapData?: {
    areas: any[];
  };

  // 🎨 HTML 界面（type = 'show_html'）
  html?: {
    content: string;      // HTML 内容
    description: string;  // 描述
  };

  // ⏳ UI 生成状态（type = 'ui_generating'）
  uiGenerating?: {
    description: string;  // 正在生成的内容描述
  };
}
