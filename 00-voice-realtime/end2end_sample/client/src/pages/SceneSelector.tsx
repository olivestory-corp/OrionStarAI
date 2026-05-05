/**
 * SceneSelector - 场景选择页 (横屏自适应布局)
 */

import React from 'react';
import { SCENES, SceneConfig } from '../scenes';

interface SceneSelectorProps {
  onSelectScene: (scene: SceneConfig) => void;
  onBack: () => void;
}

export function SceneSelector({ onSelectScene, onBack }: SceneSelectorProps) {
  return (
    <div className="h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="px-6 py-3 flex items-center justify-between border-b border-slate-700/50 shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span>Back</span>
        </button>

        <div className="flex items-center gap-4">
          <div className="text-white font-medium">Select Scene</div>
          <div className="flex items-center gap-2">
            <img
              src={`${process.env.PUBLIC_URL}/openai-logo.svg`}
              alt="OpenAI"
              className="w-5 h-5"
              style={{ filter: 'brightness(0) invert(1)' }}
            />
            <span className="text-slate-400 text-sm">
              GPT-4o Realtime
            </span>
          </div>
        </div>
      </header>

      {/* Content - 横屏布局，一排5个 */}
      <main className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        <div className="grid grid-cols-5 gap-4 max-w-5xl">
          {SCENES.map((scene) => (
            <button
              key={scene.id}
              onClick={() => scene.enabled && onSelectScene(scene)}
              disabled={!scene.enabled}
              className={`
                relative w-40 h-32 rounded-xl p-3 flex flex-col items-center justify-center gap-2
                transition-all duration-200 group
                ${scene.enabled
                  ? 'bg-slate-800/80 hover:bg-slate-700/80 hover:scale-105 cursor-pointer border border-slate-700 hover:border-slate-500'
                  : 'bg-slate-800/40 cursor-not-allowed border border-slate-800'
                }
              `}
            >
              {/* Badge */}
              {scene.badge && (
                <span className={`
                  absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium
                  ${scene.badge === 'Beta' ? 'bg-purple-500/20 text-purple-300' : 'bg-slate-600/50 text-slate-400'}
                `}>
                  {scene.badge}
                </span>
              )}

              {/* Icon */}
              <span className={`text-3xl ${!scene.enabled && 'opacity-50 grayscale'}`}>
                {scene.icon}
              </span>

              {/* Name */}
              <span className={`text-sm font-medium ${scene.enabled ? 'text-white' : 'text-slate-500'}`}>
                {scene.name}
              </span>

              {/* Description - Show on hover */}
              {scene.enabled && (
                <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900/90 px-2 py-1 rounded z-10">
                  {scene.description}
                </span>
              )}
            </button>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-2 text-center text-slate-500 text-xs border-t border-slate-700/50 shrink-0">
        <span>AgentOS 2.0 Live · Powered by </span>
        <span className="text-slate-400">OpenAI</span>
      </footer>
    </div>
  );
}

export default SceneSelector;
