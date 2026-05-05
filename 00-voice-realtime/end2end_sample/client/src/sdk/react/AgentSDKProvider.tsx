/**
 * AgentSDKProvider - AgentSDK 的 React Context Provider
 *
 * 替代原有的 CoreProviders，提供统一的 SDK 访问接口
 */

import React, { createContext, useContext, ReactNode, useState, useEffect, useCallback } from 'react';
import { useAgentSDK, UseAgentSDKReturn, UseAgentSDKOptions } from './useAgentSDK';

// Context
const AgentSDKContext = createContext<UseAgentSDKReturn | null>(null);

// 自动刷新 Context
interface AutoRefreshContextValue {
  isEnabled: boolean;
  setEnabled: (enabled: boolean) => void;
  resetTimer: () => void;
}
const AutoRefreshContext = createContext<AutoRefreshContextValue | null>(null);

export interface AgentSDKProviderProps extends UseAgentSDKOptions {
  children: ReactNode;
  /** 是否启用自动刷新，默认 true */
  autoRefreshEnabled?: boolean;
  /** 自动刷新超时时间（毫秒），默认 5 分钟 */
  autoRefreshTimeout?: number;
  /** 自动刷新前回调 */
  onBeforeAutoRefresh?: () => void;
}

/**
 * AgentSDK Provider
 */
export function AgentSDKProvider({
  children,
  autoRefreshEnabled = true,
  autoRefreshTimeout = 5 * 60 * 1000,
  onBeforeAutoRefresh,
  ...sdkOptions
}: AgentSDKProviderProps) {
  const sdk = useAgentSDK(sdkOptions);

  // 自动刷新逻辑
  const [refreshEnabled, setRefreshEnabled] = useState(autoRefreshEnabled);
  const [lastActivity, setLastActivity] = useState(Date.now());

  const resetTimer = useCallback(() => {
    setLastActivity(Date.now());
  }, []);

  // 监听用户活动
  useEffect(() => {
    if (!refreshEnabled) return;

    const handleActivity = () => resetTimer();

    window.addEventListener('click', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('touchstart', handleActivity);

    return () => {
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
    };
  }, [refreshEnabled, resetTimer]);

  // 自动刷新检测
  useEffect(() => {
    if (!refreshEnabled) return;

    const interval = setInterval(() => {
      const elapsed = Date.now() - lastActivity;
      if (elapsed >= autoRefreshTimeout) {
        console.log('[AutoRefresh] 超时，刷新页面');
        onBeforeAutoRefresh?.();
        window.location.reload();
      }
    }, 10000); // 每 10 秒检查一次

    return () => clearInterval(interval);
  }, [refreshEnabled, lastActivity, autoRefreshTimeout, onBeforeAutoRefresh]);

  // SDK 活动也重置计时器
  useEffect(() => {
    if (sdk.state.userSpeaking || sdk.state.isPlaying) {
      resetTimer();
    }
  }, [sdk.state.userSpeaking, sdk.state.isPlaying, resetTimer]);

  const autoRefreshValue: AutoRefreshContextValue = {
    isEnabled: refreshEnabled,
    setEnabled: setRefreshEnabled,
    resetTimer
  };

  return (
    <AgentSDKContext.Provider value={sdk}>
      <AutoRefreshContext.Provider value={autoRefreshValue}>
        {children}
      </AutoRefreshContext.Provider>
    </AgentSDKContext.Provider>
  );
}

/**
 * 使用 AgentSDK Context
 */
export function useAgentSDKContext(): UseAgentSDKReturn {
  const context = useContext(AgentSDKContext);
  if (!context) {
    throw new Error('useAgentSDKContext must be used within an AgentSDKProvider');
  }
  return context;
}

/**
 * 使用自动刷新 Context
 */
export function useAutoRefresh(): AutoRefreshContextValue {
  const context = useContext(AutoRefreshContext);
  if (!context) {
    throw new Error('useAutoRefresh must be used within an AgentSDKProvider');
  }
  return context;
}

export default AgentSDKProvider;
