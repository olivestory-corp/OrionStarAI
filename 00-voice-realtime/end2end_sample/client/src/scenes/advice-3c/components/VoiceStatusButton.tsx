/**
 * VoiceStatusButton - 右下角圆形语音状态按钮
 *
 * PTT (Push-to-Talk) 模式：
 * 1. 按住说话 - 立即打断 LLM + 开始录音
 * 2. 松开发送 - 停止录音 + 发送给 LLM
 * 3. 静音状态 - 灰色，带斜线的话筒图标，点击切换
 */

import React, { useCallback, useRef, useState } from 'react';

export interface VoiceStatusButtonProps {
  /** 用户是否在说话 */
  isListening: boolean;
  /** AI是否在说话 */
  isSpeaking: boolean;
  /** 是否静音（来自 SDK 状态） */
  isMuted: boolean;
  /** 切换静音状态 */
  onToggleMute: () => void;
  /** PTT 开始 - 按住时调用 */
  onPTTStart?: () => void;
  /** PTT 结束 - 松开时调用 */
  onPTTEnd?: () => void;
}

type VoiceState = 'listening' | 'speaking' | 'ready' | 'muted';

export const VoiceStatusButton: React.FC<VoiceStatusButtonProps> = ({
  isListening,
  isSpeaking,
  isMuted,
  onToggleMute,
  onPTTStart,
  onPTTEnd,
}) => {
  // PTT 状态
  const [isPTTActive, setIsPTTActive] = useState(false);
  const pttActiveRef = useRef(false);

  // 确定当前状态
  const getState = (): VoiceState => {
    if (isMuted) return 'muted';
    if (isListening || isPTTActive) return 'listening';
    if (isSpeaking) return 'speaking';
    return 'ready';
  };

  const state = getState();

  // PTT 开始 - 按下时触发
  const handlePTTStart = useCallback((e: React.PointerEvent | React.TouchEvent) => {
    e.preventDefault();
    if (isMuted) {
      console.log('[VoiceStatusButton] 🔇 静音状态，忽略 PTT');
      return;
    }
    if (pttActiveRef.current) return; // 防止重复触发

    pttActiveRef.current = true;
    setIsPTTActive(true);
    console.log('[VoiceStatusButton] 🎤 PTT 开始');
    onPTTStart?.();
  }, [isMuted, onPTTStart]);

  // PTT 结束 - 松开时触发
  const handlePTTEnd = useCallback((e: React.PointerEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!pttActiveRef.current) return; // 没有开始就不处理

    pttActiveRef.current = false;
    setIsPTTActive(false);
    console.log('[VoiceStatusButton] 🛑 PTT 结束');
    onPTTEnd?.();
  }, [onPTTEnd]);

  // 静音状态下点击切换静音
  const handleClick = useCallback(() => {
    if (isMuted) {
      console.log('[VoiceStatusButton] 🔊 取消静音');
      onToggleMute();
    }
    // 非静音状态不响应点击，由 PTT 处理
  }, [isMuted, onToggleMute]);

  // 状态配置
  const stateConfig = {
    listening: {
      bgColor: 'bg-red-500',
      ringColor: 'ring-red-400',
      pulseColor: 'bg-red-400',
      label: 'Listening',
      showPulse: true,
    },
    speaking: {
      bgColor: 'bg-blue-500',
      ringColor: 'ring-blue-400',
      pulseColor: 'bg-blue-400',
      label: 'Speaking',
      showPulse: true,
    },
    ready: {
      bgColor: 'bg-slate-700',
      ringColor: 'ring-slate-500',
      pulseColor: 'bg-slate-500',
      label: 'Ready',
      showPulse: false,
    },
    muted: {
      bgColor: 'bg-slate-600',
      ringColor: 'ring-slate-500',
      pulseColor: 'bg-slate-500',
      label: 'Muted',
      showPulse: false,
    },
  };

  const config = stateConfig[state];

  // 话筒图标
  const MicIcon = () => (
    <svg
      className="w-6 h-6 text-white"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
      />
    </svg>
  );

  // 静音话筒图标（带斜线）
  const MicOffIcon = () => (
    <svg
      className="w-6 h-6 text-white"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
      />
      {/* 斜线 */}
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2.5}
        d="M3 3l18 18"
      />
    </svg>
  );

  // 音波动画图标
  const SoundWaveIcon = () => (
    <div className="flex items-center justify-center gap-0.5">
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="w-1 rounded-full bg-white animate-pulse"
          style={{
            height: `${8 + (i % 2 === 0 ? 8 : 4)}px`,
            animationDelay: `${i * 0.15}s`,
          }}
        />
      ))}
    </div>
  );

  // 根据状态渲染图标
  const renderIcon = () => {
    switch (state) {
      case 'listening':
      case 'speaking':
        return <SoundWaveIcon />;
      case 'muted':
        return <MicOffIcon />;
      case 'ready':
      default:
        return <MicIcon />;
    }
  };

  // 获取按钮提示文字
  const getTitle = () => {
    if (isMuted) return 'Click to unmute';
    if (isPTTActive) return 'Release to send';
    return 'Hold to talk';
  };

  return (
    <div
      className={`fixed bottom-8 right-8 z-[200] ${isMuted ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'}`}
      style={{ transform: 'scale(1.5)', transformOrigin: 'bottom right', touchAction: 'none' }}
      onClick={handleClick}
      onPointerDown={handlePTTStart}
      onPointerUp={handlePTTEnd}
      onPointerLeave={handlePTTEnd}
      onPointerCancel={handlePTTEnd}
      onTouchStart={handlePTTStart}
      onTouchEnd={handlePTTEnd}
      onTouchCancel={handlePTTEnd}
      title={getTitle()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(); }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* 脉动动画背景 */}
      {config.showPulse && (
        <>
          <div
            className={`absolute inset-0 rounded-full ${config.pulseColor} opacity-30 animate-ping pointer-events-none`}
            style={{ animationDuration: '1.5s' }}
          />
          <div
            className={`absolute inset-0 rounded-full ${config.pulseColor} opacity-20 pointer-events-none`}
            style={{
              animation: 'pulse 2s ease-in-out infinite',
              transform: 'scale(1.3)',
            }}
          />
        </>
      )}

      {/* 视觉按钮（不再处理点击） */}
      <div
        className={`
          relative w-14 h-14 rounded-full
          ${config.bgColor}
          ring-2 ${config.ringColor}
          flex items-center justify-center
          shadow-lg
          transition-all duration-300
          pointer-events-none
        `}
      >
        {renderIcon()}
      </div>

      {/* 状态标签 */}
      <div
        className={`
          absolute -top-8 left-1/2 transform -translate-x-1/2
          px-2 py-1 rounded-full text-xs font-medium
          whitespace-nowrap pointer-events-none
          ${state === 'listening'
            ? 'bg-red-500/80 text-white'
            : state === 'speaking'
              ? 'bg-blue-500/80 text-white'
              : state === 'muted'
                ? 'bg-slate-600/80 text-slate-300'
                : 'bg-green-600/80 text-white'
          }
        `}
      >
        {state === 'ready' ? 'Hold to Talk' : config.label}
      </div>
    </div>
  );
};

export default VoiceStatusButton;