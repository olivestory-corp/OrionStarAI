/**
 * AgentSDK 事件类型定义
 */

import { Pose, Battery, NavigationStatus, PersonDetectionData } from './bridges';
import { ToolCall, ToolResult, TurnStatus } from './protocol';

/** 连接状态 */
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'ready';

/** 聊天消息 */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'tool' | 'system';
  text: string;
  timestamp?: number;
}

/** 音频统计 */
export interface AudioStats {
  totalBytes: number;
  totalDurationMs: number;
}

/** 机器人环境状态 */
export interface RobotEnvironmentState {
  timestamp: number;
  battery: Battery;
  pose: Pose;
  navigation: {
    status: 'idle' | 'navigating' | 'arrived' | 'error';
    destination?: string;
  };
  emergency: {
    isStopPressed: boolean;
    isPushed: boolean;
    isOutsideMap: boolean;
  };
  people: {
    count: number;
    list: PersonDetectionData['data'];
  };
}

/** AgentSDK 事件映射 */
export interface AgentSDKEvents {
  // 连接事件
  'connection_status': ConnectionStatus;
  'connected': void;
  'disconnected': void;
  'ready': void;
  'error': Error | string;

  // 语音事件
  'speech_start': void;
  'speech_end': void;
  'vad_ready': void;

  // Turn 事件
  'turn_start': number;  // turnId
  'turn_status': { turnId: number; status: TurnStatus };
  'turn_complete': { turnId: number; cost?: { amount: number; currency: string } };
  'turn_interrupted': number;  // turnId

  // 音频事件
  'audio_playing': boolean;
  'audio_progress': { playedSamples: number; totalSamples: number };
  'volume_change': number;

  // 消息事件
  'transcription': { text: string; isFinal: boolean };
  'text_output': { text: string; isFinal: boolean };
  'subtitle': string;

  // 工具事件
  'tool_call': ToolCall;
  'tool_result': ToolResult;

  // 机器人事件
  'robot_state': RobotEnvironmentState;
  'navigation_arrived': string;  // destination
  'person_detected': PersonDetectionData;
}

/** 事件名称类型 */
export type AgentSDKEventName = keyof AgentSDKEvents;
