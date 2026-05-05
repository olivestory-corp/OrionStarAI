/**
 * Robot Base Tools - 机器人基础工具定义
 *
 * 分类：
 * - navigation: 导航类 (6个)
 * - movement: 移动类 (3个)
 * - head: 头部控制 (2个)
 * - perception: 感知类 (1个)
 * - charging: 充电类 (3个)
 * - system: 系统类 (4个)
 */

import type { RegisteredTool, ToolExecutionResult } from '../types';
import robotSDK from '../../robot/robotSDK';

// ==================== 导航类工具 ====================
const navigationTools: RegisteredTool[] = [
  {
    name: 'startNavigation',
    description: `控制机器人导航到地图上的指定位置。

**调用时机** (用户明确表达要去某地):
- "带我去XX"、"去XX"、"导航到XX"

**不要调用** (用户只是询问位置):
- "XX在哪里？" → 先语音回答位置

**重要**: placeName 必须是地图上已存在的位置点。调用前建议先用 getPlaceList 获取可用地点列表。`,
    parameters: {
      type: 'object',
      properties: {
        placeName: {
          type: 'string',
          description: '目标地点名称，必须是地图上已存在的位置点。'
        },
        coordinateDeviation: {
          type: 'number',
          description: '到达目的地的判定范围（米），默认0.2米'
        }
      },
      required: ['placeName']
    },
    category: 'navigation',
    executionLocation: 'client',
    executor: async (args): Promise<ToolExecutionResult> => {
      const placeName = args.placeName;

      // 先获取地点列表，验证目标点是否存在
      try {
        const placeListResult = await robotSDK.getPlaceList() as any;
        let places: { name: string }[] = [];

        if (Array.isArray(placeListResult)) {
          places = placeListResult;
        } else if (placeListResult && typeof placeListResult === 'object' && Array.isArray(placeListResult.data)) {
          places = placeListResult.data;
        }

        const placeNames = places.map(p => p.name);
        const exists = placeNames.some(name =>
          name === placeName || name.includes(placeName) || placeName.includes(name)
        );

        if (!exists && placeNames.length > 0) {
          console.warn(`[startNavigation] ❌ 目标点不存在: ${placeName}`);
          return {
            success: false,
            error: `导航失败：目标点"${placeName}"不存在。可用的地点列表：${placeNames.join('、')}。请使用列表中的地点名称。`
          };
        }
      } catch (e) {
        console.warn('[startNavigation] ⚠️ 获取地点列表失败，继续尝试导航');
      }

      const result = await robotSDK.startNavigation(placeName);
      return { success: true, data: result };
    }
  },
  {
    name: 'stopNavigation',
    description: '停止机器人当前的导航任务。',
    parameters: { type: 'object', properties: {} },
    category: 'navigation',
    executionLocation: 'client',
    executor: async (): Promise<ToolExecutionResult> => {
      const result = await robotSDK.stopNavigation();
      return { success: true, data: result };
    }
  },
  {
    name: 'getPlaceList',
    description: '获取地图上的位置点列表。',
    parameters: { type: 'object', properties: {} },
    category: 'navigation',
    executionLocation: 'client',
    executor: async (): Promise<ToolExecutionResult> => {
      const result = await robotSDK.getPlaceList();
      return { success: true, data: result };
    }
  },
  {
    name: 'getLocation',
    description: '查询某个位置点的坐标信息。',
    parameters: {
      type: 'object',
      properties: {
        placeName: { type: 'string', description: '要查询的地点名称' }
      },
      required: ['placeName']
    },
    category: 'navigation',
    executionLocation: 'client',
    executor: async (args): Promise<ToolExecutionResult> => {
      const result = await robotSDK.getLocation(args.placeName);
      return { success: true, data: result };
    }
  },
  {
    name: 'getPosition',
    description: '获取机器人当前坐标位置。',
    parameters: { type: 'object', properties: {} },
    category: 'navigation',
    executionLocation: 'client',
    executor: async (): Promise<ToolExecutionResult> => {
      const result = await robotSDK.getPosition();
      return { success: true, data: result };
    }
  },
  {
    name: 'getMapName',
    description: '获取当前地图名称。',
    parameters: { type: 'object', properties: {} },
    category: 'navigation',
    executionLocation: 'client',
    executor: async (): Promise<ToolExecutionResult> => {
      const result = await robotSDK.getMapName();
      return { success: true, data: result };
    }
  }
];

// ==================== 移动类工具 ====================
const movementTools: RegisteredTool[] = [
  {
    name: 'moveForward',
    description: '控制机器人向前直线移动指定距离。',
    parameters: {
      type: 'object',
      properties: {
        distance: { type: 'number', description: '移动距离（米）' },
        speed: { type: 'number', description: '移动速度（米/秒），默认 0.5' },
        avoid: { type: 'boolean', description: '是否开启避障，默认 true' }
      },
      required: ['distance']
    },
    category: 'movement',
    executionLocation: 'client',
    executor: async (args): Promise<ToolExecutionResult> => {
      const result = await robotSDK.goForward(args.distance, args.speed, args.avoid);
      return { success: true, data: result };
    }
  },
  {
    name: 'moveBackward',
    description: '控制机器人向后移动指定距离。',
    parameters: {
      type: 'object',
      properties: {
        distance: { type: 'number', description: '移动距离（米）' },
        speed: { type: 'number', description: '移动速度（米/秒），默认 0.5' }
      },
      required: ['distance']
    },
    category: 'movement',
    executionLocation: 'client',
    executor: async (args): Promise<ToolExecutionResult> => {
      const result = await robotSDK.goBackward(args.distance, args.speed);
      return { success: true, data: result };
    }
  },
  {
    name: 'turnRobot',
    description: '控制机器人原地旋转。',
    parameters: {
      type: 'object',
      properties: {
        direction: { type: 'string', enum: ['left', 'right'], description: '旋转方向' },
        angle: { type: 'number', description: '旋转角度（度）' },
        speed: { type: 'number', description: '旋转速度（度/秒），默认 30' }
      },
      required: ['direction', 'angle']
    },
    category: 'movement',
    executionLocation: 'client',
    executor: async (args): Promise<ToolExecutionResult> => {
      const result = args.direction === 'left'
        ? await robotSDK.turnLeft(args.angle, args.speed)
        : await robotSDK.turnRight(args.angle, args.speed);
      return { success: true, data: result };
    }
  }
];

// ==================== 头部控制类工具 ====================
const headTools: RegisteredTool[] = [
  {
    name: 'moveHead',
    description: '控制机器人头部上下仰俯。用于抬头或低头动作。',
    parameters: {
      type: 'object',
      properties: {
        vAngle: { type: 'number', description: '垂直仰俯角度：90度为平视正前方，数值越小头越抬起（看天花板方向），范围 45 到 90 度。例如：抬头=45，低头/平视=90' }
      },
      required: ['vAngle']
    },
    category: 'head',
    executionLocation: 'client',
    executor: async (args): Promise<ToolExecutionResult> => {
      // hAngle 固定为 0，机器人头部不支持水平转动
      const result = await robotSDK.moveHead(0, args.vAngle);
      return { success: true, data: result };
    }
  },
  {
    name: 'resetHead',
    description: '将机器人头部复位到正前方。',
    parameters: { type: 'object', properties: {} },
    category: 'head',
    executionLocation: 'client',
    executor: async (): Promise<ToolExecutionResult> => {
      const result = await robotSDK.resetHead();
      return { success: true, data: result };
    }
  }
];

// ==================== 感知类工具 ====================
const perceptionTools: RegisteredTool[] = [
  {
    name: 'getPersonList',
    description: '获取当前视野内检测到的人员列表。',
    parameters: { type: 'object', properties: {} },
    category: 'perception',
    executionLocation: 'client',
    executor: async (): Promise<ToolExecutionResult> => {
      const result = await robotSDK.getPersonList();
      return { success: true, data: result };
    }
  }
];

// ==================== 充电类工具 ====================
const chargingTools: RegisteredTool[] = [
  {
    name: 'startAutoCharge',
    description: '机器人自动回充电桩充电。',
    parameters: {
      type: 'object',
      properties: {
        timeout: { type: 'number', description: '导航超时时间（毫秒），默认5分钟' }
      }
    },
    category: 'charging',
    executionLocation: 'client',
    executor: async (args): Promise<ToolExecutionResult> => {
      const result = await robotSDK.startAutoCharge(args?.timeout);
      return { success: true, data: result };
    }
  },
  {
    name: 'stopAutoCharge',
    description: '停止机器人当前的自动回充任务。',
    parameters: { type: 'object', properties: {} },
    category: 'charging',
    executionLocation: 'client',
    executor: async (): Promise<ToolExecutionResult> => {
      const result = await robotSDK.stopAutoCharge();
      return { success: true, data: result };
    }
  },
  {
    name: 'leaveChargingPile',
    description: '停止充电并脱离充电桩。',
    parameters: {
      type: 'object',
      properties: {
        speed: { type: 'number', description: '离桩速度（米/秒），默认 0.2' },
        distance: { type: 'number', description: '离桩距离（米），默认 0.5' }
      }
    },
    category: 'charging',
    executionLocation: 'client',
    executor: async (args): Promise<ToolExecutionResult> => {
      const result = await robotSDK.leaveChargingPile(args?.speed, args?.distance);
      return { success: true, data: result };
    }
  }
];

// ==================== 系统类工具 ====================
const systemTools: RegisteredTool[] = [
  {
    name: 'setLight',
    description: '设置机器人灯光颜色。',
    parameters: {
      type: 'object',
      properties: {
        color: { type: 'string', description: "RGB Hex String (e.g., 'FF0000')" }
      },
      required: ['color']
    },
    category: 'system',
    executionLocation: 'client',
    executor: async (args): Promise<ToolExecutionResult> => {
      const result = await robotSDK.setLight(args.color);
      return { success: true, data: result };
    }
  },
  {
    name: 'startFocusFollow',
    description: '开始焦点跟随指定人员。',
    parameters: {
      type: 'object',
      properties: {
        personId: { type: 'number', description: '人员ID' }
      },
      required: ['personId']
    },
    category: 'system',
    executionLocation: 'client',
    executor: async (args): Promise<ToolExecutionResult> => {
      const result = await robotSDK.startFocusFollow(args.personId);
      return { success: true, data: result };
    }
  },
  {
    name: 'stopFocusFollow',
    description: '停止焦点跟随。',
    parameters: { type: 'object', properties: {} },
    category: 'system',
    executionLocation: 'client',
    executor: async (): Promise<ToolExecutionResult> => {
      const result = await robotSDK.stopFocusFollow();
      return { success: true, data: result };
    }
  },
  {
    name: 'enter_maintenance_mode',
    description: '进入维修模式，允许修改机器人配置。',
    parameters: { type: 'object', properties: {} },
    category: 'system',
    executionLocation: 'client',
    executor: async (): Promise<ToolExecutionResult> => {
      console.log('[RobotTools] 🔧 触发维修模式');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('enter_maintenance_mode'));
      }
      return { success: true, data: { message: '已进入维修模式，请在界面上进行配置修改。' } };
    }
  }
];

// ==================== 导出所有工具 ====================
export const ROBOT_BASE_TOOLS: RegisteredTool[] = [
  ...navigationTools,
  ...movementTools,
  ...headTools,
  ...perceptionTools,
  ...chargingTools,
  ...systemTools
];

/**
 * 机器人基础工具名称列表
 */
export const ROBOT_BASE_TOOL_NAMES = ROBOT_BASE_TOOLS.map(t => t.name);

/**
 * 检查是否是机器人基础工具
 */
export function isRobotBaseTool(name: string): boolean {
  return ROBOT_BASE_TOOL_NAMES.includes(name);
}

/**
 * 按分类获取工具
 */
export function getToolsByCategory(category: string): RegisteredTool[] {
  return ROBOT_BASE_TOOLS.filter(t => t.category === category);
}
