/**
 * 维修模式类型定义
 */

export interface ToolInfo {
  name: string;
  description: string;
}

export interface ToolOverride {
  description: string;
}

export interface SceneOverrides {
  sceneId: string;
  promptAdditions: string[];
  toolOverrides: {
    [toolName: string]: ToolOverride;
  };
  updatedAt: number;
}

export interface ParseInstructionResult {
  success: boolean;
  action?: 'append_prompt' | 'modify_tool' | 'cancel';
  content?: string;
  toolName?: string;
  newDescription?: string;
  reason?: string;
  error?: string;
}

export interface SpeechToTextResult {
  success: boolean;
  text?: string;
  error?: string;
}

export type MaintenanceStep =
  | 'idle'
  | 'recording'
  | 'transcribing'
  | 'confirming'
  | 'parsing'
  | 'previewing'
  | 'saved';
