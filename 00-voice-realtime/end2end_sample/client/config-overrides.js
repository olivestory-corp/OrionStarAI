const WebpackBar = require('webpackbar');

module.exports = function override(config, env) {
  // 添加构建进度条
  config.plugins.push(
    new WebpackBar({
      name: '🚀 客户端构建',
      color: '#61dafb', // React 蓝色
    })
  );

  // 为 face-api.js 提供 fs 模块的空 fallback（浏览器环境不需要）
  config.resolve = {
    ...config.resolve,
    fallback: {
      ...config.resolve?.fallback,
      fs: false,
    },
  };

  // ONNX Runtime WASM 文件现在从 CDN 加载 (cdn.jsdelivr.net)
  // 不再需要本地复制，大幅减小 build 体积

  if (env === 'development') {
    config.ignoreWarnings = [
      ...config.ignoreWarnings || [],
      (warning) => {
        if (warning.message && warning.message.includes('Failed to parse source map')) {
          return true;
        }
        if (warning.message && warning.message.includes('Critical dependency')) {
          return true;
        }
        if (warning.message && warning.message.includes('onAfterSetupMiddleware')) {
          return true;
        }
        if (warning.message && warning.message.includes('onBeforeSetupMiddleware')) {
          return true;
        }
        return false;
      }
    ];
  }
  return config;
};
