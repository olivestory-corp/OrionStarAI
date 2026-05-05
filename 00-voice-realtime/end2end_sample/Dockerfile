# ========================================
# Stage 1: Build Frontend
# ========================================
# 使用 AWS ECR Public 镜像避免 Docker Hub 限流
FROM public.ecr.aws/docker/library/node:20-slim AS frontend-builder

WORKDIR /app/client

# 配置 npm 提高网络稳定性
RUN npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm config set fetch-timeout 300000

# 复制前端依赖文件和必要脚本（postinstall 需要）
COPY client/package*.json ./
COPY client/scripts ./scripts/
RUN npm install --prefer-offline --no-audit --progress=false || \
    npm install --prefer-offline --no-audit --progress=false || \
    npm install --prefer-offline --no-audit --progress=false

# 复制 shared 目录（client 依赖 shared/types/protocol）
COPY shared/ /app/shared/

# 复制前端源码并构建
COPY client/ ./
RUN npm run build

# ========================================
# Stage 2: Build Backend
# ========================================
FROM public.ecr.aws/docker/library/node:20-slim AS backend-builder

# 安装编译原生模块所需的依赖（@discordjs/opus 需要）
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    libopus-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 配置 npm 提高网络稳定性
RUN npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm config set fetch-timeout 300000

# 复制后端依赖文件
COPY server/package*.json ./server/
RUN cd server && (npm install --prefer-offline --no-audit --progress=false || \
    npm install --prefer-offline --no-audit --progress=false || \
    npm install --prefer-offline --no-audit --progress=false)

# 复制 shared 目录（server 依赖）
COPY shared/ ./shared/

# 复制后端源码并编译
COPY server/ ./server/
RUN cd server && npm run build

# ========================================
# Stage 3: Production Runtime
# ========================================
FROM public.ecr.aws/docker/library/node:20-slim AS production

# 安装运行时依赖（opus 原生模块需要）
RUN apt-get update && apt-get install -y --no-install-recommends \
    libopus0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 直接从 backend-builder 复制已编译的 node_modules（包含原生模块）
COPY --from=backend-builder /app/server/node_modules ./server/node_modules

# 复制编译后的后端代码
COPY --from=backend-builder /app/server/dist ./server/dist

# 复制 shared 目录（运行时可能需要）
COPY --from=backend-builder /app/shared ./shared

# 复制后端源码中的数据文件（store_data, knowledgeBase 等）
COPY server/src/store_data ./server/src/store_data
COPY server/src/knowledgeBase ./server/src/knowledgeBase

# 复制前端构建产物到正确位置
# 根据 index.ts: path.join(__dirname, '..', '..', 'client', 'build')
# __dirname = /app/server/dist/server/src，所以需要放到 /app/server/dist/client/build
COPY --from=frontend-builder /app/client/build ./server/dist/client/build

# 复制环境变量文件和密钥
COPY server/.env.production ./server/.env.production
COPY server/key/key.json ./server/key/key.json

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=8081
ENV GOOGLE_APPLICATION_CREDENTIALS=key/key.json

# 暴露端口
EXPOSE 8081

# 健康检查（使用 node 代替 wget）
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8081/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# 工作目录切换到 server
WORKDIR /app/server

# 启动服务
CMD ["node", "dist/server/src/index.js"]
