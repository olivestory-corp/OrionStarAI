/**
 * Tool Executor - 统一工具执行器
 *
 * 负责：
 * 1. 路由工具调用到正确的执行器
 * 2. 处理服务端 API 调用
 * 3. 发送工具执行结果
 * 4. 触发工具执行事件 (tool_start / tool_end)
 *
 * 特殊工具处理：
 * - silent: 不返回结果给 LLM，直接打断
 *
 * 事件：
 * - window 'tool_start': { toolCallId, name, args }
 * - window 'tool_end': { toolCallId, name, args, success, error? }
 */

import type { UnifiedClientMessage, UnifiedServerMessage } from '../../../../shared/types/protocol';
import type { ToolExecutionContext, ToolExecutionResult, SceneToolConfig } from './types';
import { toolRegistry } from './registry';
import { getBackendBaseUrl } from '../utils';

/**
 * 特殊工具列表 - 这些工具不需要返回结果给 LLM
 */
const NO_RESPONSE_TOOLS = new Set(['silent']);

/**
 * 工具执行事件数据
 */
export interface ToolExecutionEvent {
  toolCallId: string;
  name: string;
  args: Record<string, any>;
  success?: boolean;
  error?: string;
}

/**
 * 触发工具开始事件
 */
function emitToolStart(data: ToolExecutionEvent): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('tool_start', { detail: data }));
  }
}

/**
 * 触发工具结束事件
 */
function emitToolEnd(data: ToolExecutionEvent): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('tool_end', { detail: data }));
  }
}

/**
 * 统一工具执行器
 */
export class ToolExecutor {
  private sceneConfig?: SceneToolConfig;

  /**
   * 设置场景配置
   */
  setSceneConfig(config: SceneToolConfig): void {
    this.sceneConfig = config;
  }

  /**
   * 执行工具调用
   */
  async execute(
    toolCall: NonNullable<UnifiedServerMessage['toolCall']>,
    sendMessage: (msg: UnifiedClientMessage) => void,
    turnId: number,
    extra?: Record<string, any>
  ): Promise<void> {
    const { name, arguments: args, toolCallId } = toolCall;
    const context: ToolExecutionContext = {
      toolCall,
      sendMessage,
      turnId,
      extra
    };

    console.log(`[ToolExecutor] 🔧 执行工具: ${name}`, args);

    // 🎯 触发工具开始事件
    emitToolStart({ toolCallId: toolCallId || '', name, args });

    // 🔇 特殊处理: silent 工具
    if (name === 'silent') {
      console.log(`[ToolExecutor] 🔇 执行 silent - 不返回结果给 LLM`);

      // 触发静音事件
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('agent_silent'));
      }

      // 发送 interrupt 消息打断 LLM
      sendMessage({
        type: 'interrupt',
        turnId,
        timestamp: Date.now(),
        interrupt: { interruptedTurnId: turnId }
      } as UnifiedClientMessage);

      // 🎯 触发工具结束事件
      emitToolEnd({ toolCallId: toolCallId || '', name, args, success: true });

      console.log(`[ToolExecutor] ✅ silent 执行完成 - 已打断对话`);
      return;
    }

    try {
      let result: ToolExecutionResult;

      // 1. 优先尝试场景工具执行器
      if (this.sceneConfig?.sceneExecutor) {
        const sceneResult = await this.sceneConfig.sceneExecutor(context);
        if (sceneResult !== null) {
          // 🎯 触发工具结束事件
          emitToolEnd({ toolCallId: toolCallId || '', name, args, success: true });
          this.sendResult(sendMessage, turnId, toolCallId || '', name, sceneResult);
          return;
        }
      }

      // 2. 尝试注册表中的工具
      const registeredTool = toolRegistry.get(name);
      if (registeredTool) {
        result = await registeredTool.executor(args, context);
      } else {
        // 3. 未知工具
        console.warn(`[ToolExecutor] ⚠️ 未知工具: ${name}`);
        result = {
          success: false,
          error: `Unknown tool: ${name}`
        };
      }

      // 🎯 触发工具结束事件
      emitToolEnd({
        toolCallId: toolCallId || '',
        name,
        args,
        success: result.success,
        error: result.error
      });

      // 检查是否需要返回结果给 LLM
      if (NO_RESPONSE_TOOLS.has(name)) {
        console.log(`[ToolExecutor] ✅ ${name} 执行完成 - 不返回结果给 LLM`);
        return;
      }

      // 发送结果
      this.sendResult(sendMessage, turnId, toolCallId || '', name, JSON.stringify(result));
      console.log(`[ToolExecutor] ✅ 工具执行完成: ${name}`);

    } catch (error: any) {
      console.error(`[ToolExecutor] ❌ 工具执行失败: ${name}`, error);

      // 🎯 触发工具结束事件 (失败)
      emitToolEnd({
        toolCallId: toolCallId || '',
        name,
        args,
        success: false,
        error: error.message
      });

      // silent 失败也不发送结果
      if (NO_RESPONSE_TOOLS.has(name)) {
        return;
      }

      this.sendResult(
        sendMessage,
        turnId,
        toolCallId || '',
        name,
        JSON.stringify({
          success: false,
          error: error.message || 'Tool execution failed'
        })
      );
    }
  }

  /**
   * 发送工具执行结果
   */
  private sendResult(
    sendMessage: (msg: UnifiedClientMessage) => void,
    turnId: number,
    toolCallId: string,
    name: string,
    result: string
  ): void {
    sendMessage({
      type: 'tool_result',
      turnId,
      timestamp: Date.now(),
      toolResult: {
        toolCallId,
        name,
        result
      }
    } as UnifiedClientMessage);
  }
}

/**
 * 调用服务端 API
 * 用于需要服务端支持的工具（如 UI 生成、搜索等）
 */
export async function callServerAPI<T = any>(
  path: string,
  body: Record<string, any>
): Promise<T> {
  const baseUrl = getBackendBaseUrl();
  const url = `${baseUrl}${path}`;

  console.log(`[ToolExecutor] 🌐 调用服务端 API: ${url}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

// 单例导出
export const toolExecutor = new ToolExecutor();