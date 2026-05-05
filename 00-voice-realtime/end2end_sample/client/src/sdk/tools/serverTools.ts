/**
 * Server Tools - Server-side tool definitions
 *
 * These tools were originally executed on the server, now migrated to client
 * Client is responsible for calling server API to get data
 */

import type { RegisteredTool, ToolExecutionContext, ToolExecutionResult } from './types';
import { callServerAPI } from './executor';

/**
 * Server tool definitions
 */
export const SERVER_TOOLS: RegisteredTool[] = [
  // ==================== silent ====================
  // ⚠️ Special tool: silent is specially handled by ToolExecutor
  // - Does not return tool_result to LLM (otherwise LLM will continue responding)
  // - Directly sends interrupt to break current conversation
  // - The executor here won't actually be called, just for type completeness
  {
    name: 'silent',
    description: `Stop voice output and stay quiet.

**ONLY call in these situations**:
- User explicitly says "shut up", "stop talking", "be quiet", "stop", "silence"
- User explicitly asks you not to speak

**NEVER call in these situations**:
- User is just pausing or thinking
- Background noise or silence detected
- Conversation naturally ends
- User asked a question (should answer, not stay silent)`,
    parameters: {
      type: 'object',
      properties: {},
      required: []
    },
    category: 'system',
    executionLocation: 'client',
    // Note: This executor won't actually be called, silent is specially handled in ToolExecutor
    executor: async (_args, _context): Promise<ToolExecutionResult> => {
      // This function won't be called, silent is handled directly by ToolExecutor.execute()
      console.warn('[ServerTools] ⚠️ silent executor should not be called directly');
      return { success: true, data: { message: 'Silent mode activated.' } };
    }
  }
];

/**
 * 服务端工具名称列表
 */
export const SERVER_TOOL_NAMES = SERVER_TOOLS.map(t => t.name);

/**
 * 检查是否是服务端工具
 */
export function isServerTool(name: string): boolean {
  return SERVER_TOOL_NAMES.includes(name);
}
