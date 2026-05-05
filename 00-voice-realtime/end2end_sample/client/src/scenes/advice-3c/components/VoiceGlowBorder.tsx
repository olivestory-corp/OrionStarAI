/**
 * VoiceGlowBorder - 屏幕四周呼吸灯效果
 *
 * 当用户说话时，屏幕四周显示脉动的光晕边框效果
 * 模拟音浪/呼吸灯的视觉反馈
 */

import React from 'react';

export interface VoiceGlowBorderProps {
  /** 是否激活（用户说话中） */
  isActive: boolean;
  /** 颜色主题 */
  color?: 'blue' | 'red' | 'green' | 'purple' | 'cyan';
  /** 光晕强度 (1-3) */
  intensity?: 1 | 2 | 3;
}

export const VoiceGlowBorder: React.FC<VoiceGlowBorderProps> = ({
  isActive,
  color = 'cyan',
  intensity = 2,
}) => {
  if (!isActive) return null;

  // 颜色配置
  const colorConfig = {
    blue: {
      primary: 'rgba(59, 130, 246, 0.8)',    // blue-500
      secondary: 'rgba(96, 165, 250, 0.6)',   // blue-400
      glow: 'rgba(59, 130, 246, 0.4)',
    },
    red: {
      primary: 'rgba(239, 68, 68, 0.8)',      // red-500
      secondary: 'rgba(248, 113, 113, 0.6)',  // red-400
      glow: 'rgba(239, 68, 68, 0.4)',
    },
    green: {
      primary: 'rgba(34, 197, 94, 0.8)',      // green-500
      secondary: 'rgba(74, 222, 128, 0.6)',   // green-400
      glow: 'rgba(34, 197, 94, 0.4)',
    },
    purple: {
      primary: 'rgba(168, 85, 247, 0.8)',     // purple-500
      secondary: 'rgba(192, 132, 252, 0.6)',  // purple-400
      glow: 'rgba(168, 85, 247, 0.4)',
    },
    cyan: {
      primary: 'rgba(6, 182, 212, 0.8)',      // cyan-500
      secondary: 'rgba(34, 211, 238, 0.6)',   // cyan-400
      glow: 'rgba(6, 182, 212, 0.4)',
    },
  };

  const colors = colorConfig[color];
  const borderWidth = intensity * 6; // 6px, 12px, 18px (加倍)
  const glowSpread = intensity * 40;  // 40px, 80px, 120px (大幅增加)
  const edgeWidth = intensity * 25;   // 边缘光带宽度: 25px, 50px, 75px

  return (
    <>
      {/* CSS Keyframes */}
      <style>{`
        @keyframes breathe {
          0%, 100% {
            opacity: 0.4;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.02);
          }
        }

        @keyframes wave {
          0% {
            opacity: 0.3;
            box-shadow: inset 0 0 ${glowSpread}px ${colors.glow};
          }
          25% {
            opacity: 0.6;
            box-shadow: inset 0 0 ${glowSpread * 1.5}px ${colors.primary};
          }
          50% {
            opacity: 0.9;
            box-shadow: inset 0 0 ${glowSpread * 2}px ${colors.primary};
          }
          75% {
            opacity: 0.6;
            box-shadow: inset 0 0 ${glowSpread * 1.5}px ${colors.secondary};
          }
          100% {
            opacity: 0.3;
            box-shadow: inset 0 0 ${glowSpread}px ${colors.glow};
          }
        }

        @keyframes cornerPulse {
          0%, 100% {
            opacity: 0.5;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.3);
          }
        }

        @keyframes borderFlow {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }
      `}</style>

      {/* 主光晕层 - 四周边框 */}
      <div
        className="fixed inset-0 pointer-events-none z-[90]"
        style={{
          animation: 'wave 2s ease-in-out infinite',
          border: `${borderWidth}px solid transparent`,
          borderImage: `linear-gradient(
            90deg,
            ${colors.primary},
            ${colors.secondary},
            ${colors.primary},
            ${colors.secondary},
            ${colors.primary}
          ) 1`,
          backgroundClip: 'padding-box',
        }}
      />

      {/* 渐变边框流动效果 */}
      <div
        className="fixed inset-0 pointer-events-none z-[91]"
        style={{
          background: `linear-gradient(90deg,
            transparent,
            ${colors.glow},
            transparent,
            ${colors.glow},
            transparent
          )`,
          backgroundSize: '200% 100%',
          animation: 'borderFlow 3s linear infinite',
          mask: `linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)`,
          maskComposite: 'xor',
          WebkitMaskComposite: 'xor',
          padding: `${borderWidth + 2}px`,
        }}
      />

      {/* 四角强调光点 - 更大范围 */}
      {['top-0 left-0', 'top-0 right-0', 'bottom-0 left-0', 'bottom-0 right-0'].map((position, index) => (
        <div
          key={position}
          className={`fixed ${position} pointer-events-none z-[92]`}
          style={{
            width: `${80 + intensity * 40}px`,
            height: `${80 + intensity * 40}px`,
            background: `radial-gradient(circle, ${colors.primary} 0%, ${colors.glow} 40%, transparent 70%)`,
            animation: `cornerPulse 1.5s ease-in-out infinite`,
            animationDelay: `${index * 0.2}s`,
          }}
        />
      ))}

      {/* 顶部边缘光带 - 更宽 */}
      <div
        className="fixed top-0 left-0 right-0 pointer-events-none z-[91]"
        style={{
          height: `${edgeWidth}px`,
          background: `linear-gradient(to bottom, ${colors.primary}, ${colors.glow} 50%, transparent)`,
          animation: 'breathe 2s ease-in-out infinite',
        }}
      />

      {/* 底部边缘光带 - 更宽 */}
      <div
        className="fixed bottom-0 left-0 right-0 pointer-events-none z-[91]"
        style={{
          height: `${edgeWidth}px`,
          background: `linear-gradient(to top, ${colors.primary}, ${colors.glow} 50%, transparent)`,
          animation: 'breathe 2s ease-in-out infinite',
          animationDelay: '0.5s',
        }}
      />

      {/* 左侧边缘光带 - 更宽 */}
      <div
        className="fixed top-0 bottom-0 left-0 pointer-events-none z-[91]"
        style={{
          width: `${edgeWidth}px`,
          background: `linear-gradient(to right, ${colors.primary}, ${colors.glow} 50%, transparent)`,
          animation: 'breathe 2s ease-in-out infinite',
          animationDelay: '0.25s',
        }}
      />

      {/* 右侧边缘光带 - 更宽 */}
      <div
        className="fixed top-0 bottom-0 right-0 pointer-events-none z-[91]"
        style={{
          width: `${edgeWidth}px`,
          background: `linear-gradient(to left, ${colors.primary}, ${colors.glow} 50%, transparent)`,
          animation: 'breathe 2s ease-in-out infinite',
          animationDelay: '0.75s',
        }}
      />
    </>
  );
};

export default VoiceGlowBorder;
