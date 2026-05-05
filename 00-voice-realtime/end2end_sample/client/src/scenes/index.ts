/**
 * Scenes Registry - 场景注册
 */

import { SceneConfig } from './types';
import {
  FaceRegisterScene,
  FACE_REGISTER_SCENE_PROMPT,
  getFaceRegisterTools,
  executeFaceRegisterTool,
} from './faceRegister';
import {
  Advice3CScene,
  ADVICE_3C_SCENE_PROMPT,
  getAdvice3CTools,
  executeAdvice3CTool,
} from './advice-3c';

/**
 * 所有可用场景
 */
export const SCENES: SceneConfig[] = [
  {
    id: 'face-register',
    name: '人脸注册',
    icon: '👤',
    description: '人脸录入与身份识别',
    component: FaceRegisterScene,
    systemPrompt: FACE_REGISTER_SCENE_PROMPT,
    enabled: true,
    // 🔧 场景工具
    getTools: getFaceRegisterTools,
    executeToolCall: executeFaceRegisterTool,
  },
  {
    id: 'advice-3c',
    name: 'Advice 3C',
    icon: '🖥️',
    description: 'IT & Electronics Shopping / ช้อปปิ้ง IT',
    component: Advice3CScene,
    systemPrompt: ADVICE_3C_SCENE_PROMPT,
    enabled: true,
    badge: 'New',
    hideBackHeader: true, // 场景自己处理返回逻辑
    // 🔧 Scene Tools
    getTools: getAdvice3CTools,
    executeToolCall: executeAdvice3CTool,
    // 🔧 Tool Filter: 只保留导航相关工具，禁用其他基础工具
    toolFilter: {
      disabledTools: [
        // 导航类 - 保留: startNavigation, stopNavigation, getPlaceList
        'getLocation', 'getPosition', 'getMapName',
        // 移动类 - 全部禁用
        'moveForward', 'moveBackward', 'turnRobot',
        // 头部控制 - 全部禁用
        'moveHead', 'resetHead',
        // 感知类 - 全部禁用
        'getPersonList',
        // 充电类 - 全部禁用
        'startAutoCharge', 'stopAutoCharge', 'leaveChargingPile',
        // 系统类 - 全部禁用
        'setLight', 'startFocusFollow', 'stopFocusFollow', 'enter_maintenance_mode',
        'render_ui_component','consult_planning_agent','search_web'
      ],
    },
  },
];

/**
 * 根据 ID 获取场景
 */
export function getSceneById(id: string): SceneConfig | undefined {
  return SCENES.find(scene => scene.id === id);
}

/**
 * 获取可用场景
 */
export function getEnabledScenes(): SceneConfig[] {
  return SCENES.filter(scene => scene.enabled);
}

// 导出类型
export * from './types';

// 导出工具管理器
export { getSceneTools, executeSceneToolCall, createSceneAdapter } from './toolManager';

// 导出场景
export { FaceRegisterScene } from './faceRegister';
export { Advice3CScene } from './advice-3c';
