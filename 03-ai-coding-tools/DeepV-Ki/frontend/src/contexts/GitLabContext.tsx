'use client';

import React, { createContext, useContext, ReactNode, useRef } from 'react';
import { useGitLabProjects } from '@/hooks/useGitLabProjects';

// 导入类型
import type { GitLabProject, ProjectRole } from '@/types/gitlab';

interface GitLabContextType {
  projects: GitLabProject[];
  grouped: Record<string, Record<ProjectRole, GitLabProject[]>>;
  loading: boolean;
  error: string | null;
  refreshProjects: () => Promise<void>;
}

const GitLabContext = createContext<GitLabContextType | undefined>(undefined);

export function GitLabProvider({ children }: { children: ReactNode }) {
  const gitlabHookRef = useRef<GitLabContextType | null>(null);

  // 在第一次渲染时初始化 hook
  if (!gitlabHookRef.current) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    gitlabHookRef.current = useGitLabProjects();
  }

  const value = gitlabHookRef.current;

  console.log('🔧 GitLabProvider 初始化:', {
    projects_length: value.projects.length,
    grouped_keys: Object.keys(value.grouped),
  });

  return (
    <GitLabContext.Provider value={value}>
      {children}
    </GitLabContext.Provider>
  );
}

export function useGitLabContext() {
  const context = useContext(GitLabContext);
  if (!context) {
    console.error('❌ useGitLabContext 被调用但不在 GitLabProvider 内！');
    throw new Error('useGitLabContext must be used within GitLabProvider');
  }
  console.log('✅ useGitLabContext 成功获取 Context');
  return context;
}
