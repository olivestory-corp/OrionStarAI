/**
 * useAgentSDK - React Hook 封装
 *
 * 薄封装层，将 AgentSDK 事件转换为 React 状态
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AgentSDK, AgentSDKConfig, AgentSDKState } from '../AgentSDK';
import { ToolCall, ChatMessage, ModelType, ToolDeclaration } from '../types';

/** 工具执行上下文 */
export interface ToolExecutionContext {
  toolCall: ToolCall;
  sendMessage: (msg: any) => void;
  turnId: number;
}

export interface UseAgentSDKOptions extends Omit<AgentSDKConfig, 'tools'> {
  /** 是否自动初始化 */
  autoInit?: boolean;
  /** 工具列表（静态） */
  tools?: ToolDeclaration[];
  /** 工具获取函数（动态，优先于 tools） */
  getTools?: () => Promise<ToolDeclaration[]>;
  /** 工具执行函数 */
  executeToolCall?: (
    toolCall: ToolCall,
    sendMessage: (msg: any) => void,
    turnId: number
  ) => Promise<void>;
}

/** 音频统计 */
export interface AudioStats {
  totalDurationMs: number;
  totalBytes: number;
  packetCount: number;
}

/** 导航路径 */
export interface NavigationPath {
  from: string;
  to: string;
  duration_ms?: number;
}

/** UI 内容 */
export interface UIContent {
  html: string;
  description?: string;
}

/** 机器人状态 */
export interface RobotStatus {
  status: string;
  destination?: string;
}

export interface UseAgentSDKReturn {
  /** AgentSDK 实例 */
  agent: AgentSDK | null;
  /** 当前状态 */
  state: AgentSDKState;
  /** 消息历史 */
  messages: ChatMessage[];
  /** 当前用户输入（实时转写） */
  currentUserMessage: string;
  /** 当前助手回复（流式） */
  currentAssistantMessage: string;

  // 扩展状态
  /** 音频统计 */
  audioStats: AudioStats;
  /** 是否正在生成 UI */
  isUiGenerating: boolean;
  /** 导航路径 */
  navigationPath: NavigationPath | null;
  /** 总费用 */
  totalCost: number;
  /** 选择的模型 */
  selectedModel: ModelType;
  /** UI 内容 (动态生成的 HTML) */
  uiContent: UIContent | null;
  /** 机器人状态 */
  robotStatus: string;

  // 便捷访问（从 state 解构）
  /** 是否已连接 */
  isConnected: boolean;
  /** 是否已初始化 */
  isInitialized: boolean;
  /** 用户是否在说话 */
  userSpeaking: boolean;
  /** 是否正在播放 */
  isPlaying: boolean;
  /** 是否静音 */
  isMuted: boolean;
  /** VAD 是否就绪 */
  isVADReady: boolean;
  /** 是否在监听 */
  isListening: boolean;
  /** 字幕文本 */
  subtitleText: string;
  /** 字幕进度 */
  subtitleProgress: number;

  // 操作方法
  /** 初始化 */
  initialize: () => Promise<void>;
  /** 连接 */
  connect: () => void;
  /** 断开连接 */
  disconnect: () => void;
  /** 发送文本 */
  sendText: (text: string, role?: 'user' | 'system') => void;
  /** 发送文本（带打断） - 别名 */
  sendTextWithInterrupt: (text: string, role?: 'user' | 'system') => void;
  /** 发送消息 - 别名 */
  sendMessage: (text: string) => void;
  /** 发送上下文信息（不触发LLM回复） */
  sendContext: (text: string) => void;
  /** 切换静音 */
  toggleMute: () => void;
  /** 设置音量 */
  setVolume: (volume: number) => void;
  /** 开始监听 */
  startListening: () => void;
  /** 停止监听 */
  stopListening: () => void;
  /** 停止音频 */
  stopAudio: () => void;
  /** 设置导航路径 */
  setNavigationPath: (path: NavigationPath | null) => void;
  /** 获取地点列表 */
  getPlaceList: () => Promise<any[]>;
  /** 清除 UI 内容 */
  clearUIContent: () => void;
  /** 导航 */
  navigate: (placeName: string) => Promise<void>;
  /** 停止导航 */
  stopNavigation: () => Promise<void>;
  /** 暂停 VAD */
  pauseVAD: () => void;
  /** 恢复 VAD */
  resumeVAD: () => void;
  /** PTT 开始 - 按住说话 */
  startPTT: () => void;
  /** PTT 结束 - 松开发送 */
  stopPTT: () => void;
}

const INITIAL_STATE: AgentSDKState = {
  connectionStatus: 'disconnected',
  isReady: false,
  userSpeaking: false,
  isListening: false,
  isVADReady: false,
  isPlaying: false,
  isMuted: false,
  volume: 1.0,
  currentTurnId: 0,
  subtitleText: '',
  subtitleProgress: 0,
  robotState: null
};

const INITIAL_AUDIO_STATS: AudioStats = {
  totalDurationMs: 0,
  totalBytes: 0,
  packetCount: 0
};

export function useAgentSDK(options: UseAgentSDKOptions): UseAgentSDKReturn {
  const agentRef = useRef<AgentSDK | null>(null);
  const [state, setState] = useState<AgentSDKState>(INITIAL_STATE);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentUserMessage, setCurrentUserMessage] = useState('');
  const [currentAssistantMessage, setCurrentAssistantMessage] = useState('');

  // 扩展状态
  const [audioStats, setAudioStats] = useState<AudioStats>(INITIAL_AUDIO_STATS);
  const [isUiGenerating, setIsUiGenerating] = useState(false);
  const [navigationPath, setNavigationPath] = useState<NavigationPath | null>(null);
  const [totalCost, setTotalCost] = useState(0);
  const [uiContent, setUIContent] = useState<UIContent | null>(null);
  const [robotStatus, setRobotStatus] = useState('');

  // 初始化 AgentSDK
  useEffect(() => {
    const initAgent = async () => {
      // 如果有 getTools 函数，先获取工具列表
      let tools = options.tools;
      if (options.getTools) {
        try {
          tools = await options.getTools();
          console.log('[useAgentSDK] 动态加载工具:', tools?.length);
        } catch (e) {
          console.error('[useAgentSDK] 获取工具列表失败:', e);
        }
      }

      const agentConfig: AgentSDKConfig = {
        ...options,
        tools,
      };
      const agent = new AgentSDK(agentConfig);
      agentRef.current = agent;

    // 状态变化
    agent.on('state_change', (newState: AgentSDKState) => {
      setState(newState);
    });

    // 文本输出
    agent.on('text_output', ({ text, isFinal }: { text: string; isFinal: boolean }) => {
      if (!isFinal) {
        setCurrentAssistantMessage(prev => prev + text);
      }
    });

    // 转写
    agent.on('transcription', ({ text }: { text: string }) => {
      setCurrentUserMessage(prev => prev + text);
    });

    // Turn 完成
    agent.on('turn_complete', () => {
      // 保存消息
      setCurrentUserMessage(current => {
        if (current.trim()) {
          setMessages(prev => [...prev, { role: 'user', text: current.trim() }]);
        }
        return '';
      });

      setCurrentAssistantMessage(current => {
        if (current.trim()) {
          setMessages(prev => [...prev, { role: 'assistant', text: current.trim() }]);
        }
        return '';
      });
    });

    // 工具调用
    agent.on('tool_call', async (toolCall: ToolCall, msgTurnId?: number) => {
      const turnId = msgTurnId ?? agent.getCurrentTurnId?.() ?? 0;
      console.log('[useAgentSDK] 📥 收到工具调用:', toolCall.name, toolCall.arguments, 'turnId:', turnId);

      setMessages(prev => [...prev, {
        role: 'tool',
        text: `🔧 ${toolCall.name}`
      }]);

      // 特殊处理 UI 生成工具
      if (toolCall.name === 'render_html_ui' || toolCall.name === 'generateUI') {
        setIsUiGenerating(true);
      }

      // 处理 UI 渲染结果
      if (toolCall.name === 'render_html_ui' && toolCall.arguments) {
        try {
          const args = toolCall.arguments;
          if (args.html) {
            setUIContent({ html: args.html, description: args.description });
          }
        } catch (e) {
          console.error('[useAgentSDK] 解析 UI 内容失败:', e);
        }
      }

      // 处理导航
      if (toolCall.name === 'startNavigation' && toolCall.arguments) {
        try {
          const args = toolCall.arguments;
          if (args.placeName) {
            setNavigationPath({ from: 'current', to: args.placeName });
            //setRobotStatus(`导航到 ${args.placeName}`);
          }
        } catch (e) {
          console.error('[useAgentSDK] 解析导航参数失败:', e);
        }
      }

      // 执行工具调用
      if (options.executeToolCall && agent) {
        try {
          await options.executeToolCall(
            toolCall,
            (msg) => agent.sendRawMessage(msg),
            turnId
          );
          console.log('[useAgentSDK] ✅ 工具执行完成:', toolCall.name);
        } catch (e) {
          console.error('[useAgentSDK] ❌ 工具执行失败:', toolCall.name, e);
        }
      } else {
        console.warn('[useAgentSDK] ⚠️ 没有配置 executeToolCall，工具调用未执行');
      }
    });

    // Turn 完成时的费用更新
    agent.on('turn_complete', ({ cost }: { turnId: number; cost?: any }) => {
      // 兼容两种费用格式
      const costAmount = cost?.amount ?? cost?.totalCost ?? 0;
      if (costAmount > 0) {
        setTotalCost(prev => prev + costAmount);
      }
      setIsUiGenerating(false);
    });

    // 音频统计更新
    agent.on('audio_stats', (stats: AudioStats) => {
      setAudioStats(stats);
    });

    // 机器人到达事件
    agent.on('robot_arrived', (destination: string) => {
      //setRobotStatus(`已到达 ${destination}`);
      setNavigationPath(null);
    });

    // 错误
    agent.on('error', (error: Error) => {
      console.error('[useAgentSDK] 错误:', error);
      setMessages(prev => [...prev, {
        role: 'tool',
        text: `❌ ${error.message}`
      }]);
    });

    // 自动初始化
      if (options.autoInit !== false) {
        agent.initialize().catch(console.error);
      }
    };

    initAgent();

    return () => {
      if (agentRef.current) {
        agentRef.current.destroy();
        agentRef.current = null;
      }
    };
  }, []); // 只在挂载时创建

  // 操作方法
  const initialize = useCallback(async () => {
    await agentRef.current?.initialize();
  }, []);

  const connect = useCallback(() => {
    agentRef.current?.connect();
  }, []);

  const disconnect = useCallback(() => {
    agentRef.current?.disconnect();
  }, []);

  const sendText = useCallback((text: string, role: 'user' | 'system' = 'user') => {
    agentRef.current?.sendText(text, role);
    if (role === 'user') {
      setMessages(prev => [...prev, { role: 'user', text }]);
    }
  }, []);

  const sendContext = useCallback((text: string) => {
    agentRef.current?.sendContext(text);
  }, []);

  const toggleMute = useCallback(() => {
    agentRef.current?.toggleMute();
  }, []);

  const setVolume = useCallback((volume: number) => {
    agentRef.current?.setVolume(volume);
  }, []);

  const startListening = useCallback(() => {
    agentRef.current?.startListening();
  }, []);

  const stopListening = useCallback(() => {
    agentRef.current?.stopListening();
  }, []);

  const stopAudio = useCallback(() => {
    agentRef.current?.stopAudio();
  }, []);

  const setNavigationPathFn = useCallback((path: NavigationPath | null) => {
    setNavigationPath(path);
  }, []);

  const getPlaceList = useCallback(async () => {
    return agentRef.current?.getPlaceList() || [];
  }, []);

  const clearUIContent = useCallback(() => {
    setUIContent(null);
  }, []);

  const navigate = useCallback(async (placeName: string) => {
    await agentRef.current?.navigate(placeName);
    setNavigationPath({ from: 'current', to: placeName });
    //setRobotStatus(`导航到 ${placeName}`);
  }, []);

  const stopNavigationFn = useCallback(async () => {
    await agentRef.current?.stopNavigation();
    setNavigationPath(null);
    //setRobotStatus('');
  }, []);

  // 便捷访问
  const isConnected = state.connectionStatus === 'connected' || state.connectionStatus === 'ready';
  const isInitialized = state.isReady;

  return useMemo(() => ({
    agent: agentRef.current,
    state,
    messages,
    currentUserMessage,
    currentAssistantMessage,
    // 扩展状态
    audioStats,
    isUiGenerating,
    navigationPath,
    totalCost,
    selectedModel: options.modelType || 'openai',
    uiContent,
    robotStatus,
    // 便捷访问
    isConnected,
    isInitialized,
    userSpeaking: state.userSpeaking,
    isPlaying: state.isPlaying,
    isMuted: state.isMuted,
    isVADReady: state.isVADReady,
    isListening: state.isListening,
    subtitleText: state.subtitleText,
    subtitleProgress: state.subtitleProgress,
    // 操作方法
    initialize,
    connect,
    disconnect,
    sendText,
    sendTextWithInterrupt: sendText, // 别名
    sendMessage: (text: string) => sendText(text, 'user'), // 别名
    sendContext,  // 发送上下文（不触发回复）
    toggleMute,
    setVolume,
    startListening,
    stopListening,
    stopAudio,
    setNavigationPath: setNavigationPathFn,
    getPlaceList,
    clearUIContent,
    navigate,
    stopNavigation: stopNavigationFn,
    pauseVAD: () => agentRef.current?.pauseVAD(),
    resumeVAD: () => agentRef.current?.resumeVAD(),
    startPTT: () => agentRef.current?.startPTT(),
    stopPTT: () => agentRef.current?.stopPTT(),
  }), [
    state,
    messages,
    currentUserMessage,
    currentAssistantMessage,
    audioStats,
    isUiGenerating,
    navigationPath,
    totalCost,
    options.modelType,
    uiContent,
    robotStatus,
    isConnected,
    isInitialized,
    initialize,
    connect,
    disconnect,
    sendText,
    sendContext,
    toggleMute,
    setVolume,
    startListening,
    stopListening,
    stopAudio,
    setNavigationPathFn,
    getPlaceList,
    clearUIContent,
    navigate,
    stopNavigationFn,
  ]);
}
