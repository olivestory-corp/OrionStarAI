# SSO 生产环境部署配置指南

## 🚨 **重要提醒**

SSO 回调地址必须与实际部署地址一致，否则登录后会跳转到错误的地址！

---

## 📋 **配置清单**

### 1. **DeepV-Ki 配置**

#### 方式 A：GitLab CI/CD 变量（推荐）

1. 访问 GitLab CI/CD 设置：
   ```
   https://gitlab.example.net/ai/deepvki/-/settings/ci_cd
   ```

2. 展开 **Variables** 部分，编辑 `DOTENV_FILE_CONTENT`

3. 修改以下配置：
   ```bash
   # 开发环境配置（保持不变）
   # SSO_CALLBACK_URL=http://localhost:3000/api/auth/sso/callback
   # FRONTEND_URL=http://localhost:3000
   
   # 生产环境配置（修改为服务器地址）
   SSO_CALLBACK_URL=https://deepvki.example.com/api/auth/sso/callback
   FRONTEND_URL=https://deepvki.example.com
   ```

4. 保存后，下次部署自动生效 ✅

#### 方式 B：自动化脚本（已集成到 CI/CD）

CI/CD 会自动运行 `scripts/setup_production_env.sh`，将 URL 设置为：
- `SSO_CALLBACK_URL=https://deepvki.example.com/api/auth/sso/callback`
- `FRONTEND_URL=https://deepvki.example.com`

**如果服务器域名不是 `deepvki.example.com`**，请修改 `.gitlab-ci.yml`：

```yaml
- SERVER_DOMAIN="your-domain.com" SERVER_PROTOCOL="https" ./scripts/setup_production_env.sh
```

---

### 2. **OA 系统配置**

#### 步骤

1. **登录 OA 管理后台**

2. **找到第三方应用管理**

3. **编辑 DeepV-Ki 应用配置**

4. **设置回调地址为**：
   ```
   https://deepvki.example.com/api/auth/sso/callback
   ```

5. **保存配置**

#### 验证

访问：
```
https://deepvki.example.com
```

点击 SSO 登录，登录成功后应该跳转回：
```
https://deepvki.example.com
```

而不是 `http://localhost:3000`

---

## 🔍 **常见问题**

### Q1: SSO 登录后跳转到 localhost

**原因**：`SSO_CALLBACK_URL` 配置为开发环境地址

**解决**：
1. 检查 GitLab CI/CD 变量中的 `DOTENV_FILE_CONTENT`
2. 确认 `SSO_CALLBACK_URL=https://deepvki.example.com/api/auth/sso/callback`
3. 重新部署

### Q2: SSO 登录失败，显示 "回调地址不匹配"

**原因**：OA 系统配置的回调地址与 DeepV-Ki 配置不一致

**解决**：
1. 检查 OA 系统配置的回调地址
2. 确认与 `SSO_CALLBACK_URL` 一致
3. 两边都使用 `https://deepvki.example.com/api/auth/sso/callback`

### Q3: 本地开发如何配置？

**本地开发**保持默认配置即可：
```bash
SSO_CALLBACK_URL=http://localhost:3000/api/auth/sso/callback
FRONTEND_URL=http://localhost:3000
```

**但需要在 OA 系统中**同时配置开发和生产两个回调地址：
- 开发：`http://localhost:3000/api/auth/sso/callback`
- 生产：`https://deepvki.example.com/api/auth/sso/callback`

---

## 🚀 **部署流程**

### 自动部署（推荐）

```bash
# 1. 推送到 main 分支，自动触发 CI/CD
git push origin main

# 2. CI/CD 自动执行：
#    - 构建前端
#    - 配置生产环境 URL
#    - 部署到服务器
#    - 启动服务

# 3. 验证
curl https://deepvki.example.com/api/health
```

### 手动部署

```bash
# 1. 在服务器上
cd /opt/deepvki

# 2. 拉取最新代码
git pull origin main

# 3. 配置生产环境 URL
chmod +x scripts/setup_production_env.sh
SERVER_DOMAIN="deepvki.example.com" SERVER_PROTOCOL="https" ./scripts/setup_production_env.sh

# 4. 重启服务
./start_server.sh --restart

# 5. 验证
curl http://localhost:8001/api/health
curl http://localhost:3000
```

---

## 📝 **环境变量参考**

### 开发环境 (.env.development)

```bash
SSO_CALLBACK_URL=http://localhost:3000/api/auth/sso/callback
FRONTEND_URL=http://localhost:3000
```

### 生产环境 (.env.production)

```bash
SSO_CALLBACK_URL=https://deepvki.example.com/api/auth/sso/callback
FRONTEND_URL=https://deepvki.example.com
```

---

## ✅ **检查清单**

部署前请确认：

- [ ] GitLab CI/CD 变量 `DOTENV_FILE_CONTENT` 包含正确的生产 URL
- [ ] OA 系统配置了正确的回调地址
- [ ] 服务器域名解析正确（`deepvki.example.com` 指向服务器 IP）
- [ ] HTTPS 证书配置正确（如果使用 HTTPS）
- [ ] 防火墙允许 80/443 端口访问

---

## 🔗 **相关链接**

- GitLab CI/CD: https://gitlab.example.net/ai/deepvki/-/settings/ci_cd
- 生产环境: https://deepvki.example.com
- 健康检查: https://deepvki.example.com/api/health

