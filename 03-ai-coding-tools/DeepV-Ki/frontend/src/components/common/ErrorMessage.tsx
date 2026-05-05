/**
 * ErrorMessage 组件
 * 统一的错误提示显示
 */

import React from 'react';
import { FaExclamationTriangle, FaTimes } from 'react-icons/fa';

interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export default function ErrorMessage({
  message,
  onRetry,
  onDismiss
}: ErrorMessageProps) {
  return (
    <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
      <div className="flex items-start gap-3">
        <FaExclamationTriangle className="flex-shrink-0 text-red-600 dark:text-red-400 mt-0.5" size={20} />

        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-red-800 dark:text-red-300 mb-1">
            出错了
          </h3>
          <p className="text-sm text-red-700 dark:text-red-400">
            {message}
          </p>

          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-3 text-sm font-medium text-red-700 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 underline"
            >
              重试
            </button>
          )}
        </div>

        {onDismiss && (
          <button
            onClick={onDismiss}
            className="flex-shrink-0 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
          >
            <FaTimes size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
