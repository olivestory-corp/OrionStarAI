/**
 * NavigationOverlay - 导航中覆盖层
 * 纯 UI 组件，不依赖任何 Context
 */

import React, { useEffect, useState } from 'react';

interface NavigationOverlayProps {
  /** 是否正在导航 */
  isNavigating: boolean;
  /** 目的地名称 */
  destination?: string;
  /** 停止导航回调 */
  onStopNavigation: () => void;
}

export const NavigationOverlay: React.FC<NavigationOverlayProps> = ({
  isNavigating,
  destination,
  onStopNavigation,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);

  useEffect(() => {
    if (isNavigating) {
      setIsVisible(true);
      setIsAnimatingOut(false);
    } else if (isVisible) {
      setIsAnimatingOut(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        setIsAnimatingOut(false);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [isNavigating, isVisible]);

  if (!isVisible) return null;

  return (
    <div
      className={`fixed inset-0 z-[51] flex flex-col items-center justify-center overflow-hidden pointer-events-none
        ${isAnimatingOut ? 'animate-nav-overlay-out' : 'animate-nav-overlay-in'}`}
    >
      {/* 全屏背景覆盖 */}
      <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm" />

      <div className="relative z-10 flex flex-col items-center gap-8 pointer-events-auto -mt-20">
        <div className="relative flex items-center justify-center">
          <div className="absolute w-40 h-40 rounded-full border-2 border-cyan-400/30 animate-nav-pulse-1" />
          <div className="absolute w-40 h-40 rounded-full border-2 border-cyan-400/20 animate-nav-pulse-2" />
          <div className="absolute w-40 h-40 rounded-full border-2 border-cyan-400/10 animate-nav-pulse-3" />

          <div className="relative w-24 h-24 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center shadow-lg shadow-cyan-500/30">
            <svg className="w-12 h-12 text-white animate-nav-arrow" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71L12 2z" />
            </svg>
          </div>
        </div>

        <div className="flex flex-col items-center gap-3">
          <span className="text-cyan-400 text-xl font-medium tracking-wide animate-pulse">
            正在导航中
          </span>

          {destination && (
            <div className="flex items-center gap-3 px-6 py-3 bg-slate-800/80 rounded-2xl border border-cyan-500/30">
              <svg className="w-6 h-6 text-cyan-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
              </svg>
              <span className="text-white text-2xl font-bold">{destination}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 mt-4">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="w-3 h-3 bg-cyan-400 rounded-full animate-nav-dot"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>

        <button
          onClick={onStopNavigation}
          className="mt-4 flex items-center gap-3 px-8 py-4 bg-red-600 hover:bg-red-500
            rounded-2xl transition-all duration-200 transform hover:scale-105
            shadow-lg shadow-red-500/30 active:scale-95"
        >
          <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 6h12v12H6z" />
          </svg>
          <span className="text-white text-xl font-bold tracking-wide">停止导航</span>
        </button>
      </div>

      <style>{`
        @keyframes nav-overlay-in {
          from { opacity: 0; transform: translateY(100%); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-nav-overlay-in { animation: nav-overlay-in 0.4s ease-out forwards; }

        @keyframes nav-overlay-out {
          from { opacity: 1; transform: translateY(0); }
          to { opacity: 0; transform: translateY(100%); }
        }
        .animate-nav-overlay-out { animation: nav-overlay-out 0.4s ease-in forwards; }

        @keyframes nav-pulse {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(2.5); opacity: 0; }
        }
        .animate-nav-pulse-1 { animation: nav-pulse 2s ease-out infinite; }
        .animate-nav-pulse-2 { animation: nav-pulse 2s ease-out infinite 0.6s; }
        .animate-nav-pulse-3 { animation: nav-pulse 2s ease-out infinite 1.2s; }

        @keyframes nav-arrow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        .animate-nav-arrow { animation: nav-arrow 1.5s ease-in-out infinite; }

        @keyframes nav-dot {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        .animate-nav-dot { animation: nav-dot 1s ease-in-out infinite; }
      `}</style>
    </div>
  );
};

export default NavigationOverlay;
