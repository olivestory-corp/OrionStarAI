/**
 * GitLab Refresh Button Component
 * 放在 header 中的快捷按钮，用于刷新 GitLab 项目列表
 */

'use client';

import React, { useState } from 'react';
import { FaGitlab, FaSpinner } from 'react-icons/fa';
import { useGitLabContext } from '@/contexts/GitLabContext';

export default function GitLabRefreshButton() {
  const { loading: contextLoading, refreshProjects, projects } = useGitLabContext();
  const [showTooltip, setShowTooltip] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [localLoading, setLocalLoading] = useState(false);

  const loading = contextLoading || localLoading;

  const handleClick = async () => {
    if (loading) return;

    setLocalLoading(true);
    setNotification(null);

    try {
      // 调用 context 中的 refreshProjects
      await refreshProjects();

      // 显示成功提示，包含项目总数
      const total = projects.length;
      setNotification({
        message: total > 0 ? `✅ 成功获取 ${total} 个 GitLab 项目！` : `✅ 项目列表已更新！`,
        type: 'success'
      });

      console.log(`📊 GitLab projects refreshed`);

      // 刷新成功后滚动到项目部分
      setTimeout(() => {
        const element = document.querySelector('[data-gitlab-section]');
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }, 300);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '未知错误';
      console.error('GitLab refresh error:', err);

      // 显示错误提示
      setNotification({
        message: `❌ 获取项目失败: ${errorMessage}`,
        type: 'error'
      });
    } finally {
      setLocalLoading(false);

      // 3 秒后自动隐藏通知
      setTimeout(() => {
        setNotification(null);
      }, 3000);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        disabled={loading}
        title="刷新 GitLab 项目"
        className={`
          inline-flex items-center justify-center
          p-2 rounded-lg transition-all duration-200
          ${loading
            ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 cursor-not-allowed'
            : 'bg-transparent hover:bg-orange-100 dark:hover:bg-orange-900/30 text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300'
          }
        `}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {loading ? (
          <FaSpinner className="text-xl animate-spin" />
        ) : (
          <FaGitlab className="text-xl" />
        )}
      </button>

      {/* Tooltip */}
      {showTooltip && !loading && (
        <div className="absolute right-0 top-full mt-2 px-3 py-1 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs rounded whitespace-nowrap z-50 pointer-events-none">
          刷新我的 GitLab 项目
          <div className="absolute bottom-full right-2 w-0 h-0 border-l-4 border-r-4 border-b-4 border-l-transparent border-r-transparent border-b-gray-900 dark:border-b-gray-100"></div>
        </div>
      )}

      {/* Notification Popup */}
      {notification && (
        <div className={`
          fixed top-4 right-4 px-4 py-3 rounded-lg shadow-lg z-50
          animate-in fade-in slide-in-from-top-2 duration-300
          ${notification.type === 'success'
            ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border border-green-300 dark:border-green-700'
            : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border border-red-300 dark:border-red-700'
          }
        `}>
          <div className="flex items-center gap-2">
            <span className="text-lg">{notification.type === 'success' ? '✅' : '❌'}</span>
            <span className="font-medium">{notification.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
