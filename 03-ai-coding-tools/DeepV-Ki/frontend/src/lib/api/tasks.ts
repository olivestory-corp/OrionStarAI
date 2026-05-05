/**
 * 任务相关 API
 */

import { APIClient } from './client';
import type { WikiTask } from '@/hooks/useTasks';

export interface CreateTaskResponse {
  task_id: string;
  created_at: string;
}

/**
 * 任务 API 封装
 */
export const TaskAPI = {
  /**
   * 获取任务状态
   */
  async getStatus(taskId: string): Promise<WikiTask> {
    return APIClient.get<WikiTask>(`/api/tasks/${taskId}/status`);
  },

  /**
   * 取消任务
   */
  async cancel(taskId: string): Promise<Record<string, unknown>> {
    return APIClient.delete(`/api/tasks/${taskId}`);
  },

  /**
   * 创建 Wiki 任务
   */
  async createWikiTask(params: Record<string, unknown>): Promise<CreateTaskResponse> {
    return APIClient.post<CreateTaskResponse>('/api/tasks/wiki/generate', params);
  },
};
