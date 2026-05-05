# GitLab CI/CD 自动部署指南（无 Docker 版）

本文档介绍如何配置 GitLab CI/CD 使用 `start_server.sh` 直接部署 DeepV-Ki 到服务器。

---

## 🎯 **部署架构**

```
开发者推送代码
    ↓
GitLab CI/CD 触发
    ↓
服务器上自动执行：
├─ 1. git pull（拉取最新代码）
├─ 2. npm run build（重新构建前端）
├─ 3. start_server.sh --kill（停止旧服务）
├─ 4. start_server.sh（启动新服务）
└─ 5. 健康检查（验证服务正常）
```

**特点**：
- ⚡ **快速**：20-30 秒完成部署
- 🎯 **简单**：直接在服务器上运行，无容器开销
- 🔄 **自动**：推送代码即自动部署
- 🛡️ **安全**：环境变量存储在 GitLab CI/CD Variables

---

## 📋 **前置条件**

### 1. 服务器环境

- ✅ Python 3.11+
- ✅ Node.js 20+
- ✅ Git
- ✅ 项目克隆到 `/opt/deepvki`

### 2. GitLab Runner

确保服务器上已安装并注册 GitLab Runner：

```bash
# 安装 GitLab Runner（Ubuntu/Debian）
curl -L https://packages.gitlab.com/install/repositories/runner/gitlab-runner/script.deb.sh | sudo bash
sudo apt-get install gitlab-runner

# 注册 Runner
sudo gitlab-runner register
# 输入 GitLab URL: https://gitlab.example.net
# 输入 Token: (从 GitLab 项目 Settings → CI/CD → Runners 获取)
# 输入 Tags: ubuntu
# 输入 Executor: shell
```

**验证 Runner**：
```bash
sudo gitlab-runner list
# 应该看到注册的 Runner
```

### 3. 服务器权限

GitLab Runner 用户需要对项目目录有写权限：

```bash
# 将 gitlab-runner 用户添加到项目所有者组
sudo usermod -aG $(stat -c '%G' /opt/deepvki) gitlab-runner

# 或者直接授权
sudo chown -R gitlab-runner:gitlab-runner /opt/deepvki
```

---

## 🔧 **配置步骤**

### 步骤 1：配置 GitLab CI/CD 变量

**路径**：GitLab 项目 → Settings → CI/CD → Variables

添加变量 `DOTENV_FILE_CONTENT`：

```ini
OPENAI_API_KEY=sk-xxxxxxxx
GOOGLE_API_KEY=AIzaxxxxxxxx
GITLAB_URL=https://gitlab.example.net
GITLAB_PRIVATE_TOKEN=glpat-xxxxxxxx
SSO_LOGIN_URL=https://oa.example.com/r/w
SSO_API_URL=https://oa.example.com/openapi
SSO_APP_ID=deepvki
SSO_APP_SECRET=xxxxxxxx
NEXT_PUBLIC_API_URL=https://deepvki.example.com
PYTHON_BACKEND_HOST=http://localhost:8001
NODE_ENV=production
```

**安全设置**：
- ✅ Type: `Variable`
- ✅ Protected: `是`（仅 main 分支和 protected tags 可用）
- ✅ Masked: `是`（日志中隐藏）
- ❌ Expand variable reference: `否`

---

### 步骤 2：验证 `.gitlab-ci.yml`

项目根目录的 `.gitlab-ci.yml` 已配置好，内容如下：

```yaml
stages:
  - deploy

workflow:
  rules:
    - if: '$CI_COMMIT_BRANCH == "main"'
    - if: '$CI_COMMIT_TAG =~ /^release-\d+\.\d+\.\d+$/'

deploy-job:
  stage: deploy
  script:
    - cd /opt/deepvki
    - git fetch origin
    - git reset --hard origin/$CI_COMMIT_BRANCH || git reset --hard $CI_COMMIT_TAG
    - cat "$DOTENV_FILE_CONTENT" > .env
    - npm run build
    - ./start_server.sh --kill || true
    - sleep 2
    - ./start_server.sh --verbose
    - sleep 5
    - curl -f http://localhost:3000 > /dev/null 2>&1
    - curl -f http://localhost:8001/api/health > /dev/null 2>&1
  tags:
    - ubuntu
  environment:
    name: production
    url: https://deepvki.example.com
```

---

### 步骤 3：首次部署测试

```bash
# 1. 推送代码到 main 分支
git add .
git commit -m "测试 CI/CD 自动部署"
git push origin main

# 2. 在 GitLab 查看 Pipeline
# 路径: 项目 → CI/CD → Pipelines

# 3. 查看部署日志
# 点击 Pipeline → deploy-job → 查看日志
```

---

## 🚀 **日常使用**

### 场景 1：日常开发（90%）

```bash
# 开发者本地
git add .
git commit -m "修复用户登录 bug"
git push origin main

# ✅ GitLab CI/CD 自动部署（20-30 秒）
```

---

### 场景 2：正式发版（10%）

```bash
# Maintainer 本地
git tag release-1.0.1 -m "🚀 版本 1.0.1

## 新特性
- 支持批量导出 Wiki
- 优化 Mermaid 渲染性能

## Bug 修复
- 修复登录超时问题
- 修复前端缓存错误
"
git push origin release-1.0.1

# ✅ GitLab CI/CD 自动部署（20-30 秒）
```

---

### 场景 3：紧急回滚

```bash
# 方法 1：回滚到上一个提交
git revert HEAD
git push origin main

# 方法 2：回滚到指定版本
git reset --hard <commit-hash>
git push origin main --force  # ⚠️ 需要 Maintainer 权限

# 方法 3：重新部署旧 tag
git push origin :refs/tags/release-1.0.1  # 删除 tag
git tag release-1.0.1 <old-commit-hash>
git push origin release-1.0.1
```

---

## 📊 **部署时间分析**

```
总计: ~20-30 秒

├─ git pull            ~2 秒
├─ npm run build       ~15 秒（利用缓存）
├─ 停止旧服务           ~2 秒
├─ 启动新服务           ~3 秒
├─ 健康检查            ~5 秒
└─ 日志输出            ~3 秒
```

**停机时间**：~3-5 秒（从停止旧服务到新服务启动）

---

## 🔍 **故障排查**

### 问题 1：Pipeline 失败 - "项目目录不存在"

**原因**：服务器上没有克隆项目

**解决**：
```bash
# 在服务器上执行
sudo mkdir -p /opt/deepvki
cd /opt
sudo git clone https://gitlab.example.net/ai/deepvki.git
sudo chown -R gitlab-runner:gitlab-runner /opt/deepvki
```

---

### 问题 2：Pipeline 失败 - "前端构建失败"

**原因**：Node.js 版本过低或内存不足

**解决**：
```bash
# 检查 Node.js 版本
node -v  # 应该是 v20.x

# 如果版本过低，升级
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20

# 如果内存不足，增加 Node.js 内存限制
export NODE_OPTIONS="--max-old-space-size=4096"
```

---

### 问题 3：Pipeline 成功但服务未启动

**原因**：Python 虚拟环境未激活或依赖缺失

**解决**：
```bash
# 在服务器上手动测试
cd /opt/deepvki
source .venv/bin/activate
pip install -r api/requirements.txt
./start_server.sh --verbose
```

---

### 问题 4：健康检查失败

**原因**：服务启动时间超过 5 秒

**解决**：修改 `.gitlab-ci.yml`，增加等待时间：
```yaml
- sleep 10  # 从 5 秒改为 10 秒
```

---

### 问题 5：权限不足

**原因**：gitlab-runner 用户无权限操作文件

**解决**：
```bash
# 授予权限
sudo chown -R gitlab-runner:gitlab-runner /opt/deepvki

# 或添加到用户组
sudo usermod -aG www-data gitlab-runner
```

---

## 📈 **监控和日志**

### 查看 Pipeline 日志

**路径**：GitLab 项目 → CI/CD → Pipelines → 点击 Pipeline → deploy-job

---

### 查看服务运行日志

```bash
# 后端日志
tail -f /opt/deepvki/logs/backend.log

# 前端日志
tail -f /opt/deepvki/logs/frontend.log

# 实时监控
watch -n 1 "curl -s http://localhost:3000 | head -n 5"
```

---

### 查看服务状态

```bash
# 检查进程
ps aux | grep -E "python.*api.main|node.*server.js"

# 检查端口
netstat -tlnp | grep -E "3000|8001"

# 快速健康检查
curl http://localhost:3000
curl http://localhost:8001/api/health
```

---

## 🔒 **安全最佳实践**

1. ✅ **环境变量加密**：使用 GitLab CI/CD Variables（Protected + Masked）
2. ✅ **限制触发条件**：只在 main 分支和 release tag 触发
3. ✅ **保护分支**：main 分支设为 Protected（Settings → Repository → Protected branches）
4. ✅ **日志脱敏**：敏感信息自动隐藏（Masked 变量）
5. ✅ **权限最小化**：gitlab-runner 用户只能访问 `/opt/deepvki`
6. ✅ **定期轮换密钥**：每季度更新 API Keys 和 Tokens

---

## 🆚 **对比：CI/CD vs 手动部署**

| 维度 | CI/CD 自动部署 | 手动部署 |
|-----|---------------|---------|
| **部署速度** | ⚡ 20-30 秒（自动） | ⏱️ 5-10 分钟（手动） |
| **出错概率** | ✅ 低（脚本标准化） | ⚠️ 高（人为操作） |
| **版本追溯** | ✅ 完整（每次 Pipeline） | ❌ 无（需手动记录） |
| **权限管理** | ✅ GitLab 统一管理 | ⚠️ SSH 权限分散 |
| **团队协作** | ✅ 所有人可触发 | ❌ 需要服务器权限 |
| **回滚速度** | ⚡ 30 秒 | ⏱️ 5 分钟 |

---

## 📚 **相关文档**

- **服务器部署指南**：`docs/DEPLOYMENT.md`
- **Docker 部署指南**：`docs/DOCKER_DEPLOYMENT.md`
- **性能诊断**：`docs/PERFORMANCE_DIAGNOSIS.md`
- **数据库迁移**：`docs/DATABASE_MIGRATION_GUIDE.md`

---

## 💡 **进阶优化**

### 1. 多环境部署

```yaml
# 开发环境
deploy-dev:
  environment:
    name: development
    url: http://dev.deepvki.com
  only:
    - develop

# 生产环境
deploy-prod:
  environment:
    name: production
    url: https://deepvki.example.com
  only:
    - main
    - tags
```

---

### 2. 蓝绿部署（零停机）

```bash
# 启动新版本（不同端口）
./start_server.sh --backend-only --port 8002 &
./start_server.sh --frontend-only --port 3001 &

# 更新 Nginx 配置切换流量
# ... nginx reload ...

# 停止旧版本
./start_server.sh --kill
```

---

### 3. 自动化测试

```yaml
stages:
  - test
  - deploy

test-job:
  stage: test
  script:
    - npm run test
    - pytest api/tests/
  only:
    - main
    - merge_requests
```

---

## 🎉 **总结**

**当前配置特点**：
- ✅ **简单**：无 Docker 复杂性
- ✅ **快速**：20-30 秒完成部署
- ✅ **稳定**：自动化流程，减少人为错误
- ✅ **安全**：环境变量加密，权限控制
- ✅ **可追溯**：每次部署有完整日志

**适用场景**：
- ✅ 50 人团队内部项目
- ✅ 独占服务器
- ✅ 快速迭代
- ✅ 可容忍短暂停机

---

**🚀 开始使用：推送代码到 main 分支，GitLab CI/CD 会自动部署！**

