/**
 * AgentSDK - 语音助手核心 SDK
 *
 * 纯 TypeScript 实现，无 React 依赖
 * 支持 Bridge 模式，可在 Web/Android/测试环境中使用
 *
 * @example
 * ```typescript
 * import { AgentSDK } from './sdk';
 *
 * const agent = new AgentSDK({
 *   wsUrl: 'wss://your-server.com/ws',
 *   modelType: 'gemini',
 *   systemPrompt: '你是一个友好的助手',
 *   tools: [{ name: 'search', description: '搜索功能' }],
 * });
 *
 * agent.on('ready', () => {
 *   console.log('Agent 已就绪');
 * });
 *
 * agent.on('text_output', ({ text }) => {
 *   console.log('AI 回复:', text);
 * });
 *
 * await agent.initialize();
 * agent.connect();
 * ```
 */

// 主类
export { AgentSDK } from './AgentSDK';
export type { AgentSDKConfig, AgentSDKState } from './AgentSDK';

// Core 模块
export { TurnManager } from './core/TurnManager';
export { WebSocketManager } from './core/WebSocketManager';
export type { WebSocketManagerConfig } from './core/WebSocketManager';

// Audio 模块
export { AudioManager } from './audio/AudioManager';
export type { AudioManagerConfig } from './audio/AudioManager';
export { OpusEncoder } from './audio/OpusEncoder';
export { OpusDecoder } from './audio/OpusDecoder';
export { WebAudioPlayer } from './audio/WebAudioPlayer';

// VAD 模块
export { VADManager } from './vad/VADManager';
export type { VADManagerConfig } from './vad/VADManager';
export { WebVADAdapter } from './vad/adapters/WebVADAdapter';
export { BridgeVADAdapter } from './vad/adapters/BridgeVADAdapter';

// Robot 模块
export { RobotEnvironment } from './robot/RobotEnvironment';
export type { RobotEnvironmentConfig } from './robot/RobotEnvironment';
export { AndroidRobotBridge } from './robot/adapters/AndroidRobotBridge';
export { MockRobotBridge } from './robot/adapters/MockRobotBridge';
export { RobotToolExecutor } from './robot/baseToolExecutor';
export { getRobotBaseTools, isRobotBaseTool, ROBOT_BASE_TOOL_NAMES } from './robot/baseTools';

// 兼容性: 导出原 robotSDK 实例
export { default as robotSDK } from './robot/robotSDK';

// 🆕 Tools 模块 - 统一工具管理
export * from './tools';
export { toolRegistry, getAllToolDeclarations, isRegisteredTool, getToolExecutor } from './tools/registry';
export { toolExecutor, callServerAPI } from './tools/executor';
export { SERVER_TOOLS, SERVER_TOOL_NAMES, isServerTool } from './tools/serverTools';
export { ROBOT_BASE_TOOLS } from './tools/definitions/robotTools';

// Audio 扩展
export { SpeechAudioCache, speechAudioCache } from './audio/SpeechAudioCache';
export * from './audio/audioProcessor';


// Utils 模块
export { getBackendBaseUrl, getWebSocketUrl, getAssetUrl } from './utils';

// React 集成
export { useAgentSDK } from './react/useAgentSDK';
export type { UseAgentSDKOptions, UseAgentSDKReturn } from './react/useAgentSDK';

// Maintenance 模块 (排除冲突的 ToolOverride，使用 tools 模块中的版本)
export type {
  ToolInfo,
  SceneOverrides,
  ParseInstructionResult,
  SpeechToTextResult,
  MaintenanceStep,
} from './maintenance';
export {
  getSceneOverrides,
  saveSceneOverrides,
  appendPrompt,
  setToolOverride,
  resetSceneOverrides,
  removePromptAddition,
  removeToolOverride,
  speechToText,
  parseInstruction,
} from './maintenance';
// 为 maintenance 模块的 ToolOverride 提供别名导出
export type { ToolOverride as MaintenanceToolOverride } from './maintenance/types';

// Types
export * from './types';