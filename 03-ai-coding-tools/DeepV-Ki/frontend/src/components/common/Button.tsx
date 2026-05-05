/**
 * Button 组件
 * 统一的按钮样式
 */

import React from 'react';
import { FaSpinner } from 'react-icons/fa';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

const variantClasses = {
  primary: 'bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white dark:text-white border-transparent shadow-sm hover:shadow-md hover:scale-105 active:scale-95',
  secondary: 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100 border-transparent shadow-sm hover:shadow-md hover:scale-105 active:scale-95',
  success: 'bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white dark:text-white border-transparent shadow-sm hover:shadow-md hover:scale-105 active:scale-95',
  danger: 'bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700 text-white dark:text-white border-transparent shadow-sm hover:shadow-md hover:scale-105 active:scale-95',
  ghost: 'bg-transparent border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 hover:border-gray-400 dark:hover:border-gray-500 hover:shadow-sm hover:scale-105 active:scale-95',
};

const sizeClasses = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  children,
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      className={`
        inline-flex items-center justify-center gap-2
        font-medium rounded-lg border
        transition-all duration-200 ease-out
        cursor-pointer
        disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className}
      `}
      disabled={isDisabled}
      {...props}
    >
      {loading ? (
        <FaSpinner className="animate-spin" size={14} />
      ) : icon ? (
        <span className="flex-shrink-0">{icon}</span>
      ) : null}
      <span>{children}</span>
    </button>
  );
}
