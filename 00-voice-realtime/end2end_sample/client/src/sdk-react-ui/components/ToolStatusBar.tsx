/**
 * ToolStatusBar - 工具执行状态栏
 *
 * 显示当前正在执行的工具状态
 * - 位置：屏幕底部中央（字幕上方）
 * - 动画：淡入/淡出
 */

import React from 'react';
import { useToolStatus } from '../hooks/useToolStatus';

export interface ToolStatusBarProps {
  /** 自定义样式 */
  className?: string;
  /** 自定义位置样式 */
  style?: React.CSSProperties;
}

export const ToolStatusBar: React.FC<ToolStatusBarProps> = ({
  className = '',
  style
}) => {
  const { isRunning, displayName } = useToolStatus();

  if (!isRunning || !displayName) {
    return null;
  }

  return (
    <div
      className={`tool-status-bar ${className}`}
      style={{
        position: 'fixed',
        bottom: '180px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        animation: 'toolStatusFadeIn 0.3s ease-out',
        ...style
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '15px',
          padding: '15px 30px',
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          borderRadius: '36px',
          color: 'white',
          fontSize: '21px',
          fontWeight: 500,
          backdropFilter: 'blur(10px)',
          boxShadow: '0 6px 30px rgba(0, 0, 0, 0.3)'
        }}
      >
        {/* 加载动画 */}
        <div
          style={{
            width: '27px',
            height: '27px',
            border: '3px solid rgba(255, 255, 255, 0.3)',
            borderTopColor: '#60A5FA',
            borderRadius: '50%',
            animation: 'toolStatusSpin 0.8s linear infinite'
          }}
        />

        {/* 状态文本 */}
        <span>{displayName}...</span>
      </div>

      {/* 动画样式 */}
      <style>{`
        @keyframes toolStatusFadeIn {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }

        @keyframes toolStatusSpin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
};

export default ToolStatusBar;
