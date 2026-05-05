/**
 * SubtitleDisplay - 字幕显示组件
 * 纯 UI 组件，不依赖任何 Context
 * 注意：字幕的延迟清除逻辑已在 AgentSDK 层面处理（playing_change 事件）
 */

import React, { useRef, useEffect, useState } from 'react';

interface SubtitleDisplayProps {
  /** 完整的文字内容 */
  text: string;
  /** 播放进度 0-1 */
  progress: number;
  /** 是否正在播放（可选，用于样式变化） */
  isPlaying?: boolean;
}


const LINE_HEIGHT = 28;
const VISIBLE_LINES = 2;

export const SubtitleDisplay: React.FC<SubtitleDisplayProps> = ({ text, progress }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const lastLineRef = useRef(0);
  const [totalLines, setTotalLines] = useState(1);

  // 测量实际行数
  useEffect(() => {
    if (textRef.current) {
      const height = textRef.current.scrollHeight;
      const lines = Math.ceil(height / LINE_HEIGHT);
      setTotalLines(Math.max(1, lines));
    }
  }, [text]);

  // 根据进度和实际行数计算当前行并滚动
  useEffect(() => {
    if (!containerRef.current || !text || totalLines <= VISIBLE_LINES) return;

    const currentLine = Math.floor(progress * totalLines);

    if (currentLine > lastLineRef.current) {
      lastLineRef.current = currentLine;
      const targetLine = Math.max(0, currentLine - 1);
      const targetScroll = targetLine * LINE_HEIGHT;

      containerRef.current.scrollTo({
        top: targetScroll,
        behavior: 'smooth'
      });
    }
  }, [progress, text, totalLines]);

  // 文字清空时重置
  useEffect(() => {
    if (!text) {
      lastLineRef.current = 0;
      if (containerRef.current) {
        containerRef.current.scrollTop = 0;
      }
    }
  }, [text]);

  if (!text) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-8 z-50 pointer-events-none">
      <div className="w-[80vw] max-w-[1000px] min-w-[600px] bg-black/70 backdrop-blur-md rounded-xl px-6 py-4 shadow-2xl">
        <div
          ref={containerRef}
          className="overflow-hidden"
          style={{ height: LINE_HEIGHT * VISIBLE_LINES }}
        >
          <div
            ref={textRef}
            className="text-white text-lg font-medium tracking-wide text-left break-words"
            style={{ lineHeight: `${LINE_HEIGHT}px` }}
          >
            {text}
          </div>
        </div>

        <div className="mt-3 h-1 bg-white/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-400 to-purple-500 rounded-full transition-all duration-100"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default SubtitleDisplay;
