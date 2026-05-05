/**
 * MainPage - 主页面
 * 在 AgentSDKProvider 内部运行，渲染当前场景
 */

import { useState, useCallback, useEffect } from 'react';
import { useAgentSDKContext } from '../sdk/react';
import { DynamicUI, MaintenanceMode, BackHeader } from '../sdk-react-ui';
import { DebugPanel } from '../sdk-react-ui/debug';
import type { ToolInfo } from '../sdk/maintenance';
import { SceneConfig, getSceneTools } from '../scenes';

import '../App.css';

interface MainPageProps {
  scene: SceneConfig;
  onExitToSceneSelector: () => void;
  onReloadScene?: () => void;
}

export function MainPage({ scene, onExitToSceneSelector, onReloadScene }: MainPageProps) {
  const {
    uiContent,
    clearUIContent,
    pauseVAD,
    state,
    isConnected,
    isInitialized,
    isVADReady,
    isPlaying,
    isMuted,
    userSpeaking,
    isListening,
    subtitleText,
    subtitleProgress,
    audioStats,
    messages,
    totalCost,
    sendText,
    toggleMute,
    setVolume,
    stopAudio,
    navigate,
    stopNavigation,
    navigationPath,
    setNavigationPath
  } = useAgentSDKContext();

  // 调试模式
  const [showDebug, setShowDebug] = useState(false);

  // 维修模式
  const [showMaintenance, setShowMaintenance] = useState(false);
  const [sceneTools, setSceneTools] = useState<ToolInfo[]>([]);

  // 加载场景工具
  useEffect(() => {
    getSceneTools(scene).then(tools => {
      const toolInfos: ToolInfo[] = tools.map(t => ({
        name: t.name,
        description: t.description || '',
      }));
      setSceneTools(toolInfos);
    });
  }, [scene]);

  // 监听维修模式事件
  useEffect(() => {
    const handleEnterMaintenance = () => {
      console.log('[MainPage] 收到进入维修模式事件');
      setShowMaintenance(true);
      pauseVAD();
    };

    window.addEventListener('enter_maintenance_mode', handleEnterMaintenance);
    return () => {
      window.removeEventListener('enter_maintenance_mode', handleEnterMaintenance);
    };
  }, [pauseVAD]);

  // 关闭维修模式
  const handleCloseMaintenance = useCallback((hasChanges: boolean) => {
    setShowMaintenance(false);
    onReloadScene?.();
  }, [onReloadScene]);

  // 切换调试模式
  const handleToggleDebug = useCallback(() => {
    setShowDebug(prev => !prev);
  }, []);

  // 渲染场景组件
  const SceneComponent = scene.component;

  return (
    <>
      {/* 通用返回头部（场景可配置隐藏） */}
      {!scene.hideBackHeader && (
        <BackHeader title={scene.name} onBack={onExitToSceneSelector} />
      )}

      {/* 正常模式：渲染场景 */}
      {!showDebug && (
        <SceneComponent onExit={handleToggleDebug} />
      )}

      {/* 调试模式 */}
      {showDebug && (
        <DebugPanel
          onClose={handleToggleDebug}
          onBack={onExitToSceneSelector}
          isConnected={isConnected}
          isInitialized={isInitialized}
          isVADReady={isVADReady}
          isPlaying={isPlaying}
          isMuted={isMuted}
          userSpeaking={userSpeaking}
          isListening={isListening}
          subtitleText={subtitleText}
          subtitleProgress={subtitleProgress}
          robotState={state.robotState}
          audioStats={audioStats}
          messages={messages}
          totalCost={totalCost}
          navigationPath={navigationPath}
          onToggleMute={toggleMute}
          onSetVolume={setVolume}
          onStopAudio={stopAudio}
          onSendText={sendText}
          onNavigate={navigate}
          onStopNavigation={stopNavigation}
          onSetNavigationPath={setNavigationPath}
        />
      )}

      {/* 动态 UI 弹窗 */}
      {uiContent && (
        <DynamicUI
          html={uiContent.html}
          description={uiContent.description}
          onClose={clearUIContent}
        />
      )}

      {/* 维修模式悬浮层 */}
      {showMaintenance && (
        <MaintenanceMode
          sceneId={scene.id}
          sceneName={scene.name}
          currentPrompt={scene.systemPrompt || ''}
          tools={sceneTools}
          onClose={handleCloseMaintenance}
        />
      )}
    </>
  );
}

export default MainPage;
