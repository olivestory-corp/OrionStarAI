/**
 * PresenceIndicator - 人员感知指示器
 *
 * 雷达圈样式，显示机器人是否检测到人并准备交互：
 * - 灰色：待机中（无人）
 * - 黄色：检测到人（太远）
 * - 绿色脉冲：可交互（距离合适）
 */

import React from 'react';

export type PresenceStatus = 'idle' | 'detected' | 'ready';

export interface PresenceIndicatorProps {
  /** 感知状态 */
  status: PresenceStatus;
  /** 大小 */
  size?: 'sm' | 'md' | 'lg';
  /** 自定义类名 */
  className?: string;
}

const SIZE_MAP = {
  sm: { outer: 64, inner: 44, icon: 20 },
  md: { outer: 128, inner: 88, icon: 40 },
  lg: { outer: 160, inner: 112, icon: 48 },
};

const STATUS_CONFIG = {
  idle: {
    label: '待机中',
    outerColor: 'rgba(100, 116, 139, 0.3)',  // slate
    innerColor: 'rgba(100, 116, 139, 0.5)',
    iconColor: '#64748b',
    animate: false,
  },
  detected: {
    label: '看到你了',
    outerColor: 'rgba(251, 191, 36, 0.3)',   // amber
    innerColor: 'rgba(251, 191, 36, 0.6)',
    iconColor: '#fbbf24',
    animate: false,
  },
  ready: {
    label: '我在听',
    outerColor: 'rgba(52, 211, 153, 0.3)',   // emerald
    innerColor: 'rgba(52, 211, 153, 0.7)',
    iconColor: '#34d399',
    animate: true,
  },
};

export const PresenceIndicator: React.FC<PresenceIndicatorProps> = ({
  status,
  size = 'md',
  className = '',
}) => {
  const dims = SIZE_MAP[size];
  const config = STATUS_CONFIG[status];

  return (
    <div
      className={`presence-indicator ${className}`}
      style={{
        position: 'relative',
        width: dims.outer,
        height: dims.outer,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* 外圈 - 雷达扫描效果 */}
      <div
        style={{
          position: 'absolute',
          width: dims.outer,
          height: dims.outer,
          borderRadius: '50%',
          border: `2px solid ${config.outerColor}`,
          animation: config.animate ? 'presence-pulse 2s ease-in-out infinite' : 'none',
        }}
      />

      {/* 中间扩散圈（仅 ready 状态） */}
      {config.animate && (
        <div
          style={{
            position: 'absolute',
            width: dims.outer,
            height: dims.outer,
            borderRadius: '50%',
            border: `2px solid ${config.innerColor}`,
            animation: 'presence-ripple 2s ease-out infinite',
          }}
        />
      )}

      {/* 内圈 */}
      <div
        style={{
          position: 'absolute',
          width: dims.inner,
          height: dims.inner,
          borderRadius: '50%',
          backgroundColor: config.innerColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.3s ease',
        }}
      >
        {/* 图标 */}
        {status === 'idle' && (
          // 睡眠/待机图标
          <svg
            width={dims.icon}
            height={dims.icon}
            viewBox="0 0 24 24"
            fill="none"
            stroke={config.iconColor}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M17 18a5 5 0 0 0-10 0" />
            <line x1="12" y1="2" x2="12" y2="9" />
            <line x1="4.22" y1="10.22" x2="5.64" y2="11.64" />
            <line x1="1" y1="18" x2="3" y2="18" />
            <line x1="21" y1="18" x2="23" y2="18" />
            <line x1="18.36" y1="11.64" x2="19.78" y2="10.22" />
            <line x1="23" y1="22" x2="1" y2="22" />
            <polyline points="8 6 12 2 16 6" />
          </svg>
        )}
        {status === 'detected' && (
          // 眼睛图标
          <svg
            width={dims.icon}
            height={dims.icon}
            viewBox="0 0 24 24"
            fill="none"
            stroke={config.iconColor}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
        {status === 'ready' && (
          // 耳朵图标
          <svg
            width={dims.icon}
            height={dims.icon}
            viewBox="0 0 24 24"
            fill="none"
            stroke={config.iconColor}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 8.5a6.5 6.5 0 1 1 13 0c0 6-6 6-6 10.5a2 2 0 0 1-4 0" />
            <path d="M15 8.5a2.5 2.5 0 0 0-5 0v1a2 2 0 0 0 4 0" />
          </svg>
        )}
      </div>

      {/* 状态文字 */}
      <div
        style={{
          position: 'absolute',
          bottom: size === 'sm' ? -20 : size === 'md' ? -28 : -32,
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: size === 'sm' ? 12 : size === 'md' ? 16 : 18,
          color: config.iconColor,
          whiteSpace: 'nowrap',
          fontWeight: 500,
        }}
      >
        {config.label}
      </div>

      {/* CSS 动画 */}
      <style>{`
        @keyframes presence-pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.05);
            opacity: 0.8;
          }
        }

        @keyframes presence-ripple {
          0% {
            transform: scale(1);
            opacity: 0.6;
          }
          100% {
            transform: scale(1.5);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
};

export default PresenceIndicator;
