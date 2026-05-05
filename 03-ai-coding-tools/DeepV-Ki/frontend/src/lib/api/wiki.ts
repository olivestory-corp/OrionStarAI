/**
 * Wiki 相关 API
 */

import { APIClient } from './client';
import type {
  WikiProjectStatus,
  WikiGenerateRequest,
  WikiGenerateResponse,
} from '@/types/gitlab';

export interface BatchWikiStatusRequest {
  project_keys: string[];
}

export type BatchWikiStatusResponse = Record<string, WikiProjectStatus>;

/**
 * Wiki API 封装
 */
export const WikiAPI = {
  /**
   * 获取单个项目的 Wiki 状态
   */
  async getStatus(projectKey: string): Promise<WikiProjectStatus> {
    const encodedKey = encodeURIComponent(projectKey);
    return APIClient.get<WikiProjectStatus>(
      `/api/wiki/projects/${encodedKey}/status`
    );
  },

  /**
   * 批量获取多个项目的 Wiki 状态
   */
  async batchGetStatus(projectKeys: string[]): Promise<BatchWikiStatusResponse> {
    return APIClient.post<BatchWikiStatusResponse>(
      '/api/wiki/projects/status/batch',
      { project_keys: projectKeys }
    );
  },

  /**
   * 生成 Wiki
   */
  async generate(request: WikiGenerateRequest): Promise<WikiGenerateResponse> {
    return APIClient.post<WikiGenerateResponse>(
      '/api/tasks/wiki/generate',
      request
    );
  },

  /**
   * 获取 Wiki 内容（通过 project_key）
   */
  async getContentByProjectKey(projectKey: string): Promise<Record<string, unknown>> {
    const encodedKey = encodeURIComponent(projectKey);
    return APIClient.get(`/api/wiki/projects/${encodedKey}/content`);
  },

  /**
   * 获取 Wiki 内容（旧方法，保留兼容性）
   */
  async getContent(owner: string, repo: string): Promise<Record<string, unknown>> {
    return APIClient.get(`/api/wiki/${owner}/${repo}`);
  },
};
