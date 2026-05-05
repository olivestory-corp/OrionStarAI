const path = require('path');

module.exports = {
  apps: [
    {
      name: 'gemini-server',
      script: path.join(__dirname, 'dist/server/src/index.js'),
      cwd: __dirname,
      instances: 1, // 单进程模式（PM2会自动处理重启和监控）
      exec_mode: 'fork', // fork模式而不是cluster，避免端口冲突
      env: {
        NODE_ENV: 'production',
        PORT: 8081
      },
      error_file: path.join(__dirname, 'logs/error.log'),
      out_file: path.join(__dirname, 'logs/out.log'),
      log_file: path.join(__dirname, 'logs/combined.log'),
      time_format: 'YYYY-MM-DD HH:mm:ss Z',
      // 性能优化
      max_memory_restart: '4096M', // 内存超过4GB自动重启
      instance_var: 'INSTANCE_ID',
      // 重启策略
      max_restarts: 10,
      min_uptime: '10s',
      listen_timeout: 3000,
      kill_timeout: 5000,
    }
  ]
};
