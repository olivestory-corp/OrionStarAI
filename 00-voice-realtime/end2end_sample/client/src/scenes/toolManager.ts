/**
 * Scene Tool Manager - 场景工具管理器
 *
 * 职责：
 * 1. 整合基础工具 + 服务端工具 + 场景特定工具
 * 2. 支持场景级别的工具禁用/启用
 * 3. 支持场景级别的工具描述/参数覆盖
 * 4. 路由工具调用到对应的执行器
 * 5. 格式化工具结果返回给 LLM
 */

import type { ToolDeclaration, UnifiedClientMessage, UnifiedServerMessage } from '../../../shared/types/protocol';
import { toolRegistry } from '../sdk/tools/registry';
import { toolExecutor } from '../sdk/tools/executor';
import { SceneConfig, ToolOverrideConfig } from './types';

// 内部工具类型定义 (避免跨模块类型解析问题)
interface InternalRegisteredTool {
  name: string;
  description: string;
  parameters: { type: 'object'; properties: Record<string, any>; required?: string[] };
  [key: string]: any;
}

/**
 * 应用工具覆盖配置
 * @param tool 原始工具声明
 * @param override 覆盖配置
 * @returns 覆盖后的工具声明
 */
function applyToolOverride(
  tool: ToolDeclaration,
  override: ToolOverrideConfig
): ToolDeclaration {
  const result: ToolDeclaration = { ...tool };

  // 覆盖 description
  if (override.description) {
    result.description = override.description;
  }

  // 覆盖/合并 parameters
  if (override.parameters) {
    result.parameters = {
      ...tool.parameters,
      ...override.parameters,
      // 深度合并 properties
      properties: {
        ...tool.parameters.properties,
        ...(override.parameters.properties || {})
      }
    };
    // 如果指定了 required，使用覆盖的
    if (override.parameters.required) {
      result.parameters.required = override.parameters.required;
    }
  }

  return result;
}

/**
 * 获取场景的完整工具列表
 * = (基础机器人工具 + 服务端工具) 经过场景过滤和覆盖 + 场景特定工具
 */
export async function getSceneTools(scene: SceneConfig): Promise<ToolDeclaration[]> {
  // 1. 获取所有已注册工具
  const allRegisteredTools = toolRegistry.getAll() as InternalRegisteredTool[];

  // 2. 应用场景过滤
  let filteredTools = allRegisteredTools;

  if (scene.toolFilter) {
    if (scene.toolFilter.enabledTools) {
      // 白名单模式：只启用指定工具
      const enabledSet = new Set(scene.toolFilter.enabledTools);
      filteredTools = allRegisteredTools.filter(t => enabledSet.has(t.name));
    } else if (scene.toolFilter.disabledTools) {
      // 黑名单模式：禁用指定工具
      const disabledSet = new Set(scene.toolFilter.disabledTools);
      filteredTools = allRegisteredTools.filter(t => !disabledSet.has(t.name));
    }
  }

  // 3. 转换为 ToolDeclaration 格式
  let baseDeclarations: ToolDeclaration[] = filteredTools.map(t => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters
  }));

  // 4. 🆕 应用工具覆盖配置
  const toolOverrides = scene.toolFilter?.toolOverrides;
  if (toolOverrides) {
    baseDeclarations = baseDeclarations.map(tool => {
      const override = toolOverrides[tool.name];
      if (override) {
        console.log(`[ToolManager] 🔄 覆盖工具[${tool.name}] 配置`);
        return applyToolOverride(tool, override);
      }
      return tool;
    });
  }

  // 5. 获取场景特定工具
  const sceneTools = scene.getTools?.() ?? [];

  const totalTools = [...baseDeclarations, ...sceneTools];

  console.log(`[ToolManager] 🔧 场景[${scene.id}] 工具加载: ${baseDeclarations.length} 基础 + ${sceneTools.length} 场景 = ${totalTools.length} 总计`);

  if (scene.toolFilter?.disabledTools?.length) {
    console.log(`[ToolManager] 🚫 禁用工具: ${scene.toolFilter.disabledTools.join(', ')}`);
  }

  if (toolOverrides && Object.keys(toolOverrides).length > 0) {
    console.log(`[ToolManager] 🔄 覆盖工具: ${Object.keys(toolOverrides).join(', ')}`);
  }

  return totalTools;
}

/**
 * 执行工具调用
 * 使用统一的工具执行器，支持场景自定义执行器
 */
export async function executeSceneToolCall(
  scene: SceneConfig,
  toolCall: NonNullable<UnifiedServerMessage['toolCall']>,
  sendMessage: (msg: UnifiedClientMessage) => void,
  turnId: number
): Promise<void> {
  const { name } = toolCall;

  console.log(`[ToolManager] 🔧 执行工具: ${name}`, toolCall.arguments);

  // 配置场景执行器
  toolExecutor.setSceneConfig({
    disabledTools: scene.toolFilter?.disabledTools,
    enabledTools: scene.toolFilter?.enabledTools,
    sceneTools: scene.getTools?.(),
    sceneExecutor: scene.executeToolCall
      ? async (context) => scene.executeToolCall!(context)
      : undefined
  });

  // 使用统一执行器
  await toolExecutor.execute(toolCall, sendMessage, turnId);
}

/**
 * 创建场景的 ScenarioConfig 适配器
 * 用于兼容 SessionContext 的老接口
 */
export function createSceneAdapter(scene: SceneConfig) {
  return {
    id: scene.id,
    name: scene.name,
    description: scene.description,
    systemPrompt: scene.systemPrompt,

    getTools: () => getSceneTools(scene),

    executeToolCall: (
      toolCall: NonNullable<UnifiedServerMessage['toolCall']>,
      sendMessage: (msg: UnifiedClientMessage) => void,
      turnId: number
    ) => executeSceneToolCall(scene, toolCall, sendMessage, turnId),

    getMapData: undefined  // 场景暂不支持地图数据
  };
}
