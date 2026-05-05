/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element */
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { dracula } from 'react-syntax-highlighter/dist/esm/styles/prism';
import Mermaid from '@/components/Mermaid';
import { fixMarkdownContent } from '@/lib/markdown-fixer';

interface WikiMarkdownViewerProps {
  markdown: string;
  isDarkMode?: boolean;
}

/**
 * Wiki Markdown 查看器
 * 使用 react-markdown 渲染 Markdown 内容
 * 支持 GFM、代码高亮、Mermaid 图表
 */
const WikiMarkdownViewer: React.FC<WikiMarkdownViewerProps> = ({
  markdown
}) => {
  const [isMounted, setIsMounted] = useState(false);

  // 确保客户端挂载
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 清理 Markdown 内容：移除可能破坏解析的 HTML，并修复代码块边界
  const cleanMarkdown = useMemo(() => {
    return fixMarkdownContent(markdown);
  }, [markdown]);

  if (!isMounted) {
    return <div className="animate-pulse">Loading...</div>;
  }

  return (
    <div className="prose-markdown max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // 代码块自定义渲染
          code(props: any) {
            const { inline, className, children } = props;
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : 'text';

            // 检查是否是 Mermaid 图表
            if (language === 'mermaid') {
              return (
                <Mermaid
                  chart={String(children).replace(/\n$/, '')}
                />
              );
            }

            // 内联代码
            if (inline) {
              return (
                <code
                  className={`${className} bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 px-2 py-1 rounded font-mono text-sm`}
                >
                  {children}
                </code>
              );
            }

            // 代码块
            return (
              <SyntaxHighlighter
                style={dracula}
                language={language}
                PreTag="pre"
                showLineNumbers
                className="rounded-lg !my-4"
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            );
          },

          // 表格行斑马纹
          tr(props: any) {
            return (
              <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/50" {...props} />
            );
          },

          // 列表项自定义样式
          li(props: any) {
            return (
              <li className="text-gray-800 dark:text-gray-200" {...props} />
            );
          },

          // 链接自定义样式
          a(props: any) {
            return (
              <a
                className="text-blue-600 dark:text-blue-400 no-underline hover:underline font-semibold"
                target="_blank"
                rel="noopener noreferrer"
                {...props}
              />
            );
          },

          // 图片自定义样式
          img(props: any) {
            const { src, alt } = props;
            return (
              <img
                src={src || ''}
                alt={alt || 'Image'}
                className="rounded-lg shadow-lg border-4 border-white dark:border-gray-800 max-w-full h-auto my-6"
              />
            );
          },

          // 块引用自定义样式
          blockquote(props: any) {
            return (
              <blockquote
                className="border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-900/20 italic pl-6 py-3 rounded-r-lg my-4"
                {...props}
              />
            );
          },
        }}
      >
        {cleanMarkdown}
      </ReactMarkdown>
    </div>
  );
};

export default WikiMarkdownViewer;
