'use client';

import React from 'react';

interface ProgressBarProps {
  progress: number; // 0-100
  className?: string;
  showLabel?: boolean;
  animated?: boolean;
  color?: 'blue' | 'green' | 'red' | 'yellow';
}

/**
 * Animated progress bar component
 *
 * Displays a visual progress bar with percentage label
 */
export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  className = '',
  showLabel = true,
  animated = true,
  color = 'blue',
}) => {
  // Clamp progress between 0 and 100
  const normalizedProgress = Math.min(Math.max(progress, 0), 100);

  const colorClasses = {
    blue: 'bg-blue-600',
    green: 'bg-green-600',
    red: 'bg-red-600',
    yellow: 'bg-yellow-600',
  };

  const bgColorClass = colorClasses[color];

  return (
    <div className={`w-full ${className}`}>
      {/* Progress bar container */}
      <div className="relative w-full bg-gray-200 rounded-full h-3 dark:bg-gray-700 overflow-hidden">
        {/* Progress fill */}
        <div
          className={`h-full ${bgColorClass} transition-all duration-300 ease-out ${
            animated ? 'animate-pulse' : ''
          }`}
          style={{
            width: `${normalizedProgress}%`,
          }}
        >
          {/* Shine effect for animation */}
          {animated && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-20 animate-shimmer" />
          )}
        </div>
      </div>

      {/* Progress label */}
      {showLabel && (
        <div className="mt-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          Progress: {normalizedProgress}%
        </div>
      )}
    </div>
  );
};

export default ProgressBar;
