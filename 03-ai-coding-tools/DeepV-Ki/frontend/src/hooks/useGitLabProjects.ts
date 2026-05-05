/**
 * Hook for managing GitLab projects
 */

'use client';

import { useState, useCallback } from 'react';
import type { GitLabProject, ProjectRole } from '@/types/gitlab';
import { WikiAPI } from '@/lib/api';
import { APIClient } from '@/lib/api/client';
import { CacheManager } from '@/lib/cache';

interface GitLabProjectsAPIResponse {
  total: number;
  member_count: number;
  inherited_count: number;
  user_email: string;
  member: Record<ProjectRole, GitLabProject[]>;
  inherited: Record<ProjectRole, GitLabProject[]>;
}

interface UseGitLabProjectsReturn {
  projects: GitLabProject[];
  grouped: Record<string, Record<ProjectRole, GitLabProject[]>>;
  loading: boolean;
  error: string | null;
  refreshProjects: () => Promise<void>;
}

export function useGitLabProjects(): UseGitLabProjectsReturn {
  const [projects, setProjects] = useState<GitLabProject[]>([]);
  const [grouped, setGrouped] = useState<Record<string, Record<ProjectRole, GitLabProject[]>>>({
    member: {} as Record<ProjectRole, GitLabProject[]>,
    inherited: {} as Record<ProjectRole, GitLabProject[]>,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshProjects = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Try to get user email from auth
      let userEmail = '';
      try {
        const authData = await APIClient.get<{ user_info: { uid: string; email: string; username: string } }>('/api/auth/sso/user');
        const userInfo = authData?.user_info;
        userEmail = userInfo?.uid || userInfo?.email || userInfo?.username || '';
        console.log('📧 Got user email from SSO:', userEmail);
      } catch (err) {
        console.debug('Could not get user email from auth:', err);
      }

      // 1. 尝试从本地存储加载缓存 (优先显示)
      if (userEmail) {
        console.log(`🔍 [LocalStorage] Checking cache for ${userEmail}...`);
        const cachedData = CacheManager.getProjects(userEmail);

        if (cachedData) {
          console.log(`✅ [LocalStorage] Found cached projects for ${userEmail}`);

          // 重建扁平化项目列表
          const cachedProjects: GitLabProject[] = [];
          Object.values(cachedData.member || {}).forEach((ps) => {
            if (Array.isArray(ps)) cachedProjects.push(...ps);
          });
          Object.values(cachedData.inherited || {}).forEach((ps) => {
            if (Array.isArray(ps)) cachedProjects.push(...ps);
          });

          // 更新状态
          setProjects(cachedProjects);
          setGrouped({
            member: (cachedData.member || {}) as Record<ProjectRole, GitLabProject[]>,
            inherited: (cachedData.inherited || {}) as Record<ProjectRole, GitLabProject[]>,
          });
        } else {
          console.log(`⚪ [LocalStorage] No cache found for ${userEmail}`);
        }
      }

      // Build URL with email parameter if available
      const url = new URL('/api/gitlab/projects/grouped', window.location.origin);
      if (userEmail) {
        url.searchParams.append('email', userEmail);
      }

      console.log('🔄 Fetching GitLab projects from:', url.toString());

      const data = await APIClient.get<GitLabProjectsAPIResponse>(url.toString());

      console.log('✅ GitLab API Response:', {
        total: data.total,
        member_count: data.member_count,
        inherited_count: data.inherited_count,
        user_email: data.user_email
      });

      console.log('📋 Data structure:', {
        member_keys: Object.keys(data.member || {}),
        inherited_keys: Object.keys(data.inherited || {}),
        member_type: typeof data.member,
        inherited_type: typeof data.inherited,
        member_data: data.member,
        inherited_data: data.inherited
      });

      // Flatten all projects
      const allProjects: GitLabProject[] = [];

      // 明确设置 grouped 数据
      const groupedData = {
        member: data.member || {},
        inherited: data.inherited || {},
      };

      console.log('🔍 Grouped data structure:', {
        member_keys: Object.keys(groupedData.member),
        inherited_keys: Object.keys(groupedData.inherited),
        member_sample: groupedData.member.DEVELOPER ? `${groupedData.member.DEVELOPER.length} items` : 'undefined',
        inherited_sample: groupedData.inherited.DEVELOPER ? `${groupedData.inherited.DEVELOPER.length} items` : 'undefined',
      });

      // Collect all projects for easy access
      Object.values(data.member || {}).forEach((projects) => {
        if (Array.isArray(projects)) {
          allProjects.push(...projects);
        }
      });
      Object.values(data.inherited || {}).forEach((projects) => {
        if (Array.isArray(projects)) {
          allProjects.push(...projects);
        }
      });

      // 批量获取 wiki 状态
      if (allProjects.length > 0) {
        try {
          const projectKeys = allProjects.map(p => {
            const namespace = p.path_with_namespace.split('/')[0];
            const repoName = p.path;
            return `gitlab:${namespace}/${repoName}`;
          });

          console.log(`🔍 Fetching wiki status for ${projectKeys.length} projects...`);
          console.log('📋 Project keys:', projectKeys.slice(0, 5)); // 显示前5个

          const wikiStatuses = await WikiAPI.batchGetStatus(projectKeys);
          console.log('📊 Wiki statuses received:', Object.keys(wikiStatuses).length);
          console.log('📋 First wiki status:', Object.entries(wikiStatuses)[0]);

          // 合并 wiki 状态到项目数据
          const projectsWithWiki = allProjects.map(project => {
            const namespace = project.path_with_namespace.split('/')[0];
            const repoName = project.path;
            const projectKey = `gitlab:${namespace}/${repoName}`;
            const wikiStatus = wikiStatuses[projectKey];

            return {
              ...project,
              wiki_status: wikiStatus?.status || 'not_generated',
              wiki_pages_count: wikiStatus?.pages_count,
              wiki_task_id: wikiStatus?.current_task_id,
              wiki_last_generated_at: wikiStatus?.last_generated_at,
            };
          });

          // 更新 grouped 数据
          const updatedGroupedData = {
            member: {} as Record<ProjectRole, GitLabProject[]>,
            inherited: {} as Record<ProjectRole, GitLabProject[]>,
          };

          // 重新分组，使用带 wiki 状态的项目
          projectsWithWiki.forEach(project => {
            const memberType = project.member_type || 'member';
            const role = project.role;

            if (!updatedGroupedData[memberType][role]) {
              updatedGroupedData[memberType][role] = [];
            }
            updatedGroupedData[memberType][role].push(project);
          });

          setProjects(projectsWithWiki);
          setGrouped(updatedGroupedData);

          // 2. 保存最新数据到本地存储 (供下次使用)
          if (userEmail) {
            console.log(`💾 [LocalStorage] Saving fresh projects for ${userEmail}`);
            CacheManager.setProjects(userEmail, {
              member: updatedGroupedData.member,
              inherited: updatedGroupedData.inherited,
              total: projectsWithWiki.length,
              member_count: data.member_count, // 保持原始计数
              inherited_count: data.inherited_count, // 保持原始计数
            });
          }

          console.log(`✅ Successfully loaded ${projectsWithWiki.length} projects with wiki status`);
        } catch (wikiErr) {
          console.warn('⚠️  Failed to fetch wiki status, using projects without wiki info:', wikiErr);
          setProjects(allProjects);
          setGrouped(groupedData);

          // 即使获取 wiki 状态失败，也保存基础项目数据
          if (userEmail) {
            console.log(`💾 [LocalStorage] Saving basic projects (wiki status failed) for ${userEmail}`);
            CacheManager.setProjects(userEmail, {
              member: groupedData.member,
              inherited: groupedData.inherited,
              total: allProjects.length,
              member_count: data.member_count,
              inherited_count: data.inherited_count,
            });
          }
        }
      } else {
        setProjects(allProjects);
        setGrouped(groupedData);

        // 保存基础数据
        if (userEmail) {
          console.log(`💾 [LocalStorage] Saving projects for ${userEmail}`);
          CacheManager.setProjects(userEmail, {
            member: groupedData.member,
            inherited: groupedData.inherited,
            total: allProjects.length,
            member_count: data.member_count,
            inherited_count: data.inherited_count,
          });
        }
      }

      console.log(`📊 Successfully loaded ${allProjects.length} projects`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch projects';
      setError(errorMessage);
      console.error('❌ Error fetching GitLab projects:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    projects,
    grouped,
    loading,
    error,
    refreshProjects,
  };
}
