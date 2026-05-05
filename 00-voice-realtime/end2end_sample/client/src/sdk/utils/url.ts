/**
 * URL 工具函数
 * 纯 TypeScript 实现
 */

/**
 * 获取后端 API 基础 URL
 */
export function getBackendBaseUrl(): string {
  // 优先使用环境变量
  if (typeof process !== 'undefined' && process.env?.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }

  // 默认使用相对路径（生产环境）
  return '';
}

/**
 * 获取 WebSocket URL
 */
export function getWebSocketUrl(): string {
  // 优先使用环境变量
  if (typeof process !== 'undefined' && process.env?.REACT_APP_WS_URL) {
    return process.env.REACT_APP_WS_URL;
  }

  // 开发环境
  if (typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return `ws://${window.location.hostname}:8081/ws`;
  }

  // 生产环境：使用相对路径
  return '/ws';
}

/**
 * 获取静态资源 URL
 */
export function getAssetUrl(filename: string): string {
  let baseUrl = '';

  // React 的 PUBLIC_URL
  if (typeof process !== 'undefined' && process.env?.PUBLIC_URL) {
    baseUrl = process.env.PUBLIC_URL;
  } else if (typeof window !== 'undefined' && (window as any).APP_BASE_URL) {
    baseUrl = (window as any).APP_BASE_URL;
  }

  // 规范化
  if (baseUrl && !baseUrl.endsWith('/')) {
    baseUrl += '/';
  }

  let cleanFilename = filename;
  if (cleanFilename.startsWith('./')) {
    cleanFilename = cleanFilename.slice(2);
  } else if (cleanFilename.startsWith('/')) {
    cleanFilename = cleanFilename.slice(1);
  }

  return `${baseUrl}${cleanFilename}`;
}
