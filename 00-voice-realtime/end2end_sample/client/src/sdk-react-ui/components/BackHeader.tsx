/**
 * BackHeader - 通用返回头部
 * 纯 UI 组件，不依赖任何 Context
 */

import React from 'react';

interface BackHeaderProps {
  /** 标题 */
  title?: string;
  /** 返回回调 */
  onBack: () => void;
}

export function BackHeader({ title, onBack }: BackHeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 px-4 py-2 flex items-center bg-black/30 backdrop-blur-sm border-b border-white/10">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-white/70 hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-white/10"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        <span className="text-sm">返回</span>
      </button>

      {title && (
        <span className="ml-4 text-white/60 text-sm">{title}</span>
      )}
    </header>
  );
}

export default BackHeader;
