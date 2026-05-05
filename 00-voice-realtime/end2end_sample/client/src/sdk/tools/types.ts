/**
 * Tools Types - 工具类型定义
 */

import type { ToolDeclaration, UnifiedClientMessage, UnifiedServerMessage } from '../../../../shared/types/protocol';

// Re-export for convenience
export type { ToolDeclaration };

/**
 * 工具分类
 */
export type ToolCategory =
  | 'navigation'      // 导航类
  | 'movement'        // 移动类
  | 'head'            // 头部控制
  | 'perception'      // 感知类
  | 'charging'        // 充电类
  | 'system'          // 系统类
  | 'ui'              // UI 类
  | 'search'          // 搜索类
  | 'planning'        // 规划类
  | 'scene';          // 场景特定

/**
 * 工具执行位置
 */
export type ToolExecutionLocation = 'client' | 'server';

/**
 * 工具调用上下文
 */
export interface ToolExecutionContext {
  /** 工具调用信息 */
  toolCall: NonNullable<UnifiedServerMessage['toolCall']>;
  /** 发送消息函数 */
  sendMessage: (msg: UnifiedClientMessage) => void;
  /** 当前 Turn ID */
  turnId: number;
  /** 额外上下文数据 */
  extra?: Record<string, any>;
}

/**
 * 工具执行结果
 */
export interface ToolExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * 工具执行器函数类型
 */
export type ToolExecutorFn = (
  args: Record<string, any>,
  context: ToolExecutionContext
) => Promise<ToolExecutionResult>;

/**
 * 注册的工具（完整定义，不依赖继承）
 */
export interface RegisteredTool {
  /** 工具名称 */
  name: string;
  /** 工具描述 */
  description: string;
  /** 工具参数 */
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  /** 工具分类 */
  category: ToolCategory;
  /** 执行位置 */
  executionLocation: ToolExecutionLocation;
  /** 是否需要服务端 API */
  requiresServerAPI?: boolean;
  /** 服务端 API 路径 (如果需要) */
  serverAPIPath?: string;
  /** 工具执行器 */
  executor: ToolExecutorFn;
}

/**
 * 工具覆盖配置
 * 允许场景覆盖基础工具的 description 和 parameters
 */
export interface ToolOverride {
  /** 覆盖的工具描述 */
  description?: string;
  /** 覆盖的工具参数 (会与原参数合并) */
  parameters?: {
    type?: 'object';
    properties?: Record<string, any>;
    required?: string[];
  };
}

/**
 * 场景工具配置
 */
export interface SceneToolConfig {
  /** 要禁用的基础工具名称列表 */
  disabledTools?: string[];
  /** 要启用的基础工具名称列表 (如果设置，则只启用这些) */
  enabledTools?: string[];
  /** 场景额外工具 */
  sceneTools?: ToolDeclaration[];
  /** 场景工具执行器 */
  sceneExecutor?: (context: ToolExecutionContext) => Promise<string | null>;
  /**
   * 🆕 工具覆盖配置
   * key: 工具名称, value: 覆盖的属性
   * 允许场景自定义已有工具的 description 和 parameters
   */
  toolOverrides?: Record<string, ToolOverride>;
}
