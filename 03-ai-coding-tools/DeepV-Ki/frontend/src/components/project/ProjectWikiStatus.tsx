/**
 * ProjectWikiStatus 组件
 * 显示项目的 Wiki 状态
 */

'use client';

import React from 'react';
import { FaCheckCircle, FaSpinner, FaExclamationCircle, FaCircle } from 'react-icons/fa';
import type { IconType } from 'react-icons';
import type { WikiProjectStatus } from '@/types/gitlab';


interface ProjectWikiStatusProps {
  status: WikiProjectStatus | null;
  showProgress?: boolean;
}

interface StatusConfig {
  icon: IconType;
  text: string;
  color: string;
  bgColor: string;
  animate?: string;
}

const statusConfig: Record<string, StatusConfig> = {
  not_generated: {
    icon: FaCircle,
    text: '未生成',
    color: 'text-gray-500 dark:text-gray-400',
    bgColor: 'bg-gray-50 dark:bg-gray-900',
  },
  generating: {
    icon: FaSpinner,
    text: 'AI分析中',
    color: 'text-gray-700 dark:text-gray-300',
    bgColor: 'bg-gray-100 dark:bg-gray-800',
    animate: 'animate-spin',
  },
  generated: {
    icon: FaCheckCircle,
    text: '已生成',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/20',
  },
  failed: {
    icon: FaExclamationCircle,
    text: '生成失败',
    color: 'text-gray-700 dark:text-gray-300',
    bgColor: 'bg-gray-50 dark:bg-gray-900',
  },
};

/**
 * 检查是否为无限进度阶段（时长不确定的操作）
 *
 * 某些操作的时长难以预测，应显示无限循环的加载动画：
 * - 下载仓库 (Downloading repository)
 * - 提取文档 (Extracting documents from repository)
 */
function isIndeterminateProgress(message: string | undefined): boolean {
  if (!message) return false;
  return (
    message.includes('Downloading repository') ||
    message.includes('Extracting documents from repository')
  );
}

/**
 * 计算实际的进度条百分比
 *
 * 完全基于后端返回的 message 关键词和页码计算，不依赖 progress 字段
 *
 * 进度分配：
 * - 0-10%: 初始化和代码分析阶段
 * - 10%: 生成向量嵌入（Generating embeddings for xx documents）
 * - 20%: 生成 Wiki 结构（Generating wiki structure）
 * - 20-95%: 页面生成阶段（Generating page x/y），均匀分配 75% 的空间
 * - 95-100%: 后处理阶段
 *
 * 示例（10个页面）：
 * - Generating page 1/10: 20 + (1/10)*75 = 27.5% ≈ 28%
 * - Generating page 5/10: 20 + (5/10)*75 = 57.5% ≈ 58%
 * - Generating page 10/10: 20 + (10/10)*75 = 95%
 */
function calculateProgress(status: WikiProjectStatus | null | undefined): number {
  if (!status || !status.message) return 0;

  const message = status.message;

  // 检查关键词，依次判断处于哪个阶段
  if (message.includes('Generating embeddings for') || message.includes('generating embeddings for')) {
    return 10;
  }

  if (message.includes('Generating wiki structure') || message.includes('generating wiki structure')) {
    return 20;
  }

  // 页面生成阶段：提取 "Generating page X/Y" 中的页码
  const pageMatch = message.match(/[Gg]enerating page\s+(\d+)\s*\/\s*(\d+)/);
  if (pageMatch) {
    const currentPage = parseInt(pageMatch[1], 10);
    const totalPages = parseInt(pageMatch[2], 10);

    if (!isNaN(currentPage) && !isNaN(totalPages) && totalPages > 0) {
      // 页面生成阶段占用 20-95% 的范围，共 75%
      // 均匀分配给每个页面
      const pageProgress = (currentPage / totalPages) * 75;
      const calculatedProgress = 20 + pageProgress;
      return Math.min(Math.round(calculatedProgress), 95);
    }
  }

  // 默认进度为 0%
  return 0;
}

export default function ProjectWikiStatus({
  status,
  showProgress = true
}: ProjectWikiStatusProps) {
  const statusType = status?.status || 'not_generated';
  const config = statusConfig[statusType as keyof typeof statusConfig];
  const Icon = config.icon;
  const progressValue = calculateProgress(status);

  // 检查是否是排队状态
  const isQueuedStatus = status?.message?.includes('Task created and queued');

  // 使用 Ref 和 State 结合的方式，保持倒计时不被中断
  const [displayedSeconds, setDisplayedSeconds] = React.useState<number | null>(null);
  const countdownTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const lastMessageRef = React.useRef<string | null>(null);
  const baselineTimeRef = React.useRef<{ seconds: number; timestamp: number } | null>(null);

  // 计算初始的剩余时间（秒数）
  const calculateRemainingSeconds = React.useCallback((message: string | undefined): number | null => {
    if (!message) {
      return null;
    }

    // 从 message 中提取页码，与进度条计算逻辑保持一致
    const pageMatch = message.match(/[Gg]enerating page\s+(\d+)\s*\/\s*(\d+)/);
    if (!pageMatch) {
      return null;
    }

    const currentPage = parseInt(pageMatch[1], 10);
    const totalPages = parseInt(pageMatch[2], 10);

    if (isNaN(currentPage) || isNaN(totalPages) || totalPages <= 0) {
      return null;
    }

    // 剩余页数 = 总页数 - 当前页数
    const remainingPages = totalPages - currentPage;

    // 计算剩余时间：最后一页单独算 50 秒，其他页面 35 秒
    let remainingSeconds = 0;
    if (remainingPages > 1) {
      // 多页：前面的页面用 35 秒，最后一页用 50 秒
      remainingSeconds = (remainingPages - 1) * 35 + 50;
    } else {
      // 剩余1页（9/10）或0页（10/10，正在生成最后一页），都按 50 秒算
      remainingSeconds = 50;
    }

    return remainingSeconds > 0 ? remainingSeconds : null;
  }, []);

  // 当消息变化时，重置计时器
  React.useEffect(() => {
    if (statusType !== 'generating' || isQueuedStatus) {
      setDisplayedSeconds(null);
      lastMessageRef.current = null;
      baselineTimeRef.current = null;
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
      return;
    }

    // 如果消息改变（页码更新），重新计算初始时间
    if (status?.message !== lastMessageRef.current) {
      const newSeconds = calculateRemainingSeconds(status?.message);
      if (newSeconds !== null) {
        setDisplayedSeconds(newSeconds);
        // 记录基准时间，用于精确倒计时
        baselineTimeRef.current = {
          seconds: newSeconds,
          timestamp: Date.now(),
        };
        lastMessageRef.current = status?.message || null;

        // 清除旧的计时器
        if (countdownTimerRef.current) {
          clearInterval(countdownTimerRef.current);
        }

        // 启动新的倒计时
        countdownTimerRef.current = setInterval(() => {
          if (baselineTimeRef.current) {
            const elapsed = Math.floor((Date.now() - baselineTimeRef.current.timestamp) / 1000);
            const remaining = baselineTimeRef.current.seconds - elapsed;

            if (remaining > 0) {
              setDisplayedSeconds(remaining);
            } else {
              setDisplayedSeconds(null);
              if (countdownTimerRef.current) {
                clearInterval(countdownTimerRef.current);
                countdownTimerRef.current = null;
              }
            }
          }
        }, 100); // 100ms 更新一次，确保平滑
      } else {
        setDisplayedSeconds(null);
        lastMessageRef.current = status?.message || null;
      }
    }
  }, [status?.message, statusType, isQueuedStatus, calculateRemainingSeconds]);

  // 清理计时器
  React.useEffect(() => {
    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    };
  }, []);

  // 格式化时间显示
  const estimatedRemaining = React.useMemo(() => {
    if (displayedSeconds === null || displayedSeconds <= 0) {
      return null;
    }

    if (displayedSeconds < 60) {
      return `约 ${displayedSeconds} 秒`;
    } else {
      const minutes = Math.floor(displayedSeconds / 60);
      const seconds = displayedSeconds % 60;
      if (seconds === 0) {
        return `约 ${minutes} 分钟`;
      } else {
        return `约 ${minutes} 分 ${seconds} 秒`;
      }
    }
  }, [displayedSeconds]);

  return (
    <div className={`rounded-lg px-3 py-2 ${config.bgColor}`}>
      <div className="flex items-center gap-2">
        <Icon
          className={`${config.color} ${config.animate || ''}`}
          size={14}
        />
        <span className={`text-sm font-medium ${config.color}`}>
          {isQueuedStatus ? '排队中' : config.text}
        </span>
      </div>

      {/* AI分析中显示进度条和进度说明 */}
      {statusType === 'generating' && showProgress && (
        <div className="mt-2">
          {isIndeterminateProgress(status?.message) ? (
            // 无限进度条（用于时长不确定的操作）
            <div>
              <div className="w-full bg-gray-200/50 dark:bg-gray-700/50 rounded-full h-2.5 overflow-hidden relative shadow-sm">
                {/* 无限循环的加载动画 */}
                <div
                  className="h-2.5 rounded-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-600 dark:from-emerald-400 dark:via-emerald-500 dark:to-emerald-600 shadow-lg shadow-emerald-500/30"
                  style={{
                    animation: 'indeterminate 1.5s ease-in-out infinite',
                    width: '30%',
                  }}
                />
              </div>

              {/* 说明文字 */}
              <div className="mt-2 space-y-0.5">
                <p className="text-xs text-gray-500 dark:text-gray-500">
                  {isQueuedStatus ? '任务已创建，等待处理' : status?.message || 'AI分析中...'}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 italic">
                  {isQueuedStatus ? '请稍候...' : '时间可能较长，请耐心等待...'}
                </p>
              </div>
            </div>
          ) : (
            // 标准进度条（用于时长可预估的操作）
            <div>
              <div className="w-full bg-gray-200/50 dark:bg-gray-700/50 rounded-full h-2.5 overflow-hidden relative shadow-sm">
                {/* 进度条背景层 */}
                <div
                  className="h-2.5 rounded-full transition-all duration-500 ease-out bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-600 dark:from-emerald-400 dark:via-emerald-500 dark:to-emerald-600 shadow-lg shadow-emerald-500/30"
                  style={{ width: `${progressValue}%` }}
                />

                {/* 高光动画层 - 不断扫过的效果 */}
                {progressValue > 0 && (
                  <div
                    className="absolute top-0 left-0 h-full w-full bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-pulse"
                    style={{
                      animation: 'slideShine 2s infinite',
                      width: '100%',
                    }}
                  />
                )}
              </div>

              {/* 进度百分比和说明文字 */}
              <div className="mt-2 space-y-0.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    {progressValue}%
                  </p>
                  {estimatedRemaining && (
                    <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      {estimatedRemaining}
                    </p>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-500">
                  {status?.message || 'AI分析中...'}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 已生成显示页面数 */}
      {statusType === 'generated' && status?.pages_count && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
          {status.pages_count} pages
        </p>
      )}

      {/* 动画样式注入 */}
      <style jsx>{`
        @keyframes slideShine {
          0% {
            transform: translateX(-100%);
          }
          50% {
            transform: translateX(100%);
          }
          100% {
            transform: translateX(-100%);
          }
        }

        @keyframes indeterminate {
          0% {
            transform: translateX(-100%);
          }
          50% {
            transform: translateX(100%);
          }
          100% {
            transform: translateX(-100%);
          }
        }
      `}</style>
    </div>
  );
}
