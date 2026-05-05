/**
 * PermissionInfoCard 组件
 * 可折叠的权限说明卡片，显示 Wiki 操作所需的权限级别
 */

'use client';

import React, { useState, useEffect } from 'react';
import { FaChevronDown, FaChevronUp, FaInfoCircle, FaTimes } from 'react-icons/fa';

const STORAGE_KEY = 'permission-info-card-dismissed';

export default function PermissionInfoCard() {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isDismissed, setIsDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

  // 从 localStorage 读取状态
  useEffect(() => {
    setMounted(true);
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (dismissed === 'true') {
      setIsDismissed(true);
    }
  }, []);

  // 永久关闭卡片
  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDismissed(true);
    localStorage.setItem(STORAGE_KEY, 'true');
  };

  // 切换展开/折叠
  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  // 防止 SSR 不匹配
  if (!mounted || isDismissed) {
    return null;
  }

  return (
    <div className="border border-blue-200 dark:border-blue-800/50 rounded-xl overflow-hidden bg-blue-50/50 dark:bg-blue-900/10 transition-all duration-300">
      {/* 卡片头部 - 可点击折叠 */}
      <button
        onClick={toggleExpand}
        className="w-full flex items-center justify-between p-3 sm:p-4 hover:bg-blue-100/50 dark:hover:bg-blue-900/20 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2 sm:gap-3">
          <FaInfoCircle className="text-blue-500 dark:text-blue-400 flex-shrink-0" size={16} />
          <span className="font-medium text-gray-800 dark:text-gray-200 text-sm sm:text-base">
            Wiki 权限说明
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* 永久关闭按钮 */}
          <button
            onClick={handleDismiss}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200/50 dark:hover:bg-gray-700/50 rounded-lg transition-colors"
            title="不再显示"
          >
            <FaTimes size={12} />
          </button>
          {/* 展开/折叠图标 */}
          <span className="text-gray-400 dark:text-gray-500">
            {isExpanded ? <FaChevronUp size={12} /> : <FaChevronDown size={12} />}
          </span>
        </div>
      </button>

      {/* 卡片内容 - 权限表格 */}
      {isExpanded && (
        <div className="px-3 sm:px-4 pb-3 sm:pb-4 border-t border-blue-200/50 dark:border-blue-800/30">
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400">
                  <th className="pb-2 pr-4 font-medium">操作</th>
                  <th className="pb-2 font-medium">所需权限</th>
                </tr>
              </thead>
              <tbody className="text-gray-700 dark:text-gray-300">
                <tr className="border-t border-blue-100 dark:border-blue-800/30">
                  <td className="py-2 pr-4">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-green-500"></span>
                      阅读 Wiki
                    </span>
                  </td>
                  <td className="py-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                      项目成员（Guest 及以上）
                    </span>
                  </td>
                </tr>
                <tr className="border-t border-blue-100 dark:border-blue-800/30">
                  <td className="py-2 pr-4">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                      生成 / 刷新 Wiki
                    </span>
                  </td>
                  <td className="py-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400">
                      Maintainer 或 Owner
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-500">
            💡 加入成员请到 <a href="https://gitlab.example.net" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 underline">gitlab.example.net</a> 分配合适的权限即可。
          </p>
          <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-500">
            💡 本系统使用「默认分支」做分析，请在 GitLab 中设置正确的默认分支（Setting &gt; Repository &gt; Default branch）。
          </p>
          <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-500">
            💡 生成的质量与项目根下的 README.md 完善程度相关。建议使用 deepvcode cli 让 AI 分析项目并生成 README.md，复查完善并提交后，再到本系统生成 Wiki。
          </p>
        </div>
      )}
    </div>
  );
}
