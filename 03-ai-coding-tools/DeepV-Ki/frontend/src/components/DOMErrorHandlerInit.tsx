'use client';

import { useEffect } from 'react';
import { installDOMErrorHandler } from '@/utils/domErrorHandler';

/**
 * 在客户端启动时初始化 DOM 错误处理器
 * 防止异步渲染导致的 DOM 操作错误
 */
export default function DOMErrorHandlerInit() {
  useEffect(() => {
    // 在浏览器环境中安装 DOM 错误处理器
    installDOMErrorHandler();
  }, []);

  return null;
}
