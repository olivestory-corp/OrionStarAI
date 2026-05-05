/**
 * 项目相关 API
 */

import { APIClient } from './client';
import type { GitLabProject } from '@/types/gitlab';

export interface GroupedProjects {
  member?: Record<string, GitLabProject[]>;
  inherited?: Record<string, GitLabProject[]>;
  total: number;
  member_count?: number;
  inherited_count?: number;
  cached?: boolean;
  syncing?: boolean;
}

export interface SyncProjectsResponse {
  success: boolean;
  member_count: number;
  inherited_count: number;
  message: string;
}

export interface SyncStatus {
  stage: 'initializing' | 'fetching_user' | 'fetching_direct_projects' | 'fetching_groups' | 'fetching_group_projects' | 'processing' | 'saving' | 'completed' | 'error' | 'idle';
  progress: number;        // 0-100
  message: string;
  timestamp: number;
  member_count?: number;
  inherited_count?: number;
  total?: number;
  error?: string;
}

/**
 * 项目 API 封装
 */
export const ProjectAPI = {
  /**
   * 获取分组的项目列表
   */
  async getGroupedProjects(userEmail: string): Promise<GroupedProjects> {
    // 添加时间戳防止缓存
    return APIClient.get<GroupedProjects>(
      `/api/gitlab/projects/grouped?email=${encodeURIComponent(userEmail)}&_t=${Date.now()}`
    );
  },

  /**
   * 从 GitLab 同步项目
   * 通过调用 /api/gitlab/projects/grouped 来获取最新项目（会自动同步到本地数据库）
   */
  async syncProjects(userEmail: string): Promise<SyncProjectsResponse> {
    const result = await APIClient.get<GroupedProjects>(
      `/api/gitlab/projects/grouped?email=${encodeURIComponent(userEmail)}`
    );

    return {
      success: true,
      member_count: result.member_count || 0,
      inherited_count: result.inherited_count || 0,
      message: `Successfully synced ${result.total || 0} projects from GitLab`,
    };
  },

  /**
   * 获取同步状态（用于轮询）
   */
  async getSyncStatus(userEmail: string): Promise<SyncStatus> {
    return APIClient.get<SyncStatus>(
      `/api/gitlab/sync-status?email=${encodeURIComponent(userEmail)}`
    );
  },
};
