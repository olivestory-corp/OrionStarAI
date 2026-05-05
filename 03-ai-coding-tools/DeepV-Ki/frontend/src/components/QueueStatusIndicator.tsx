/**
 * QueueStatusIndicator 组件
 * 显示全局任务队列状态和用户任务位置
 */

'use client';

import React, { useEffect, useState, useCallback } from 'react';

interface UserTask {
  task_id: string;
  status: string;
  position: number;
}

interface QueueStatus {
  is_busy: boolean;
  processing_count: number;
  queued_count: number;
  user_tasks: UserTask[];
  error?: string;
}

const POLL_INTERVAL = 5000; // 5秒轮询
const CACHE_KEY = 'deepwiki_wiki_statuses';

/**
 * 从 sessionStorage 获取正在生成的任务ID列表
 */
function getGeneratingTaskIds(): string[] {
  if (typeof window === 'undefined') return [];

  try {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (!cached) return [];

    const statuses = JSON.parse(cached);
    const taskIds: string[] = [];

    Object.values(statuses).forEach((status: unknown) => {
      const s = status as { status?: string; current_task_id?: string };
      if (s.status === 'generating' && s.current_task_id) {
        taskIds.push(s.current_task_id);
      }
    });

    return taskIds;
  } catch {
    return [];
  }
}

export default function QueueStatusIndicator() {
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchQueueStatus = useCallback(async () => {
    try {
      const taskIds = getGeneratingTaskIds();
      const queryParam = taskIds.length > 0 ? `?task_ids=${taskIds.join(',')}` : '';

      const response = await fetch(`/api/tasks/queue/status${queryParam}`);
      if (response.ok) {
        const data = await response.json();
        setQueueStatus(data);
      }
    } catch (error) {
      console.error('Failed to fetch queue status:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // 立即获取一次
    fetchQueueStatus();

    // 定时轮询
    const interval = setInterval(fetchQueueStatus, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [fetchQueueStatus]);

  // 不显示的情况：加载中、无数据、队列空闲且用户无任务
  if (loading || !queueStatus) {
    return null;
  }

  const { is_busy, processing_count, queued_count, user_tasks } = queueStatus;

  // 如果队列空闲且用户没有活动任务，不显示
  if (!is_busy && user_tasks.length === 0) {
    return null;
  }

  // 获取用户任务的显示文本
  const getUserTaskText = (): string | null => {
    if (user_tasks.length === 0) return null;

    // 检查是否有正在处理的任务
    const processingTask = user_tasks.find(t => t.status === 'processing');
    if (processingTask) {
      return '生成中';
    }

    // 检查是否有排队的任务
    const queuedTasks = user_tasks.filter(t => t.status === 'queued');
    if (queuedTasks.length > 0) {
      // 找出位置最靠前的任务
      const minPosition = Math.min(...queuedTasks.map(t => t.position));
      if (queuedTasks.length === 1) {
        return `排在第 ${minPosition} 位`;
      }
      return `${queuedTasks.length} 个任务排队中（最前：第 ${minPosition} 位）`;
    }

    return null;
  };

  const userTaskText = getUserTaskText();

  return (
    <div className="max-w-2xl mx-auto mt-3">
      <div className="flex items-center justify-center gap-4 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 rounded-lg px-4 py-2 border border-gray-200 dark:border-gray-800">
        {/* 全局状态 */}
        <div className="flex items-center gap-3">
          <span className="text-gray-400 dark:text-gray-500">服务器状态：</span>

          {is_busy ? (
            <>
              {processing_count > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                  <span className="text-green-600 dark:text-green-400">生成中 ({processing_count})</span>
                </span>
              )}

              {queued_count > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="inline-flex rounded-full h-2 w-2 bg-yellow-500"></span>
                  <span className="text-yellow-600 dark:text-yellow-400">排队 ({queued_count})</span>
                </span>
              )}
            </>
          ) : (
            <span className="flex items-center gap-1.5">
              <span className="inline-flex rounded-full h-2 w-2 bg-gray-400"></span>
              <span>空闲</span>
            </span>
          )}
        </div>

        {/* 分隔线 */}
        {userTaskText && (
          <span className="text-gray-300 dark:text-gray-700">|</span>
        )}

        {/* 用户任务状态 */}
        {userTaskText && (
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400 dark:text-gray-500">您的任务：</span>
            <span className="text-indigo-600 dark:text-indigo-400 font-medium">
              {userTaskText}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
