/**
 * Scene Types - 场景类型定义
 */

import React from 'react';
import type { ToolDeclaration, UnifiedClientMessage, UnifiedServerMessage } from '../../../shared/types/protocol';

/** 场景配置（别名，用于兼容导入） */
export type ScenarioConfig = SceneConfig;

/**
 * 工具调用参数
 */
export interface ToolCallContext {
  toolCall: NonNullable<UnifiedServerMessage['toolCall']>;
  sendMessage: (msg: UnifiedClientMessage) => void;
  turnId: number;
}

/**
 * 工具覆盖配置
 * 允许场景覆盖基础工具的 description 和 parameters
 */
export interface ToolOverrideConfig {
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
 * 工具过滤配置
 */
export interface ToolFilterConfig {
  /**
   * 要禁用的工具名称列表（黑名单模式）
   * 这些工具不会发送给 LLM
   */
  disabledTools?: string[];

  /**
   * 要启用的工具名称列表（白名单模式）
   * 如果设置，则只有这些工具会被启用（优先级高于 disabledTools）
   */
  enabledTools?: string[];

  /**
   * 🆕 工具覆盖配置
   * key: 工具名称, value: 覆盖的属性
   * 允许场景自定义已有工具的 description 和 parameters
   */
  toolOverrides?: Record<string, ToolOverrideConfig>;
}

/**
 * 场景配置
 */
export interface SceneConfig {
  /** 场景唯一标识 */
  id: string;
  /** 场景名称 */
  name: string;
  /** 场景图标 (emoji 或图片路径) */
  icon: string;
  /** 场景描述 */
  description: string;
  /** 场景 UI 组件 */
  component: React.ComponentType<SceneProps>;
  /** 场景特定的 System Prompt */
  systemPrompt?: string;
  /** 是否可用 */
  enabled?: boolean;
  /** 标签 (如 "Beta", "New") */
  badge?: string;
  /**
   * 输入模式
   * - 'vad': 语音活动检测模式（默认），自动检测用户说话
   * - 'ptt': Push-to-Talk 模式，禁用 VAD，手动控制录音
   */
  inputMode?: 'vad' | 'ptt';
  /**
   * 是否隐藏通用返回头部
   * 默认 false，设为 true 时场景需要自己处理返回逻辑
   */
  hideBackHeader?: boolean;

  /**
   * 🆕 工具过滤配置
   * 控制哪些基础工具在该场景中可用
   */
  toolFilter?: ToolFilterConfig;

  /**
   * 场景工具定义（可选）
   * 返回场景特定的工具列表，会与基础机器人工具合并后发送给 LLM
   */
  getTools?: () => ToolDeclaration[];

  /**
   * 场景工具执行器（可选）
   * 当 LLM 调用场景工具时，此函数负责执行并返回结果
   */
  executeToolCall?: (context: ToolCallContext) => Promise<string | null>;
}

/**
 * 场景组件 Props
 */
export interface SceneProps {
  /** 退出场景回调 */
  onExit: () => void;
}

/**
 * 场景工具结果
 */
export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
}
