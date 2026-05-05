<div align="center">

# 🚀 DeepV Code Server

### **轻量级 AI 代理服务器**

*赋能开发者，加速创新*

<br>

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-43853D.svg?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-Supported-2496ED.svg?logo=docker&logoColor=white)](https://www.docker.com/)

<br>

[English](./README.md) | **简体中文**

<br>

</div>

---

# DeepV Code Server (deepx-mini-server)

> ⭐ **如果这个项目对你有帮助，请给我们一个 Star！** 您的支持是我们继续开发的动力。
>
> 🍴 **想要贡献代码？** 我们欢迎 Fork 和 Pull Request！无论是 Bug 修复、功能改进还是新特性，我们都期待您的参与。

---

## 💡 企业级 API KEY 解决方案

如果您没有 API Key，请联系我们提供企业云方案。我们是 **Google Cloud 认证合作伙伴**，能为您提供物美价廉的企业级 API KEY，包括：
- Claude 系列
- Gemini 系列
- OpenAI
- 其他开源大模型

**📞 联系我们**: [http://cmcm.bot/](http://cmcm.bot/)
**📖 了解更多**: [https://www.polymericcloud.com/](https://www.polymericcloud.com/)

---

这是一个为 [**DeepV Code 客户端**](https://github.com/OrionStarAI/DeepVCode) 提供的基础服务项目，作为一个轻量级的 AI 代理服务器，支持 **Vertex AI** 和 **OpenRouter**。

## 项目说明

本项目旨在为 DeepV Code 客户端提供统一的 AI 接口访问层，处理不同 AI 供应商（如 Google Vertex AI 和 OpenRouter）的鉴权、请求转发和响应格式转换。

### 主要功能

- **多供应商支持**：集成 Google Vertex AI 和 OpenRouter。
- **统一接口**：提供统一的聊天接口，支持流式（Streaming）和非流式响应。
- **格式转换**：自动将不同供应商的响应格式转换为统一的 Google AI 格式。
- **Mock 鉴权**：内置 Mock JWT 登录接口，方便开发和测试。

## 敏感信息清理建议

在提交或公开代码前，请确保以下信息已处理：

1.  **环境变量**：`.env` 文件已在 `.gitignore` 中，请确保不要将其提交。
2.  **密钥文件**：`key/` 目录下的所有 JSON 凭证文件已在 `.gitignore` 中。
3.  **调试日志**：建议将 `.deepvcode/` 目录添加到 `.gitignore` 中，因为它包含请求和响应的详细日志（可能包含 API Key 或私有数据）。
4.  **Mock 数据**：`src/routes.ts` 中的 `deepvlab-login` 接口包含硬编码的测试邮箱和头像信息，建议根据需要进行清理或脱敏。

## 快速开始

### 环境要求

- Node.js (建议 v18+)
- npm 或 yarn

### 安装依赖

```bash
npm install
```

### 配置环境

1. 复制环境变量模板：
   ```bash
   cp .env.example .env
   ```
2. 编辑 `.env` 文件，填入必要的配置信息：
   - `OPENROUTER_API_KEY`: 你的 OpenRouter API 密钥。
   - `VERTEX_CREDENTIALS_PATHS`: Vertex AI 服务账号 JSON 文件的路径。
   - `GOOGLE_API_KEY`: (可选) Google API 密钥。

### 启动项目

#### 开发模式 (支持热重载)

```bash
npm run dev
```

#### 调试模式 (输出详细日志)

```bash
npm run dev:debug
```

#### 生产模式

**方法 1: 直接启动（简单但不推荐）**

```bash
npm run build
npm run start:prod
```

**方法 2: PM2 进程管理（推荐）**

PM2 提供自动重启、日志管理、进程监控等生产级功能。

首先全局安装 PM2：
```bash
npm install -g pm2
```

然后启动应用：
```bash
npm run pm2:start        # 启动应用（自动编译+启动）
pm2 monit               # 监控应用状态和性能
npm run pm2:logs        # 查看实时日志
npm run pm2:restart     # 重启应用（需要重新编译）
npm run pm2:reload      # 优雅重启（零停机）
pm2 kill                # 停止所有应用
npm run pm2:delete      # 停止并删除应用
```

启用系统启动时自动运行：
```bash
npm run pm2:startup     # 配置开机自启
pm2 save               # 保存当前配置
```

**方法 3: Docker 容器化部署（最佳实践）**

使用 Docker 可以确保生产环境的一致性和隔离。

构建镜像：
```bash
docker build -t deepx-mini-server:latest .
```

使用 docker-compose 启动（推荐）：
```bash
docker-compose up -d        # 后台启动
docker-compose logs -f      # 查看日志
docker-compose ps          # 查看容器状态
docker-compose stop        # 停止服务
docker-compose down        # 停止并移除容器
```

或直接运行 Docker 容器：
```bash
docker run -d \
  --name deepx-mini-server \
  -p 3001:3001 \
  -e NODE_ENV=production \
  -e OPENROUTER_API_KEY=your_key_here \
  -v ./key:/app/key:ro \
  -v ./logs:/app/logs \
  --restart unless-stopped \
  deepx-mini-server:latest
```

**方法 4: Systemd 服务（Linux 系统原生方案）**

将 `deepx-mini-server.service` 复制到 systemd 目录：

```bash
sudo cp deepx-mini-server.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable deepx-mini-server    # 启用开机自启
sudo systemctl start deepx-mini-server     # 启动服务
sudo systemctl status deepx-mini-server    # 查看状态
sudo journalctl -u deepx-mini-server -f    # 查看日志
```

## 客户端连接

### 配置代理服务器地址

根据你使用的客户端类型，按以下步骤配置代理服务器地址：

#### DeepV Code CLI (命令行工具)

1. 在用户 home 目录下找到 `.deepv/` 文件夹（用户 home 目录位置如下）：
   - **macOS**: `~/.deepv/settings.json` 或 `/Users/你的用户名/.deepv/settings.json`
   - **Windows**: `C:\Users\你的用户名\.deepv\settings.json`

2. 打开 `settings.json` 文件

3. 添加或修改 `customProxyServerUrl` 配置项，例如：
   ```json
   {
     "customProxyServerUrl": "http://localhost:3001"
   }
   ```

4. **重启 CLI** 使配置生效

#### DeepV Code for VSCode (VSCode 扩展)

1. 打开 VSCode 的扩展设置
2. 搜索 `Custom Proxy Server Url`
3. 在设置中填入代理服务器地址，例如：
   ```
   http://localhost:3001
   ```
4. **重启 VSCode** 使配置生效

**服务器地址示例：**
- 本地开发: `http://localhost:3001`
- 远程服务: `https://your-server-domain.com`

## 接口说明

- **POST `/v1/chat/messages`**: 统一聊天接口。
- **POST `/v1/chat/stream`**: 统一流式聊天接口。
- **POST `/auth/jwt/deepvlab-login`**: Mock 登录接口，返回测试用的 JWT Token。
- **GET `/health`**: 健康检查接口。

## 生产部署最佳实践

### 选择合适的部署方案

| 方案 | 场景 | 优点 | 缺点 |
|------|------|------|------|
| PM2 | 单机部署 | 简单易用，自动重启，日志管理 | 不支持水平扩展 |
| Docker + docker-compose | 开发/小规模生产 | 环境一致性好，便于扩展 | 需要 Docker 基础 |
| Kubernetes | 大规模生产 | 高可用，自动扩展，负载均衡 | 学习曲线陡，配置复杂 |
| Systemd | Linux 原生方案 | 系统级别，资源隔离好 | 仅限 Linux，功能相对简陋 |

### 推荐方案排序

1. **小规模 & 单机** → PM2
2. **中等规模 & 需要一致性** → Docker Compose
3. **大规模 & 高可用** → Kubernetes
4. **Linux 系统优先** → Systemd

### 性能优化建议

```bash
# 1. 启用集群模式（充分利用多核 CPU）
# 已在 ecosystem.config.js 中配置为 'cluster' 模式

# 2. 设置合理的进程数
# instances: 'max' 会自动使用全部 CPU 核心

# 3. 使用反向代理（Nginx）处理静态资源和负载均衡
# 推荐配置见 nginx.conf.example

# 4. 配置内存上限防止内存泄漏
# max_memory_restart: '1G' 会在内存超过 1GB 时自动重启

# 5. 启用 gzip 压缩（在反向代理层配置）
```

### 监控和告警

使用 PM2 Plus（付费但值得）：
```bash
pm2 link  # 链接到 PM2 Plus Dashboard
```

或者使用开源方案：
```bash
# 监控进程状态
pm2 monit

# 导出日志用于分析
pm2 save
pm2 logs --lines 1000 > server.log
```

### 环境变量管理

**生产环境敏感信息处理：**

不要将敏感信息存储在代码中，使用环境变量：

```bash
# .env.production（不提交到 Git）
NODE_ENV=production
PORT=3001
HOST=0.0.0.0
OPENROUTER_API_KEY=sk-xxxxx
VERTEX_CREDENTIALS_PATHS=/opt/deepx-mini-server/key/creds.json
CORS_ORIGIN=https://yourdomain.com
```

使用 docker-compose 时，参考 `.env` 文件：
```bash
docker-compose --env-file .env.production up -d
```

## 技术栈

- **Express**: Web 框架。
- **TypeScript**: 编程语言。
- **tsx**: 开发环境运行工具。
- **Google Auth Library**: 处理 Google Cloud 鉴权。
- **PM2**: 生产级进程管理器。
- **Docker**: 容器化部署。
