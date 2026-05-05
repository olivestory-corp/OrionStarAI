import express from 'express';
import compression from 'compression';
import { createServer } from 'http';
import https from 'https';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import dotenv from 'dotenv';
import { handleClientConnection } from './websocket';
import { wsManager } from './wsManager';
import fs from 'fs';
import path from 'path';

const NODE_ENV = process.env.NODE_ENV || 'development';

// 🔥 修复: 使用 process.cwd() 确保在任何层级目录下运行都能找到根目录的 .env 文件
const serverDir = process.cwd();

const envFile = NODE_ENV === 'production' ?
  path.join(serverDir, '.env.production') :
  path.join(serverDir, '.env');

console.log(`[Config] 加载环境变量: ${envFile}`);
dotenv.config({ path: envFile });

const app = express();
const PORT = process.env.PORT || 8081;
const INSTANCE_ID = process.env.INSTANCE_ID || '0';

// 启用 CORS
app.use(cors());

// 启用 Gzip/Brotli 压缩
app.use(compression({
  filter: (req, res) => {
    if (req.path.match(/\.(wasm|onnx)$/)) {
      return true;
    }
    return compression.filter(req, res);
  },
  level: 6,
}));

app.use(express.json({ limit: '10mb' }));

// ========================================
// API 路由 - /api/*
// ========================================

// 健康检查
app.get('/api/health', (req, res) => {
  const stats = wsManager.getStats();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    instance: INSTANCE_ID,
    env: NODE_ENV,
    websocket: stats
  });
});

// 🆕 获取 OpenAI Realtime 临时密钥 (Ephemeral Key)
app.post('/api/realtime/token', async (req, res) => {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  if (!OPENAI_API_KEY) {
    return res.status(500).json({
      error: '服务器未配置 OPENAI_API_KEY'
    });
  }

  try {
    // 调用 OpenAI API 获取临时密钥
    const response = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session: {
          type: 'realtime',
          model: 'gpt-realtime-2025-08-28',
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[API] OpenAI API 错误:', error);
      return res.status(response.status).json({
        error: '获取临时密钥失败',
        detail: error
      });
    }

    const data = await response.json() as { value?: string; expires_at?: number };
    console.log('[API] ✅ 已生成 OpenAI 临时密钥:', data.value ? data.value.substring(0, 15) + '...' : 'N/A');

    // client_secrets 接口直接返回 { value: "ek_...", expires_at: ... }
    res.json({
      success: true,
      client_secret: {
        value: data.value,
        expires_at: data.expires_at,
      },
    });
  } catch (error: any) {
    console.error('[API] 获取临时密钥出错:', error);
    res.status(500).json({
      error: '服务器内部错误',
      message: error.message
    });
  }
});

// ========================================
// 静态文件服务 - /
// ========================================

// 前端构建文件路径
const clientBuildPath = path.join(__dirname, '..', '..', 'client', 'build');

// 检查前端构建文件是否存在（优先检测文件，无论环境）
if (fs.existsSync(clientBuildPath)) {
  console.log('✅ 检测到前端构建文件，启用静态文件服务');
  console.log(`   路径: ${clientBuildPath}`);

  // 静态资源缓存策略
  app.use(express.static(clientBuildPath, {
    setHeaders: (res, filePath) => {
      if (filePath.match(/\.(wasm|onnx)$/)) {
        // WASM/ONNX 模型文件几乎不变，设置强缓存 1 年
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else if (filePath.match(/\.(js|css)$/) && filePath.includes('/static/')) {
        // CRA 构建的 static/ 下的 JS/CSS 带 hash，可以长期缓存 1 年
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else if (filePath.match(/\.(js|css)$/)) {
        // 根目录的 JS/CSS 不带 hash，使用协商缓存（每次检查更新）
        res.setHeader('Cache-Control', 'no-cache');
      } else if (filePath.match(/\.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/)) {
        // 其他静态资源缓存 1 周
        res.setHeader('Cache-Control', 'public, max-age=604800');
      } else if (filePath.endsWith('.html')) {
        // HTML 文件不缓存，每次检查更新
        res.setHeader('Cache-Control', 'no-cache');
      }
      // 其他文件使用默认策略
    }
  }));

  // SPA 路由处理 - 所有非 API、非 WebSocket 的请求都返回 index.html
  // 使用中间件而不是路由，避免通配符语法问题
  app.use((req, res, next) => {
    // 只处理 GET 请求
    if (req.method !== 'GET') {
      return next();
    }

    // 排除 API 和 WebSocket 路由
    if (req.path.startsWith('/api/') || req.path.startsWith('/ws')) {
      return next();
    }

    // 排除静态资源文件
    if (req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|json|map)$/)) {
      return next();
    }

    // 返回前端 index.html（SPA 路由）
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
} else {
  console.log('⚠️  未检测到前端构建文件');
  console.log(`   路径: ${clientBuildPath}`);
  console.log('   提示: cd client && npm run build');

  // 根路径返回提示信息
  app.get('/', (req, res) => {
    res.json({
      message: '服务器运行中',
      note: '前端构建文件不存在，请先构建前端: cd client && npm run build',
      api: {
        health: '/api/health'
      },
      websocket: '/ws'
    });
  });
}

// ========================================
// WebSocket 服务 - /ws
// ========================================

console.log('📡 使用 HTTP 模式');
const server = createServer(app);

// 创建 WebSocket 服务器
const wss = new WebSocketServer({
  server,
  path: '/ws'  // WebSocket 路径
});

wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress || 'unknown';
  console.log(`[WS连接] 来自${clientIp}`);
  handleClientConnection(ws);
});

// ========================================
// HTTPS 服务 (可选)
// ========================================

const useSSL = process.env.USE_SSL === 'true';
const sslDir = path.join(__dirname, '..', '..', 'ssl');
const keyPath = path.join(sslDir, 'localhost.key');
const certPath = path.join(sslDir, 'localhost.crt');

if (useSSL && fs.existsSync(keyPath) && fs.existsSync(certPath)) {
  try {
    const httpsOptions = {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath)
    };

    const httpsServer = https.createServer(httpsOptions, app);
    const HTTPS_PORT = parseInt(process.env.HTTPS_PORT || '8443', 10);

    // HTTPS WebSocket
    const wssHttps = new WebSocketServer({
      server: httpsServer,
      path: '/ws'
    });

    wssHttps.on('connection', (ws, req) => {
      const clientIp = req.socket.remoteAddress || 'unknown';
      console.log(`[WSS连接] 来自${clientIp}`);
      handleClientConnection(ws);
    });

    httpsServer.listen(HTTPS_PORT, '0.0.0.0', () => {
      console.log(`✅ HTTPS 服务已启动`);
      console.log(`   本地: https://localhost:${HTTPS_PORT}`);
      console.log(`   WSS: wss://localhost:${HTTPS_PORT}/ws`);
    });
  } catch (error) {
    console.error('⚠️  HTTPS 启动失败:', error);
  }
} else {
  console.log('ℹ️  未找到 SSL 证书，仅运行 HTTP 模式');
  console.log(`   期望路径: ${keyPath}`);
}

// ========================================
// 启动服务器
// ========================================

const portNumber = typeof PORT === 'string' ? parseInt(PORT, 10) : PORT;

server.listen(portNumber, '0.0.0.0', () => {
  console.log('========================================');
  console.log('🚀 Gem Store Server');
  console.log('========================================');
  console.log(`环境: ${NODE_ENV}`);
  console.log(`实例ID: ${INSTANCE_ID}`);
  console.log(`端口: ${PORT}`);
  console.log(`监听地址: 0.0.0.0`);
  console.log('');
  console.log(`✅ 服务已启动`);
  console.log(`   本地: http://localhost:${PORT}`);
  console.log(`   WS: ws://localhost:${PORT}/ws`);
  console.log(`   健康检查: http://localhost:${PORT}/api/health`);
  console.log('========================================');
});

// ========================================
// 错误处理
// ========================================

process.on('uncaughtException', (error) => {
  console.error('未捕获的异常:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的 Promise 拒绝:', reason);
});

// ========================================
// 优雅关闭处理
// ========================================

async function gracefulShutdown(signal: string) {
  console.log(`\n[关闭] 收到信号: ${signal}`);

  // 关闭WebSocket管理器
  await wsManager.gracefulShutdown();

  // 关闭HTTP服务器
  server.close(() => {
    console.log('[关闭] 服务器已关闭');
    process.exit(0);
  });

  // 5秒后强制退出
  setTimeout(() => {
    console.error('[关闭] 强制退出');
    process.exit(1);
  }, 5000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Windows 兼容：监听进程退出事件
if (process.platform === 'win32') {
  process.on('message', (msg) => {
    if (msg === 'shutdown') {
      gracefulShutdown('shutdown');
    }
  });
}