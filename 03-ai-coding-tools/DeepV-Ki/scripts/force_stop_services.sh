#!/bin/bash

###############################################################################
# DeepV-Ki 强制停止服务脚本
# 用途：彻底清理所有相关进程和端口占用
###############################################################################

set -e

echo "🛑 DeepV-Ki 服务强制停止脚本"
echo "================================"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. 尝试使用 start_server.sh 正常停止
echo ""
echo "📋 步骤 1: 尝试正常停止服务..."
if [ -f "./start_server.sh" ]; then
    ./start_server.sh --kill 2>/dev/null || true
    echo -e "${GREEN}✓ start_server.sh --kill 已执行${NC}"
else
    echo -e "${YELLOW}⚠ start_server.sh 不存在，跳过${NC}"
fi

sleep 2

# 2. 强制杀死所有相关进程
echo ""
echo "📋 步骤 2: 强制杀死所有相关进程..."

# Next.js 前端进程
echo "  - 停止 Next.js 进程..."
pkill -9 -f "next" 2>/dev/null && echo -e "${GREEN}    ✓ 已停止 next 进程${NC}" || echo "    ℹ 无 next 进程"
pkill -9 -f "next-server" 2>/dev/null && echo -e "${GREEN}    ✓ 已停止 next-server${NC}" || echo "    ℹ 无 next-server 进程"
pkill -9 -f "node.*next" 2>/dev/null && echo -e "${GREEN}    ✓ 已停止 node next${NC}" || echo "    ℹ 无 node next 进程"

# Python/FastAPI 后端进程
echo "  - 停止 Python/FastAPI 进程..."
pkill -9 -f "python.*api.main" 2>/dev/null && echo -e "${GREEN}    ✓ 已停止 python api.main${NC}" || echo "    ℹ 无 python api.main 进程"
pkill -9 -f "uvicorn.*api.main" 2>/dev/null && echo -e "${GREEN}    ✓ 已停止 uvicorn api.main${NC}" || echo "    ℹ 无 uvicorn 进程"
pkill -9 -f "python.*uvicorn" 2>/dev/null && echo -e "${GREEN}    ✓ 已停止 python uvicorn${NC}" || echo "    ℹ 无 python uvicorn 进程"

sleep 1

# 3. 清理端口占用
echo ""
echo "📋 步骤 3: 清理端口占用..."

# 端口 3000 (前端)
echo "  - 清理端口 3000 (前端)..."
PORT_3000_PIDS=$(lsof -ti:3000 2>/dev/null || true)
if [ -n "$PORT_3000_PIDS" ]; then
    echo "$PORT_3000_PIDS" | xargs kill -9 2>/dev/null || true
    echo -e "${GREEN}    ✓ 已清理端口 3000${NC}"
else
    echo "    ℹ 端口 3000 未被占用"
fi

# 端口 8001 (后端)
echo "  - 清理端口 8001 (后端)..."
PORT_8001_PIDS=$(lsof -ti:8001 2>/dev/null || true)
if [ -n "$PORT_8001_PIDS" ]; then
    echo "$PORT_8001_PIDS" | xargs kill -9 2>/dev/null || true
    echo -e "${GREEN}    ✓ 已清理端口 8001${NC}"
else
    echo "    ℹ 端口 8001 未被占用"
fi

sleep 2

# 4. 验证端口状态
echo ""
echo "📋 步骤 4: 验证端口状态..."

PORT_3000_CHECK=$(lsof -i:3000 2>/dev/null || true)
PORT_8001_CHECK=$(lsof -i:8001 2>/dev/null || true)

if [ -z "$PORT_3000_CHECK" ] && [ -z "$PORT_8001_CHECK" ]; then
    echo -e "${GREEN}✅ 所有端口已释放，服务已完全停止${NC}"
    echo ""
    echo "端口状态："
    echo "  - 端口 3000: ✓ 空闲"
    echo "  - 端口 8001: ✓ 空闲"
    exit 0
else
    echo -e "${RED}❌ 仍有端口被占用${NC}"
    echo ""
    if [ -n "$PORT_3000_CHECK" ]; then
        echo -e "${YELLOW}端口 3000 占用情况：${NC}"
        echo "$PORT_3000_CHECK"
    fi
    if [ -n "$PORT_8001_CHECK" ]; then
        echo -e "${YELLOW}端口 8001 占用情况：${NC}"
        echo "$PORT_8001_CHECK"
    fi
    echo ""
    echo -e "${YELLOW}建议：请手动检查并停止以上进程${NC}"
    exit 1
fi

