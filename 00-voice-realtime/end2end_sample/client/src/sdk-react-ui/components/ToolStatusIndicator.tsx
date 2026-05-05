/**
 * Tool Status Indicator - 工具执行状态指示器
 *
 * 统一展示工具执行状态：
 * - Toast: 快速工具的简短提示
 * - Inline: 中等时长工具的行内进度
 * - Overlay: 长时间工具的全屏覆盖层
 */

import React, { useEffect, useState, useCallback } from 'react';
import { toolStateManager, ToolState, ToolStateHookResult } from '../../sdk/tools/toolState';

/**
 * Hook: 订阅工具状态变化
 */
export function useToolState(): ToolStateHookResult {
  const [activeTools, setActiveTools] = useState<ToolState[]>([]);
  const [hasLongRunning, setHasLongRunning] = useState(false);

  useEffect(() => {
    const handleChange = (states: ToolState[]) => {
      setActiveTools(states);
      setHasLongRunning(states.some(s => s.duration === 'long'));
    };

    toolStateManager.on('state_change', handleChange);

    // 初始状态
    handleChange(toolStateManager.getActiveStates());

    return () => {
      toolStateManager.off('state_change', handleChange);
    };
  }, []);

  return { activeTools, hasLongRunning };
}

/**
 * Toast 样式的工具提示
 */
const ToolToast: React.FC<{ tool: ToolState }> = ({ tool }) => {
  const statusColor = tool.status === 'running' ? '#3B82F6' :
                      tool.status === 'success' ? '#10B981' :
                      tool.status === 'error' ? '#EF4444' : '#6B7280';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 24px',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        borderRadius: '12px',
        color: 'white',
        fontSize: '21px',
        boxShadow: '0 6px 18px rgba(0, 0, 0, 0.3)',
        animation: 'slideIn 0.3s ease-out'
      }}
    >
      {tool.status === 'running' && (
        <div
          style={{
            width: '24px',
            height: '24px',
            border: '3px solid transparent',
            borderTopColor: statusColor,
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}
        />
      )}
      {tool.status === 'success' && <span style={{ color: statusColor, fontSize: '24px' }}>✓</span>}
      {tool.status === 'error' && <span style={{ color: statusColor, fontSize: '24px' }}>✗</span>}
      <span>{tool.runningText}</span>
    </div>
  );
};

/**
 * 行内进度条
 */
const ToolInline: React.FC<{ tool: ToolState; onCancel?: () => void }> = ({ tool, onCancel }) => {
  const progress = tool.progress ?? 0;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        padding: '18px 24px',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        borderRadius: '18px',
        color: 'white',
        minWidth: '300px'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '21px', fontWeight: 500 }}>{tool.displayName}</span>
        {onCancel && tool.status === 'running' && (
          <button
            onClick={onCancel}
            style={{
              background: 'none',
              border: 'none',
              color: '#EF4444',
              cursor: 'pointer',
              fontSize: '18px'
            }}
          >
            取消
          </button>
        )}
      </div>
      <div style={{ fontSize: '18px', color: '#9CA3AF' }}>
        {tool.progressMessage || tool.runningText}
      </div>
      <div
        style={{
          height: '6px',
          backgroundColor: 'rgba(255, 255, 255, 0.2)',
          borderRadius: '3px',
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            width: `${progress}%`,
            height: '100%',
            backgroundColor: '#3B82F6',
            transition: 'width 0.3s ease',
            borderRadius: '3px'
          }}
        />
      </div>
    </div>
  );
};

/**
 * 全屏覆盖层（长时间工具）
 */
const ToolOverlay: React.FC<{ tool: ToolState; onCancel?: () => void }> = ({ tool, onCancel }) => {
  const progress = tool.progress ?? 0;
  const elapsed = Math.floor((Date.now() - tool.startTime) / 1000);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        animation: 'fadeIn 0.3s ease-out'
      }}
    >
      <div
        style={{
          backgroundColor: 'rgba(30, 30, 30, 0.95)',
          borderRadius: '30px',
          padding: '48px 72px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '24px',
          minWidth: '450px',
          boxShadow: '0 12px 48px rgba(0, 0, 0, 0.5)'
        }}
      >
        {/* 加载动画 */}
        <div
          style={{
            width: '96px',
            height: '96px',
            border: '6px solid rgba(255, 255, 255, 0.1)',
            borderTopColor: '#3B82F6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}
        />

        {/* 工具名称 */}
        <h3 style={{ color: 'white', margin: 0, fontSize: '30px', fontWeight: 600 }}>
          {tool.displayName}
        </h3>

        {/* 状态文本 */}
        <p style={{ color: '#9CA3AF', margin: 0, fontSize: '21px', textAlign: 'center' }}>
          {tool.progressMessage || tool.runningText}
        </p>

        {/* 进度条 */}
        {tool.progress !== undefined && (
          <div
            style={{
              width: '100%',
              height: '9px',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '5px',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                width: `${progress}%`,
                height: '100%',
                backgroundColor: '#3B82F6',
                transition: 'width 0.3s ease',
                borderRadius: '5px'
              }}
            />
          </div>
        )}

        {/* 已用时间 */}
        <span style={{ color: '#6B7280', fontSize: '18px' }}>
          已用时 {elapsed} 秒
        </span>

        {/* 取消按钮 */}
        {onCancel && tool.status === 'running' && (
          <button
            onClick={onCancel}
            style={{
              marginTop: '12px',
              padding: '12px 36px',
              backgroundColor: 'rgba(239, 68, 68, 0.2)',
              border: '2px solid #EF4444',
              borderRadius: '12px',
              color: '#EF4444',
              cursor: 'pointer',
              fontSize: '21px',
              transition: 'all 0.2s'
            }}
          >
            取消
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * 工具状态指示器主组件
 */
export const ToolStatusIndicator: React.FC = () => {
  const { activeTools, hasLongRunning } = useToolState();
  const [, forceUpdate] = useState(0);

  // 强制每秒更新以显示已用时间
  useEffect(() => {
    if (hasLongRunning) {
      const timer = setInterval(() => forceUpdate(n => n + 1), 1000);
      return () => clearInterval(timer);
    }
  }, [hasLongRunning]);

  const handleCancel = useCallback((toolCallId: string) => {
    toolStateManager.cancel(toolCallId);
    // 触发实际的取消操作
    window.dispatchEvent(new CustomEvent('tool_cancel', { detail: { toolCallId } }));
  }, []);

  // 分类工具
  const toastTools = activeTools.filter(t => t.feedbackType === 'toast' && t.showFeedback);
  const inlineTools = activeTools.filter(t => t.feedbackType === 'inline' && t.showFeedback);
  const overlayTool = activeTools.find(t => t.feedbackType === 'overlay' && t.showFeedback);

  return (
    <>
      {/* CSS 动画 */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes slideIn {
          from { transform: translateY(-20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>

      {/* Toast 提示（右上角） */}
      {toastTools.length > 0 && (
        <div
          style={{
            position: 'fixed',
            top: '30px',
            right: '30px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            zIndex: 9990
          }}
        >
          {toastTools.map(tool => (
            <ToolToast key={tool.toolCallId} tool={tool} />
          ))}
        </div>
      )}

      {/* Inline 进度（底部中央） */}
      {inlineTools.length > 0 && !overlayTool && (
        <div
          style={{
            position: 'fixed',
            bottom: '150px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            zIndex: 9990
          }}
        >
          {inlineTools.map(tool => (
            <ToolInline
              key={tool.toolCallId}
              tool={tool}
              onCancel={() => handleCancel(tool.toolCallId)}
            />
          ))}
        </div>
      )}

      {/* Overlay（全屏） */}
      {overlayTool && (
        <ToolOverlay
          tool={overlayTool}
          onCancel={() => handleCancel(overlayTool.toolCallId)}
        />
      )}
    </>
  );
};

export default ToolStatusIndicator;
