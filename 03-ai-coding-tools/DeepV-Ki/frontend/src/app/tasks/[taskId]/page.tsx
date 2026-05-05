'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTasks } from '@/hooks/useTasks';
import ProgressBar from '@/components/ProgressBar';
import Link from 'next/link';

/**
 * Task detail page component
 *
 * Displays real-time progress of wiki generation task
 */
export default function TaskDetailPage() {
  const params = useParams();
  const taskId = params.taskId as string;
  const { task, error, cancelTask, isPolling, startPolling } = useTasks();
  const [mounted, setMounted] = useState(false);

  // Add styles for indeterminate progress
  React.useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
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
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Start polling when component mounts
  useEffect(() => {
    setMounted(true);
    if (taskId && !isPolling) {
      startPolling(taskId);
    }
  }, [taskId, isPolling, startPolling]);

  if (!mounted) {
    return null;
  }

  // Loading state
  if (!task && !error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="inline-block">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 bg-blue-600 rounded-full animate-spin"></div>
              <div className="absolute inset-2 bg-gray-50 dark:bg-gray-900 rounded-full"></div>
            </div>
          </div>
          <p className="mt-4 text-lg font-semibold text-gray-700 dark:text-gray-300">
            Loading task details...
          </p>
        </div>
      </div>
    );
  }

  // Error state (no task found)
  if (!task) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
            <div className="text-center">
              <div className="text-6xl mb-4">❌</div>
              <h1 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-2">
                Task Not Found
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Task ID: {taskId}
              </p>
              <p className="text-gray-600 dark:text-gray-400 mb-8">
                {error || 'The task you are looking for does not exist or has expired.'}
              </p>
              <Link
                href="/"
                className="inline-block px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
              >
                Go Back Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Get stage color based on current stage
  const getStageColor = (stage: string): string => {
    const stageColors: Record<string, string> = {
      validation: 'from-blue-400 to-blue-600',
      cloning: 'from-purple-400 to-purple-600',
      extraction: 'from-indigo-400 to-indigo-600',
      embedding: 'from-pink-400 to-pink-600',
      structure: 'from-orange-400 to-orange-600',
      pages: 'from-green-400 to-green-600',
      adapting_diagrams: 'from-teal-400 to-teal-600',
      caching: 'from-cyan-400 to-cyan-600',
      completed: 'from-emerald-400 to-emerald-600',
      loading: 'from-blue-400 to-blue-600',
      preparing: 'from-purple-400 to-purple-600',
      structure_completed: 'from-orange-400 to-orange-600',
      failed: 'from-red-400 to-red-600',
      cancelled: 'from-gray-400 to-gray-600',
    };
    return stageColors[stage] || 'from-gray-400 to-gray-600';
  };

  // Get progress bar color based on status
  const getProgressColor = (): 'blue' | 'green' | 'red' | 'yellow' => {
    switch (task.status) {
      case 'success':
        return 'green';
      case 'failed':
        return 'red';
      case 'cancelled':
        return 'yellow';
      default:
        return 'blue';
    }
  };

  // Get status badge
  const getStatusBadge = (): React.ReactNode => {
    const statusConfig: Record<string, { color: string; text: string; icon: string }> = {
      pending: { color: 'bg-yellow-100 text-yellow-800', text: '⏳ Pending', icon: '⏳' },
      queued: { color: 'bg-blue-100 text-blue-800', text: '📋 Queued', icon: '📋' },
      running: { color: 'bg-green-100 text-green-800', text: '⚙️ Running', icon: '⚙️' },
      success: { color: 'bg-emerald-100 text-emerald-800', text: '✅ Success', icon: '✅' },
      failed: { color: 'bg-red-100 text-red-800', text: '❌ Failed', icon: '❌' },
      cancelled: { color: 'bg-gray-100 text-gray-800', text: '⛔ Cancelled', icon: '⛔' },
      timeout: { color: 'bg-orange-100 text-orange-800', text: '⏱️ Timeout', icon: '⏱️' },
    };

    const config = statusConfig[task.status] || statusConfig.pending;
    return (
      <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${config.color}`}>
        {config.text}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/"
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 mb-4 inline-flex items-center"
          >
            ← Back Home
          </Link>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Wiki Generation Task
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm break-all">
            Task ID: <code className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">{taskId}</code>
          </p>
        </div>

        {/* Status Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Status
              </h2>
              {getStatusBadge()}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <p>
                Created:{' '}
                <time>{new Date(task.created_at).toLocaleString()}</time>
              </p>
              {task.started_at && (
                <p>
                  Started:{' '}
                  <time>{new Date(task.started_at).toLocaleString()}</time>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Progress Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Progress
          </h2>

          {/* Check if we're in an indeterminate stage */}
          {(task.message?.includes('Downloading repository') || task.message?.includes('Extracting documents from repository')) ? (
            <div>
              <div className="w-full bg-gray-200 rounded-full h-3 dark:bg-gray-700 overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full"
                  style={{
                    animation: 'indeterminate 1.5s ease-in-out infinite',
                    width: '30%',
                  }}
                />
              </div>
              <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                {task.message}
              </p>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-500 italic">
                时间可能较长，请耐心等待...
              </p>
            </div>
          ) : (
            <ProgressBar progress={task.progress} color={getProgressColor()} />
          )}

          {/* Current Stage */}
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3 uppercase tracking-wide">
              Current Stage
            </h3>
            <div className={`bg-gradient-to-r ${getStageColor(task.current_stage)} rounded-lg p-4 text-white`}>
              <p className="font-semibold text-lg capitalize">
                {task.current_stage.replace(/_/g, ' ')}
              </p>
              <p className="text-white text-opacity-90 mt-1">{task.message}</p>
            </div>
          </div>

          {/* Pages Progress */}
          {task.pages_total !== undefined && task.pages_total > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3 uppercase tracking-wide">
                Pages Generation
              </h3>
              <div className="space-y-2">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {task.pages_generated} / {task.pages_total} pages generated
                </p>
                <div className="w-full bg-gray-300 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.round((task.pages_generated! / task.pages_total) * 100)}%`,
                    }}
                  ></div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Error Section */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900 dark:bg-opacity-20 border border-red-200 dark:border-red-700 rounded-lg shadow-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-red-800 dark:text-red-400 mb-2">
              Error
            </h3>
            <p className="text-red-700 dark:text-red-300">{error}</p>
            {task.error_code && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                Error Code: {task.error_code}
              </p>
            )}
          </div>
        )}

        {/* Task Status Details */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Task Details
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Repository</p>
              <p className="font-medium text-gray-900 dark:text-white break-all">
                {task.repo_url}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Repository Type</p>
              <p className="font-medium text-gray-900 dark:text-white capitalize">
                {task.repo_type}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">AI Provider</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {task.provider} / {task.model}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Language</p>
              <p className="font-medium text-gray-900 dark:text-white capitalize">
                {task.language}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          {task.status === 'running' && (
            <button
              onClick={cancelTask}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition flex-1 sm:flex-none"
            >
              Cancel Task
            </button>
          )}

          {task.status === 'success' && (
            <div className="text-green-600 dark:text-green-400 font-semibold py-3 px-6 bg-green-50 dark:bg-green-900 dark:bg-opacity-20 rounded-lg">
              ✓ Task completed! Redirecting to wiki...
            </div>
          )}

          {task.status === 'failed' && (
            <>
              <Link
                href="/"
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition flex-1 sm:flex-none text-center"
              >
                New Wiki
              </Link>
            </>
          )}

          {task.status === 'cancelled' && (
            <Link
              href="/"
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition flex-1 sm:flex-none text-center"
            >
              Back to Home
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
