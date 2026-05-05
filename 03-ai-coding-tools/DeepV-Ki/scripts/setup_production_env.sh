#!/bin/bash
# 生产环境配置脚本
# 自动将 SSO_CALLBACK_URL 和 FRONTEND_URL 设置为生产环境地址

set -e

echo "🔧 配置生产环境变量..."

# 服务器域名（可通过环境变量覆盖）
SERVER_DOMAIN="${SERVER_DOMAIN:-deepwiki.example.com}"
SERVER_PROTOCOL="${SERVER_PROTOCOL:-https}"

# 构建完整 URL
SSO_CALLBACK_URL="${SERVER_PROTOCOL}://${SERVER_DOMAIN}/api/auth/sso/callback"
FRONTEND_URL="${SERVER_PROTOCOL}://${SERVER_DOMAIN}"

echo "📝 生产环境配置："
echo "   SSO_CALLBACK_URL=${SSO_CALLBACK_URL}"
echo "   FRONTEND_URL=${FRONTEND_URL}"

# 检查 .env 文件是否存在
if [ ! -f .env ]; then
    echo "❌ .env 文件不存在！"
    exit 1
fi

# 备份原始 .env
cp .env .env.backup.$(date +%Y%m%d_%H%M%S)

# 使用 sed 替换配置
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s|^SSO_CALLBACK_URL=.*|SSO_CALLBACK_URL=${SSO_CALLBACK_URL}|" .env
    sed -i '' "s|^FRONTEND_URL=.*|FRONTEND_URL=${FRONTEND_URL}|" .env
else
    # Linux
    sed -i "s|^SSO_CALLBACK_URL=.*|SSO_CALLBACK_URL=${SSO_CALLBACK_URL}|" .env
    sed -i "s|^FRONTEND_URL=.*|FRONTEND_URL=${FRONTEND_URL}|" .env
fi

echo "✅ 生产环境配置完成！"
echo ""
echo "⚠️  请确保 OA 系统中的回调地址也配置为："
echo "   ${SSO_CALLBACK_URL}"

