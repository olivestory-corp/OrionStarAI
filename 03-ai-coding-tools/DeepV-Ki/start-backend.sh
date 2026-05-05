#!/bin/bash

# DeepV-Ki Backend 启动脚本
# 用法: ./start-backend.sh [前台|后台]
# 默认: 前台运行

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

# 激活虚拟环境
if [ ! -d "venv" ]; then
    echo "❌ 虚拟环境不存在，请先运行: uv venv --python 3.11 venv"
    exit 1
fi

echo "🔧 激活虚拟环境..."
source venv/bin/activate

# 验证依赖
echo "✅ 检查依赖..."
python -c "import fastapi; import uvicorn; print('✅ 核心依赖已安装')"

# 清理占用的端口（如果需要）
PORT=${PORT:-8001}
echo "🔍 检查端口 $PORT..."
if command -v lsof &> /dev/null; then
    if lsof -i ":$PORT" &> /dev/null; then
        echo "⚠️  端口 $PORT 已被占用，清理进程..."
        lsof -i ":$PORT" | grep -v COMMAND | awk '{print $2}' | xargs kill -9 2>/dev/null || true
        sleep 1
    fi
fi

# 运行模式
RUN_MODE=${1:-前台}

if [ "$RUN_MODE" = "后台" ]; then
    echo "🚀 在后台启动后端服务 (端口: $PORT)..."
    python -m api.main > api/logs/backend.log 2>&1 &
    BACKEND_PID=$!
    echo "✅ 后端进程已启动 (PID: $BACKEND_PID)"
    echo "📝 日志文件: api/logs/backend.log"
    echo ""
    echo "💡 提示: 停止服务运行: kill $BACKEND_PID"
    sleep 3

    # 验证服务是否运行
    if curl -s http://localhost:$PORT/health > /dev/null 2>&1; then
        echo "✅ 服务健康检查通过"
        echo "🌐 API 地址: http://localhost:$PORT"
        echo "📚 API 文档: http://localhost:$PORT/docs"
    else
        echo "❌ 服务健康检查失败，请检查日志: tail -f api/logs/backend.log"
        exit 1
    fi
else
    echo "🚀 在前台启动后端服务 (端口: $PORT)..."
    echo "💡 提示: 按 CTRL+C 停止服务"
    echo ""
    python -m api.main
fi
