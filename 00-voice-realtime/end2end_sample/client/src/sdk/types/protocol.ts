/**
 * 统一通信协议类型定义
 * 复用 shared/types/protocol.ts 的定义
 */

// 复用 shared 的协议定义
export type {
  UnifiedClientMessage,
  UnifiedServerMessage,
  ToolDeclaration,
} from '../../../../shared/types/protocol';

/** 工具调用 (从 UnifiedServerMessage 中提取) */
export interface ToolCall {
  toolCallId: string;
  name: string;
  arguments: Record<string, any>;
}

/** 工具结果 */
export interface ToolResult {
  toolCallId: string;
  result: any;
  error?: string;
}

/** 模型类型 */
export type ModelType = 'openai';

/** Turn 状态 */
export type TurnStatus =
  | 'encoding'
  | 'sending'
  | 'waiting_llm'
  | 'receiving'
  | 'decoding'
  | 'playing'
  | 'completed'
  | 'interrupted';

/** Turn 信息 */
export interface TurnInfo {
  turnId: number;
  status: TurnStatus;
  startTime: number;
  audioChunksCount: number;
  receivedChunksCount: number;
}
