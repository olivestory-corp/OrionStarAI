/**
 * Common Agent 工具集 (已迁移到客户端)
 *
 * ⚠️ 注意：工具声明和执行已迁移到客户端 (client/src/sdk/tools/)
 *
 * 此文件保留空的导出以保持向后兼容
 */

// 空的函数声明列表（工具现在由客户端管理）
export const commonFunctionDeclarations: any[] = [];

// 空的执行函数（工具现在由客户端执行）
export async function executeCommonFunctionCall(
  functionName: string,
  args: any,
  context?: any
): Promise<string> {
  console.log(`[Common Agent] ⚠️ 工具已迁移到客户端: ${functionName}`);

  return JSON.stringify({
    status: 'migrated',
    message: `Tool '${functionName}' has been migrated to client-side execution.`,
    hint: 'Client should handle this tool call directly.'
  });
}
