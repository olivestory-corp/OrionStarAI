/**
 * Tool Registry - 工具注册中心
 *
 * 统一管理所有工具的注册、查询和过滤
 */

import type { ToolDeclaration } from '../../../../shared/types/protocol';
import type {
  RegisteredTool,
  ToolCategory,
  ToolExecutorFn,
  SceneToolConfig
} from './types';
import { ROBOT_BASE_TOOLS } from './definitions/robotTools';
import { SERVER_TOOLS } from './serverTools';

/**
 * 工具注册表
 */
class ToolRegistry {
  private tools: Map<string, RegisteredTool> = new Map();

  constructor() {
    this.registerBuiltinTools();
  }

  /**
   * 注册内置工具
   */
  private registerBuiltinTools(): void {
    // 注册机器人基础工具
    ROBOT_BASE_TOOLS.forEach(tool => {
      this.register(tool);
    });

    // 注册服务端工具 (迁移到客户端)
    SERVER_TOOLS.forEach(tool => {
      this.register(tool);
    });

    console.log(`[ToolRegistry] 📦 已注册 ${this.tools.size} 个内置工具`);
  }

  /**
   * 注册工具
   */
  register(tool: RegisteredTool): void {
    if (this.tools.has(tool.name)) {
      console.warn(`[ToolRegistry] ⚠️ 工具 ${tool.name} 已存在，将被覆盖`);
    }
    this.tools.set(tool.name, tool);
  }

  /**
   * 注销工具
   */
  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  /**
   * 获取工具
   */
  get(name: string): RegisteredTool | undefined {
    return this.tools.get(name);
  }

  /**
   * 检查工具是否存在
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * 获取所有工具名称
   */
  getAllNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * 获取所有工具
   */
  getAll(): RegisteredTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * 按分类获取工具
   */
  getByCategory(category: ToolCategory): RegisteredTool[] {
    return this.getAll().filter(t => t.category === category);
  }

  /**
   * 获取机器人基础工具名称列表
   */
  getRobotToolNames(): string[] {
    return this.getAll()
      .filter(t => t.executionLocation === 'client' && t.category !== 'scene')
      .map(t => t.name);
  }

  /**
   * 获取服务端工具名称列表
   */
  getServerToolNames(): string[] {
    return this.getAll()
      .filter(t => t.requiresServerAPI)
      .map(t => t.name);
  }

  /**
   * 获取工具声明（用于发送给 LLM）
   */
  getDeclarations(names?: string[]): ToolDeclaration[] {
    const tools = names
      ? names.map(n => this.get(n)).filter(Boolean) as RegisteredTool[]
      : this.getAll();

    return tools.map(({ name, description, parameters }) => ({
      name,
      description,
      parameters
    }));
  }

  /**
   * 根据场景配置获取工具声明
   */
  getSceneTools(config: SceneToolConfig): ToolDeclaration[] {
    let baseTools: RegisteredTool[];

    if (config.enabledTools) {
      // 白名单模式：只启用指定工具
      baseTools = config.enabledTools
        .map(n => this.get(n))
        .filter(Boolean) as RegisteredTool[];
    } else {
      // 黑名单模式：排除禁用工具
      const disabled = new Set(config.disabledTools || []);
      baseTools = this.getAll()
        .filter(t => t.category !== 'scene') // 不包含场景工具
        .filter(t => !disabled.has(t.name));
    }

    // 转换为 ToolDeclaration
    const declarations = baseTools.map(({ name, description, parameters }) => ({
      name,
      description,
      parameters
    }));

    // 添加场景特定工具
    if (config.sceneTools) {
      declarations.push(...config.sceneTools);
    }

    return declarations;
  }
}

// 单例导出
export const toolRegistry = new ToolRegistry();

/**
 * 便捷函数：获取所有工具声明
 */
export function getAllToolDeclarations(): ToolDeclaration[] {
  return toolRegistry.getDeclarations();
}

/**
 * 便捷函数：检查是否是已注册工具
 */
export function isRegisteredTool(name: string): boolean {
  return toolRegistry.has(name);
}

/**
 * 便捷函数：获取工具执行器
 */
export function getToolExecutor(name: string): ToolExecutorFn | undefined {
  return toolRegistry.get(name)?.executor;
}
