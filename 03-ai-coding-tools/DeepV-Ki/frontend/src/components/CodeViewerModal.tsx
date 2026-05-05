
import React, { useEffect, useState, useMemo } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, vs } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { FaTimes, FaCopy, FaCheck, FaCodeBranch, FaExpandAlt } from 'react-icons/fa';
import { useTheme } from 'next-themes';

interface CodeViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  content: string;
  language: string;
  branch?: string;
  loading?: boolean;
  error?: string | null;
  highlightStart?: number;
  highlightEnd?: number;
}

const CodeViewerModal: React.FC<CodeViewerModalProps> = ({
  isOpen,
  onClose,
  title,
  content,
  language,
  branch,
  loading = false,
  error = null,
  highlightStart,
  highlightEnd
}) => {
  const [copied, setCopied] = useState(false);
  const [showFullFile, setShowFullFile] = useState(false);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  // Reset showFullFile when modal opens/closes or content changes
  useEffect(() => {
    if (isOpen) {
      setShowFullFile(false);
    }
  }, [isOpen, content]);

  // Calculate display content and range
  const { displayContent, startLineNumber, isPartial } = useMemo(() => {
    if (!content || loading || error) {
      return { displayContent: '', startLineNumber: 1, isPartial: false };
    }

    // If no highlight or user requested full file, show everything
    if (!highlightStart || showFullFile) {
      return { displayContent: content, startLineNumber: 1, isPartial: false };
    }

    const lines = content.split('\n');
    const totalLines = lines.length;
    const contextLines = 10; // Show 10 lines of context before and after

    // Calculate range (1-based line numbers)
    // Ensure we don't go below line 1
    const start = Math.max(1, highlightStart - contextLines);

    // Ensure we don't go beyond the last line
    // If highlightEnd is not provided, default to highlightStart
    const endTarget = highlightEnd || highlightStart;
    const end = Math.min(totalLines, endTarget + contextLines);

    // Slice content (0-based array index)
    // slice(start, end) extracts up to but not including end
    const slicedLines = lines.slice(start - 1, end);

    return {
      displayContent: slicedLines.join('\n'),
      startLineNumber: start,
      isPartial: true
    };
  }, [content, highlightStart, highlightEnd, showFullFile, loading, error]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(content); // Always copy full content
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 z-[100] flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
      style={{
        '--scrollbar-track': isDark ? '#1e1e1e' : '#ffffff',
        '--scrollbar-thumb': isDark ? '#424242' : '#c1c1c1',
        '--scrollbar-thumb-hover': isDark ? '#4f4f4f' : '#a8a8a8'
      } as React.CSSProperties}
    >
      <div
        className="bg-white dark:bg-[#1e1e1e] w-full max-w-4xl h-[80vh] rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.2)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.6)] flex flex-col overflow-hidden border border-gray-200 dark:border-[#454545]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - VS Code style */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-[#454545] bg-gray-50 dark:bg-[#252526] select-none shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-medium text-gray-700 dark:text-[#cccccc] truncate font-mono">
                  {title}
                </span>
                {isPartial && (
                  <span className="text-[10px] text-gray-500 dark:text-[#cccccc]/60 bg-gray-200 dark:bg-[#3c3c3c] px-1.5 rounded border border-gray-300 dark:border-[#454545]">
                    {startLineNumber}-{startLineNumber + displayContent.split('\n').length - 1}
                  </span>
                )}
              </div>
              {branch && (
                <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-[#cccccc]/50">
                  <FaCodeBranch className="w-2.5 h-2.5" />
                  <span className="font-mono truncate">
                    {branch}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 ml-4">
            {isPartial && (
              <button
                onClick={() => setShowFullFile(true)}
                className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium text-blue-600 dark:text-[#3794ff] hover:bg-blue-50 dark:hover:bg-[#3794ff]/10 rounded transition-colors"
                title="Show full file"
              >
                <FaExpandAlt className="w-3 h-3" />
                <span className="hidden sm:inline">Full File</span>
              </button>
            )}

            {!loading && !error && (
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium text-gray-600 dark:text-[#cccccc] hover:bg-gray-200 dark:hover:bg-[#3c3c3c] rounded transition-colors"
                title="Copy content"
              >
                {copied ? <FaCheck className="text-green-500 w-3 h-3" /> : <FaCopy className="w-3 h-3" />}
                <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-gray-500 dark:text-[#cccccc] hover:bg-red-100 dark:hover:bg-[#c53030] hover:text-red-600 dark:hover:text-white rounded transition-colors ml-1"
              title="Close (Esc)"
            >
              <FaTimes size={14} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto relative bg-white dark:bg-[#1e1e1e] custom-scrollbar">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-blue-500 dark:border-[#007acc] border-t-transparent rounded-full animate-spin"></div>
                <p className="text-gray-500 dark:text-[#cccccc] text-xs">Loading...</p>
              </div>
            </div>
          ) : error ? (
            <div className="absolute inset-0 flex items-center justify-center p-8">
              <div className="text-center max-w-md">
                <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <FaTimes className="text-red-500 text-xl" />
                </div>
                <h4 className="text-sm font-bold text-gray-900 dark:text-[#cccccc] mb-1">Unable to load</h4>
                <p className="text-xs text-gray-500 dark:text-[#cccccc]/60">{error}</p>
              </div>
            </div>
          ) : (
            <SyntaxHighlighter
              language={language}
              style={isDark ? oneDark : vs}
              customStyle={{
                margin: 0,
                padding: '1rem',
                fontSize: '13px',
                lineHeight: '1.5',
                fontFamily: "'Menlo', 'Monaco', 'Courier New', monospace",
                minHeight: '100%',
                background: 'transparent' // Let container bg show through
              }}
              showLineNumbers={true}
              lineNumberStyle={{
                minWidth: '3em',
                paddingRight: '1em',
                color: isDark ? '#858585' : '#6e7681',
                textAlign: 'right'
              }}
              wrapLines={true}
              startingLineNumber={startLineNumber}
              lineProps={(lineNumber) => {
                const style: React.CSSProperties = { display: 'block' };
                if (highlightStart && lineNumber >= highlightStart && (!highlightEnd || lineNumber <= highlightEnd)) {
                  style.backgroundColor = isDark ? 'rgba(38, 79, 120, 0.5)' : 'rgba(173, 214, 255, 0.3)'; // VS Code selection color
                  style.boxShadow = 'inset 3px 0 0 0 #007acc'; // Blue accent indicator
                  style.width = '100%';
                }
                return { style };
              }}
            >
              {displayContent}
            </SyntaxHighlighter>
          )}
        </div>
      </div>
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: var(--scrollbar-track);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: var(--scrollbar-thumb);
          border-radius: 0px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: var(--scrollbar-thumb-hover);
        }
        .custom-scrollbar::-webkit-scrollbar-corner {
          background: var(--scrollbar-track);
        }
      `}</style>
    </div>
  );
};

export default CodeViewerModal;
