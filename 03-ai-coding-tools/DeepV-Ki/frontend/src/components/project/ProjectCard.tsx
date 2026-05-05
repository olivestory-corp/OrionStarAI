/**
 * ProjectCard 组件
 * 单个项目卡片
 */

'use client';

import React from 'react';
import { FaGitlab, FaLock, FaGlobe, FaShieldAlt } from 'react-icons/fa';
import { useWiki } from '@/contexts/WikiContext';
import ProjectWikiStatus from './ProjectWikiStatus';
import ProjectWikiActions from './ProjectWikiActions';
import type { GitLabProject, ProjectRole } from '@/types/gitlab';

interface ProjectCardProps {
  project: GitLabProject;
  onClick?: (project: GitLabProject) => void;
}

const roleColors: Record<ProjectRole, string> = {
  OWNER: 'border border-gray-900 dark:border-gray-100 text-gray-900 dark:text-gray-100 bg-transparent hover:bg-gray-50 dark:hover:bg-gray-900',
  MAINTAINER: 'border border-gray-700 dark:border-gray-400 text-gray-700 dark:text-gray-400 bg-transparent hover:bg-gray-50 dark:hover:bg-gray-900',
  DEVELOPER: 'border border-gray-500 dark:border-gray-500 text-gray-600 dark:text-gray-400 bg-transparent hover:bg-gray-50 dark:hover:bg-gray-900',
  REPORTER: 'border border-gray-400 dark:border-gray-600 text-gray-500 dark:text-gray-500 bg-transparent hover:bg-gray-50 dark:hover:bg-gray-900',
  GUEST: 'border border-gray-300 dark:border-gray-700 text-gray-400 dark:text-gray-600 bg-transparent hover:bg-gray-50 dark:hover:bg-gray-900',
};

const visibilityIcons = {
  public: { icon: FaGlobe, label: 'Public', color: 'text-gray-600 dark:text-gray-400' },
  internal: { icon: FaShieldAlt, label: 'Internal', color: 'text-gray-600 dark:text-gray-400' },
  private: { icon: FaLock, label: 'Private', color: 'text-gray-600 dark:text-gray-400' },
};

export default function ProjectCard({ project, onClick }: ProjectCardProps) {
  const { getWikiStatus } = useWiki();

  const visibilityConfig = visibilityIcons[project.visibility] || visibilityIcons.private;
  const VisibilityIcon = visibilityConfig.icon;

  // 获取 Wiki 状态
  const namespace = project.path_with_namespace.split('/')[0];
  const repoName = project.path;
  const projectKey = `gitlab:${namespace}/${repoName}`;
  const wikiStatus = getWikiStatus(projectKey);

  const handleClick = () => {
    if (onClick) {
      onClick(project);
    }
  };

  return (
    <div
      onClick={handleClick}
      className="
        relative rounded-lg border border-gray-200 dark:border-gray-700
        bg-white dark:bg-gray-900
        hover:border-gray-300 dark:hover:border-gray-600
        hover:shadow-md dark:hover:shadow-lg dark:hover:shadow-blue-500/5
        transition-all duration-200 cursor-default
        overflow-hidden
      "
    >
      {/* 角色标签 */}
      <div className="absolute top-2 right-2 z-10">
        <span className={`
          inline-flex px-2 py-0.5 rounded text-xs font-medium
          transition-colors ${roleColors[project.role]}
        `}>
          {project.role}
        </span>
      </div>

      {/* 继承标签 */}
      {project.member_type === 'inherited' && (
        <div className="absolute top-2 left-2 z-10">
          <span className="px-2 py-0.5 rounded text-xs font-medium border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 bg-transparent hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
            Inherited
          </span>
        </div>
      )}

      {/* 内容 */}
      <div className="p-4 pt-10">
        {/* 项目名称 */}
        <div className="flex items-start gap-2 mb-2">
          <FaGitlab className="flex-shrink-0 mt-0.5 text-orange-600 dark:text-orange-400" size={18} />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base text-gray-900 dark:text-gray-100 truncate">
              {project.name}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-500 truncate">
              {project.path_with_namespace}
            </p>
          </div>
        </div>

        {/* 描述 */}
        {project.description && (
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
            {project.description}
          </p>
        )}

        {/* 可见性 */}
        <div className="flex items-center gap-2 mb-3">
          <VisibilityIcon className={visibilityConfig.color} size={12} />
          <span className="text-xs text-gray-500 dark:text-gray-500">
            {visibilityConfig.label}
          </span>
        </div>

        {/* Wiki 状态 */}
        <div className="mb-3">
          <ProjectWikiStatus status={wikiStatus} />
        </div>

        {/* Wiki 操作按钮 */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
          <span className="text-xs text-gray-400 dark:text-gray-500">
            ID: {project.id}
          </span>

          <ProjectWikiActions project={project} wikiStatus={wikiStatus} />
        </div>
      </div>
    </div>
  );
}
