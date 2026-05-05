/**
 * Loading 组件 - 炫酷大气版本
 * 统一的加载状态显示，支持多种动画效果
 */

import React from 'react';

interface LoadingProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  fullScreen?: boolean;
  variant?: 'spinner' | 'orbit' | 'pulse' | 'gradient';
}

const sizeClasses = {
  sm: 'w-12 h-12',
  md: 'w-16 h-16',
  lg: 'w-24 h-24',
};

export default function Loading({
  size = 'md',
  text = '加载中...',
  fullScreen = false,
  variant = 'orbit'
}: LoadingProps) {

  // 轨道旋转动画加载器（默认）
  const OrbitLoader = () => (
    <div className={`${sizeClasses[size]} relative`}>
      <style>{`
        @keyframes orbit {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes orbitInner {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(-360deg); }
        }
        .orbit-outer {
          animation: orbit 3s linear infinite;
        }
        .orbit-inner {
          animation: orbitInner 4s linear infinite;
        }
      `}</style>
      {/* 外层轨道 */}
      <div className="orbit-outer absolute inset-0 rounded-full border-2 border-transparent border-t-emerald-500 border-r-emerald-400 dark:border-t-emerald-400 dark:border-r-emerald-300 opacity-80"></div>
      {/* 中层轨道 */}
      <div className="orbit-inner absolute inset-2 rounded-full border-2 border-transparent border-b-blue-500 border-l-blue-400 dark:border-b-blue-400 dark:border-l-blue-300 opacity-60"></div>
      {/* 内核 */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-2 h-2 rounded-full bg-gradient-to-r from-emerald-500 to-blue-500 dark:from-emerald-400 dark:to-blue-400 shadow-lg shadow-emerald-500/50 dark:shadow-emerald-400/30"></div>
      </div>
    </div>
  );

  // 脉冲渐变加载器
  const PulseLoader = () => (
    <div className={`${sizeClasses[size]} relative`}>
      <style>{`
        @keyframes pulseGradient {
          0%, 100% {
            box-shadow: 0 0 20px rgba(16, 185, 129, 0.6), inset 0 0 20px rgba(16, 185, 129, 0.3);
          }
          50% {
            box-shadow: 0 0 40px rgba(16, 185, 129, 0.8), inset 0 0 40px rgba(16, 185, 129, 0.5);
          }
        }
        .pulse-glow {
          animation: pulseGradient 2s ease-in-out infinite;
        }
      `}</style>
      <div className="pulse-glow w-full h-full rounded-full bg-gradient-to-br from-emerald-500 via-green-400 to-emerald-400 dark:from-emerald-400 dark:via-green-300 dark:to-emerald-300 opacity-30"></div>
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-emerald-600 to-emerald-400 dark:from-emerald-500 dark:to-emerald-300"></div>
    </div>
  );

  // 梯度旋转加载器
  const GradientLoader = () => (
    <div className={`${sizeClasses[size]} relative`}>
      <style>{`
        @keyframes gradientRotate {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .gradient-spin {
          animation: gradientRotate 3s linear infinite;
        }
        @keyframes dash {
          0% { stroke-dashoffset: 300; }
          50% { stroke-dashoffset: 75; }
          100% { stroke-dashoffset: 300; }
        }
        .gradient-dash {
          animation: dash 2s ease-in-out infinite;
        }
      `}</style>
      <svg className="gradient-spin w-full h-full" viewBox="0 0 100 100">
        <defs>
          <linearGradient id="gradientColor" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="currentColor" stopOpacity="1" className="text-emerald-500 dark:text-emerald-400" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="1" className="text-blue-500 dark:text-blue-400" />
          </linearGradient>
        </defs>
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke="url(#gradientColor)"
          strokeWidth="3"
          strokeLinecap="round"
          className="gradient-dash"
        />
      </svg>
    </div>
  );

  // 简约加载器
  const SpinnerLoader = () => (
    <div className={`${sizeClasses[size]} relative`}>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .simple-spin {
          animation: spin 1.5s linear infinite;
        }
      `}</style>
      <svg className="simple-spin w-full h-full text-emerald-500 dark:text-emerald-400" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    </div>
  );

  const loaders = {
    spinner: <SpinnerLoader />,
    orbit: <OrbitLoader />,
    pulse: <PulseLoader />,
    gradient: <GradientLoader />,
  };

  const content = (
    <div className="flex flex-col items-center justify-center gap-4">
      {loaders[variant]}
      {text && (
        <div className="text-center">
          <p className="text-base font-medium text-gray-700 dark:text-gray-200 tracking-wide">
            {text}
          </p>
          <div className="mt-2 flex justify-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-bounce"></span>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-bounce" style={{ animationDelay: '0.1s' }}></span>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-bounce" style={{ animationDelay: '0.2s' }}></span>
          </div>
        </div>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-white via-gray-50 to-white dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 backdrop-blur-sm z-50 flex items-center justify-center overflow-hidden">
        {/* 背景装饰 */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-200 dark:bg-emerald-900/30 rounded-full blur-3xl opacity-20 dark:opacity-10 animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-200 dark:bg-blue-900/30 rounded-full blur-3xl opacity-20 dark:opacity-10 animate-pulse" style={{ animationDelay: '1s' }}></div>
        </div>
        <div className="relative">
          {content}
        </div>
      </div>
    );
  }

  return content;
}
