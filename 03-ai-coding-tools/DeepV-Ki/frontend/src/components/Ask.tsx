'use client';

import React, {useState, useRef, useEffect, useCallback} from 'react';
import Markdown from './Markdown';
import RepoInfo from '@/types/repoinfo';
import getRepoUrl from '@/utils/getRepoUrl';
import ModelSelectionModal from './ModelSelectionModal';
import { closeWebSocket, ChatCompletionRequest } from '@/utils/websocketClient';
import { FiCopy, FiMaximize2, FiMinimize2 } from 'react-icons/fi';

interface Model {
  id: string;
  name: string;
}

interface Provider {
  id: string;
  name: string;
  models: Model[];
  supportsCustomModel?: boolean;
}

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface AskProps {
  repoInfo: RepoInfo;
  provider?: string;
  model?: string;
  isCustomModel?: boolean;
  customModel?: string;
  language?: string;
  onRef?: (ref: { clearConversation: () => void }) => void;
  onCollapse?: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

const Ask: React.FC<AskProps> = ({
  repoInfo,
  provider = '',
  model = '',
  isCustomModel = false,
  customModel = '',
  language = 'en',
  onRef,
  isExpanded = false,
  onToggleExpand
}) => {
  const [question, setQuestion] = useState('');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [deepResearch, setDeepResearch] = useState(false);
  const [loadingPhraseIndex, setLoadingPhraseIndex] = useState(0);

  const loadingPhrases = [
    '正在启动...',
    '✨ 大脑高速运转中...',
    '🔍 仔细分析代码...',
    '⚡ 迅速处理信息...',
    '🎯 精准定位问题...',
    '🚀 加速计算中...',
    '💡 灵感闪现中...',
    '🧠 深度学习中...',
    '🔬 研究中...',
    '📚 查阅资料中...',
  ];

  // Model selection state
  const [selectedProvider, setSelectedProvider] = useState(provider);
  const [selectedModel, setSelectedModel] = useState(model);
  const [isCustomSelectedModel, setIsCustomSelectedModel] = useState(isCustomModel);
  const [customSelectedModel, setCustomSelectedModel] = useState(customModel);
  const [isModelSelectionModalOpen, setIsModelSelectionModalOpen] = useState(false);
  const [isComprehensiveView, setIsComprehensiveView] = useState(true);

  // Research navigation state
  const [conversationHistory, setConversationHistory] = useState<Message[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const responseRef = useRef<HTMLDivElement>(null);
  const providerRef = useRef(provider);
  const modelRef = useRef(model);
  const webSocketRef = useRef<WebSocket | null>(null);

  // Focus input on component mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Rotate loading phrases every 2 seconds
  useEffect(() => {
    if (!isLoading) return;

    const interval = setInterval(() => {
      setLoadingPhraseIndex((prev) => (prev + 1) % loadingPhrases.length);
    }, 2000);

    return () => clearInterval(interval);
  }, [isLoading, loadingPhrases.length]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) return;

    const resizeTextarea = () => {
      // Reset height to auto to get the correct scrollHeight
      textarea.style.height = 'auto';
      // Set height to scrollHeight (content height)
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    };

    // Initial resize
    resizeTextarea();

    // Listen to input changes
    textarea.addEventListener('input', resizeTextarea);

    return () => {
      textarea.removeEventListener('input', resizeTextarea);
    };
  }, []);

  // 定义 clearConversation 为 useCallback，这样才能在依赖数组中使用
  const clearConversation = useCallback(() => {
    setQuestion('');
    setResponse('');
    setConversationHistory([]);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Expose clearConversation method to parent component
  useEffect(() => {
    if (onRef) {
      onRef({ clearConversation });
    }
  }, [onRef, clearConversation]);

  // Scroll to bottom of response when it changes
  useEffect(() => {
    if (responseRef.current) {
      responseRef.current.scrollTop = responseRef.current.scrollHeight;
    }
  }, [response]);

  // Close WebSocket when component unmounts
  useEffect(() => {
    const wsRef = webSocketRef.current;
    return () => {
      closeWebSocket(wsRef);
    };
  }, []);

  useEffect(() => {
    providerRef.current = provider;
    modelRef.current = model;
  }, [provider, model]);

  useEffect(() => {
    const fetchModel = async () => {
      try {
        setIsLoading(true);

        const response = await fetch('/api/models/config');
        if (!response.ok) {
          throw new Error(`Error fetching model configurations: ${response.status}`);
        }

        const data = await response.json();

        // use latest provider/model ref to check
        if(providerRef.current == '' || modelRef.current== '') {
          setSelectedProvider(data.defaultProvider);

          // Find the default provider and set its default model
          const selectedProvider = data.providers.find((p:Provider) => p.id === data.defaultProvider);
          if (selectedProvider && selectedProvider.models.length > 0) {
            setSelectedModel(selectedProvider.models[0].id);
          }
        } else {
          setSelectedProvider(providerRef.current);
          setSelectedModel(modelRef.current);
        }
      } catch (err) {
        console.error('Failed to fetch model configurations:', err);
      } finally {
        setIsLoading(false);
      }
    };
    if(provider == '' || model == '') {
      fetchModel()
    }
  }, [provider, model]);



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!question.trim() || isLoading) return;

    sendMessage();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // 回车发送，Shift+Enter 换行
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!question.trim() || isLoading) return;
      sendMessage();
    }
    // Shift+Enter 会自动换行，不需要阻止默认行为
  };

  const sendMessage = async () => {
    if (!question.trim() || isLoading) return;

    setIsLoading(true);
    setResponse('');

    try {
      // Prepare the content, adding [DEEP RESEARCH] tag if enabled
      let contentToSend = question;
      if (deepResearch) {
        contentToSend = `[DEEP RESEARCH] ${contentToSend}`;
      }

      // Construct the full message history including the current question
      const messagesToSend: Message[] = [
        ...conversationHistory,
        { role: 'user', content: contentToSend }
      ];

      const requestBody: ChatCompletionRequest = {
        repo_url: getRepoUrl(repoInfo),
        type: repoInfo.type,
        messages: messagesToSend,
        provider: selectedProvider,
        model: isCustomSelectedModel ? customSelectedModel : selectedModel,
        language: language
      };

      if (repoInfo?.token) {
        requestBody.token = repoInfo.token;
      }

      closeWebSocket(webSocketRef.current);

      const apiResponse = await fetch(`/api/chat/completions/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!apiResponse.ok) {
        throw new Error(`API error: ${apiResponse.status}`);
      }

      const reader = apiResponse.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('Failed to get response reader');
      }

      let fullResponse = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        fullResponse += chunk;
        setResponse(fullResponse);
      }

      setConversationHistory([...conversationHistory, { role: 'user', content: question }, { role: 'assistant', content: fullResponse }]);
      setQuestion('');
    } catch (error) {
      console.error('Error during API call:', error);
      setResponse('错误：获取响应失败。请重试。');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-gradient-to-b from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 shadow-2xl shadow-black/10">
      {/* Header */}
      <div className="flex-shrink-0 px-5 py-4 border-b border-slate-200/50 dark:border-slate-700/50 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md">
        <div className="flex items-center justify-between gap-3">
          {/* Logo + Title */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-md flex-shrink-0">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" clipRule="evenodd" d="M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12ZM13.4881 6.44591C13.8882 6.55311 14.1256 6.96437 14.0184 7.36447L11.4302 17.0237C11.323 17.4238 10.9117 17.6613 10.5116 17.5541C10.1115 17.4468 9.8741 17.0356 9.98131 16.6355L12.5695 6.97624C12.6767 6.57614 13.088 6.3387 13.4881 6.44591ZM14.9697 8.46967C15.2626 8.17678 15.7374 8.17678 16.0303 8.46967L16.2387 8.67801C16.874 9.3133 17.4038 9.84308 17.7678 10.3202C18.1521 10.8238 18.4216 11.3559 18.4216 12C18.4216 12.6441 18.1521 13.1762 17.7678 13.6798C17.4038 14.1569 16.874 14.6867 16.2387 15.322L16.0303 15.5303C15.7374 15.8232 15.2626 15.8232 14.9697 15.5303C14.6768 15.2374 14.6768 14.7626 14.9697 14.4697L15.1412 14.2981C15.8229 13.6164 16.2797 13.1574 16.5753 12.7699C16.8577 12.3998 16.9216 12.1843 16.9216 12C16.9216 11.8157 16.8577 11.6002 16.5753 11.2301C16.2797 10.8426 15.8229 10.3836 15.1412 9.70191L14.9697 9.53033C14.6768 9.23744 14.6768 8.76257 14.9697 8.46967ZM7.96986 8.46967C8.26275 8.17678 8.73762 8.17678 9.03052 8.46967C9.32341 8.76257 9.32341 9.23744 9.03052 9.53033L8.85894 9.70191C8.17729 10.3836 7.72052 10.8426 7.42488 11.2301C7.14245 11.6002 7.07861 11.8157 7.07861 12C7.07861 12.1843 7.14245 12.3998 7.42488 12.7699C7.72052 13.1574 8.17729 13.6164 8.85894 14.2981L9.03052 14.4697C9.32341 14.7626 9.32341 15.2374 9.03052 15.5303C8.73762 15.8232 8.26275 15.8232 7.96986 15.5303L7.76151 15.322C7.12617 14.6867 6.59638 14.1569 6.23235 13.6798C5.84811 13.1762 5.57861 12.6441 5.57861 12C5.57861 11.3559 5.84811 10.8238 6.23235 10.3202C6.59638 9.84308 7.12617 9.31331 7.76151 8.67801L7.96986 8.46967Z"/>
              </svg>
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Ask</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">智能代码分析</p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {onToggleExpand && (
              <button
                type="button"
                onClick={onToggleExpand}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors hidden lg:block"
                title={isExpanded ? "收起面板" : "展开面板"}
              >
                {isExpanded ? (
                  <FiMinimize2 className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                ) : (
                  <FiMaximize2 className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content area - flex container for proper scrolling */}
      <div className="flex flex-col flex-1 overflow-hidden min-h-0">
        {/* Response display - scrollable area */}
        <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0" ref={responseRef}>
          {conversationHistory.length === 0 && !isLoading && !response ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-xs">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-7 h-7 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white mb-1">有任何问题都可以问我</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">分析代码、理解架构、探索功能...</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {conversationHistory.map((msg, index) => (
                <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[90%] rounded-2xl px-4 py-3 ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-tr-none'
                      : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-tl-none shadow-sm'
                  }`}>
                    {msg.role === 'user' ? (
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    ) : (
                      <div className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                        <style>{`
                          .ask-markdown-container article {
                            font-size: 0.75rem;
                            line-height: 1.4;
                          }
                          .ask-markdown-container p {
                            margin: 0.5rem 0;
                          }
                          .ask-markdown-container h1,
                          .ask-markdown-container h2,
                          .ask-markdown-container h3,
                          .ask-markdown-container h4,
                          .ask-markdown-container h5,
                          .ask-markdown-container h6 {
                            font-size: 0.875rem;
                            margin: 0.75rem 0 0.5rem 0;
                          }
                          .ask-markdown-container ul,
                          .ask-markdown-container ol {
                            margin: 0.5rem 0;
                            padding-left: 1rem;
                          }
                          .ask-markdown-container li {
                            margin: 0.25rem 0;
                          }
                          .ask-markdown-container code {
                            font-size: 0.6rem;
                            padding: 0.15rem 0.3rem;
                            border-radius: 0.25rem;
                          }
                          .ask-markdown-container pre {
                            margin: 0.375rem 0;
                            padding: 0.375rem;
                            border-radius: 0.375rem;
                            overflow: auto;
                            max-height: 300px;
                          }
                          .ask-markdown-container pre code {
                            font-size: 0.55rem !important;
                            line-height: 1.3;
                            padding: 0 !important;
                          }
                          .ask-markdown-container blockquote {
                            font-size: 0.75rem;
                            margin: 0.5rem 0;
                            padding-left: 0.75rem;
                          }
                          .ask-markdown-container table {
                            font-size: 0.7rem;
                            display: block;
                            overflow-x: auto;
                          }
                          .ask-markdown-container table th,
                          .ask-markdown-container table td {
                            padding: 0.25rem 0.4rem;
                          }
                        `}</style>
                        <div className="ask-markdown-container">
                          <Markdown content={msg.content} />
                        </div>
                        {/* 复制按钮 */}
                        <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(msg.content).then(() => {
                                // 这里可以添加一个临时的复制成功提示，但为了简化，暂时不做
                              });
                            }}
                            className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                            title="复制回复内容"
                          >
                            <FiCopy className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* 当前正在生成的回复 */}
              {isLoading && (
                <div className="space-y-6">
                  {/* 显示用户刚才发送的问题（如果还没加入历史记录） */}
                  {/* 注意：sendMessage 中是先请求再更新 history，所以这里不需要重复显示用户问题，
                      因为我们会在请求开始前把用户问题加入 history 吗？
                      查看 sendMessage 逻辑：
                      setConversationHistory([...conversationHistory, { role: 'user', content: question }, { role: 'assistant', content: fullResponse }]);
                      是在请求结束后才更新 history。
                      所以请求过程中，history 里没有最新的问题。
                      我们需要在请求开始时就把问题加入 history，或者在这里临时显示。
                  */}
                  <div className="flex justify-end">
                    <div className="max-w-[90%] rounded-2xl px-4 py-3 bg-blue-600 text-white rounded-tr-none">
                      <p className="text-sm whitespace-pre-wrap">{question}</p>
                    </div>
                  </div>

                  <div className="flex justify-start">
                    <div className="max-w-[90%] rounded-2xl px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-tl-none shadow-sm">
                      {response ? (
                        <div className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                          <div className="ask-markdown-container">
                            <Markdown content={response} />
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 py-2">
                          <div className="flex gap-1.5">
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                            <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                            <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                          </div>
                          <span className="text-xs text-slate-500 dark:text-slate-400 animate-pulse">
                            {loadingPhrases[loadingPhraseIndex]}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Deep Research toggle */}
        <div className="flex flex-col px-5 py-3 border-b border-slate-200/50 dark:border-slate-700/50 flex-shrink-0">
          <div className="flex items-center gap-2">
            <label className="flex items-center cursor-pointer gap-2">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={deepResearch}
                  onChange={() => setDeepResearch(!deepResearch)}
                  className="sr-only"
                />
                <div className={`w-9 h-5 rounded-full transition-all ${deepResearch ? 'bg-gradient-to-r from-purple-500 to-purple-600' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
                <div className={`absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${deepResearch ? 'translate-x-4' : ''}`}></div>
              </div>
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">深度研究</span>
            </label>
          </div>
          {deepResearch && (
            <p className="mt-1.5 text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed">
              使用更复杂的思维链（Chain of Thought）和更严谨的分析策略来处理您的问题，适合处理复杂、宏大的技术问题。
            </p>
          )}
        </div>

        {/* Input form - at the bottom */}
        <form onSubmit={handleSubmit} className="space-y-3 px-5 py-4 border-t border-slate-200/50 dark:border-slate-700/50 bg-white/20 dark:bg-slate-900/20 backdrop-blur-sm flex-shrink-0">
          <div className="relative group">
            {/* 背景光晕效果 */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-xl blur-lg opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 pointer-events-none" />

            <div className="relative bg-white dark:bg-slate-800 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 focus-within:border-blue-500 dark:focus-within:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md focus-within:shadow-lg focus-within:shadow-blue-500/20">
              <textarea
                ref={inputRef}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="询问关于这个代码库的任何问题..."
                disabled={isLoading}
                rows={3}
                className="w-full px-4 py-3 pr-12 bg-transparent text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none text-sm resize-none overflow-y-auto disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={isLoading || !question.trim()}
                className={`absolute right-3 top-3 p-2 rounded-lg transition-all duration-200 ${
                  isLoading || !question.trim()
                    ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                    : 'text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 hover:scale-110 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                }`}
                title={isLoading ? '正在处理...' : '发送 (Ctrl+Enter)'}
              >
                {isLoading ? (
                  <svg className="w-5 h-5 animate-spin" fill="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.3" />
                    <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M16.6915026,12.4744748 L3.50612381,13.2599618 C3.19218622,13.2599618 3.03521743,13.4170592 3.03521743,13.5741566 L1.15159189,20.0151496 C0.8376543,20.8006365 0.99,21.89 1.77946707,22.52 C2.41,22.99 3.50612381,23.1 4.13399899,22.8429026 L21.714504,14.0454487 C22.6563168,13.5741566 23.1272231,12.6315722 22.9702544,11.6889879 L4.13399899,1.16346278 C3.34915502,0.9 2.40734225,1.00636533 1.77946707,1.4776575 C0.994623095,2.10604706 0.837654326,3.0486314 1.15159189,3.99721575 L3.03521743,10.4382088 C3.03521743,10.5953061 3.34915502,10.7524035 3.50612381,10.7524035 L16.6915026,11.5378905 C16.6915026,11.5378905 17.1624089,11.5378905 17.1624089,12.0091827 C17.1624089,12.4744748 16.6915026,12.4744748 16.6915026,12.4744748 Z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Model Selection Modal */}
      <ModelSelectionModal
        isOpen={isModelSelectionModalOpen}
        onClose={() => setIsModelSelectionModalOpen(false)}
        provider={selectedProvider}
        setProvider={setSelectedProvider}
        model={selectedModel}
        setModel={setSelectedModel}
        isCustomModel={isCustomSelectedModel}
        setIsCustomModel={setIsCustomSelectedModel}
        customModel={customSelectedModel}
        setCustomModel={setCustomSelectedModel}
        isComprehensiveView={isComprehensiveView}
        setIsComprehensiveView={setIsComprehensiveView}
        showFileFilters={false}
        onApply={() => console.log('Model selected')}
        showWikiType={false}
        authRequired={false}
        isAuthLoading={false}
      />
    </div>
  );
};

export default Ask;