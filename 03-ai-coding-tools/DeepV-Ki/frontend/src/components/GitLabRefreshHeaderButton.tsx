'use client';

import React, { useState } from 'react';
import { FaGitlab, FaSpinner } from 'react-icons/fa';

export default function GitLabRefreshHeaderButton() {
  const [loading, setLoading] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const handleClick = async () => {
    if (loading) return;

    setLoading(true);
    setNotification(null);

    try {
      // 获取用户邮箱
      let userEmail = '';
      try {
        const authResponse = await fetch('/api/auth/sso/user', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        if (authResponse.ok) {
          const authData = await authResponse.json();
          userEmail = authData?.user_info?.uid || '';
        }
      } catch (err) {
        console.debug('Could not get user email:', err);
      }

      // 直接调用 /api/gitlab/projects/grouped 进行同步
      const response = await fetch('/api/gitlab/projects/grouped?email=' + encodeURIComponent(userEmail), {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      console.log('✅ 同步成功! 项目数:', data.total);

      setNotification({
        message: `✅ 成功同步 ${data.total} 个项目！`,
        type: 'success'
      });

      // 刷新 Panel 中的数据
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('gitlabProjectsRefreshed', { detail: { total: data.total } }));
      }, 500);

      // 滚动到项目部分
      setTimeout(() => {
        const element = document.querySelector('[data-gitlab-section]');
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }, 300);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '未知错误';
      console.error('GitLab refresh error:', err);

      setNotification({
        message: `❌ 同步失败: ${errorMessage}`,
        type: 'error'
      });
    } finally {
      setLoading(false);

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
        title="同步 GitLab 项目"
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
          同步我的 GitLab 项目
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
