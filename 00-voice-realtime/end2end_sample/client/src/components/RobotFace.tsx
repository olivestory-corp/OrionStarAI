import React, { useEffect, useState, useRef } from 'react';

interface RobotFaceProps {
  isUserSpeaking: boolean;
  isRobotSpeaking: boolean;
  statusMessage?: string | null;
  onToggleDebug: () => void;
  isMuted?: boolean;
  onToggleMute?: () => void;
  isPaused?: boolean; // 🆕 新增：是否暂停所有动画
}

// --- 优化 1: 将 JellyEye 移出组件并使用 React.memo 防止重复渲染 ---
// 使用 forwardRef 以便父组件可以直接操作 DOM (零渲染更新)
const JellyEye = React.memo(React.forwardRef<HTMLDivElement, { isLeft: boolean; blink: boolean; isUserSpeaking: boolean; isPaused?: boolean }>(
  ({ isLeft, blink, isUserSpeaking, isPaused }, ref) => (
    <div className="relative">
      {/* 猫耳 - 静态部分 */}
      <div
        className={`absolute -top-4 ${isLeft ? '-left-4 rotate-[-25deg]' : '-right-4 rotate-[25deg]'}
          w-20 h-20 bg-blue-600 rounded-[30px] opacity-90`}
      />

      {/* 眼眶 */}
      <div className={`relative w-36 h-36 sm:w-44 sm:h-44 rounded-full p-3 sm:p-4
        bg-gradient-to-b from-cyan-400 to-blue-700
        transition-transform duration-150 ease-out
        ${blink ? 'scale-y-[0.1]' : 'scale-y-100'}
      `}>
        <div className="w-full h-full rounded-full bg-slate-950 overflow-hidden relative">
          {/* 瞳孔 - 使用 CSS 动画替代鼠标跟随 */}
          <div
            ref={ref}
            className={`absolute inset-0 rounded-full ${isPaused ? '' : 'animate-eye-float'}`}
            style={{ transform: 'translate3d(0,0,0)' }} // 初始位置
          >
            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
              w-[75%] h-[75%] bg-gradient-to-b from-slate-900 to-black rounded-full
              transition-transform duration-300 ${isUserSpeaking ? 'scale-110' : 'scale-100'}
            `}>
              {/* 高光 */}
              <div className="absolute top-[15%] left-[15%] w-[35%] h-[25%] bg-white rounded-full opacity-90 rotate-[-15deg]" />
              <div className="absolute bottom-[20%] right-[20%] w-[12%] h-[12%] bg-cyan-300 rounded-full opacity-80" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
));

// 🆕 使用 React.memo 包装整个组件，防止父组件无关更新导致的重绘
export const RobotFace = React.memo<RobotFaceProps>(({
  isUserSpeaking,
  isRobotSpeaking,
  statusMessage,
  onToggleDebug,
  isMuted = false,
  onToggleMute,
  isPaused = false,
}) => {
  const [blink, setBlink] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // --- 优化 2: 使用 Ref 直接引用瞳孔 DOM，避免 State 更新 ---
  const leftEyeRef = useRef<HTMLDivElement>(null);
  const rightEyeRef = useRef<HTMLDivElement>(null);

  // --- 1. 眨眼逻辑 (优化: 降低频率，且暂停时不执行) ---
  useEffect(() => {
    if (isPaused) return; // 暂停时不眨眼

    let timeoutId: NodeJS.Timeout;
    const triggerBlink = () => {
      setBlink(true);
      setTimeout(() => setBlink(false), 150);
      const isDoubleBlink = Math.random() < 0.1; // 降低双眨眼概率
      // 延长眨眼间隔: 4s ~ 8s
      const nextDelay = isDoubleBlink ? 300 : 4000 + Math.random() * 4000;
      timeoutId = setTimeout(triggerBlink, nextDelay);
    };
    timeoutId = setTimeout(triggerBlink, 3000);
    return () => clearTimeout(timeoutId);
  }, [isPaused]); // 依赖 isPaused

  // --- 2. 鼠标跟随逻辑已移除 (触屏设备优化) ---

  return (
    <div ref={containerRef} className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 overflow-hidden font-sans select-none ${isPaused ? 'paused-animations' : ''}`}>

      {/* --- 背景层 --- */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900 to-black" />

      {/* --- 脸部主体 --- */}
      <div className="relative z-10 flex flex-col items-center">

        {/* 状态消息 (优化: 条件渲染，不显示时不渲染 DOM) */}
        {statusMessage && (
          <div className="absolute -top-32 animate-fade-in">
            <div className="px-6 py-3 bg-slate-800 rounded-2xl border border-cyan-500/50 flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-cyan-100 text-lg font-bold tracking-wide">
                {statusMessage}
              </span>
            </div>
          </div>
        )}

        {/* 双眼 - 传递 Refs */}
        <div className="flex gap-8 sm:gap-12 items-center">
          <JellyEye isLeft={true} blink={blink} isUserSpeaking={isUserSpeaking} ref={leftEyeRef} isPaused={isPaused} />
          <JellyEye isLeft={false} blink={blink} isUserSpeaking={isUserSpeaking} ref={rightEyeRef} isPaused={isPaused} />
        </div>

        {/* 嘴巴 (优化: 降低动画频率，暂停时停止) */}
        <div className="mt-6 sm:mt-8 h-16 flex items-center justify-center">
          <svg
            width="60"
            height="40"
            viewBox="0 0 60 40"
            className={`transition-transform duration-200 ${isRobotSpeaking && !isPaused ? 'animate-talk-slow' : ''}`}
          >
            <path
              d="M 15 15 Q 30 28 45 15"
              fill="none"
              stroke="#22d3ee"
              strokeWidth="5"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>

      {/* --- 底部状态栏 --- */}
      <div className="absolute bottom-0 left-0 right-0 h-40 flex flex-col items-center justify-end pb-12">

        {/* 动态声波 (优化: 始终显示，根据状态调整幅度，暂停时停止) */}
        <div className="flex items-end gap-3 h-20 mb-4 transition-opacity duration-300 opacity-100">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className={`w-4 rounded-full origin-bottom transition-all duration-300
                ${isUserSpeaking && !isPaused ? 'bg-cyan-400 animate-wave-active' : 'bg-slate-700 animate-wave-idle'}
              `}
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>

        {/* 强力聆听提示 (仅在用户说话时显示，优化: 条件渲染) */}
        {isUserSpeaking && !isPaused && (
          <div className="flex items-center gap-3 px-8 py-3 bg-slate-900 rounded-full border-2 border-red-500 animate-fade-in-up">
            <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse" />
            <span className="text-white text-2xl font-black tracking-widest">正在聆听...</span>
          </div>
        )}
      </div>

      {/* 工具栏 (右下角) */}
      <div className="absolute bottom-6 right-6 flex items-center gap-4 z-50">
        {/* Mute Toggle */}
        {onToggleMute && (
          <button
            onClick={onToggleMute}
            className={`p-3 rounded-full transition-all duration-200 backdrop-blur-sm border
              ${isMuted
                ? 'bg-red-500/80 text-white border-red-400 hover:bg-red-600'
                : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:text-white hover:bg-slate-700 hover:border-slate-500'
              }`}
            title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
          >
            {isMuted ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            )}
          </button>
        )}

        {/* Debug Toggle - 优化可见性 */}
        <button
          onClick={onToggleDebug}
          className="p-3 rounded-full bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700 transition-all duration-200 backdrop-blur-sm border border-slate-700/50 hover:border-slate-500"
          title="Toggle Debug View"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>

      <style>{`
        /* 全局暂停类 */
        .paused-animations * {
          animation-play-state: paused !important;
        }

        /* 活跃状态声波 */
        @keyframes wave-active {
          0%, 100% { transform: scaleY(0.3); }
          50% { transform: scaleY(1.5); }
        }
        .animate-wave-active {
          animation: wave-active 0.8s ease-in-out infinite;
          will-change: transform;
        }

        /* 待机状态声波 (微动) */
        @keyframes wave-idle {
          0%, 100% { transform: scaleY(0.2); }
          50% { transform: scaleY(0.4); }
        }
        .animate-wave-idle {
          animation: wave-idle 2s ease-in-out infinite;
          will-change: transform;
        }

        /* 优化: 降低嘴部动画频率 (0.2s -> 0.5s) */
        @keyframes talk-slow {
          0%, 100% { transform: scaleY(1) scaleX(1); }
          50% { transform: scaleY(2.2) scaleX(0.8); }
        }
        .animate-talk-slow {
          animation: talk-slow 0.5s ease-in-out infinite;
          transform-origin: center;
        }

        /* 新增: 眼球微动动画 (替代鼠标跟随) */
        @keyframes eye-float {
          0%, 100% { transform: translate3d(0, 0, 0); }
          25% { transform: translate3d(2px, -2px, 0); }
          50% { transform: translate3d(0, 1px, 0); }
          75% { transform: translate3d(-2px, -1px, 0); }
        }
        .animate-eye-float {
          animation: eye-float 6s ease-in-out infinite;
          will-change: transform;
        }

        /* 简单的淡入动画 */
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out forwards;
        }

        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
});