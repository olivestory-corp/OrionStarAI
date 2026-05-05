# DeepV-Ki Docker 部署指南

本文档介绍如何使用 Docker 部署 DeepV-Ki，包括 GitLab CI/CD 自动部署和手动部署。

---

## 📋 **部署架构**

```
Docker 容器内：
├─ 前端 (Next.js)     → 端口 3000（外部访问）
├─ 后端 (FastAPI)     → 端口 8001（仅容器内部）
└─ Cron 定时任务      → 每天 3:00 自动更新 Wiki
```

**特点：**
- ✅ **预构建前端**：`.next` 目录已在 git 中，无需容器内构建
- ✅ **轻量级镜像**：默认不安装 Playwright，只用 mermaid.ink API
- ✅ **统一代理**：前端转发后端请求，简化网络配置
- ✅ **自动部署**：GitLab CI/CD 监听 release tag，自动构建和部署

---

## 🚀 **快速开始：GitLab CI/CD 自动部署**

### 1. 配置 GitLab Runner

确保您的 GitLab 项目已配置 Runner，并添加 `ubuntu` 标签。

### 2. 配置环境变量

在 GitLab 项目中添加 CI/CD 变量 `DOTENV_FILE_CONTENT`：

```bash
OPENAI_API_KEY=sk-xxxxxxxx
GOOGLE_API_KEY=AIzaxxxxxxxx
GITLAB_URL=https://gitlab.your-company.com
GITLAB_PRIVATE_TOKEN=glpat-xxxxxxxx
SSO_LOGIN_URL=https://oa.your-company.com/r/w
SSO_API_URL=https://oa.your-company.com/openapi
SSO_APP_ID=your_app_id
SSO_APP_SECRET=your_app_secret
NEXT_PUBLIC_API_URL=https://deepvki.example.com
PYTHON_BACKEND_HOST=http://localhost:8001
```

### 3. 触发部署

推送 release tag：

```bash
git tag release-1.0.0
git push origin release-1.0.0
```

GitLab CI/CD 将自动：
1. 构建 Docker 镜像
2. 停止旧容器
3. 启动新容器
4. 挂载持久化数据

---

## 🛠️ **手动部署（本地测试）**

### 1. 准备环境

创建 `.env` 文件：

```bash
cp .env.example .env
vim .env  # 填写您的配置
```

### 2. 构建镜像

```bash
docker build -t deepvki:latest .
```

**构建时间**：约 3-5 分钟（因为前端已预构建）

### 3. 启动容器

```bash
docker run -d \
  --name deepvki \
  -p 3000:3000 \
  -p 8001:8001 \
  --env-file .env \
  --restart unless-stopped \
  -v $(pwd)/data:/root/.adalflow \
  -v $(pwd)/logs:/app/api/logs \
  deepvki:latest
```

### 4. 验证部署

```bash
# 查看日志
docker logs -f deepvki

# 访问前端
curl http://localhost:3000

# 访问后端 API
curl http://localhost:8001/api/health
```

---

## 🎨 **Mermaid 图表渲染策略**

### 默认：轻量级（mermaid.ink API）

**默认配置**：只用 `mermaid.ink` API，无需安装 Playwright。

**优点**：
- ✅ 镜像小（约 1GB）
- ✅ 启动快
- ✅ 无需系统依赖

**缺点**：
- ❌ 依赖外部服务（需网络连接）
- ❌ API 限流可能影响渲染

---

### 可选：离线渲染（Playwright）

**适用场景**：内网环境或需要 100% 离线渲染。

**启用方法**：

#### 方法 1：修改 Dockerfile

取消注释第 31-32 行：

```dockerfile
# Dockerfile (第 31-32 行)
RUN pip install --no-cache playwright && playwright install --with-deps chromium
```

重新构建镜像：

```bash
docker build -t deepvki:latest .
```

#### 方法 2：运行时安装（已有容器）

```bash
docker exec -it deepvki bash

# 在容器内执行
pip install playwright
playwright install --with-deps chromium
```

**注意**：启用 Playwright 会增加约 **400MB** 镜像大小。

---

## 📊 **数据持久化**

容器挂载两个目录：

| 容器内路径 | 宿主机路径 | 说明 |
|-----------|-----------|------|
| `/root/.adalflow` | `/opt/deepvki/data` | Wiki 数据、FAISS 索引、SQLite 数据库 |
| `/app/api/logs` | `/opt/deepvki/logs` | 后端日志 |

**备份数据**：

```bash
# 备份所有数据
tar -czf deepvki-backup-$(date +%Y%m%d).tar.gz /opt/deepvki/data /opt/deepvki/logs

# 恢复数据
tar -xzf deepvki-backup-YYYYMMDD.tar.gz -C /
```

---

## 🔧 **常见问题**

### 1. **前端显示空白页**

**原因**：`.next` 目录未被复制到镜像。

**解决**：检查 `.dockerignore` 是否正确配置：

```bash
# .dockerignore 应该包含：
# .next/  # ✅ 保留：前端已在 git 中预构建
.next/cache/  # ❌ 排除：构建缓存不需要
```

---

### 2. **Mermaid 图表全部失败**

**原因**：mermaid.ink API 无法访问，且未安装 Playwright。

**解决**：
- **方案 1**：确保容器能访问 `https://mermaid.ink`
- **方案 2**：启用 Playwright 离线渲染（见上文）

---

### 3. **容器内存不足**

**原因**：Node.js 内存限制。

**解决**：增加 Docker 容器内存限制：

```bash
docker run -d \
  --name deepvki \
  --memory=4g \
  --memory-swap=4g \
  -p 3000:3000 \
  ...
```

---

### 4. **GitLab CI/CD 构建失败**

**原因**：`DOTENV_FILE_CONTENT` 变量未配置。

**解决**：在 GitLab 项目 Settings → CI/CD → Variables 中添加该变量。

---

## 📦 **镜像大小优化**

| 配置 | 镜像大小 | 说明 |
|-----|---------|------|
| **默认**（mermaid.ink API） | ~1.0 GB | 推荐，适合大多数场景 |
| **启用 Playwright** | ~1.4 GB | 离线渲染，内网环境 |

**进一步优化**：
- 使用 Alpine 基础镜像（需修改 Python 依赖）
- 多阶段构建清理缓存（已实现）
- 删除不必要的系统工具

---

## 🔄 **更新部署**

### 方法 1：GitLab CI/CD（推荐）

```bash
git tag release-1.0.1
git push origin release-1.0.1
```

### 方法 2：手动更新

```bash
# 1. 拉取最新代码
git pull origin main

# 2. 重新构建镜像
docker build -t deepvki:latest .

# 3. 停止并删除旧容器
docker stop deepvki && docker rm deepvki

# 4. 启动新容器
docker run -d \
  --name deepvki \
  -p 3000:3000 \
  -p 8001:8001 \
  --env-file .env \
  --restart unless-stopped \
  -v /opt/deepvki/data:/root/.adalflow \
  -v /opt/deepvki/logs:/app/api/logs \
  deepvki:latest
```

---

## 📝 **环境变量说明**

| 变量名 | 必填 | 默认值 | 说明 |
|-------|------|--------|------|
| `OPENAI_API_KEY` | ❌ | - | OpenAI API 密钥 |
| `GOOGLE_API_KEY` | ❌ | - | Google Gemini API 密钥 |
| `GITLAB_URL` | ✅ | - | GitLab 实例地址 |
| `GITLAB_PRIVATE_TOKEN` | ✅ | - | GitLab 访问令牌 |
| `SSO_LOGIN_URL` | ❌ | - | SSO 登录地址 |
| `SSO_API_URL` | ❌ | - | SSO API 地址 |
| `SSO_APP_ID` | ❌ | - | SSO 应用 ID |
| `SSO_APP_SECRET` | ❌ | - | SSO 应用密钥 |
| `NEXT_PUBLIC_API_URL` | ✅ | `https://deepvki.example.com` | 前端访问的 API 地址 |
| `PYTHON_BACKEND_HOST` | ✅ | `http://localhost:8001` | 后端服务地址 |

---

## 🎯 **最佳实践**

1. ✅ **定期备份数据**：每周备份 `/opt/deepvki/data`
2. ✅ **监控日志**：定期检查 `/opt/deepvki/logs` 中的错误
3. ✅ **使用 release tag**：每次发版打 tag，避免意外部署
4. ✅ **环境变量加密**：GitLab CI/CD 变量设置为 Protected + Masked
5. ✅ **资源限制**：为容器设置内存和 CPU 限制
6. ✅ **健康检查**：配置 Docker healthcheck（见下文）

---

## 💊 **健康检查（可选）**

在 `docker-compose.yml` 中添加：

```yaml
services:
  deepvki:
    image: deepvki:latest
    ports:
      - "3000:3000"
      - "8001:8001"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000", "||", "exit", "1"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

---

## 📞 **技术支持**

遇到问题？参考以下资源：
- 📖 **部署指南**：`docs/DEPLOYMENT.md`
- 🐛 **故障排查**：`docs/TROUBLESHOOTING.md`
- 🔧 **性能优化**：`docs/PERFORMANCE_DIAGNOSIS.md`
- 📝 **数据库迁移**：`docs/DATABASE_MIGRATION_GUIDE.md`

