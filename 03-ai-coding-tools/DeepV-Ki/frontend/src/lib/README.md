# API工具库使用指南

本目录包含了统一的API代理工具和配置管理，用于简化API路由的开发和维护。

## 📁 文件结构

```
src/lib/
├── api-proxy.ts           # 统一的API代理工具
├── config.ts              # 环境变量和配置管理
├── api-route-template.ts  # API路由模板
└── README.md              # 本文档
```

## 🔧 核心工具

### 1. API代理工具 (api-proxy.ts)

提供统一的后端代理功能，包含路径映射、错误处理、请求转换等。

```typescript
import { proxyToBackend, proxyGet, proxyPost } from '@/lib/api-proxy';

// 基础代理
export async function GET(request: NextRequest) {
  return proxyGet('/api/auth/status', request);
}

// 带选项的代理
export async function POST(request: NextRequest) {
  return proxyPost('/api/auth/validate', request, {
    transformRequest: (data) => ({ ...data, timestamp: Date.now() }),
    timeout: 10000,
  });
}
```

### 2. 配置管理 (config.ts)

统一管理所有环境变量和配置。

```typescript
import { config, getWebSocketUrl, isDevelopment } from '@/lib/config';

console.log('Backend URL:', config.pythonBackendHost);
console.log('WebSocket URL:', getWebSocketUrl());
console.log('Is Development:', isDevelopment());
```

### 3. API路由模板 (api-route-template.ts)

提供多种预定义的路由模板，简化API路由创建。

## 🚀 使用示例

### 简单代理路由

```typescript
// src/app/api/auth/status/route.ts
import { createSimpleProxyRoute } from '@/lib/api-route-template';

const { GET } = createSimpleProxyRoute('/api/auth/status');
export { GET };
```

### 只读路由

```typescript
// src/app/api/models/config/route.ts
import { createReadOnlyRoute } from '@/lib/api-route-template';

export const GET = createReadOnlyRoute('/api/models/config');
```

### 带数据转换的路由

```typescript
// src/app/api/wiki/projects/route.ts
import { createTransformRoute } from '@/lib/api-route-template';

const { GET, DELETE } = createTransformRoute('/api/wiki/projects', {
  transformResponse: (data) => ({
    ...data,
    processed_at: new Date().toISOString(),
  }),
});

export { GET, DELETE };
```

### 缓存路由

```typescript
// src/app/api/models/config/route.ts
import { createCachedRoute } from '@/lib/api-route-template';

const { GET } = createCachedRoute('/api/models/config', {
  maxAge: 600, // 10分钟缓存
  staleWhileRevalidate: 120, // 过期后2分钟内仍可使用
});

export { GET };
```

### 流式响应路由

```typescript
// src/app/api/chat/stream/route.ts
import { createStreamRoute } from '@/lib/api-route-template';

const { POST } = createStreamRoute('/api/chat/stream');
export { POST };
```

### 自定义路由

```typescript
// src/app/api/custom/route.ts
import { createCustomRoute } from '@/lib/api-route-template';
import { NextRequest, NextResponse } from 'next/server';

export const GET = createCustomRoute(async (request: NextRequest) => {
  // 自定义逻辑
  const data = { message: 'Custom response' };
  return NextResponse.json(data);
});
```

## 🎯 路径映射

API代理工具使用预定义的路径映射表：

```typescript
// 前端路径 → 后端路径
'/api/auth/status' → '/api/auth/status'
'/api/models/config' → '/api/models/config'
'/api/wiki/projects' → '/api/processed_projects'
'/api/chat/stream' → '/chat/completions/stream'
// ... 更多映射
```

## 🔍 调试和监控

### 配置验证

```typescript
import { validateEnvironment, printConfig } from '@/lib/config';

// 验证环境变量
const validation = validateEnvironment();
if (!validation.isValid) {
  console.error('Missing environment variables:', validation.missingVars);
}

// 打印当前配置（开发环境）
printConfig();
```

### 代理配置查看

```typescript
import { getProxyConfig } from '@/lib/api-proxy';

console.log('Proxy Configuration:', getProxyConfig());
```

## ⚠️ 注意事项

### 1. 环境变量优先级

```
PYTHON_BACKEND_HOST > SERVER_BASE_URL > 默认值
```

### 2. 错误处理

所有模板都包含统一的错误处理：
- 标准化的错误响应格式
- 详细的错误日志
- 超时处理
- 网络错误处理

### 3. 安全考虑

- 敏感信息不会在日志中显示
- 请求头的安全转发
- 超时保护

### 4. 性能优化

- 支持响应缓存
- 请求超时控制
- 连接复用

## 🔄 迁移指南

### 从旧的API路由迁移

1. **简单代理**：
   ```typescript
   // 旧方式
   const response = await fetch(`${BACKEND_URL}/api/auth/status`);
   
   // 新方式
   return proxyGet('/api/auth/status', request);
   ```

2. **使用模板**：
   ```typescript
   // 旧方式：手写完整的代理逻辑
   
   // 新方式：使用模板
   const { GET } = createSimpleProxyRoute('/api/auth/status');
   export { GET };
   ```

3. **环境变量**：
   ```typescript
   // 旧方式
   const backendUrl = process.env.PYTHON_BACKEND_HOST || 'http://localhost:8001';
   
   // 新方式
   import { config } from '@/lib/config';
   const backendUrl = config.pythonBackendHost;
   ```

## 📝 最佳实践

1. **优先使用模板**：除非有特殊需求，否则使用预定义模板
2. **统一错误处理**：让模板处理错误，避免重复代码
3. **合理使用缓存**：对于配置类API使用缓存模板
4. **日志记录**：利用内置的日志功能进行调试
5. **类型安全**：使用TypeScript类型定义确保类型安全
