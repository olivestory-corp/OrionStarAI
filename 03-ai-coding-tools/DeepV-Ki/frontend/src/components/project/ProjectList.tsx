/**
 * ProjectList 组件
 * 项目列表主组件
 */

'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { FaCloudDownloadAlt, FaSearch, FaTimes } from 'react-icons/fa';
import { useProjects } from '@/contexts/ProjectContext';
import { useWiki } from '@/contexts/WikiContext';
import { useAuth } from '@/hooks/useAuth';
import Loading from '@/components/common/Loading';
import ErrorMessage from '@/components/common/ErrorMessage';
import Button from '@/components/common/Button';
import ProjectCard from './ProjectCard';
import PermissionInfoCard from './PermissionInfoCard';
import GitLabSyncTutorialModal from '@/components/GitLabSyncTutorialModal';
import QueueStatusIndicator from '@/components/QueueStatusIndicator';
import type { ProjectRole, GitLabProject } from '@/types/gitlab';

const roleOrder: ProjectRole[] = ['OWNER', 'MAINTAINER', 'DEVELOPER', 'REPORTER', 'GUEST'];

export default function ProjectList() {
  const {
    projects,
    loading: projectsLoading,
    error: projectsError,
    userEmail,
    setUserEmail,
    refreshProjects,
    syncProjects,
    syncStatus,
  } = useProjects();

  const { user } = useAuth();

  const {
    loadWikiStatuses,
    loading: wikiLoading,
    wikiStatuses
  } = useWiki();

  const [searchQuery, setSearchQuery] = useState('');
  const [showTutorialModal, setShowTutorialModal] = useState(false);

  // 获取用户邮箱
  useEffect(() => {
    if (user?.uid) {
      setUserEmail(user.uid);
    }
  }, [user, setUserEmail]);

  // 加载 Wiki 状态（初次加载）
  useEffect(() => {
    if (!projects) return;

    // 收集所有项目的 keys
    const allProjects: GitLabProject[] = [
      ...Object.values(projects.member || {}).flat(),
      ...Object.values(projects.inherited || {}).flat(),
    ];

    const projectKeys = allProjects.map(p => {
      const namespace = p.path_with_namespace.split('/')[0];
      const repoName = p.path;
      return `gitlab:${namespace}/${repoName}`;
    });

    if (projectKeys.length > 0) {
      loadWikiStatuses(projectKeys);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects]); // 只在 projects 变化时执行一次

  // 智能轮询：只轮询状态为 'generating' 的项目
  useEffect(() => {
    if (!projects) return;

    const pollInterval = setInterval(() => {
      // 收集所有项目
      const allProjects: GitLabProject[] = [
        ...Object.values(projects.member || {}).flat(),
        ...Object.values(projects.inherited || {}).flat(),
      ];

      // 筛选出正在生成的项目
      const generatingProjectKeys: string[] = [];

      allProjects.forEach(p => {
        const namespace = p.path_with_namespace.split('/')[0];
        const repoName = p.path;
        const projectKey = `gitlab:${namespace}/${repoName}`;

        const status = wikiStatuses.get(projectKey);
        if (status?.status === 'generating') {
          generatingProjectKeys.push(projectKey);
        }
      });

      // 只有存在正在生成的项目时才轮询
      if (generatingProjectKeys.length > 0) {
        console.log(`🔄 智能轮询: ${generatingProjectKeys.length} 个项目正在生成 Wiki`);
        loadWikiStatuses(generatingProjectKeys);
      }
    }, 5000); // 每 5 秒轮询一次（比之前的3秒更节省资源）

    return () => clearInterval(pollInterval);
  }, [projects, wikiStatuses, loadWikiStatuses]);

  // 打开教程弹窗
  const handleSyncClick = () => {
    setShowTutorialModal(true);
  };

  // 确认同步（从弹窗中点击"开始同步"）
  const handleConfirmSync = async () => {
    setShowTutorialModal(false);
    await syncProjects();
  };

  // 计算过滤后的项目
  const filteredProjects = useMemo(() => {
    if (!projects) return { member: {}, inherited: {}, total: 0, member_count: 0, inherited_count: 0 };

    const filterProjects = (projectList: GitLabProject[]): GitLabProject[] => {
      if (!searchQuery.trim()) return projectList;

      const query = searchQuery.toLowerCase();
      return projectList.filter(project =>
        project.name.toLowerCase().includes(query) ||
        project.path.toLowerCase().includes(query) ||
        project.path_with_namespace.toLowerCase().includes(query) ||
        (project.description && project.description.toLowerCase().includes(query))
      );
    };

    const filtered: typeof projects = {
      member: {},
      inherited: {},
      total: 0,
      member_count: 0,
      inherited_count: 0,
    };

    // 过滤成员项目
    if (projects.member) {
      for (const role of roleOrder) {
        filtered.member![role] = filterProjects(projects.member[role] || []);
      }
    }

    // 过滤继承项目
    if (projects.inherited) {
      for (const role of roleOrder) {
        filtered.inherited![role] = filterProjects(projects.inherited[role] || []);
      }
    }

    // 计算总数
    const allFiltered = [
      ...Object.values(filtered.member || {}).flat(),
      ...Object.values(filtered.inherited || {}).flat(),
    ];
    filtered.total = allFiltered.length;

    return filtered;
  }, [projects, searchQuery]);

  // Group projects by owner (namespace)
  const groupedProjects = useMemo(() => {
    if (!projects) return [];

    // Collect all filtered projects
    const allProjects = [
      ...Object.values(filteredProjects.member || {}).flat(),
      ...Object.values(filteredProjects.inherited || {}).flat(),
    ];

    const groups: Record<string, GitLabProject[]> = {};

    allProjects.forEach(project => {
      // Extract owner from path_with_namespace (e.g., "group/subgroup/project" -> "group")
      const owner = project.path_with_namespace.split('/')[0];

      if (!groups[owner]) {
        groups[owner] = [];
      }
      groups[owner].push(project);
    });

    // Sort owners alphabetically and projects within each owner
    return Object.keys(groups)
      .sort((a, b) => a.localeCompare(b))
      .map(owner => ({
        owner,
        projects: groups[owner].sort((a, b) => a.name.localeCompare(b.name))
      }));
  }, [filteredProjects, projects]);

  // Generate alphabet index
  const alphabetIndex = useMemo(() => {
    const letters = new Set<string>();
    groupedProjects.forEach(({ owner }) => {
      const firstChar = owner.charAt(0).toUpperCase();
      if (/[A-Z]/.test(firstChar)) {
        letters.add(firstChar);
      } else {
        letters.add('#');
      }
    });
    return Array.from(letters).sort((a, b) => {
      if (a === '#') return 1;
      if (b === '#') return -1;
      return a.localeCompare(b);
    });
  }, [groupedProjects]);

  // Scroll to section
  const scrollToLetter = (letter: string) => {
    const targetOwner = groupedProjects.find(({ owner }) => {
      const firstChar = owner.charAt(0).toUpperCase();
      return letter === '#' ? !/[A-Z]/.test(firstChar) : firstChar === letter;
    });

    if (targetOwner) {
      const element = document.getElementById(`owner-group-${targetOwner.owner}`);
      if (element) {
        const headerOffset = 120; // Adjust for header height
        const elementPosition = element.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      }
    }
  };

  // 加载中（优先级最高）
  if (projectsLoading) {
    const message = syncStatus?.message ?? '正在获取用户信息和项目列表...';

    // 根据 stage 显示不同的详细信息
    const getStageDetail = () => {
      switch (syncStatus?.stage) {
        case 'initializing':
          return '初始化中...';
        case 'fetching_user':
          return '正在获取用户信息...';
        case 'fetching_direct_projects':
          return '正在获取您直接参与的项目...';
        case 'fetching_groups':
          return '正在获取您所在的组...';
        case 'fetching_group_projects':
          return '正在获取组内项目...';
        case 'processing':
          return '正在处理数据...';
        case 'saving':
          return '正在保存数据...';
        default:
          return message;
      }
    };

    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-full max-w-md px-6 py-8 text-center space-y-6">
          <Loading size="lg" />

          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              正在从 GitLab 同步您的项目
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {getStageDetail()}
            </p>
          </div>

          {/* 无限循环进度条 */}
          <div className="space-y-3">
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600"
                style={{
                  animation: 'infiniteProgress 2s ease-in-out infinite',
                }}
              />
            </div>
            <style jsx>{`
              @keyframes infiniteProgress {
                0% {
                  width: 0%;
                  opacity: 1;
                }
                50% {
                  width: 100%;
                  opacity: 1;
                }
                100% {
                  width: 100%;
                  opacity: 0;
                  transform: translateX(100%);
                }
              }
            `}</style>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-500">
            首次进行可能会需要一点时间，请耐心等待
          </p>
        </div>
      </div>
    );
  }

  // 错误
  if (projectsError && !projects) {
    return (
      <div className="max-w-2xl mx-auto mt-8">
        <ErrorMessage
          message={projectsError}
          onRetry={refreshProjects}
        />
      </div>
    );
  }

  // 没有项目（只在加载完成后显示）
  if (!projectsLoading && (!projects || projects.total === 0)) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          暂无项目
        </p>
        <Button
          variant="primary"
          icon={<FaCloudDownloadAlt size={14} />}
          onClick={handleSyncClick}
          loading={projectsLoading}
        >
          同步 GitLab
        </Button>
        {/* GitLab 同步教程弹窗 */}
        <GitLabSyncTutorialModal
          isOpen={showTutorialModal}
          onClose={() => setShowTutorialModal(false)}
          onConfirmSync={handleConfirmSync}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 权限说明卡片 */}
      <PermissionInfoCard />

      {/* 搜索框 - Sticky Header */}
      <div className="sticky top-[73px] z-40 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-4 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-800/50 transition-all duration-300">
        <div className="relative group max-w-2xl mx-auto">
          <div className="relative">
            {/* 背景光晕效果 */}
            <div className="absolute inset-0 bg-gradient-to-r from-[var(--accent-primary)]/20 to-[var(--accent-secondary)]/20 rounded-xl blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 pointer-events-none" />

            <div className="relative bg-white dark:bg-gray-900 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-[var(--accent-primary)]/50 dark:hover:border-[var(--accent-primary)]/40 focus-within:border-[var(--accent-primary)] dark:focus-within:border-[var(--accent-primary)] transition-all duration-200 shadow-sm hover:shadow-md focus-within:shadow-lg focus-within:shadow-[var(--accent-primary)]/20">
              <div className="flex items-center gap-3 px-4 py-3.5">
                <FaSearch className="text-[var(--accent-primary)] flex-shrink-0 transition-transform duration-200 group-focus-within:scale-110" size={18} />
                <input
                  type="text"
                  placeholder="搜索项目名、路径或描述..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none text-base"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="text-gray-400 dark:text-gray-500 hover:text-[var(--accent-primary)] dark:hover:text-[var(--accent-primary)] hover:scale-110 transition-all duration-200 flex-shrink-0 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                    title="清除搜索"
                  >
                    <FaTimes size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 队列状态指示器 */}
        <QueueStatusIndicator />
      </div>

      {/* 头部操作栏 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            我的项目
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
            {searchQuery ? `搜索结果: ${filteredProjects.total} 个项目` : `共 ${projects?.total || 0} 个项目`}
            {userEmail && ` (${userEmail})`}
          </p>
        </div>

        <div className="flex gap-3">
          <Button
            variant="primary"
            icon={<FaCloudDownloadAlt size={14} />}
            onClick={handleSyncClick}
            loading={projectsLoading}
          >
            同步 GitLab
          </Button>
        </div>
      </div>

      {/* Wiki 状态加载提示 - 改为不占用空间的提示 */}
      {wikiLoading && (
        <div className="fixed bottom-4 right-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-3 flex items-center gap-3 text-sm text-blue-700 dark:text-blue-300 shadow-lg z-40">
          <Loading size="sm" text="" />
          <span>正在加载 Wiki 状态...</span>
        </div>
      )}

      {/* Projects grouped by Owner */}
      {groupedProjects.length > 0 && (
        <div className="relative">
          <div className="space-y-12">
            {groupedProjects.map(({ owner, projects }) => (
              <div key={owner} id={`owner-group-${owner}`} className="relative scroll-mt-24">
                {/* Owner Header */}
                <div className="flex items-center gap-3 mb-6 pb-2 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {owner}
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
                    {projects.length}
                  </span>
                </div>

                {/* Projects Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {projects.map((project) => (
                    <ProjectCard key={project.id} project={project} />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Alphabet Index Navigation */}
          {alphabetIndex.length > 1 && (
            <div className="fixed right-4 top-1/2 -translate-y-1/2 z-50 hidden xl:flex flex-col gap-1 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm p-2 rounded-full shadow-lg border border-gray-200 dark:border-gray-700">
              {alphabetIndex.map((letter) => (
                <button
                  key={letter}
                  onClick={() => scrollToLetter(letter)}
                  className="w-6 h-6 flex items-center justify-center text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-white hover:bg-[var(--accent-primary)] rounded-full transition-all duration-200"
                  title={`Scroll to ${letter}`}
                >
                  {letter}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 搜索无结果 */}
      {searchQuery && filteredProjects.total === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            没有找到匹配的项目
          </p>
          <button
            onClick={() => setSearchQuery('')}
            className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors cursor-pointer"
          >
            清除搜索条件
          </button>
        </div>
      )}

      {/* GitLab 同步教程弹窗 */}
      <GitLabSyncTutorialModal
        isOpen={showTutorialModal}
        onClose={() => setShowTutorialModal(false)}
        onConfirmSync={handleConfirmSync}
      />
    </div>
  );
}