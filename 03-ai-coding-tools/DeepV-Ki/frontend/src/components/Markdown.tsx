'use client';

import React, { FC, Component, ReactNode, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import Mermaid from './Mermaid';
import { FiCopy, FiCheck, FiCode } from 'react-icons/fi';
import { fixMarkdownContent } from '@/lib/markdown-fixer';
import { generateFileUrl } from '@/utils/fileUrlGenerator';
import CodeViewerModal from './CodeViewerModal';

interface MarkdownProps {
  content: string;
  repoUrl?: string | null;
  repoType?: string;
  defaultBranch?: string;
}

/**
 * 代码块级别的容错包装器
 */
class CodeBlockErrorBoundary extends Component<
  { children: ReactNode; language: string },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode; language: string }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.warn(`Error in ${this.props.language} code block:`, error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded my-2">
          <p className="text-xs text-yellow-600 dark:text-yellow-400">
            代码块渲染失败: {this.props.language}
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * 增强型 Markdown 组件
 *
 * 使用 Tailwind Typography 提供专业的排版样式
 * 支持：GFM、代码高亮、Mermaid 图表、表格等
 */
const MarkdownComponent: FC<MarkdownProps> = ({
  content,
  repoUrl,
  repoType = 'github',
  defaultBranch = 'main'
}) => {
  console.log('Markdown content:', content);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Code Viewer Modal State
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerContent, setViewerContent] = useState('');
  const [viewerTitle, setViewerTitle] = useState('');
  const [viewerLanguage, setViewerLanguage] = useState('text');
  const [viewerBranch, setViewerBranch] = useState('');
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [viewerHighlightStart, setViewerHighlightStart] = useState<number | undefined>(undefined);
  const [viewerHighlightEnd, setViewerHighlightEnd] = useState<number | undefined>(undefined);

  // 清理内容：移除可能破坏 Markdown 解析的 HTML 标签，并修复代码块边界
  const cleanContent = useMemo(() => {
    return fixMarkdownContent(content);
  }, [content]);

  if (!content) {
    return null;
  }

  // 获取文件内容
  const fetchFileContent = async (filePath: string) => {
    if (!repoUrl) return;

    setViewerOpen(true);
    setViewerLoading(true);
    setViewerError(null);
    setViewerTitle(filePath);
    setViewerContent('');

    // Parse line numbers if present (e.g., file.ts:10-20)
    const lineMatch = filePath.match(/:(\d+)(?:-(\d+))?$/);
    let highlightStart: number | undefined;
    let highlightEnd: number | undefined;

    if (lineMatch) {
      highlightStart = parseInt(lineMatch[1], 10);
      if (lineMatch[2]) {
        highlightEnd = parseInt(lineMatch[2], 10);
      }
    }

    setViewerHighlightStart(highlightStart);
    setViewerHighlightEnd(highlightEnd);

    // Remove line numbers for fetching and language detection
    const cleanPath = filePath.split(':')[0];

    // Determine language from extension
    const ext = cleanPath.split('.').pop()?.toLowerCase() || 'text';
    setViewerLanguage(ext);

    try {
      // Only support GitLab for now via backend proxy
      if (repoType === 'gitlab') {
        const params = new URLSearchParams({
          repo_url: repoUrl,
          file_path: cleanPath,
          branch: defaultBranch || 'master'
        });

        const headers: HeadersInit = {};
        const token = typeof window !== 'undefined' ? localStorage.getItem('deepwiki_token') : '';
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`/api/gitlab/file-content?${params.toString()}`, {
          credentials: 'include',
          headers
        });
        const data = await response.json();

        if (data.success) {
          setViewerContent(data.content);
          setViewerBranch(data.branch);
        } else {
          throw new Error(data.message || 'Failed to fetch content');
        }
      } else {
        // For other providers, fallback to opening in new tab for now
        window.open(generateFileUrl({
          repoUrl,
          repoType,
          defaultBranch: defaultBranch || 'main',
          filePath
        }), '_blank');
        setViewerOpen(false);
      }
    } catch (err) {
      console.error('Error fetching file content:', err);
      setViewerError(err instanceof Error ? err.message : 'Failed to load file content');
    } finally {
      setViewerLoading(false);
    }
  };

  // 处理文件链接点击：复制文件名
  const handleFileLinkClick = (href: string, event: React.MouseEvent) => {
    // 如果有 repoUrl，尝试获取内容
    if (repoUrl) {
      event.preventDefault();
      fetchFileContent(href);
      return;
    }

    // 检查是否是相对路径的文件链接（./ 或 ../ 开头，或纯文件名）
    const isFileLink =
      href.startsWith('./') ||
      href.startsWith('../') ||
      /^[A-Z_]+\.(md|MD|txt|TXT|json|JSON|ya?ml|YAML)$/i.test(href) ||
      /^[^/]+\.(md|MD|txt|TXT|json|JSON|ya?ml|YAML)$/i.test(href);

    if (isFileLink) {
      event.preventDefault();

      // 提取文件名（去掉路径）
      const fileName = href.split('/').pop() || href;

      // 复制到剪贴板
      navigator.clipboard.writeText(fileName).then(() => {
        setCopiedLink(fileName);
        setTimeout(() => setCopiedLink(null), 2000);
      }).catch(err => {
        console.error('Failed to copy filename:', err);
      });
    }
  };

  return (
    <article className="prose-markdown max-w-none">
      {/* 复制成功提示 */}
      {copiedLink && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2 bg-green-500 text-white rounded-lg shadow-lg animate-fade-in">
          ✓ Copied: <span className="font-mono">{copiedLink}</span>
        </div>
      )}

      <CodeViewerModal
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
        title={viewerTitle}
        content={viewerContent}
        language={viewerLanguage}
        branch={viewerBranch}
        loading={viewerLoading}
        error={viewerError}
        highlightStart={viewerHighlightStart}
        highlightEnd={viewerHighlightEnd}
      />

      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // 自定义链接渲染：文件链接改为复制文件名或跳转
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          a: ({ href, children, node: _node, ...props }: any) => { // eslint-disable-line @typescript-eslint/no-unused-vars
            // 1. 优先使用 href，如果 href 为空（例如 [file:line]() 格式），则尝试使用 children 作为路径
            let targetPath = href;
            const linkText = String(children);

            // 处理 Sources: [file:line]() 这种空链接的情况
            if (!targetPath && linkText) {
              // 简单的启发式检查：如果文本看起来像文件路径或包含行号
              if (
                linkText.includes('.') || // 有扩展名
                linkText.includes('/') || // 有路径分隔符
                linkText.includes('\\') || // Windows 路径分隔符
                /:\d+/.test(linkText)     // 包含行号
              ) {
                targetPath = linkText;
              }
            }

            if (!targetPath) return <a {...props}>{children}</a>;

            // 2. 检查是否是文件链接（包括带有行号的引用）
            // 移除可能的行号后缀进行扩展名检查
            const cleanPathForCheck = targetPath.split(':')[0];

            const isFileLink =
              targetPath.startsWith('./') ||
              targetPath.startsWith('../') ||
              // 允许任意路径，只要以支持的扩展名结尾（无论是否包含路径分隔符）
              /\.(md|txt|json|ya?ml|ts|tsx|js|jsx|py|java|c|cpp|h|go|rs|css|scss|html|xml|properties|gradle|sql|sh|bat|ps1|php|rb|cs|swift|kt|kts|dart|lua|pl|r|scala|vue|toml|ini|conf)$/i.test(cleanPathForCheck);

            if (isFileLink) {
              // 如果有 repoUrl，生成可点击链接（点击触发 Modal）
              if (repoUrl) {
                return (
                  <a
                    href="#"
                    onClick={(e) => handleFileLinkClick(targetPath, e)}
                    className="source-link group inline-flex items-center gap-1 hover:text-blue-600 transition-colors cursor-pointer"
                    title={`View file content: ${targetPath}`}
                    {...props}
                  >
                    {children}
                    <FiCode className="w-3 h-3 opacity-50 group-hover:opacity-100" />
                  </a>
                );
              }

              // 否则保持原来的复制功能
              return (
                <a
                  href={targetPath}
                  onClick={(e) => handleFileLinkClick(targetPath, e as unknown as React.MouseEvent)}
                  className="source-link cursor-copy"
                  style={{
                    fontSize: '0.75rem !important',
                    color: '#6b7280 !important',
                    backgroundColor: 'transparent !important',
                    padding: '0 !important',
                    margin: '0 !important',
                  }}
                  title={`Click to copy: ${targetPath.split('/').pop() || targetPath}`}
                  {...props}
                >
                  {children}
                </a>
              );
            }

            // 普通链接：保持原样
            return <a href={href} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;
          },

          // 自定义列表项渲染：处理任务列表
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          li: ({ node, ...props }: any) => {
            // 检查是否是任务列表项
            if (node.children[0]?.type === 'element' && node.children[0]?.tagName === 'input' && node.children[0]?.properties?.type === 'checkbox') {
              return (
                <li className="task-list-item flex items-center gap-2 my-1 list-none">
                  <input type="checkbox" checked={node.children[0].properties.checked} readOnly className="cursor-default flex-shrink-0" />
                  <span className="flex-1">{props.children.slice(1)}</span>
                </li>
              );
            }
            // 否则，使用默认的 li 渲染
            return <li {...props} />;
          },

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          code: ({ className, children, ...props }: any) => {
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : '';
            const isInline = !className;

            // Mermaid 图表
            if (language === 'mermaid') {
              return (
                <div className="my-8 flex justify-center">
                  <div className="not-prose">
                    <CodeBlockErrorBoundary language="mermaid">
                      <Mermaid chart={String(children).replace(/\n$/, '')} />
                    </CodeBlockErrorBoundary>
                  </div>
                </div>
              );
            }

            // 代码块
            if (!isInline && language) {
              const codeContent = String(children).replace(/\n$/, '');
              const handleCopyCode = () => {
                navigator.clipboard.writeText(codeContent).then(() => {
                  setCopiedCode(codeContent);
                  setTimeout(() => setCopiedCode(null), 2000);
                }).catch(err => {
                  console.error('Failed to copy code:', err);
                });
              };

              return (
                <div className="my-3 relative group">
                  <button
                    onClick={handleCopyCode}
                    className="absolute top-2 right-2 p-1 rounded bg-gray-700 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer"
                    title="Copy code"
                  >
                    {copiedCode === codeContent ? <FiCheck className="w-4 h-4 text-green-400" /> : <FiCopy className="w-4 h-4" />}
                  </button>
                  <div className="not-prose">
                    <CodeBlockErrorBoundary language={language}>
                      <SyntaxHighlighter
                        style={oneDark}
                        language={language}
                        PreTag="div"
                        showLineNumbers={true}
                        wrapLines={true}
                        customStyle={{
                          margin: 0,
                          padding: '1rem',
                          fontSize: '0.85rem',
                          lineHeight: '1.5',
                          borderRadius: '0.375rem',
                        }}
                        lineNumberStyle={{
                          fontSize: '0.75rem',
                        }}
                        {...props}
                      >
                        {codeContent}
                      </SyntaxHighlighter>
                    </CodeBlockErrorBoundary>
                  </div>
                </div>
              );
            }

            // 内联代码 - 使用 prose-code 样式
            return <code {...props}>{children}</code>;
          },
        }}
      >
        {cleanContent}
      </ReactMarkdown>
    </article>
  );
};

const Markdown = React.memo(MarkdownComponent);
export default Markdown;
