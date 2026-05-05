#!/bin/bash
# 健康检查脚本 - 用于 CI/CD 部署验证

set -e

MAX_RETRIES=30
RETRY_INTERVAL=2

echo "🔍 健康检查开始..."

# 检查后端服务
echo "检查后端服务..."
for i in $(seq 1 $MAX_RETRIES); do
    if curl -f http://localhost:8001/health > /dev/null 2>&1; then
        echo "✅ 后端服务正常 (第 $i 次尝试)"
        BACKEND_OK=1
        break
    fi
    
    if [ $i -eq $MAX_RETRIES ]; then
        echo "❌ 后端服务启动失败"
        echo "最后 50 行日志:"
        tail -n 50 /opt/deepwiki/logs/backend.log || echo "无法读取后端日志"
        exit 1
    fi
    
    echo "   等待后端启动... ($i/$MAX_RETRIES)"
    sleep $RETRY_INTERVAL
done

# 检查前端服务
echo "检查前端服务..."
for i in $(seq 1 $MAX_RETRIES); do
    if curl -f http://localhost:3000 > /dev/null 2>&1; then
        echo "✅ 前端服务正常 (第 $i 次尝试)"
        FRONTEND_OK=1
        break
    fi
    
    if [ $i -eq $MAX_RETRIES ]; then
        echo "❌ 前端服务启动失败"
        echo "最后 50 行日志:"
        tail -n 50 /opt/deepwiki/logs/frontend.log || echo "无法读取前端日志"
        exit 1
    fi
    
    echo "   等待前端启动... ($i/$MAX_RETRIES)"
    sleep $RETRY_INTERVAL
done

echo ""
echo "✅ 所有服务健康检查通过！"
exit 0

