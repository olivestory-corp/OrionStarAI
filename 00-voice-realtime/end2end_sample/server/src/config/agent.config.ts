/**
 * Agent配置文件
 *
 * 新架构：
 * - 服务端只有一个 common-agent
 * - 场景特定的 prompt 由客户端提供
 * - 此配置文件保留用于向后兼容和调试
 */

export interface AgentConfig {
  // 当前激活的Agent ID（现在只有 common）
  activeAgent: 'common';

  // Agent描述
  description: string;

  // 是否启用调试模式
  debug?: boolean;
}

// 默认配置
export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  activeAgent: 'common',
  description: 'Common Agent - 通用语音机器人，场景由客户端决定',
  debug: false
};

// 获取当前配置
export function getCurrentAgentConfig(): AgentConfig {
  return {
    ...DEFAULT_AGENT_CONFIG,
    debug: process.env.NODE_ENV === 'development'
  };
}

// 显示配置信息
export function showAgentConfig(): void {
  console.log('\n=== Agent 配置 ===');
  console.log('🤖 Common Agent');
  console.log('   场景特定的 System Prompt 由客户端提供');
  console.log('   客户端工具（导航、移动等）由客户端处理\n');
}