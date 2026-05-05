/**
 * App.tsx - 应用入口
 *
 * 新架构：
 * - 场景选择在 AgentSDKProvider 之外完成
 * - 选择场景后才创建 AgentSDKProvider 并连接
 */

import React, { useState, useCallback, useEffect } from 'react';
import { AgentSDKProvider } from './sdk/react';
import { SceneConfig, createSceneAdapter, getSceneById } from './scenes';
import type { ToolDeclaration } from './sdk/tools/types';
import { HomePage } from './components/HomePage';
import { PermissionModal } from './components/PermissionModal';
import { SceneSelector } from './pages/SceneSelector';
import MainPage from './pages/MainPage';

import './App.css';

/**
 * 快速模式配置
 * ?3c -> advice-3c 场景
 */
type QuickModeConfig = {
  sceneId: string;
  voice: string;
} | null;

function getQuickModeConfig(): QuickModeConfig {
  const search = window.location.search;
  if (search.includes('3c')) {
    return { sceneId: 'advice-3c', voice: 'marin' };
  }
  return null;
}

/** 场景适配器类型 */
interface SceneAdapter {
  id: string;
  name: string;
  systemPrompt?: string;
  getTools: () => Promise<ToolDeclaration[]>;
  executeToolCall: (toolCall: any, sendMessage: (msg: any) => void, turnId: number) => Promise<void>;
}

type AppState = 'home' | 'permission' | 'scene-selector' | 'running';

/**
 * 主应用
 */
function MainApp() {
  // 检测快速模式 (?3c -> advice-3c)
  const quickMode = getQuickModeConfig();

  // 状态 - 快速模式下直接进入 running
  const [appState, setAppState] = useState<AppState>(quickMode ? 'running' : 'home');
  const [selectedVoice, setSelectedVoice] = useState<string>(quickMode?.voice || 'alloy');
  const [selectedScene, setSelectedScene] = useState<SceneConfig | null>(() => {
    if (quickMode) {
      return getSceneById(quickMode.sceneId) || null;
    }
    return null;
  });
  const [activeScenario, setActiveScenario] = useState<SceneAdapter | null>(() => {
    if (quickMode) {
      const scene = getSceneById(quickMode.sceneId);
      if (scene) {
        return createSceneAdapter(scene);
      }
    }
    return null;
  });
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [sessionKey, setSessionKey] = useState(0);

  // 快速模式下自动请求麦克风权限
  useEffect(() => {
    if (quickMode) {
      navigator.mediaDevices.getUserMedia({ audio: true }).catch(err => {
        console.error('[App] 快速模式麦克风权限请求失败:', err);
      });
    }
  }, [quickMode]);

  // 首页点击开始
  const handleConnect = useCallback(() => {
    setAppState('permission');
  }, []);

  // 请求麦克风权限
  const handleRequestPermission = useCallback(async () => {
    setIsRequestingPermission(true);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setAppState('scene-selector');
    } catch (err) {
      console.error('[App] 麦克风权限请求失败:', err);
    } finally {
      setIsRequestingPermission(false);
    }
  }, []);

  // 选择场景
  const handleSelectScene = useCallback((scene: SceneConfig) => {
    console.log('[App] 选择场景:', scene.id);
    setSelectedScene(scene);

    const sceneAdapter = createSceneAdapter(scene);
    setActiveScenario(sceneAdapter);
    setAppState('running');
    console.log('[App] ✅ 场景已加载:', scene.id);
  }, []);

  // 返回首页
  const handleBackToHome = useCallback(() => {
    setAppState('home');
    setSelectedScene(null);
    setActiveScenario(null);
  }, []);

  // 返回场景选择
  const handleBackToSceneSelector = useCallback(() => {
    setAppState('scene-selector');
    setSelectedScene(null);
    setActiveScenario(null);
  }, []);

  // 重新加载场景
  const handleReloadScene = useCallback(() => {
    console.log('[App] 🔄 重新加载场景...');
    setSessionKey(prev => prev + 1);
  }, []);

  // 根据状态渲染
  if (appState === 'home') {
    return (
      <HomePage
        selectedVoice={selectedVoice}
        onVoiceChange={setSelectedVoice}
        onConnect={handleConnect}
        isLoading={false}
        error={null}
      />
    );
  }

  if (appState === 'permission') {
    return (
      <>
        <HomePage
          selectedVoice={selectedVoice}
          onVoiceChange={setSelectedVoice}
          onConnect={handleConnect}
          isLoading={false}
          error={null}
        />
        <PermissionModal
          isOpen={true}
          onRequest={handleRequestPermission}
          onClose={() => setAppState('home')}
          error={null}
          isLoading={isRequestingPermission}
        />
      </>
    );
  }

  if (appState === 'scene-selector') {
    return (
      <SceneSelector
        onSelectScene={handleSelectScene}
        onBack={handleBackToHome}
      />
    );
  }

  if (appState === 'running' && activeScenario && selectedScene) {
    return (
      <AgentSDKProvider
        key={sessionKey}
        systemPrompt={activeScenario.systemPrompt}
        getTools={activeScenario.getTools}
        executeToolCall={activeScenario.executeToolCall}
        modelType="openai"
        voice={selectedVoice}
        autoConnect={true}
        inputMode={selectedScene.inputMode || 'vad'}
      >
        <MainPage
          scene={selectedScene}
          onExitToSceneSelector={handleBackToSceneSelector}
          onReloadScene={handleReloadScene}
        />
      </AgentSDKProvider>
    );
  }

  return null;
}

/**
 * App 组件 - 路由分发
 */
function App() {
  return <MainApp />;
}

export default App;
