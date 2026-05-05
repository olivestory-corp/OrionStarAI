/**
 * Tools Module - 统一工具管理
 *
 * 整合所有工具来源:
 * - Robot Base Tools (机器人基础工具)
 * - Server Tools (服务端工具，迁移到客户端调用)
 * - Scene Tools (场景特定工具)
 *
 * 事件:
 * - window 'tool_start': ToolExecutionEvent - 工具开始执行
 * - window 'tool_end': ToolExecutionEvent - 工具执行结束
 *
 * 使用示例:
 * ```ts
 * window.addEventListener('tool_start', (e) => {
 *   const { name, args } = (e as CustomEvent).detail;
 *   showLoading(name);
 * });
 *
 * window.addEventListener('tool_end', (e) => {
 *   const { name, success, error } = (e as CustomEvent).detail;
 *   hideLoading();
 * });
 * ```
 */

export * from './types';
export * from './registry';
export * from './executor';
export * from './serverTools';

// 导出事件类型
export type { ToolExecutionEvent } from './executor';
