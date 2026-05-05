'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { parseProgressMessage, calculateSmartProgress } from '@/lib/progress-parser';

/**
 * Wiki task status
 */
export type TaskStatus =
  | 'pending'
  | 'queued'
  | 'running'
  | 'success'
  | 'failed'
  | 'cancelled'
  | 'timeout';

/**
 * Wiki task information
 */
export interface WikiTask {
  task_id: string;
  status: TaskStatus;
  progress: number; // 0-100
  current_stage: string;
  message: string;
  pages_generated?: number;
  pages_total?: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  error?: string;
  error_code?: string;
  timestamp?: string;
  // Request parameters
  repo_url?: string;
  repo_type?: string;
  provider?: string;
  model?: string;
  language?: string;
  comprehensive?: boolean;
  result?: {
    owner: string;
    repo: string;
    wiki_url?: string;
  };
}

/**
 * Wiki generation request
 */
export interface WikiGenerationRequest {
  repo_url: string;
  repo_type: 'github' | 'gitlab' | 'bitbucket' | 'gerrit';
  token?: string;
  provider: string;
  model: string;
  language: string;
  comprehensive: boolean;
  excluded_dirs?: string[];
  excluded_files?: string[];
  included_dirs?: string[];
  included_files?: string[];
}

/**
 * useTasks Hook
 *
 * Manages wiki generation task lifecycle:
 * - Create tasks
 * - Poll task status
 * - Cancel tasks
 * - Handle auto-redirect on completion
 */
export const useTasks = (initialTaskId?: string) => {
  const router = useRouter();
  const [task, setTask] = useState<WikiTask | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const lastProgressRef = useRef<number>(0);

  /**
   * Create a new wiki generation task
   */
  const createTask = useCallback(
    async (request: WikiGenerationRequest) => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/tasks/wiki/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(
            data.detail || 'Failed to create wiki generation task'
          );
        }

        const data = await response.json();

        // Set initial task state
        setTask({
          task_id: data.task_id,
          status: 'pending',
          progress: 0,
          current_stage: 'validation',
          message: 'Task created, waiting to be processed...',
          created_at: data.created_at,
          result: undefined,
        });

        // Auto-navigate to task detail page
        router.push(`/tasks/${data.task_id}`);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to create task';
        setError(errorMsg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [router]
  );

  /**
   * Poll task status from server
   */
  const pollTaskStatus = useCallback(async (taskId: string) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}/status`);

      if (!response.ok) {
        throw new Error('Failed to fetch task status');
      }

      const data: WikiTask = await response.json();

      // Parse progress from message and calculate smart progress
      const parsedProgress = parseProgressMessage(data.message);
      const smartProgress = calculateSmartProgress(
        data.progress,
        data.message,
        lastProgressRef.current
      );

      // Update progress tracking
      lastProgressRef.current = smartProgress;

      // Enrich task with parsed page progress
      const enrichedTask: WikiTask = {
        ...data,
        progress: smartProgress,
        pages_generated: parsedProgress.currentPage,
        pages_total: parsedProgress.totalPages,
      };

      setTask(enrichedTask);
      setError(null);

      // Auto-redirect when task completes
      if (enrichedTask.status === 'success' && enrichedTask.result) {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          setIsPolling(false);
        }

        // Show success message for 2 seconds before redirect
        setTimeout(() => {
          const redirectUrl = enrichedTask.result?.wiki_url || `/${enrichedTask.result?.owner}/${enrichedTask.result?.repo}`;
          router.push(redirectUrl);
        }, 2000);
      } else if (enrichedTask.status === 'failed' || enrichedTask.status === 'cancelled') {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          setIsPolling(false);
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch task status';
      setError(errorMsg);
    }
  }, [router]);

  /**
   * Start polling task status
   */
  const startPolling = useCallback(
    (taskId: string) => {
      if (!taskId || isPolling) return;

      setIsPolling(true);

      // Fetch status immediately
      pollTaskStatus(taskId);

      // Set up interval for subsequent polls (3 seconds)
      pollIntervalRef.current = setInterval(() => {
        pollTaskStatus(taskId);
      }, 3000);
    },
    [isPolling, pollTaskStatus]
  );

  /**
   * Stop polling
   */
  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
      setIsPolling(false);
    }
  }, []);

  /**
   * Auto-start polling if task ID provided
   */
  useEffect(() => {
    if (initialTaskId && !isPolling) {
      startPolling(initialTaskId);
    }

    return () => {
      stopPolling();
    };
  }, [initialTaskId, isPolling, startPolling, stopPolling]);

  /**
   * Cancel a task
   */
  const cancelTask = useCallback(async () => {
    if (!task) return;

    try {
      const response = await fetch(`/api/tasks/${task.task_id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to cancel task');
      }

      setTask({
        ...task,
        status: 'cancelled',
      });

      stopPolling();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to cancel task';
      setError(errorMsg);
    }
  }, [task, stopPolling]);

  /**
   * Retry a failed task
   *
   * Creates a new task with the same parameters as the failed one
   */
  const retryTask = useCallback(async () => {
    if (!task) return;

    setError(null);

    // Build retry request from previous task
    const retryRequest: WikiGenerationRequest = {
      repo_url: task.result?.wiki_url || '', // This might not have the original URL
      repo_type: 'github', // TODO: Store original repo_type in task
      provider: task.result?.owner || 'google', // TODO: Store original provider
      model: task.result?.repo || 'gemini-2.5-flash', // TODO: Store original model
      language: 'english', // TODO: Store original language
      comprehensive: true, // TODO: Store original comprehensive flag
    };

    try {
      await createTask(retryRequest);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to retry task';
      setError(errorMsg);
    }
  }, [task, createTask]);

  return {
    task,
    loading,
    error,
    createTask,
    cancelTask,
    retryTask,
    isPolling,
    startPolling,
    stopPolling,
  };
};
