/**
 * Wiki 类型选择 Modal
 *
 * 用户选择生成全面型或简洁型 Wiki
 * 参考"刷新 Wiki"弹窗样式
 */

'use client';

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FaBook, FaBolt, FaTimes } from 'react-icons/fa';

interface WikiTypeSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (isComprehensive: boolean, forceRefresh: boolean) => void;
  projectName: string;
  isRefresh?: boolean;  // 是否是重新生成（已生成过的 Wiki）
}

export default function WikiTypeSelectionModal({
  isOpen,
  onClose,
  onSelect,
  projectName,
  isRefresh = false
}: WikiTypeSelectionModalProps) {
  const [mounted, setMounted] = React.useState(false);
  const [forceRefresh, setForceRefresh] = React.useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      // 禁止背景滚动
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  const handleSelect = (isComprehensive: boolean) => {
    onSelect(isComprehensive, forceRefresh);
    onClose();
  };

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="bg-[var(--background)] rounded-2xl shadow-2xl max-w-2xl w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-primary-dark)] px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FaBook className="text-2xl" />
            选择 Wiki 类型
          </h2>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 transition-colors p-1 rounded-full hover:bg-white/20 cursor-pointer"
          >
            <FaTimes size={20} />
          </button>
        </div>

        {/* Project Name */}
        <div className="px-6 py-3 bg-[var(--ios-background-secondary)] border-b border-[var(--border-color)]">
          <p className="text-sm text-[var(--muted)]">
            项目: <span className="font-semibold text-[var(--foreground)]">{projectName}</span>
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-[var(--foreground)] text-center mb-6">
            请选择要生成的 Wiki 类型：
          </p>

          {/* Option Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 全面型 */}
            <button
              onClick={() => handleSelect(true)}
              className="group relative p-6 border-2 border-[var(--accent-primary)]/30 rounded-xl hover:border-[var(--accent-primary)]/60 hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-[var(--accent-primary)]/5 to-[var(--accent-primary-light)]/5 cursor-pointer"
            >
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="w-16 h-16 bg-[var(--accent-primary)] rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                  <FaBook className="text-white text-2xl" />
                </div>

                <h3 className="text-lg font-bold text-[var(--foreground)]">
                  全面型 Wiki
                </h3>

                <p className="text-sm text-[var(--muted)]">
                  深入详细的文档
                </p>

                <ul className="text-xs text-[var(--foreground)] space-y-1 text-left w-full opacity-85">
                  <li className="flex items-start gap-2">
                    <span className="text-[var(--accent-primary)] mt-0.5">✓</span>
                    <span>8-12 个详细页面</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[var(--accent-primary)] mt-0.5">✓</span>
                    <span>多级分区结构</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[var(--accent-primary)] mt-0.5">✓</span>
                    <span>丰富的图表和示例</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[var(--accent-primary)] mt-0.5">✓</span>
                    <span>完整的架构说明</span>
                  </li>
                </ul>

                <div className="mt-4 px-4 py-2 bg-[var(--accent-primary)] text-white rounded-lg font-medium hover:bg-[var(--accent-primary-dark)] transition-colors cursor-pointer">
                  选择全面型
                </div>
              </div>

              {/* Badge */}
              <div className="absolute top-2 right-2 bg-[var(--accent-primary)] text-white text-xs px-2 py-1 rounded-full">
                推荐
              </div>
            </button>

            {/* 简洁型 */}
            <button
              onClick={() => handleSelect(false)}
              className="group relative p-6 border-2 border-[var(--accent-secondary)]/30 rounded-xl hover:border-[var(--accent-secondary)]/60 hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-[var(--accent-secondary)]/5 to-[var(--accent-tertiary)]/5 cursor-pointer"
            >
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="w-16 h-16 bg-[var(--accent-secondary)] rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                  <FaBolt className="text-white text-2xl" />
                </div>

                <h3 className="text-lg font-bold text-[var(--foreground)]">
                  简洁型 Wiki
                </h3>

                <p className="text-sm text-[var(--muted)]">
                  快速上手文档
                </p>

                <ul className="text-xs text-[var(--foreground)] space-y-1 text-left w-full opacity-85">
                  <li className="flex items-start gap-2">
                    <span className="text-[var(--accent-secondary)] mt-0.5">✓</span>
                    <span>4-6 个核心页面</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[var(--accent-secondary)] mt-0.5">✓</span>
                    <span>扁平化结构</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[var(--accent-secondary)] mt-0.5">✓</span>
                    <span>关键信息快速查阅</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[var(--accent-secondary)] mt-0.5">✓</span>
                    <span>适合小型项目</span>
                  </li>
                </ul>

                <div className="mt-4 px-4 py-2 bg-[var(--accent-secondary)] text-white rounded-lg font-medium hover:bg-[var(--accent-secondary)] transition-colors cursor-pointer opacity-90 hover:opacity-100">
                  选择简洁型
                </div>
              </div>

              {/* Badge */}
              <div className="absolute top-2 right-2 bg-[var(--accent-secondary)] text-white text-xs px-2 py-1 rounded-full">
                快速
              </div>
            </button>
          </div>

          {/* Force Refresh Option - Only shown for refresh operations */}
          {isRefresh && (
            <div className="mt-6 p-4 bg-[var(--info)]/10 border border-[var(--info)]/30 rounded-lg">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={forceRefresh}
                  onChange={(e) => setForceRefresh(e.target.checked)}
                  className="w-4 h-4 accent-[var(--accent-primary)] bg-[var(--background)] border-[var(--border-color)] rounded cursor-pointer"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-[var(--info)]">
                    刷新源代码
                  </p>
                  <p className="text-xs text-[var(--muted)] mt-1">
                    删除缓存的代码并重新从仓库下载最新版本。如果代码已更新，请勾选此选项以获取最新内容。
                  </p>
                </div>
              </label>
            </div>
          )}

          {/* Info Note */}
          <div className="mt-6 p-4 bg-[var(--warning)]/10 border border-[var(--warning)]/30 rounded-lg">
            <p className="text-sm text-[var(--warning)]">
              <strong>提示：</strong>
              {isRefresh ? '重新生成 Wiki 时，默认使用缓存代码以加快速度。' : '每个项目每天只能成功生成一次 Wiki。'}
              {isRefresh ? '如果代码已更新，请勾选"刷新源代码"。' : '如果生成失败，可以重新尝试。'}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[var(--ios-background-secondary)] border-t border-[var(--border-color)] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[var(--foreground)] hover:text-[var(--accent-primary)] transition-colors cursor-pointer"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
