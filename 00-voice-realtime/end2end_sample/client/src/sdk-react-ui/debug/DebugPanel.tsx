/**
 * DebugPanel - 调试面板
 * 纯 UI 组件，不依赖任何 Context
 * 所有数据通过 props 传入
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import MapView from './MapView';
import { ChatMessage, RobotEnvironmentState } from '../../sdk/types';
import { robotSDK } from '../../sdk';

interface NavigationPath {
  from: string;
  to: string;
  duration_ms?: number;
}

interface AudioStats {
  totalDurationMs: number;
  totalBytes: number;
  packetCount?: number;
}

export interface DebugPanelProps {
  /** 关闭回调（返回场景） */
  onClose: () => void;
  /** 后退回调（返回场景选择） */
  onBack?: () => void;

  // 连接状态
  isConnected: boolean;
  isInitialized: boolean;
  isVADReady: boolean;

  // 音频/语音状态
  isPlaying: boolean;
  isMuted: boolean;
  userSpeaking: boolean;
  isListening: boolean;

  // 字幕
  subtitleText: string;
  subtitleProgress: number;

  // 机器人环境
  robotState: RobotEnvironmentState | null;

  // 音频统计
  audioStats: AudioStats;
  totalCost: number;

  // 消息
  messages: ChatMessage[];

  // 导航
  navigationPath: NavigationPath | null;

  // 回调
  onToggleMute: () => void;
  onSetVolume: (volume: number) => void;
  onStopAudio: () => void;
  onSendText: (text: string, role?: 'user' | 'system') => void;
  onNavigate: (placeName: string) => Promise<void>;
  onStopNavigation: () => Promise<void>;
  onSetNavigationPath: (path: NavigationPath | null) => void;
}

export function DebugPanel({
  onClose,
  onBack,
  isConnected,
  isInitialized,
  isVADReady,
  isPlaying,
  isMuted,
  userSpeaking,
  isListening,
  subtitleText,
  subtitleProgress,
  robotState,
  audioStats,
  totalCost,
  messages,
  navigationPath,
  onToggleMute,
  onSetVolume,
  onStopAudio,
  onSendText,
  onNavigate,
  onStopNavigation,
  onSetNavigationPath,
}: DebugPanelProps) {
  const [textInput, setTextInput] = useState('');
  const [places, setPlaces] = useState<any[]>([]);
  const [currentPosition, setCurrentPosition] = useState<{ x: number; y: number; theta: number }>({ x: 0, y: 0, theta: 0 });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const peopleCount = robotState?.people?.count ?? 0;
  const peopleList = robotState?.people?.list ?? [];
  const minDistance = peopleList.length > 0
    ? Math.min(...peopleList.map(p => p.distance))
    : null;

  // 加载地点列表
  useEffect(() => {
    robotSDK.getPlaceList()
      .then((result: any) => {
        console.log('[DebugPanel] 获取地点列表:', result);
        if (Array.isArray(result)) {
          setPlaces(result);
        } else if (result?.data && Array.isArray(result.data)) {
          setPlaces(result.data);
        }
      })
      .catch((err: Error) => {
        console.warn('[DebugPanel] 获取地点列表失败:', err.message);
      });
  }, []);

  // 位置更新 - 订阅事件实时更新
  useEffect(() => {
    // 初始获取位置
    robotSDK.getPosition()
      .then((result: any) => {
        const pos = result?.data || result;
        if (pos && typeof pos.x === 'number') {
          setCurrentPosition({ x: pos.x, y: pos.y, theta: pos.theta || 0 });
        }
      })
      .catch((err) => {
        console.warn('[DebugPanel] 获取初始位置失败:', err);
      });

    // 订阅位置变化事件（Mock 模式）
    const unsubscribe = robotSDK.subscribePose((pose) => {
      setCurrentPosition({ x: pose.x, y: pose.y, theta: pose.theta });
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // 滚动到底部
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, subtitleText, scrollToBottom]);

  // 发送文本消息
  const handleSendText = useCallback(() => {
    if (textInput.trim()) {
      onSendText(textInput.trim(), 'user');
      setTextInput('');
    }
  }, [textInput, onSendText]);

  // 格式化时间
  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // 格式化字节数
  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="fixed inset-0 bg-slate-900/95 z-50 flex flex-col overflow-hidden">
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between px-6 py-3 bg-slate-800/80 border-b border-slate-700/50">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-white">🔧 调试面板</h2>

          {/* 连接状态 */}
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs ${
            isConnected && isInitialized
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'bg-amber-500/20 text-amber-400'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              isConnected && isInitialized ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'
            }`} />
            {isConnected && isInitialized ? '已连接' : '连接中...'}
          </div>

          {/* VAD 状态 */}
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs ${
            isVADReady
              ? 'bg-blue-500/20 text-blue-400'
              : 'bg-slate-700/50 text-slate-500'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              isVADReady ? 'bg-blue-400' : 'bg-slate-500'
            }`} />
            VAD {isVADReady ? '就绪' : '初始化中'}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* 后退按钮（返回场景选择） */}
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 transition-all"
              title="返回场景选择"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="text-sm">返回</span>
            </button>
          )}

          {/* 关闭按钮（返回场景） */}
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-all"
            title="关闭调试面板"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧：地图 */}
        <div className="w-1/2 p-4 border-r border-slate-700/50">
          <div className="h-full bg-slate-800/50 rounded-xl overflow-hidden">
            <MapView
              areas={places.map((p: any) => ({
                id: p.id || p.name,
                name: p.name,
                x: p.x ?? 50,
                y: p.y ?? 50,
              }))}
              currentPosition={currentPosition}
              navigationPath={navigationPath}
              onNavigationComplete={() => {
                console.log('[DebugPanel] 导航完成');
                onSetNavigationPath(null);
              }}
              onAreaClick={async (area: any) => {
                console.log('[DebugPanel] 点击区域:', area.name);
                onSetNavigationPath({ from: 'current', to: area.name });
                await onNavigate(area.name);
              }}
            />
          </div>
        </div>

        {/* 右侧：对话和控制 */}
        <div className="w-1/2 flex flex-col p-4">
          {/* 状态面板 */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            {/* 语音状态 */}
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="text-xs text-slate-500 mb-1">语音状态</div>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${
                  userSpeaking ? 'bg-blue-400 animate-pulse' :
                  isPlaying ? 'bg-emerald-400 animate-pulse' :
                  isListening ? 'bg-yellow-400' : 'bg-slate-600'
                }`} />
                <span className="text-sm text-white">
                  {userSpeaking ? '用户说话中' :
                   isPlaying ? '正在播放' :
                   isListening ? '等待语音' : '空闲'}
                </span>
              </div>
            </div>

            {/* 音频统计 */}
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="text-xs text-slate-500 mb-1">音频统计</div>
              <div className="text-sm text-white">
                {formatDuration(audioStats.totalDurationMs)} / {formatBytes(audioStats.totalBytes)}
              </div>
            </div>

            {/* 费用 */}
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="text-xs text-slate-500 mb-1">费用</div>
              <div className="text-sm text-white">${totalCost.toFixed(4)}</div>
            </div>
          </div>

          {/* 字幕显示 */}
          {subtitleText && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-4">
              <div className="text-sm text-blue-300">{subtitleText}</div>
              <div className="mt-1 h-1 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-100"
                  style={{ width: `${subtitleProgress * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* 消息列表 */}
          <div className="flex-1 bg-slate-800/50 rounded-lg overflow-y-auto p-4 mb-4">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`mb-3 p-3 rounded-lg ${
                  msg.role === 'user'
                    ? 'bg-blue-500/20 text-blue-100 ml-8'
                    : msg.role === 'assistant'
                    ? 'bg-slate-700/50 text-slate-100 mr-8'
                    : 'bg-amber-500/20 text-amber-100 text-xs'
                }`}
              >
                <div className="text-xs text-slate-500 mb-1">
                  {msg.role === 'user' ? '👤 用户' : msg.role === 'assistant' ? '🤖 助手' : '🔧 工具'}
                </div>
                <div className="text-sm whitespace-pre-wrap">{msg.text}</div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* 控制区 */}
          <div className="space-y-3">
            {/* 音量控制 */}
            <div className="flex items-center gap-3 bg-slate-800/50 rounded-lg p-3">
              <button
                onClick={onToggleMute}
                className={`p-2 rounded-lg ${isMuted ? 'bg-red-500/20 text-red-400' : 'bg-slate-700 text-white'}`}
              >
                {isMuted ? '🔇' : '🔊'}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                defaultValue="1"
                onChange={(e) => onSetVolume(parseFloat(e.target.value))}
                className="flex-1"
              />
              <button
                onClick={onStopAudio}
                className="px-3 py-1 rounded-lg bg-amber-500/20 text-amber-400 text-sm"
              >
                停止播放
              </button>
            </div>

            {/* 文本输入 */}
            <div className="flex gap-2">
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
                placeholder="输入消息..."
                className="flex-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={handleSendText}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500"
              >
                发送
              </button>
            </div>

            {/* 导航控制 */}
            {navigationPath && (
              <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
                <span className="text-sm text-emerald-400">
                  🧭 导航中: {navigationPath.to}
                </span>
                <button
                  onClick={onStopNavigation}
                  className="ml-auto px-3 py-1 rounded-lg bg-red-500/20 text-red-400 text-sm"
                >
                  停止导航
                </button>
              </div>
            )}

            {/* 人员检测 */}
            <div className={`rounded-lg p-3 ${
              peopleCount > 0 && minDistance !== null && minDistance <= 1.2
                ? 'bg-emerald-500/10 border border-emerald-500/30'
                : peopleCount > 0
                ? 'bg-amber-500/10 border border-amber-500/30'
                : 'bg-slate-700/30 border border-slate-600/30'
            }`}>
              <div className={`text-sm ${
                peopleCount > 0 && minDistance !== null && minDistance <= 1.2
                  ? 'text-emerald-400'
                  : peopleCount > 0
                  ? 'text-amber-400'
                  : 'text-slate-500'
              }`}>
                {peopleCount > 0 ? (
                  <>
                    👥 检测到 {peopleCount} 人
                    {minDistance !== null && (
                      <span className="ml-2">
                        (最近 {minDistance.toFixed(2)}m
                        {minDistance <= 1.2 ? ' ✓ 可交互' : ' ✗ 太远'})
                      </span>
                    )}
                  </>
                ) : (
                  '👻 未检测到人'
                )}
              </div>
              {peopleList.length > 0 && (
                <div className="mt-2 text-xs text-slate-400 space-y-1">
                  {peopleList.map((p, i) => (
                    <div key={p.id || i}>
                      ID:{p.id} - {p.distance.toFixed(2)}m, {((p.angle * 180) / Math.PI).toFixed(0)}°
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DebugPanel;
