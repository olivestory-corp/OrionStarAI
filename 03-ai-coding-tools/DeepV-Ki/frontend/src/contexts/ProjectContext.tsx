/**
 * Project Context
 * 管理项目数据的全局状态
 */

'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { ProjectAPI, type GroupedProjects, type SyncStatus } from '@/lib/api';
import { CacheManager } from '@/lib/cache';

interface ProjectContextType {
  // 状态
  projects: GroupedProjects | null;
  loading: boolean;
  error: string | null;
  userEmail: string;
  syncStatus: SyncStatus | null;

  // 操作
  setUserEmail: (email: string) => void;
  loadProjects: () => Promise<void>;
  refreshProjects: () => Promise<void>;
  syncProjects: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

/**
 * Project Provider
 */
export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<GroupedProjects | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);

  // 使用 ref 来解决循环依赖问题 (pollSyncStatus -> refreshProjects -> loadProjects -> pollSyncStatus)
  const refreshProjectsRef = useRef<() => Promise<void>>(async () => {});

  /**
   * 轮询同步状态
   * 定义在 loadProjects 之前，因为它被 loadProjects 使用
   */
  const pollSyncStatus = useCallback(async (email: string, silent: boolean = false) => {
    const pollInterval = setInterval(async () => {
      try {
        const status = await ProjectAPI.getSyncStatus(email);

        // 更新状态
        setSyncStatus(status);

        // 在控制台显示进度
        console.log(`[${status.stage}] ${status.progress}% - ${status.message}`);

        // 如果同步完成或出错，停止轮询
        if (status.stage === 'completed' || status.stage === 'error' || status.stage === 'idle') {
          clearInterval(pollInterval);

          if (status.stage === 'completed') {
            if (silent) {
                // 静默模式：只更新本地缓存，不刷新页面
                console.log('✅ 同步完成，静默更新本地缓存...');
                try {
                    const newData = await ProjectAPI.getGroupedProjects(email);
                    CacheManager.setProjects(email, newData);
                    console.log('✅ 本地缓存已更新 (下一次加载生效)');
                } catch (e) {
                    console.error('静默更新缓存失败:', e);
                }
            } else {
                // 普通模式：刷新页面
                // 使用 ref 调用，避免循环依赖
                if (refreshProjectsRef.current) {
                    await refreshProjectsRef.current();
                }
            }

            // 清除同步状态
            setSyncStatus(null);
            setLoading(false);
          }
        }
      } catch (err) {
        console.error('轮询状态失败:', err);
        clearInterval(pollInterval);
      }
    }, 1000); // 每秒轮询一次
  }, []); // 移除 refreshProjects 依赖

  /**
   * 从缓存或 API 加载项目
   */
  const loadProjects = useCallback(async () => {
    if (!userEmail) {
      console.warn('No user email, skipping project load');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 先尝试从缓存加载
      const cached = CacheManager.getProjects(userEmail);

      if (cached) {
        console.log('✅ 从缓存加载项目数据');
        setProjects(cached);
        setLoading(false);

        // 即使有缓存，也触发一次后台同步检查（静默更新）
        // 这里的目的是：如果后端有更新的数据，悄悄更新本地存储和当前视图
        ProjectAPI.getGroupedProjects(userEmail).then(data => {
            console.log('🔍 [Background Check] Backend response:', { cached: data.cached, syncing: data.syncing, total: data.total });

            if (!data.cached) {
                console.log('🔄 后台正在同步，启动静默轮询...');
                pollSyncStatus(userEmail, true); // silent = true
            } else {
                // 后端返回了有效数据，检查是否需要更新本地缓存
                // 简单对比一下总数或者直接覆盖（因为后端数据总是准的）
                console.log('💾 [Background Check] Updating local storage with backend data');
                CacheManager.setProjects(userEmail, data);

                // 可选：如果数据有变化，也可以更新当前视图
                // setProjects(data);
                // 但为了避免用户操作时突然跳变，通常只更新缓存供下次使用
                // 或者可以比较一下 timestamp，如果差异很大才更新
            }
        }).catch(e => console.warn('后台同步检查失败:', e));
        return;
      }

      // 缓存未命中，从 API 加载
      console.log('🔄 从 API 加载项目数据...');
      const data = await ProjectAPI.getGroupedProjects(userEmail);

      if (data.cached) {
          // 如果后端返回的是缓存数据（说明之前同步过）
          CacheManager.setProjects(userEmail, data);
          setProjects(data);
          console.log(`✅ 加载了 ${data.total} 个项目`);
          setLoading(false);
      } else {
          // 如果后端返回非缓存数据（说明正在同步中或首次同步）
          console.log('⏳ 后端正在同步，启动轮询...');
          // 此时 data 可能为空或部分数据，我们先不设置 projects，或者设置为空状态
          // 启动轮询 (silent = false，因为当前没有数据显示，需要刷新)
          pollSyncStatus(userEmail, false);
          // 保持 loading 为 true，直到轮询完成
      }

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load projects';
      setError(message);
      console.error('❌ 加载项目失败:', err);
      setLoading(false);
    }
  }, [userEmail, pollSyncStatus]);

  /**
   * 刷新项目（清除缓存后重新加载）
   */
  const refreshProjects = useCallback(async () => {
    if (!userEmail) return;

    console.log('🔄 刷新项目数据...');
    CacheManager.clearProjects(userEmail);
    // 这里的 loadProjects 会重新走一遍逻辑，如果后端有缓存就直接显示
    // 如果后端还在同步，会再次进入轮询（但通常 refreshProjects 是在同步完成后调用的）
    await loadProjects();
  }, [userEmail, loadProjects]);

  // 更新 ref
  useEffect(() => {
    refreshProjectsRef.current = refreshProjects;
  }, [refreshProjects]);

  /**
   * 从 GitLab 同步项目
   */
  const syncProjects = useCallback(async () => {
    if (!userEmail) return;

    setLoading(true);
    setError(null);

    try {
      console.log('🔄 从 GitLab 同步项目...');

      // 立即启动轮询，开始监听后端状态变化 (silent = false，手动同步需要刷新)
      pollSyncStatus(userEmail, false);

      // 触发后端同步（不等待，让轮询来监听进度）
      ProjectAPI.syncProjects(userEmail).catch((err) => {
        const message = err instanceof Error ? err.message : 'Failed to sync projects';
        setError(message);
        console.error('❌ 同步项目失败:', err);
        setLoading(false);
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sync projects';
      setError(message);
      console.error('❌ 同步项目失败:', err);
      setLoading(false);
    }
  }, [userEmail, pollSyncStatus]);

  // 移除旧的 useEffect，因为逻辑已经移到 pollSyncStatus 中
  // useEffect(() => {
  //   if (syncStatus?.stage === 'completed') {
  //       refreshProjects().finally(() => {
  //           setSyncStatus(null);
  //           setLoading(false);
  //       });
  //   }
  // }, [syncStatus, refreshProjects]);

  // 监听 userEmail 变化，自动加载项目
  useEffect(() => {
    if (userEmail) {
      loadProjects();
    }
  }, [userEmail, loadProjects]);

  const value: ProjectContextType = {
    projects,
    loading,
    error,
    userEmail,
    syncStatus,
    setUserEmail,
    loadProjects,
    refreshProjects,
    syncProjects,
  };

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
}

/**
 * useProjects Hook
 */
export function useProjects() {
  const context = useContext(ProjectContext);

  if (!context) {
    throw new Error('useProjects must be used within ProjectProvider');
  }

  return context;
}
