/**
 * DynamicUI - 动态 HTML UI 展示组件
 * 纯 UI 组件，不依赖任何 Context
 */

import React, { useEffect, useRef } from 'react';

interface DynamicUIProps {
  /** HTML 内容 */
  html: string;
  /** 描述 */
  description?: string;
  /** 关闭回调 */
  onClose: () => void;
  /** 机器人操作回调 */
  onRobotAction?: (action: string, payload: any) => void;
}

export const DynamicUI: React.FC<DynamicUIProps> = ({ html, description, onClose, onRobotAction }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (iframeRef.current) {
      iframeRef.current.srcdoc = html;
    }
  }, [html]);

  // 监听来自 Iframe 的机器人控制指令
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      const data = event.data;

      if (!data || data.type !== 'ROBOT_ACTION') return;

      console.log('[DynamicUI] 收到 Iframe 指令:', data);

      if (onRobotAction) {
        onRobotAction(data.action, data.payload);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onRobotAction]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-start p-4 pointer-events-none">
      <div className="relative w-full max-w-3xl h-[85vh] bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-left-10 duration-300 pointer-events-auto border border-gray-200 ml-2 lg:ml-10">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-900 text-white border-b border-gray-800 cursor-move">
          <div className="flex items-center gap-2">
            <span className="text-blue-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
            </span>
            <h3 className="font-medium text-sm truncate max-w-md">
              {description || 'Generated UI'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-700 rounded-full transition-colors"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 bg-gray-50 relative">
          <iframe
            ref={iframeRef}
            title="Generated UI"
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-forms allow-popups allow-modals allow-same-origin"
          />
        </div>
      </div>
    </div>
  );
};

export default DynamicUI;
