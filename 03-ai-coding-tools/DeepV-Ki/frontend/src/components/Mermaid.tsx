'use client';

import React, { FC, useEffect, useRef, useState } from 'react';
import { FiMaximize2, FiMinimize2, FiDownload } from 'react-icons/fi';

interface MermaidProps {
  code?: string;
  chart?: string;
}

const Mermaid: FC<MermaidProps> = ({ code, chart }) => {
  const mermaidCode = code || chart || '';
  const containerRef = useRef<HTMLDivElement>(null);
  const svgContainerRef = useRef<HTMLDivElement>(null);
  const fullscreenContainerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRendered, setIsRendered] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [svgDimensions, setSvgDimensions] = useState<{ width: number; height: number } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const renderTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [renderKey, setRenderKey] = useState(0);
  const [svgContent, setSvgContent] = useState<string>('');

  // 清理已存在的 Mermaid 错误元素（组件挂载时）
  useEffect(() => {
    const cleanupMermaidErrors = () => {
      // 查找所有可能的 Mermaid 错误元素
      const errorElements = Array.from(document.body.children).filter((el) => {
        if (!(el instanceof HTMLElement)) return false;

        const textContent = el.textContent || '';
        const isMermaidError =
          el.id?.startsWith('d') &&
          textContent.includes('Syntax error in text') &&
          textContent.includes('mermaid version');

        return isMermaidError;
      });

      // 移除所有找到的错误元素
      errorElements.forEach((el) => {
        el.remove();
        console.debug('Cleaned up existing Mermaid error element');
      });
    };

    // 初始清理
    cleanupMermaidErrors();

    // 设置定期清理（防止遗漏）
    const cleanupInterval = setInterval(cleanupMermaidErrors, 1000);

    return () => {
      clearInterval(cleanupInterval);
    };
  }, []);

  useEffect(() => {
    if (!mermaidCode) return;

    let isMounted = true;
    let mutationObserver: MutationObserver | null = null;

    const renderMermaidDiagram = async () => {
      try {
        if (!isMounted) return;

        setError(null);
        setIsRendered(false);
        setSvgDimensions(null);

        // 动态导入mermaid避免初始化问题
        const mermaidModule = await import('mermaid');
        const mermaid = mermaidModule.default;

        // 初始化mermaid (超时保护)
        try {
          // 临时禁用控制台输出以抑制 Mermaid 错误消息
          const originalError = console.error;
          const originalWarn = console.warn;
          const originalLog = console.log;

          // 创建一个过滤器来屏蔽 Mermaid 错误
          const isKnownMermaidError = (args: unknown[]): boolean => {
            const message = args
              .map(arg => (typeof arg === 'string' ? arg : JSON.stringify(arg)))
              .join(' ');
            return (
              message.includes('Syntax error in text') ||
              message.includes('mermaid version') ||
              message.includes('KatexExpressionError') ||
              message.includes('could not load image')
            );
          };

          // 覆盖控制台方法以过滤 Mermaid 错误
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          console.error = (...args: any[]): void => {
            if (!isKnownMermaidError(args)) {
              originalError.apply(console, args);
            }
          };

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          console.warn = (...args: any[]): void => {
            if (!isKnownMermaidError(args)) {
              originalWarn.apply(console, args);
            }
          };

          mermaid.initialize({
            startOnLoad: false,
            theme: 'default',
            securityLevel: 'loose',
            logLevel: 'fatal', // 只显示致命错误
            suppressErrorRendering: true // 阻止 Mermaid 渲染错误到 DOM
          });

          // 恢复原始控制台方法
          console.error = originalError;
          console.warn = originalWarn;
          console.log = originalLog;
        } catch (initErr) {
          console.warn('Mermaid initialization warning:', initErr);
        }

        // 监听并移除 Mermaid 添加到 body 的错误元素
        mutationObserver = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
              if (node instanceof HTMLElement) {
                // 检测 Mermaid 错误元素特征
                const isMermaidError =
                  node.id?.startsWith('d') &&
                  node.textContent?.includes('Syntax error in text') &&
                  node.textContent?.includes('mermaid version');

                if (isMermaidError) {
                  // 立即移除错误元素
                  node.remove();
                  console.debug('Removed Mermaid error element from DOM');
                }
              }
            });
          });
        });

        // 监听 document.body 的子元素变化
        mutationObserver.observe(document.body, {
          childList: true,
          subtree: false
        });

        // 创建唯一ID
        const uniqueId = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // 设置渲染超时 (防止无限等待)
        const renderPromise = new Promise<string>((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            reject(new Error('Mermaid rendering timeout (10s)'));
          }, 10000);

          // 在渲染期间过滤控制台输出
          const originalError = console.error;
          const originalWarn = console.warn;

          const isKnownMermaidError = (args: unknown[]): boolean => {
            const message = args
              .map(arg => (typeof arg === 'string' ? arg : JSON.stringify(arg)))
              .join(' ');
            return (
              message.includes('Syntax error in text') ||
              message.includes('mermaid version') ||
              message.includes('KatexExpressionError') ||
              message.includes('could not load image')
            );
          };

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          console.error = (...args: any[]): void => {
            if (!isKnownMermaidError(args)) {
              originalError.apply(console, args);
            }
          };

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          console.warn = (...args: any[]): void => {
            if (!isKnownMermaidError(args)) {
              originalWarn.apply(console, args);
            }
          };

          mermaid.render(uniqueId, mermaidCode)
            .then(result => {
              clearTimeout(timeoutId);
              console.error = originalError;
              console.warn = originalWarn;
              resolve(result.svg);
            })
            .catch(err => {
              clearTimeout(timeoutId);
              console.error = originalError;
              console.warn = originalWarn;
              reject(err);
            });
        });

        const svg = await renderPromise;

        if (!isMounted) return;

        // 使用 React state 管理 SVG 内容，避免直接 DOM 操作
        try {
          // 解析并处理 SVG
          const parser = new DOMParser();
          const doc = parser.parseFromString(svg, 'image/svg+xml');
          const svgElement = doc.querySelector('svg');

          if (svgElement) {
            const viewBox = svgElement.getAttribute('viewBox');
            let svgWidth = 0, svgHeight = 0;

            if (viewBox) {
              const [, , width, height] = viewBox.split(' ').map(Number);
              svgWidth = width;
              svgHeight = height;
              setSvgDimensions({ width, height });
            }

            // 移除固定宽高
            svgElement.removeAttribute('width');
            svgElement.removeAttribute('height');

            // 添加 data 属性用于存储图表类型，全屏时使用
            const aspectRatio = svgWidth > 0 && svgHeight > 0 ? svgWidth / svgHeight : 1;
            svgElement.setAttribute('data-aspect-ratio', aspectRatio.toString());
            svgElement.setAttribute('data-svg-width', svgWidth.toString());
            svgElement.setAttribute('data-svg-height', svgHeight.toString());

            // 智能调整：根据图表宽高比和绝对尺寸决定样式（仅非全屏）
            if (svgWidth > 0 && svgHeight > 0) {
              if (aspectRatio > 2) {
                // 横向图表（宽高比 > 2）：放大到合理尺寸，允许横向滚动
                const targetWidth = Math.min(Math.max(svgWidth * 1.2, 1000), 1600);
                svgElement.setAttribute('style', `width: ${targetWidth}px; height: auto; display: block;`);
                svgElement.classList.add('mermaid-wide');
              } else if (aspectRatio > 1.2) {
                // 较宽图表：填充容器，最小宽度 800px
                svgElement.setAttribute('style', 'width: 100%; min-width: 800px; height: auto; display: block;');
                svgElement.classList.add('mermaid-landscape');
              } else if (aspectRatio < 0.6) {
                // 纵向图表：根据实际高度智能缩放
                if (svgHeight > 1000) {
                  // 很高的图表（复杂流程）：适度缩小，限制最大高度
                  svgElement.setAttribute('style', 'width: 80%; max-width: 600px; height: auto; max-height: 700px; display: block; margin: 0 auto;');
                } else {
                  // 简单的纵向图表：保持原始尺寸或稍微放大
                  const scale = svgHeight < 400 ? 1.2 : 1.0;
                  svgElement.setAttribute('style', `width: ${svgWidth * scale}px; max-width: 600px; height: auto; display: block; margin: 0 auto;`);
                }
                svgElement.classList.add('mermaid-vertical');
              } else {
                // 接近方形：填充容器宽度
                svgElement.setAttribute('style', 'width: 100%; height: auto; display: block;');
                svgElement.classList.add('mermaid-square');
              }
            } else {
              // 降级方案：默认自适应
              svgElement.setAttribute('style', 'width: 100%; height: auto; display: block;');
            }

            const serializer = new XMLSerializer();
            const modifiedSvg = serializer.serializeToString(svgElement);

            // 通过 state 更新（让 React 管理）
            setSvgContent(modifiedSvg);
            setRenderKey(prev => prev + 1);

            // SVG 插入到 DOM 后立即触发布局调整
            // 使用 setTimeout 确保 React 已经渲染了 SVG
            if (isMounted) {
              setTimeout(() => {
                const svgEl = containerRef.current?.querySelector('svg');
                if (svgEl) {
                  // 使用 requestAnimationFrame 触发浏览器重新计算布局
                  requestAnimationFrame(() => {
                    // 临时改变宽度以强制触发 ResizeObserver
                    const originalWidth = svgEl.style.width;
                    svgEl.style.width = (parseInt(originalWidth) - 1 || 100) + '%';

                    requestAnimationFrame(() => {
                      svgEl.style.width = originalWidth || '100%';
                    });
                  });
                }
              }, 0);
            }

            setIsRendered(true);
          }
        } catch (domErr) {
          console.error('DOM operation error:', domErr);
          if (isMounted) {
            setError('Failed to render diagram in DOM');
          }
        }
      } catch (err) {
        if (!isMounted) return;

        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error('Mermaid render error:', {
          message: errorMessage,
          code: mermaidCode.substring(0, 100)
        });
        setError(errorMessage);

        // React 状态更新将触发重新渲染，显示错误 UI
      }
    };

    // 智能延迟渲染策略：
    // 1. 如果页面已加载，使用较短延迟 (50ms)
    // 2. 如果页面还在加载，等待加载完成后再延迟 (100ms)
    const startRender = () => {
      if (isMounted) {
        renderMermaidDiagram();
      }
    };

    let loadHandler: (() => void) | null = null;

    if (document.readyState === 'complete') {
      // 页面已加载，最小延迟
      renderTimeoutRef.current = setTimeout(startRender, 50);
    } else {
      // 页面还在加载，等待加载完成
      loadHandler = () => {
        renderTimeoutRef.current = setTimeout(startRender, 100);
      };
      window.addEventListener('load', loadHandler);
    }

    return () => {
      isMounted = false;
      if (renderTimeoutRef.current) {
        clearTimeout(renderTimeoutRef.current);
      }
      if (mutationObserver) {
        mutationObserver.disconnect();
      }
      // 清理事件监听器
      if (loadHandler) {
        window.removeEventListener('load', loadHandler);
      }
    };
  }, [mermaidCode]);

  // 响应式调整监听 - 包括页面加载完成时的初始调整
  useEffect(() => {
    if (!containerRef.current || !isRendered) return;

    const container = containerRef.current;

    // 页面加载完成后，触发 SVG 重新布局
    const handlePageLoad = () => {
      // 给予浏览器足够时间完成布局计算（requestAnimationFrame x2）
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const svgElement = container.querySelector('svg') as SVGSVGElement | null;
          if (svgElement && !isFullscreen) {
            // 强制浏览器重新计算布局（触发 ResizeObserver）
            const width = (svgElement as unknown as HTMLElement).offsetWidth;
            svgElement.style.width = width ? (width - 1) + 'px' : '100%';

            // 触发重新布局
            requestAnimationFrame(() => {
              svgElement.style.width = '100%';
            });
          }
        });
      });
    };

    // 如果页面已加载，立即处理
    if (document.readyState === 'complete') {
      handlePageLoad();
    } else {
      window.addEventListener('load', handlePageLoad);
    }

    // 使用ResizeObserver监听容器大小变化
    resizeObserverRef.current = new ResizeObserver(() => {
      const svgElement = container.querySelector('svg');
      if (svgElement && !isFullscreen) {
        // 非全屏时才重新设置，全屏时保留之前的计算结果
        svgElement.style.maxWidth = '100%';
        svgElement.style.height = 'auto';
      }
    });

    resizeObserverRef.current.observe(container);

    return () => {
      window.removeEventListener('load', handlePageLoad);
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
    };
  }, [isRendered, isFullscreen]);

  // 监听全屏状态变化并调整 SVG 样式
  useEffect(() => {
    const svgElement = containerRef.current?.querySelector('svg');
    if (!svgElement) return;

    const aspectRatio = parseFloat(svgElement.getAttribute('data-aspect-ratio') || '1');
    const svgWidth = parseFloat(svgElement.getAttribute('data-svg-width') || '0');
    const svgHeight = parseFloat(svgElement.getAttribute('data-svg-height') || '0');

    if (isFullscreen) {
      // 全屏模式：让图表完整显示在视窗内
      console.log('Applying fullscreen styles, aspectRatio:', aspectRatio);
      if (aspectRatio > 2) {
        // 横向图表：宽度优先，确保完整显示
        svgElement.setAttribute('style', 'max-width: 95%; max-height: 90vh; width: auto; height: auto; display: block; margin: 0 auto;');
      } else if (aspectRatio < 0.6) {
        // 纵向图表：高度优先，确保完整显示
        svgElement.setAttribute('style', 'max-width: 90%; max-height: 90vh; width: auto; height: auto; display: block; margin: 0 auto;');
      } else {
        // 正常比例：自适应，同时限制宽高
        svgElement.setAttribute('style', 'max-width: 90%; max-height: 90vh; width: auto; height: auto; display: block; margin: 0 auto;');
      }
    } else {
      // 退出全屏：恢复原始样式
      console.log('Applying normal styles, aspectRatio:', aspectRatio);
      if (aspectRatio > 2) {
        const targetWidth = Math.min(Math.max(svgWidth * 1.2, 1000), 1600);
        svgElement.setAttribute('style', `width: ${targetWidth}px; height: auto; display: block;`);
      } else if (aspectRatio > 1.2) {
        svgElement.setAttribute('style', 'width: 100%; min-width: 800px; height: auto; display: block;');
      } else if (aspectRatio < 0.6) {
        if (svgHeight > 1000) {
          svgElement.setAttribute('style', 'width: 80%; max-width: 600px; height: auto; max-height: 700px; display: block; margin: 0 auto;');
        } else {
          const scale = svgHeight < 400 ? 1.2 : 1.0;
          svgElement.setAttribute('style', `width: ${svgWidth * scale}px; max-width: 600px; height: auto; display: block; margin: 0 auto;`);
        }
      } else {
        svgElement.setAttribute('style', 'width: 100%; height: auto; display: block;');
      }
    }
  }, [isFullscreen]);

  // 全屏处理
  useEffect(() => {
    const handleFullscreenChange = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const doc = document as any;
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement
      );
      setIsFullscreen(isCurrentlyFullscreen);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  // 切换全屏
  const toggleFullscreen = async () => {
    if (!fullscreenContainerRef.current) return;

    try {
      if (!isFullscreen) {
        // 进入全屏
        const elem = fullscreenContainerRef.current;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const anyElem = elem as any;
        if (elem.requestFullscreen) {
          await elem.requestFullscreen();
        } else if (anyElem.webkitRequestFullscreen) {
          await anyElem.webkitRequestFullscreen();
        } else if (anyElem.mozRequestFullScreen) {
          await anyElem.mozRequestFullScreen();
        } else if (anyElem.msRequestFullscreen) {
          await anyElem.msRequestFullscreen();
        }
      } else {
        // 退出全屏
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const anyDoc = document as any;
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (anyDoc.webkitExitFullscreen) {
          await anyDoc.webkitExitFullscreen();
        } else if (anyDoc.mozCancelFullScreen) {
          await anyDoc.mozCancelFullScreen();
        } else if (anyDoc.msExitFullscreen) {
          await anyDoc.msExitFullscreen();
        }
      }
    } catch (err) {
      console.error('Fullscreen toggle error:', err);
    }
  };

  // 下载 SVG 为 PNG
  const downloadSvg = () => {
    const svgElement = containerRef.current?.querySelector('svg');
    if (!svgElement) return;

    try {
      const svgData = new XMLSerializer().serializeToString(svgElement);
      const canvas = document.createElement('canvas');
      const bbox = svgElement.getBBox();
      const padding = 20;

      canvas.width = bbox.width + padding * 2;
      canvas.height = bbox.height + padding * 2;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // 绘制白色背景
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, padding, padding);
        const link = document.createElement('a');
        link.href = canvas.toDataURL('image/png');
        link.download = `mermaid-diagram-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      };
      img.onerror = () => {
        console.error('Failed to load SVG for download');
      };
      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    } catch (err) {
      console.error('Download error:', err);
    }
  };

  return (
    <div
      ref={fullscreenContainerRef}
      className={`my-6 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30 overflow-visible transition-all duration-300 ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none border-0 p-0 m-0' : 'p-3'
      }`}
    >
      {/* 工具栏 */}
      <div className={`flex items-center justify-between gap-2 mb-2 ${isFullscreen ? 'p-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700' : ''}`}>
        <div className="text-sm font-medium text-slate-600 dark:text-slate-400">
          {isFullscreen && 'Diagram Fullscreen View'}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={downloadSvg}
            disabled={!isRendered}
            className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Download as PNG"
            aria-label="Download diagram"
          >
            <FiDownload className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </button>
          <button
            onClick={toggleFullscreen}
            disabled={!isRendered}
            className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? (
              <FiMinimize2 className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            ) : (
              <FiMaximize2 className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            )}
          </button>
        </div>
      </div>

      {/* 图表容器 */}
      <div
        ref={svgContainerRef}
        className={`w-full ${isFullscreen ? 'p-4 flex items-center justify-center' : ''}`}
        style={{
          width: '100%',
          height: isFullscreen ? 'calc(100vh - 80px)' : 'auto',
          minHeight: isFullscreen ? 'calc(100vh - 80px)' : 'auto',
          overflow: 'auto'
        }}
      >
        {error ? (
          // 错误显示面板
          <div className="w-full flex flex-col gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg">
            <div className="flex items-start justify-between">
              <h3 className="font-semibold text-yellow-700 dark:text-yellow-300 flex items-center gap-2">
                <span>⚠️</span> Diagram Error
              </h3>
              <button
                onClick={() => setShowErrorDetails(!showErrorDetails)}
                className="text-xs px-2 py-1 rounded bg-yellow-100 dark:bg-yellow-900/40 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-200 dark:hover:bg-yellow-900/60 transition-colors"
              >
                {showErrorDetails ? 'Hide' : 'Show'} Details
              </button>
            </div>

            {showErrorDetails && (
              <div className="text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/40 p-3 rounded font-mono overflow-x-auto max-h-[400px] overflow-y-auto whitespace-pre-wrap break-words">
                {error}
              </div>
            )}

            <div className="text-xs text-yellow-600 dark:text-yellow-400 leading-relaxed">
              <p className="mb-2">
                💡 <strong>Tips:</strong> This diagram has syntax errors. The AI may have generated invalid Mermaid syntax. You can:
              </p>
              <ul className="list-disc list-inside mt-2 ml-2 space-y-1">
                <li>Regenerate the wiki and try again</li>
                <li>Check the diagram code in the error details above</li>
                <li>Manually edit the diagram using Mermaid syntax reference</li>
              </ul>
            </div>
          </div>
        ) : (
          <div
            className="w-full"
            style={{
              height: isFullscreen ? 'calc(100vh - 80px)' : 'auto',
              minHeight: isFullscreen ? 'calc(100vh - 80px)' : '200px'
            }}
          >
            {!isRendered && !error ? (
              <div className="flex justify-center items-center w-full h-full text-slate-400 dark:text-slate-500 text-sm">
                Rendering diagram...
              </div>
            ) : isRendered && svgContent ? (
              <div
                key={renderKey}
                ref={containerRef}
                dangerouslySetInnerHTML={{ __html: svgContent }}
                className="w-full"
              />
            ) : null}
          </div>
        )}
      </div>

      {/* ESC 提示 (全屏模式) */}
      {isFullscreen && (
        <div className="fixed bottom-4 right-4 text-xs text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700">
          Press <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded">ESC</kbd> to exit
        </div>
      )}
    </div>
  );
};

export default Mermaid;
