/**
 * Wiki Context
 * 管理 Wiki 状态的全局状态
 */

'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { WikiAPI } from '@/lib/api';
import { CacheManager } from '@/lib/cache';
import type { WikiProjectStatus, WikiGenerateRequest } from '@/types/gitlab';

interface WikiAPIRequest {
  repo_url: string;
  repo_type: 'gitlab' | 'github' | 'bitbucket' | 'gerrit';
  owner: string;
  repo_name: string;
  provider?: string;
  model?: string;
  language: string;
  comprehensive: boolean;
  force_refresh: boolean;
}

interface WikiContextType {
  // 状态
  wikiStatuses: Map<string, WikiProjectStatus>;
  loading: boolean;
  error: string | null;

  // 操作
  loadWikiStatuses: (projectKeys: string[]) => Promise<void>;
  getWikiStatus: (projectKey: string) => WikiProjectStatus | null;
  generateWiki: (request: WikiGenerateRequest) => Promise<string>;
  refreshWikiStatus: (projectKey: string) => Promise<void>;
  clearStatuses: () => void;
}

const WikiContext = createContext<WikiContextType | undefined>(undefined);

/**
 * Wiki Provider
 */
export function WikiProvider({ children }: { children: React.ReactNode }) {
  const [wikiStatuses, setWikiStatuses] = useState<Map<string, WikiProjectStatus>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 批量加载 Wiki 状态
   */
  const loadWikiStatuses = useCallback(async (projectKeys: string[]) => {
    if (projectKeys.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      console.log(`🔍 批量获取 ${projectKeys.length} 个项目的 Wiki 状态...`);

      const statuses = await WikiAPI.batchGetStatus(projectKeys);

      // 保存到内存缓存
      CacheManager.setWikiStatuses(statuses);

      // 更新状态
      setWikiStatuses(CacheManager.getAllWikiStatuses());

      console.log(`✅ 成功获取 ${Object.keys(statuses).length} 个项目的 Wiki 状态`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load wiki statuses';
      setError(message);
      console.error('❌ 加载 Wiki 状态失败:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 获取单个项目的 Wiki 状态
   */
  const getWikiStatus = useCallback((projectKey: string): WikiProjectStatus | null => {
    return CacheManager.getWikiStatus(projectKey);
  }, []);

  /**
   * 生成 Wiki
   */
  const generateWiki = useCallback(async (request: WikiGenerateRequest): Promise<string> => {
    setError(null);

    try {
      console.log(`📋 开始生成 Wiki: ${request.owner}/${request.repo_name}`);

      // 转换参数名：前端 is_comprehensive → 后端 comprehensive
      // 注意：request.is_comprehensive 可能是 false，所以不能用 || true
      // 如果是 undefined，则默认为 true
      const isComprehensive = request.is_comprehensive !== undefined ? request.is_comprehensive : true;

      const apiRequest: WikiAPIRequest = {
        repo_url: request.repo_url,
        repo_type: request.repo_type,
        owner: request.owner,
        repo_name: request.repo_name,
        language: request.language ?? 'zh',
        comprehensive: isComprehensive,
        force_refresh: request.force_refresh ?? false,
      };

      const response = await WikiAPI.generate(apiRequest);

      const taskId = response.task_id;
      console.log(`✅ Wiki 生成任务已创建: ${taskId}`);

      // 更新项目状态为 generating
      const projectKey = `${request.repo_type}:${request.owner}/${request.repo_name}`;
      CacheManager.setWikiStatus(projectKey, {
        project_key: projectKey,
        status: 'generating',
        current_task_id: taskId,
        generation_count: 0,
      });

      setWikiStatuses(CacheManager.getAllWikiStatuses());

      return taskId;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate wiki';
      setError(message);
      console.error('❌ 生成 Wiki 失败:', err);
      throw err;
    }
  }, []);

  /**
   * 刷新单个项目的 Wiki 状态
   */
  const refreshWikiStatus = useCallback(async (projectKey: string) => {
    setError(null);

    try {
      console.log(`🔄 刷新 Wiki 状态: ${projectKey}`);

      const status = await WikiAPI.getStatus(projectKey);

      CacheManager.setWikiStatus(projectKey, status);
      setWikiStatuses(CacheManager.getAllWikiStatuses());

      console.log(`✅ Wiki 状态已更新: ${status.status}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to refresh wiki status';
      setError(message);
      console.error('❌ 刷新 Wiki 状态失败:', err);
    }
  }, []);

  /**
   * 清除所有 Wiki 状态
   */
  const clearStatuses = useCallback(() => {
    CacheManager.clearWikiStatuses();
    setWikiStatuses(new Map());
  }, []);

  const value: WikiContextType = {
    wikiStatuses,
    loading,
    error,
    loadWikiStatuses,
    getWikiStatus,
    generateWiki,
    refreshWikiStatus,
    clearStatuses,
  };

  return (
    <WikiContext.Provider value={value}>
      {children}
    </WikiContext.Provider>
  );
}

/**
 * useWiki Hook
 */
export function useWiki() {
  const context = useContext(WikiContext);

  if (!context) {
    throw new Error('useWiki must be used within WikiProvider');
  }

  return context;
}
