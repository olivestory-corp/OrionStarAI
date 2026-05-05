import React from 'react';
import { getAssetUrl } from '../sdk/utils';

// OpenAI Realtime API 支持的音色 (完整列表 11个)
const OPENAI_VOICES = [
  { id: 'alloy', name: 'Alloy', description: '中性、平衡' },
  { id: 'ash', name: 'Ash', description: '柔和、对话式' },
  { id: 'ballad', name: 'Ballad', description: '温暖、引人入胜' },
  { id: 'coral', name: 'Coral', description: '清晰、表现力强' },
  { id: 'echo', name: 'Echo', description: '温暖、自然' },
  { id: 'fable', name: 'Fable', description: '富有表现力、戏剧性' },
  { id: 'nova', name: 'Nova', description: '年轻、活泼' },
  { id: 'onyx', name: 'Onyx', description: '深沉、权威' },
  { id: 'sage', name: 'Sage', description: '权威、专业' },
  { id: 'shimmer', name: 'Shimmer', description: '活力、富有表现力' },
  { id: 'verse', name: 'Verse', description: '自然、对话流畅' },
] as const;

export type OpenAIVoice = typeof OPENAI_VOICES[number]['id'];

interface HomePageProps {
  selectedVoice: string;
  onVoiceChange: (voice: string) => void;
  onConnect: () => void;
  isLoading: boolean;
  error: string | null;
}

export const HomePage: React.FC<HomePageProps> = ({
  selectedVoice,
  onVoiceChange,
  onConnect,
  isLoading,
  error,
}) => {
  // 当前模型可用的音色列表
  const availableVoices = OPENAI_VOICES;

  // 手动点击开始
  const handleStartClick = () => {
    onConnect();
  };

  return (
    <div className="fixed inset-0 bg-slate-950 flex items-center justify-center overflow-hidden font-sans select-none">
      {/* 背景氛围 */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#1e293b_0%,_#020617_100%)]" />
      <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-cyan-900/10 to-transparent pointer-events-none" />

      <div className="relative z-10 w-full max-w-4xl px-6 flex flex-col items-center gap-8 sm:gap-12">

        {/* 1. 顶部 Logo 区域 (缩小 20%) */}
        <div className="flex flex-col items-center gap-3 animate-fade-in-down">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-slate-900/50 rounded-2xl flex items-center justify-center border border-slate-700 shadow-2xl backdrop-blur-xl">
            <img src={getAssetUrl('logo.svg')} alt="Logo" className="w-10 h-10 sm:w-12 sm:h-12" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            AgentOS <span className="text-cyan-400">Live</span>
          </h1>
        </div>

        {/* 2. 模型信息 (仅显示 OpenAI) */}
        <div className="flex flex-row gap-3 sm:gap-6 w-full justify-center animate-fade-in-up">
          <div
            className="group relative flex-1 max-w-[220px] h-32 sm:h-40 rounded-xl border-2 bg-slate-800/80 border-cyan-500 shadow-[0_0_25px_rgba(6,182,212,0.3)] flex flex-col items-center justify-center gap-3 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent opacity-100" />

            <img
              src={getAssetUrl('openai-logo.svg')}
              alt="OpenAI"
              className="w-10 h-10 sm:w-12 sm:h-12 transition-transform duration-300 group-hover:scale-110 invert brightness-0"
            />
            <div className="flex flex-col items-center z-10">
              <span className="text-base sm:text-lg font-bold text-white">OpenAI</span>
              <span className="text-[10px] sm:text-xs text-slate-500">GPT-Realtime</span>
            </div>
          </div>
        </div>

        {/* 3. 音色选择 */}
        <div className="w-full max-w-2xl animate-fade-in-up">
          <div className="flex items-center justify-center gap-2 mb-3">
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            <span className="text-sm text-slate-400">选择音色 ({availableVoices.length})</span>
          </div>
          <div className="grid gap-1.5 grid-cols-4">
            {availableVoices.map((voice) => (
              <button
                key={voice.id}
                onClick={() => onVoiceChange(voice.id)}
                className={`relative px-2 py-1.5 rounded-lg border transition-all duration-200 text-center
                  ${selectedVoice === voice.id
                    ? 'bg-slate-800/80 border-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                    : 'bg-slate-900/40 border-slate-700 hover:bg-slate-800/60 hover:border-slate-500'
                  }`}
              >
                <div className={`text-xs font-medium ${selectedVoice === voice.id ? 'text-white' : 'text-slate-400'}`}>
                  {voice.name}
                </div>
                <div className="text-[9px] text-slate-500 truncate">
                  {voice.description}
                </div>
                {selectedVoice === voice.id && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-cyan-500 rounded-full flex items-center justify-center">
                    <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 4. 启动按钮 (缩小 20%) */}
        <div className="w-full max-w-sm flex flex-col gap-3 animate-fade-in-up delay-100">
          <button
            onClick={handleStartClick}
            disabled={isLoading}
            className="relative w-full h-14 sm:h-16 bg-slate-800 hover:bg-slate-700 rounded-full overflow-hidden group transition-all duration-300 border border-slate-600 hover:border-cyan-400 shadow-lg active:scale-95 flex items-center justify-center gap-3"
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span className="text-lg font-bold text-white">正在启动...</span>
              </>
            ) : (
              <>
                <span className="text-lg sm:text-xl font-bold text-white group-hover:text-cyan-300 transition-colors">
                  立即体验
                </span>
                <svg className="w-5 h-5 text-white group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </>
            )}
          </button>

          {/* 错误提示 */}
          {error && (
            <div className="text-center text-red-400 text-xs bg-red-900/20 py-1.5 rounded-lg border border-red-900/50 animate-shake">
              ⚠️ {error}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fade-in-down {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-down { animation: fade-in-down 0.8s ease-out forwards; }
        .animate-fade-in-up { animation: fade-in-up 0.8s ease-out forwards; }
        .delay-100 { animation-delay: 0.1s; }
      `}</style>
    </div>
  );
};
