import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { initMockRobotAPI } from './sdk/robot/initMockRobotAPI';

// 初始化 Mock Robot API (仅在非 Android 环境下生效)
initMockRobotAPI();

// 设置应用的 base URL（用于处理各种部署路径）
const getAppBaseUrl = () => {
  // 优先使用 process.env.PUBLIC_URL（由 build 时设置）
  if (process.env.PUBLIC_URL && process.env.PUBLIC_URL !== '/') {
    return process.env.PUBLIC_URL;
  }
  // 如果 PUBLIC_URL 为 '/'，返回空字符串（应用在根路径）
  if (process.env.PUBLIC_URL === '/') {
    return '';
  }
  // 从 window.location 推断（如果需要）
  // 例如：https://example.com/live/ -> /live
  const path = window.location.pathname;
  if (path !== '/' && path !== '/index.html') {
    // 移除末尾的 / 和 index.html
    let base = path.replace(/\/$/, '').replace(/\/index\.html$/, '');
    if (base && !base.startsWith('/')) base = '/' + base;
    return base;
  }
  return '';
};

const appBaseUrl = getAppBaseUrl();
(window as any).APP_BASE_URL = appBaseUrl;

console.log('[App Init] APP_BASE_URL:', appBaseUrl || '(root)');
console.log('[App Init] PUBLIC_URL:', process.env.PUBLIC_URL || '(not set)');

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  //<React.StrictMode>
    <App />
  //</React.StrictMode>
);
