/**
 * Face Register Scene - 工具定义与执行
 *
 * 工具列表:
 *   - record_name: 记录用户名字和人脸特征
 *   - get_name: 识别当前人脸身份
 */

import type { ToolDeclaration } from '../../../../shared/types/protocol';
import { ToolCallContext } from '../types';
import { faceService } from './faceService';
import { saveFaceRecord, getFaceRecords, getRegisteredNames } from './storage';

/**
 * 人脸注册场景工具定义
 */
export const getFaceRegisterTools = (): ToolDeclaration[] => {
  return [
    {
      name: 'record_name',
      description: `记录用户的名字并拍摄照片提取人脸特征。

**调用时机** (用户明确表达注册意图):
- "帮我注册人脸，我叫XXX"
- "记住我的脸，我是XXX"
- "请记住我，我叫XXX"
- "录入我的人脸信息，我是XXX"

**不要调用** (用户只是自我介绍):
- "你好，我是张三" → 不调用，这只是打招呼
- "我叫李明，请问洗手间在哪？" → 不调用，用户在问路
- "我是王经理，找张总" → 不调用，用户在找人

**判断关键**: 用户必须有"注册/记住/录入"等明确动作词，仅说"我是XXX"不算注册意图。`,
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: '用户告知的名字',
          },
        },
        required: ['name'],
      },
    },
    {
      name: 'get_name',
      description: `识别当前摄像头中的人脸身份。

**调用时机**:
- "我是谁"、"你认识我吗"、"你还记得我吗"
- "猜猜我是谁"、"你知道我是谁吗"

**不要调用**:
- 用户没有询问身份相关问题
- 用户在进行其他对话`,
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  ];
};

/**
 * 工具名称列表
 */
export const FACE_REGISTER_TOOL_NAMES = ['record_name', 'get_name'];

/**
 * 检查是否是人脸注册场景工具
 */
export const isFaceRegisterTool = (toolName: string): boolean => {
  return FACE_REGISTER_TOOL_NAMES.includes(toolName);
};

/**
 * 执行人脸注册场景工具
 * @returns 工具执行结果（JSON 字符串），或 null 表示不是该场景工具
 */
export const executeFaceRegisterTool = async (
  context: ToolCallContext
): Promise<string | null> => {
  const { toolCall } = context;
  const { name, arguments: args } = toolCall;

  if (!isFaceRegisterTool(name)) {
    return null;
  }

  console.log(`[FaceRegisterTools] 👤 执行工具: ${name}`, args);

  // 检查服务是否就绪
  if (!faceService.isReady()) {
    return JSON.stringify({
      success: false,
      error: '人脸识别模型正在加载，请稍候再试',
    });
  }

  try {
    switch (name) {
      case 'record_name': {
        const userName = args?.name;
        if (!userName) {
          return JSON.stringify({
            success: false,
            error: '未提供用户名字',
          });
        }

        // 检测人脸并提取特征
        const descriptor = await faceService.detectAndDescribe();
        if (!descriptor) {
          // 触发 UI 提示
          window.dispatchEvent(
            new CustomEvent('face_register_status', {
              detail: { status: 'no_face', message: '未检测到人脸' },
            })
          );

          return JSON.stringify({
            success: false,
            error: '未检测到人脸，请确保面部正对摄像头，光线充足',
          });
        }

        // 捕获缩略图
        const thumbnail = faceService.captureThumbnail();

        // 保存到 localStorage
        saveFaceRecord({
          name: userName,
          descriptor: Array.from(descriptor),
          thumbnail: thumbnail || undefined,
        });

        // 触发 UI 更新
        window.dispatchEvent(
          new CustomEvent('face_register_status', {
            detail: {
              status: 'registered',
              name: userName,
              message: `已成功注册 ${userName}`,
            },
          })
        );

        // 更新已注册名单
        window.dispatchEvent(
          new CustomEvent('face_register_list_updated', {
            detail: { names: getRegisteredNames() },
          })
        );

        return JSON.stringify({
          success: true,
          message: `已成功记录 ${userName} 的面部信息`,
          registeredCount: getFaceRecords().length,
        });
      }

      case 'get_name': {
        // 检测人脸并提取特征
        const descriptor = await faceService.detectAndDescribe();
        if (!descriptor) {
          window.dispatchEvent(
            new CustomEvent('face_register_status', {
              detail: { status: 'no_face', message: '未检测到人脸' },
            })
          );

          return JSON.stringify({
            success: false,
            error: '未检测到人脸，请确保面部正对摄像头',
          });
        }

        // 在已注册记录中查找匹配
        const match = faceService.findMatch(descriptor);

        if (match) {
          window.dispatchEvent(
            new CustomEvent('face_register_status', {
              detail: {
                status: 'recognized',
                name: match.name,
                confidence: (1 - match.distance).toFixed(2),
                message: `识别成功: ${match.name}`,
              },
            })
          );

          return JSON.stringify({
            success: true,
            name: match.name,
            confidence: (1 - match.distance).toFixed(2),
          });
        } else {
          const registeredCount = getFaceRecords().length;
          window.dispatchEvent(
            new CustomEvent('face_register_status', {
              detail: {
                status: 'unknown',
                message: '未找到匹配的人脸',
              },
            })
          );

          return JSON.stringify({
            success: false,
            error:
              registeredCount === 0
                ? '还没有注册任何人脸，请先说"我是XXX"进行注册'
                : `在 ${registeredCount} 个已注册用户中未找到匹配`,
          });
        }
      }

      default:
        return null;
    }
  } catch (error) {
    console.error(`[FaceRegisterTools] ❌ 工具执行失败: ${name}`, error);
    return JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : '工具执行失败',
    });
  }
};
