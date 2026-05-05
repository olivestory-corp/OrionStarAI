/**
 * FaceRegisterScene - 人脸注册场景
 * 人脸录入与身份识别
 */

import { useState, useEffect, useCallback } from 'react';
import { useAgentSDKContext } from '../../sdk/react';
import { SubtitleDisplay, SessionInitToast, ToolStatusBar } from '../../sdk-react-ui';
import { SceneProps } from '../types';
import { CameraView } from './components';
import { getRegisteredNames, clearAllFaceRecords } from './storage';

type StatusType = 'idle' | 'no_face' | 'registered' | 'recognized' | 'unknown';

interface StatusInfo {
  status: StatusType;
  message: string;
  name?: string;
  confidence?: string;
}

export function FaceRegisterScene({ onExit }: SceneProps) {
  const {
    isConnected,
    isInitialized,
    isPlaying,
    subtitleText,
    subtitleProgress,
    userSpeaking,
    isVADReady
  } = useAgentSDKContext();

  // 状态
  const [modelReady, setModelReady] = useState(false);
  const [registeredNames, setRegisteredNames] = useState<string[]>([]);
  const [statusInfo, setStatusInfo] = useState<StatusInfo | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // 初始化已注册名单
  useEffect(() => {
    setRegisteredNames(getRegisteredNames());
  }, []);

  // 监听工具执行状态事件
  useEffect(() => {
    const handleStatus = (event: CustomEvent<StatusInfo>) => {
      setStatusInfo(event.detail);
      setTimeout(() => setStatusInfo(null), 3000);
    };

    const handleListUpdated = (event: CustomEvent<{ names: string[] }>) => {
      setRegisteredNames(event.detail.names);
    };

    window.addEventListener('face_register_status', handleStatus as EventListener);
    window.addEventListener('face_register_list_updated', handleListUpdated as EventListener);

    return () => {
      window.removeEventListener('face_register_status', handleStatus as EventListener);
      window.removeEventListener('face_register_list_updated', handleListUpdated as EventListener);
    };
  }, []);

  const handleModelLoaded = useCallback(() => {
    setModelReady(true);
  }, []);

  const handleModelError = useCallback((error: Error) => {
    console.error('[FaceRegisterScene] 模型加载失败:', error);
  }, []);

  const handleClearAll = useCallback(() => {
    clearAllFaceRecords();
    setRegisteredNames([]);
    setShowClearConfirm(false);
    setStatusInfo({ status: 'idle', message: '已清空所有人脸记录' });
    setTimeout(() => setStatusInfo(null), 3000);
  }, []);

  const getStatusColor = (status: StatusType) => {
    switch (status) {
      case 'registered':
      case 'recognized':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'no_face':
      case 'unknown':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      default:
        return 'bg-slate-700/50 text-slate-400 border-slate-600/30';
    }
  };

  return (
    <div className="h-screen w-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col">
      <SessionInitToast
        isConnected={isConnected}
        isInitialized={isInitialized}
        isVADReady={isVADReady}
      />

      {/* 顶部栏 */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50">
        <div className="flex items-center gap-3">
          <span className="text-3xl">👤</span>
          <div>
            <h1 className="text-xl font-bold text-white">人脸注册</h1>
            <p className="text-sm text-slate-400">Face Registration</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${isConnected && isInitialized ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700/50 text-slate-400'}`}>
            <div className={`w-2 h-2 rounded-full ${isConnected && isInitialized ? 'bg-emerald-400' : 'bg-slate-500'}`} />
            {isConnected && isInitialized ? '已连接' : '未连接'}
          </div>

          <button
            onClick={onExit}
            className="p-2 rounded-lg bg-slate-700/50 text-slate-400 hover:text-white hover:bg-slate-600 transition-all"
            title="退出场景"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="flex-1 flex gap-6 p-6 overflow-hidden">
        <div className="flex-1 flex flex-col gap-4">
          <div className="flex-1 relative">
            <CameraView onModelLoaded={handleModelLoaded} onModelError={handleModelError} showDetectionBox={true} />

            {statusInfo && (
              <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg border backdrop-blur-sm ${getStatusColor(statusInfo.status)}`}>
                <div className="flex items-center gap-2">
                  {statusInfo.status === 'registered' && <span>✅</span>}
                  {statusInfo.status === 'recognized' && <span>🎉</span>}
                  {statusInfo.status === 'no_face' && <span>😐</span>}
                  {statusInfo.status === 'unknown' && <span>❓</span>}
                  <span className="font-medium">{statusInfo.message}</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-center gap-6 py-4">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${userSpeaking ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-slate-800/50 text-slate-500'}`}>
              <div className={`w-3 h-3 rounded-full ${userSpeaking ? 'bg-blue-400 animate-pulse' : 'bg-slate-600'}`} />
              {userSpeaking ? '正在聆听...' : '等待语音'}
            </div>

            <div className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${isPlaying ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800/50 text-slate-500'}`}>
              <div className={`w-3 h-3 rounded-full ${isPlaying ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
              {isPlaying ? '正在播放...' : '等待响应'}
            </div>
          </div>
        </div>

        <div className="w-80 flex flex-col gap-4">
          <div className="bg-slate-800/50 rounded-2xl p-5 border border-slate-700/50">
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <span>💡</span>使用说明
            </h3>
            <ul className="space-y-2 text-sm text-slate-400">
              <li className="flex items-start gap-2">
                <span className="text-emerald-400">•</span>
                <span>说 <span className="text-emerald-400 font-medium">"我是XXX"</span> 注册人脸</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400">•</span>
                <span>说 <span className="text-blue-400 font-medium">"我是谁"</span> 识别身份</span>
              </li>
            </ul>
          </div>

          <div className="flex-1 bg-slate-800/50 rounded-2xl p-5 border border-slate-700/50 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <span>👥</span>已注册 ({registeredNames.length})
              </h3>
              {registeredNames.length > 0 && (
                <button onClick={() => setShowClearConfirm(true)} className="text-xs text-red-400 hover:text-red-300 transition-colors">清空</button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              {registeredNames.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <div className="text-4xl mb-2">📭</div>
                  <p>还没有注册任何人脸</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {registeredNames.map((name, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-lg">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-medium">
                        {name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-slate-200">{name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className={`px-4 py-3 rounded-xl border ${modelReady ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-amber-500/10 border-amber-500/30 text-amber-400'}`}>
            <div className="flex items-center gap-2 text-sm">
              <div className={`w-2 h-2 rounded-full ${modelReady ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
              {modelReady ? '人脸识别模型已就绪' : '模型加载中...'}
            </div>
          </div>
        </div>
      </main>

      <ToolStatusBar />
      <SubtitleDisplay text={subtitleText} progress={subtitleProgress} isPlaying={isPlaying} />

      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-2xl p-6 max-w-sm mx-4 border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-2">确认清空</h3>
            <p className="text-slate-400 mb-6">确定要清空所有已注册的人脸记录吗？</p>
            <div className="flex gap-3">
              <button onClick={() => setShowClearConfirm(false)} className="flex-1 px-4 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors">取消</button>
              <button onClick={handleClearAll} className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-500 transition-colors">确认清空</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FaceRegisterScene;