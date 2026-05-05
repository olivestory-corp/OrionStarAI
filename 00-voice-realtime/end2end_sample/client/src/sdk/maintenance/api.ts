/**
 * 维修模式 - API 调用
 * 纯 TypeScript 实现
 */

import { ParseInstructionResult, SpeechToTextResult, ToolInfo } from './types';

/**
 * 获取 API 基础 URL
 */
function getApiBaseUrl(): string {
  if (typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return `http://${window.location.hostname}:8081`;
  }
  return '';
}

/**
 * 语音转文字
 */
export async function speechToText(audioBlob: Blob): Promise<SpeechToTextResult> {
  try {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'audio.webm');

    const response = await fetch(`${getApiBaseUrl()}/api/maintenance/speech-to-text`, {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();
    return result as SpeechToTextResult;
  } catch (error: any) {
    console.error('[Maintenance API] 语音转文字失败:', error);
    return {
      success: false,
      error: error.message || '网络请求失败',
    };
  }
}

/**
 * 解析用户指令
 */
export async function parseInstruction(
  instruction: string,
  currentPrompt: string,
  tools: ToolInfo[]
): Promise<ParseInstructionResult> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/maintenance/parse-instruction`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        instruction,
        currentPrompt,
        tools,
      }),
    });

    const result = await response.json();
    return result as ParseInstructionResult;
  } catch (error: any) {
    console.error('[Maintenance API] 解析指令失败:', error);
    return {
      success: false,
      error: error.message || '网络请求失败',
    };
  }
}
