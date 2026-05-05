/**
 * Agent管理器 - 精简版
 *
 * 架构变更说明：
 * - 工具声明和执行已迁移到客户端 (client/src/sdk/tools/)
 * - 服务端只负责：
 *   1. 提供默认的 System Prompt
 *   2. 作为 LLM 通道 (WebSocket)
 *   3. 提供 REST API (UI生成、搜索、规划)
 */

import { COMMON_AGENT_PROMPT } from './common-agent/prompt';

// Agent类型定义（精简版）
export interface Agent {
  id: string;
  name: string;
  description: string;
  prompt: string;
}

// Common Agent 定义
const commonAgent: Agent = {
  id: 'common',
  name: 'Common Agent',
  description: '通用语音机器人Agent。工具由客户端管理，System Prompt 由客户端场景提供。',
  prompt: COMMON_AGENT_PROMPT
};

// 初始化日志
console.log(`[Agent Manager] 🤖 初始化 Common Agent (工具已迁移到客户端)`);

/**
 * 获取当前Agent
 */
export function getCurrentAgent(): Agent {
  return commonAgent;
}

/**
 * 获取服务端函数声明（已迁移到客户端，返回空数组）
 */
export function getCurrentFunctionDeclarations(): any[] {
  return [];
}

/**
 * 获取默认提示词（客户端可覆盖）
 */
export function getCurrentAgentPrompt(): string {
  return commonAgent.prompt;
}

/**
 * 执行服务端函数（已迁移到客户端）
 */
export async function executeCurrentAgentFunction(
  functionName: string,
  args: any,
  context?: any
): Promise<string> {
  console.log(`[Agent Manager] ⚠️ 工具执行已迁移到客户端: ${functionName}`);

  return JSON.stringify({
    status: 'migrated',
    message: `Tool '${functionName}' execution has been migrated to client-side.`,
    hint: 'This function should be handled by client/src/sdk/tools/'
  });
}

/**
 * 获取Agent信息
 */
export function getAgentInfo(): Agent {
  return commonAgent;
}

/**
 * 获取当前状态
 */
export function getCurrentStatus() {
  return {
    agent: {
      id: commonAgent.id,
      name: commonAgent.name,
      description: commonAgent.description
    },
    mode: 'client_tools',
    message: 'Server is LLM channel only. Tools are managed by client.'
  };
}
