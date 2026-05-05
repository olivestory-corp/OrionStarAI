import express from 'express';
import cors from 'cors';
import os from 'os';
import fs from 'fs';
import { OpenRouterClient } from './clients/openrouter.js';
import { VertexClient } from './clients/vertex.js';
import { UnifiedChatRequest, VertexCredentials } from './types.js';
import { configManager } from './config.js';
import { getMessages } from './i18n.js';
import apiRouter from './routes.js';

// DEBUG logging utility
// DEBUG 日志工具
const DEBUG = process.env.DEBUG === 'true';
function debugLog(label: string, data?: any) {
  if (DEBUG) {
    const timestamp = new Date().toISOString();
    if (data === undefined) {
      console.log(`[${timestamp}] [DEBUG] ${label}`);
    } else {
      console.log(`[${timestamp}] [DEBUG] ${label}:`, JSON.stringify(data, null, 2));
    }
  }
}

const appConfig = configManager.getConfig();
const serverConfig = appConfig.server;
const vertexConfig = appConfig.vertex;
const openRouterConfig = appConfig.openRouter;

// Validate configuration on startup
const validation = await configManager.validate();
if (!validation.valid) {
  const { getMessages } = await import('./i18n.js');
  const i18n = getMessages();
  console.error(i18n.configValidationFailed);
  validation.errors.forEach(error => {
    console.error(`  • ${error}`);
  });
  console.error('');
  process.exit(1);
}

const app = express();

app.use(cors({ origin: serverConfig.corsOrigin }));
app.use(express.json({ limit: serverConfig.maxRequestSize }));

// DEBUG middleware: log requests
// DEBUG 中间件：记录请求
app.use((req, res, next) => {
  debugLog(`→ ${req.method} ${req.path}`);
  if (DEBUG && Object.keys(req.body).length > 0) {
    debugLog(`  Request Headers`, {
      'x-provider': req.headers['x-provider'],
      'authorization': req.headers['authorization'] ? '[REDACTED]' : undefined,
      'content-type': req.headers['content-type']
    });
    debugLog(`  Request Body (first 500 chars)`,
      JSON.stringify(req.body).substring(0, 500)
    );
  }

  // Save original json method
  // 保存原始的 json 方法
  const originalJson = res.json.bind(res);

  // Intercept JSON response
  // 拦截 JSON 响应
  res.json = function(data: any) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [DEBUG] ← ${req.method} ${req.path} (${res.statusCode})`);
    if (DEBUG && data) {
      const responseStr = JSON.stringify(data);
      console.log(`[${timestamp}] [DEBUG]   Response Body (first 800 chars):`, responseStr.substring(0, 800));
    }
    return originalJson(data);
  };

  // Intercept write method (for streaming responses)
  // 拦截 write 方法（用于流式响应）
  const originalWrite = res.write.bind(res);
  let streamDataCount = 0;

  res.write = function(chunk: any, ...args: any[]) {
    if (DEBUG && typeof chunk === 'string' && chunk.startsWith('data: ')) {
      const timestamp = new Date().toISOString();
      if (chunk.includes('[DONE]')) {
        console.log(`[${timestamp}] [DEBUG] ← Stream chunk [DONE]`);
      } else {
        streamDataCount++;
        const dataLine = chunk.substring(6, chunk.indexOf('\n')).trim();
        console.log(`[${timestamp}] [DEBUG] ← Stream chunk ${streamDataCount} (first 300 chars):`, dataLine.substring(0, 300));
      }
    }
    return originalWrite(chunk, ...args);
  };

  next();
});

// Register API routes
// 注册 API 路由
app.use(apiRouter);

const openRouterClient = new OpenRouterClient(openRouterConfig.baseUrl);
const vertexClient = new VertexClient();

// Helper to handle streaming response
// 处理流式响应的辅助函数
const handleStream = async (res: express.Response, upstreamResponse: Response, provider: 'vertex' | 'openrouter') => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  debugLog(`Stream handler initialized`, { provider, statusCode: upstreamResponse.status });

  if (!upstreamResponse.body) {
    debugLog(`No response body available`);
    res.end();
    return;
  }

  const reader = upstreamResponse.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    let chunkCount = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        debugLog(`Stream ended, total chunks: ${chunkCount}`);
        break;
      }

      chunkCount++;
      const chunk = decoder.decode(value, { stream: true });
      debugLog(`Chunk ${chunkCount} received`, { length: chunk.length, preview: chunk.substring(0, 100) });

      if (provider === 'vertex') {
        // Vertex stream is already in Google format (array of JSON objects)
        // Vertex 流已经是 Google 格式（JSON 对象数组）
        // But it might be raw JSON array elements, not SSE.
        // 但可能是原始 JSON 数组元素，而不是 SSE。
        // Vertex REST API returns a JSON array stream: [ {...}, {...} ]
        // Vertex REST API 返回 JSON 数组流: [ {...}, {...} ]
        // We need to parse this and convert to SSE "data: {...}"
        // 我们需要解析这个并转换为 SSE "data: {...}"

        buffer += chunk;

        if (buffer.trim().startsWith('[')) {
           buffer = buffer.trim().substring(1);
        }

        let braceCount = 0;
        let startIndex = 0;
        let inString = false;
        let escape = false;

        for (let i = 0; i < buffer.length; i++) {
          const char = buffer[i];
          if (escape) { escape = false; continue; }
          if (char === '\\') { escape = true; continue; }
          if (char === '"') { inString = !inString; continue; }

          if (!inString) {
            if (char === '{') {
              if (braceCount === 0) startIndex = i;
              braceCount++;
            } else if (char === '}') {
              braceCount--;
              if (braceCount === 0) {
                const jsonStr = buffer.substring(startIndex, i + 1);
                try {
                  // Verify it's valid JSON
                  JSON.parse(jsonStr);
                  // Send as SSE
                  res.write(`data: ${jsonStr}\n\n`);
                } catch (e) {
                  // Ignore parsing errors
                }
                buffer = buffer.substring(i + 1);
                i = -1;
                if (buffer.trim().startsWith(',')) {
                   buffer = buffer.trim().substring(1);
                }
              }
            }
          }
        }
      } else {
        // OpenRouter (OpenAI format) -> Google Format SSE
        // OpenRouter（OpenAI 格式）-> Google 格式 SSE
        // OpenRouter sends SSE: data: {...}
        // OpenRouter 发送 SSE: data: {...}
        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line / 保留不完整的行

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.substring(6).trim();
            if (dataStr === '[DONE]') {
              res.write('data: [DONE]\n\n');
              continue;
            }

            // Extract finish_reason from chunk to pass to transformStreamChunk
            // 从块中提取 finish_reason 传递给 transformStreamChunk
            let finishReason: string | undefined;
            try {
              const chunkObj = JSON.parse(dataStr);
              finishReason = chunkObj.choices?.[0]?.finish_reason;
            } catch (e) {
              // Parse error, continue without finish_reason
              // 解析错误，继续而不使用 finish_reason
            }

            const googleChunk = openRouterClient.transformStreamChunk(dataStr, finishReason);
            if (googleChunk) {
              res.write(`data: ${googleChunk}\n\n`);
            }
          } else if (line.trim() !== '') {
             // Keep alive or other events, ignore or pass
             // 心跳或其他事件，忽略或通过
          }
        }
      }
    }

    if (provider === 'vertex') {
        // Vertex doesn't send [DONE] explicitly in JSON stream, so we append it
        // Vertex 不在 JSON 流中显式发送 [DONE]，所以我们附加它
        // But only if we haven't already (logic above handles stream end)
        // 但仅在我们还没有时（上面的逻辑处理流结束）
    }
    // Always end with [DONE] for SSE clients if not sent
    // 如果未发送，总是以 [DONE] 结束 SSE 客户端
    // res.write('data: [DONE]\n\n'); // Optional, depending on client strictness / 可选，取决于客户端的严格程度

  } catch (error) {
    res.write(`data: {"error": "${String(error)}"}\n\n`);
  } finally {
    res.end();
  }
};

// Handle chat requests (both streaming and non-streaming)
// 处理聊天请求（流式和非流式）
const handleChat = async (req: express.Request, res: express.Response) => {
  try {
    const provider = req.headers['x-provider'] as string;
    const body = req.body as UnifiedChatRequest;
    const isStream = body.stream || req.path.includes('/stream');

    debugLog(`Chat Request`, {
      provider,
      model: body.model,
      stream: isStream,
      contentCount: body.contents?.length || 0
    });

    let response: Response | null = null;

    if (provider === 'openrouter') {
      if (!openRouterConfig.enabled) {
        return res.status(503).json({ error: 'OpenRouter provider is disabled' });
      }

      const apiKey = req.headers['authorization'] || req.headers['x-api-key'] || openRouterConfig.apiKey;
      if (!apiKey) {
        return res.status(401).json({ error: 'Missing Authorization, x-api-key header, or OPENROUTER_API_KEY environment variable' });
      }

      response = await openRouterClient.chat(body, apiKey as string);
    } else if (provider === 'vertex') {
      if (!vertexConfig.enabled) {
        return res.status(503).json({ error: 'Vertex AI provider is disabled' });
      }

      // Priority: request header > environment-configured credentials
      const credentialsStr = req.headers['x-vertex-credentials'] as string;
      const location = (req.headers['x-vertex-location'] as string) || vertexConfig.defaultLocation;

      let credentials: VertexCredentials;
      let lastError: Error | null = null;

      if (credentialsStr) {
        // Use credentials from header
        try {
          credentials = JSON.parse(credentialsStr);
        } catch (e) {
          return res.status(400).json({ error: 'Invalid x-vertex-credentials JSON' });
        }
        response = await vertexClient.chat(body, credentials, location);
      } else {
        // Try configured credentials in order (with fallback)
        if (vertexConfig.credentials.length === 0) {
          return res.status(401).json({ error: 'No Vertex credentials available. Provide x-vertex-credentials header or configure VERTEX_CREDENTIALS_PATHS' });
        }

        response = null;
        for (let i = 0; i < vertexConfig.credentials.length; i++) {
          try {
            const configuredCred = vertexConfig.credentials[i];
            credentials = configuredCred.credentialsData || JSON.parse(
              fs.readFileSync(configuredCred.credentialsPath, 'utf-8')
            );

            debugLog(`Vertex credential attempt`, {
              projectId: credentials.project_id,
              credentialIndex: i + 1,
              totalCredentials: vertexConfig.credentials.length
            });

            response = await vertexClient.chat(body, credentials, location);
            debugLog(`Vertex credential success`, { projectId: credentials.project_id });
            break; // Success, exit loop
          } catch (error) {
            lastError = error as Error;
            debugLog(`Vertex credential failed`, {
              projectId: vertexConfig.credentials[i]?.credentialsPath,
              credentialIndex: i + 1,
              totalCredentials: vertexConfig.credentials.length,
              error: lastError.message
            });

            // If this is the last credential, throw the error
            if (i === vertexConfig.credentials.length - 1) {
              throw lastError;
            }
            // Otherwise, continue to next credential
          }
        }

        if (!response) {
          throw lastError || new Error('All Vertex credentials failed');
        }
      }
    } else {
      return res.status(400).json({
        error: 'Invalid or missing x-provider header',
        supported: ['vertex', 'openrouter'],
        enabled: {
          vertex: vertexConfig.enabled,
          openrouter: openRouterConfig.enabled
        }
      });
    }

    if (!response) {
      return res.status(500).json({ error: 'Failed to get response from provider' });
    }

    if (isStream) {
      debugLog(`Starting stream response handling`);
      await handleStream(res, response, provider as 'vertex' | 'openrouter');
      debugLog(`Stream response completed`);
    } else {
      debugLog(`Processing non-stream response`);
      if (provider === 'vertex') {
        // Vertex returns Google format directly
        const data = await response.json();
        debugLog(`Vertex response received`, {
          candidates: data.candidates?.length || 0,
          usageMetadata: data.usageMetadata
        });
        res.json(data);
      } else {
        // OpenRouter returns OpenAI format, convert to Google format
        const data = await openRouterClient.transformResponse(response);
        debugLog(`OpenRouter response transformed`, {
          candidates: data.candidates?.length || 0,
          usageMetadata: data.usageMetadata
        });
        res.json(data);
      }
    }

  } catch (error: any) {
    debugLog(`Chat error`, { message: error.message, stack: error.stack?.split('\n')[0] });
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
};

app.post('/v1/chat/messages', handleChat);
app.post('/v1/chat/stream', handleChat);

app.get('/', (req, res) => {
  res.json({ message: 'Mini server for DeepV Code服务器运行中' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'dvcode-prox' });
});

app.listen(serverConfig.port, serverConfig.host, () => {
  const i18n = getMessages();
  const protocol = serverConfig.env === 'production' ? 'https' : 'http';
  const displayHost = serverConfig.host === '0.0.0.0' ? 'localhost' : serverConfig.host;
  const serverUrl = `${protocol}://${displayHost}:${serverConfig.port}`;

  // Get local IP address for LAN access
  // Prioritize real network interfaces: Ethernet (eth/en) > WiFi (wlan) > others
  const interfaces = os.networkInterfaces();
  let lanIp = '';
  const realIfacePatterns = /^(eth|en|wlan|eno|ens|enp|wlp)/i;

  // First pass: look for real network interfaces
  for (const name of Object.keys(interfaces)) {
    if (!realIfacePatterns.test(name)) continue;
    const addrs = interfaces[name];
    if (!addrs) continue;
    for (const iface of addrs) {
      if (iface.family === 'IPv4' && !iface.internal) {
        lanIp = iface.address;
        break;
      }
    }
    if (lanIp) break;
  }

  // Second pass: fallback to any non-loopback IPv4 if no real interface found
  if (!lanIp) {
    for (const name of Object.keys(interfaces)) {
      const addrs = interfaces[name];
      if (!addrs) continue;
      for (const iface of addrs) {
        if (iface.family === 'IPv4' && !iface.internal) {
          lanIp = iface.address;
          break;
        }
      }
      if (lanIp) break;
    }
  }

  const lanUrl = lanIp ? `${protocol}://${lanIp}:${serverConfig.port}` : '';

  console.log('\n' + i18n.separator);
  console.log(i18n.success);
  console.log(i18n.separator);
  console.log(`${i18n.localAccess}${serverUrl}`);
  if (lanUrl) {
    console.log(`${i18n.lanAccess}${lanUrl}`);
  }
  console.log(`${i18n.environment}${serverConfig.env}`);
  console.log(`${i18n.bindAddress}${serverConfig.host}:${serverConfig.port}`);
  console.log('');
  console.log(i18n.clientGuide);
  console.log(i18n.readmeSection);
  console.log(i18n.cliConfig);
  console.log(i18n.vscodeConfig);
  console.log(`${i18n.serverUrl}${serverUrl}`);
  if (lanUrl) {
    console.log(`${i18n.lanAddress}${lanUrl}`);
  }
  console.log('');
  console.log('⭐ ' + i18n.starSupport);
  console.log('🍴 ' + i18n.forkContribute);
  console.log(i18n.separator + '\n');

  // Notify PM2 that the app is ready
  if (process.send) {
    process.send('ready');
  }
});