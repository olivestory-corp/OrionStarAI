/**
 * 主页面 - 使用新的组件架构
 */

'use client';

import React from 'react';
import Header from '@/components/Header';
import { ProjectProvider } from '@/contexts/ProjectContext';
import { WikiProvider } from '@/contexts/WikiContext';
import ProjectList from '@/components/project/ProjectList';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';

export default function Home() {
  const { authenticated, login } = useAuth();
  useLanguage();

  // 打字机效果状态
  const [typedText, setTypedText] = React.useState('');

  React.useEffect(() => {
    const targetText = 'Living Knowledge';
    let index = 0;
    // 延迟 500ms 开始打字
    const startDelay = setTimeout(() => {
      const timer = setInterval(() => {
        if (index < targetText.length) {
          setTypedText(targetText.slice(0, index + 1));
          index++;
        } else {
          clearInterval(timer);
        }
      }, 150); // 打字速度
      return () => clearInterval(timer);
    }, 500);

    return () => clearTimeout(startDelay);
  }, []);

  return (
    <div className={authenticated
      ? "min-h-screen bg-gray-50 dark:bg-gray-950 selection:bg-indigo-500 selection:text-white"
      : "min-h-screen bg-white dark:bg-[#020617] text-slate-900 dark:text-slate-300 selection:bg-cyan-500/30 selection:text-cyan-600 dark:selection:text-cyan-50 transition-colors duration-300"
    }>
      {/* Header */}
      <Header />

      {/* Main Content */}
      <main className="relative">
        {authenticated ? (
          // 已登录 - 显示项目列表
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-20">
             <ProjectProvider>
              <WikiProvider>
                <ProjectList />
              </WikiProvider>
            </ProjectProvider>
          </div>
        ) : (
          // 未登录 - 极客/科幻风格落地页 (适配 Light/Dark)
          <div className="relative min-h-[calc(100vh-64px)] flex flex-col justify-center overflow-hidden">

            {/* 背景特效：网格 + 聚光灯 */}
            <div className="absolute inset-0 z-0">
              {/* 基础网格 - Light: 浅灰网格 / Dark: 深灰网格 */}
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-[0.4] dark:opacity-[0.2]"></div>

              {/* 顶部蓝色辉光 - Light: 更淡 / Dark: 更亮 */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[400px] bg-indigo-500/10 dark:bg-indigo-500/20 blur-[100px] rounded-full mix-blend-multiply dark:mix-blend-screen pointer-events-none"></div>

              {/* 底部青色辉光 */}
              <div className="absolute bottom-0 right-0 w-[800px] h-[400px] bg-cyan-500/10 dark:bg-cyan-500/10 blur-[100px] rounded-full mix-blend-multiply dark:mix-blend-screen pointer-events-none"></div>
            </div>

            <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-12 lg:py-20">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">

                {/* 左侧：文案区域 */}
                <div className="text-center lg:text-left space-y-8">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100/80 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 text-cyan-600 dark:text-cyan-400 text-xs font-mono tracking-wider backdrop-blur-md shadow-sm">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                    </span>
                    AI NATIVE PRODUCTIVITY CENTER
                  </div>

                  <h1 className="text-5xl lg:text-7xl font-bold tracking-tight text-slate-900 dark:text-white leading-[1.1]">
                    Turn Code into <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 dark:from-cyan-400 dark:via-blue-500 dark:to-indigo-500 animate-gradient-x">
                      {typedText}
                    </span>
                    <span className="animate-blink text-cyan-500 dark:text-cyan-400 ml-1 font-light">|</span>
                  </h1>

                  <p className="text-lg text-slate-600 dark:text-slate-400 max-w-xl leading-relaxed border-l-2 border-slate-200 dark:border-slate-800 pl-6 mx-auto lg:mx-0">
                    DeepV-Ki 解析您的代码仓库，构建动态、可交互的知识库。
                    <br />
                    <span className="text-slate-400 dark:text-slate-500 text-sm mt-2 block font-mono">
                      {`// 支持 GitHub, GitLab, Bitbucket & 私有仓库`}
                    </span>
                  </p>

                  <div className="flex flex-wrap justify-center lg:justify-start gap-4 pt-4 lg:ml-6">
                    <button
                      onClick={login}
                      className="group relative px-8 py-4 bg-slate-900 dark:bg-cyan-500 hover:bg-slate-800 dark:hover:bg-cyan-400 text-white dark:text-slate-950 font-bold rounded-lg transition-all duration-200 hover:shadow-lg dark:hover:shadow-[0_0_20px_rgba(6,182,212,0.5)] overflow-hidden cursor-pointer"
                    >
                      <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-shimmer"></div>
                      <span className="relative flex items-center gap-2">
                        立即体验
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </span>
                    </button>
                  </div>
                </div>

                {/* 右侧：视觉演示 (代码 -> 维基) */}
                <div className="relative hidden lg:block">
                  <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-indigo-500 rounded-2xl blur opacity-10 dark:opacity-20 group-hover:opacity-40 transition duration-1000"></div>
                  <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl dark:shadow-2xl backdrop-blur-xl">
                    {/* 模拟窗口头部 */}
                    <div className="flex items-center gap-2 mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
                      <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50"></div>
                      <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50"></div>
                      <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50"></div>
                      <div className="ml-4 text-xs text-slate-400 dark:text-slate-500 font-mono">deepvki_engine.py — Analysis</div>
                    </div>

                    {/* 模拟内容：左侧代码，右侧文档 */}
                    <div className="grid grid-cols-2 gap-6">
                      {/* 代码块 - 保持深色模式的 IDE 风格，因为 IDE 通常是深色的 */}
                      <div className="space-y-2 font-mono text-xs opacity-90 bg-slate-50 dark:bg-transparent p-2 rounded">
                        <div className="text-slate-500"># Analyzing repository structure</div>
                        <div className="text-purple-600 dark:text-purple-400">class <span className="text-yellow-600 dark:text-yellow-300">WikiGenerator</span>:</div>
                        <div className="pl-4 text-cyan-600 dark:text-cyan-300">def <span className="text-blue-600 dark:text-blue-300">analyze_code</span>(self):</div>
                        <div className="pl-8 text-slate-500 dark:text-slate-300">&quot;&quot;&quot;Extracts logic patterns&quot;&quot;&quot;</div>
                        <div className="pl-8 text-slate-600 dark:text-slate-400">nodes = self.parse_ast()</div>
                        <div className="pl-8 text-slate-600 dark:text-slate-400">return <span className="text-green-600 dark:text-green-400">Graph(nodes)</span></div>

                        <div className="h-16"></div>

                        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-600 mt-4">
                          <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse"></div>
                          Processing...
                        </div>
                      </div>

                      {/* 转换箭头 */}
                      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center justify-center">
                        <div className="w-12 h-12 bg-white dark:bg-slate-950 border border-slate-200 dark:border-cyan-500/30 rounded-full flex items-center justify-center shadow-lg dark:shadow-[0_0_15px_rgba(6,182,212,0.3)]">
                          <svg className="w-6 h-6 text-cyan-500 dark:text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                        </div>
                      </div>

                      {/* 文档块 */}
                      <div className="bg-slate-100 dark:bg-slate-800/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700/50">
                        <div className="h-2 w-24 bg-slate-300 dark:bg-slate-600 rounded mb-3"></div>
                        <div className="h-2 w-16 bg-slate-300 dark:bg-slate-700 rounded mb-6"></div>

                        <div className="space-y-2">
                          <div className="h-1.5 w-full bg-slate-300/50 dark:bg-slate-700/50 rounded"></div>
                          <div className="h-1.5 w-5/6 bg-slate-300/50 dark:bg-slate-700/50 rounded"></div>
                          <div className="h-1.5 w-4/6 bg-slate-300/50 dark:bg-slate-700/50 rounded"></div>
                        </div>

                        <div className="mt-4 p-2 bg-white dark:bg-slate-900/50 rounded border border-slate-200 dark:border-slate-700/30">
                          <div className="flex justify-center">
                            <div className="w-8 h-8 border-2 border-slate-300 dark:border-slate-600 rounded-full"></div>
                          </div>
                          <div className="flex justify-center mt-2">
                            <div className="h-4 w-0.5 bg-slate-300 dark:bg-slate-600"></div>
                          </div>
                          <div className="flex justify-center gap-4">
                            <div className="w-6 h-6 border-2 border-slate-300 dark:border-slate-600 rounded"></div>
                            <div className="w-6 h-6 border-2 border-slate-300 dark:border-slate-600 rounded"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 特性网格 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-24">
                {[
                  {
                    title: "Neural Analysis",
                    desc: "Deep understanding of code logic using advanced LLMs.",
                    icon: (
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                      </svg>
                    ),
                    color: "text-purple-600 dark:text-purple-400",
                    border: "hover:border-purple-500/50"
                  },
                  {
                    title: "Vector Search",
                    desc: "Semantic code retrieval with RAG technology.",
                    icon: (
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    ),
                    color: "text-cyan-600 dark:text-cyan-400",
                    border: "hover:border-cyan-500/50"
                  },
                  {
                    title: "Auto-Diagrams",
                    desc: "Generates Mermaid flowcharts & sequence diagrams.",
                    icon: (
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                      </svg>
                    ),
                    color: "text-blue-600 dark:text-blue-400",
                    border: "hover:border-blue-500/50"
                  }
                ].map((feature, idx) => (
                  <div key={idx} className={`group p-6 rounded-xl bg-white/60 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 backdrop-blur-sm transition-all duration-300 ${feature.border} hover:bg-white/80 dark:hover:bg-slate-800/60 shadow-sm hover:shadow-md dark:shadow-none`}>
                    <div className={`w-12 h-12 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-center mb-4 ${feature.color} group-hover:scale-110 transition-transform duration-300`}>
                      {feature.icon}
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 font-mono">{feature.title}</h3>
                    <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                      {feature.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer - 极简风格 */}
      {!authenticated && (
        <footer className="border-t border-slate-200 dark:border-slate-900 bg-white dark:bg-[#020617] text-slate-500 dark:text-slate-600 py-8">
          <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4 text-xs font-mono">
            <p>DEEPVKI_SYSTEM_V2.0 // ONLINE</p>
            <p>© {new Date().getFullYear()} DeepV-Ki Team AI CENTER</p>
          </div>
        </footer>
      )}
    </div>
  );
}
