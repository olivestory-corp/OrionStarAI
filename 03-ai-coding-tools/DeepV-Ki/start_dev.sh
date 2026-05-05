#!/bin/bash

###############################################################################
# DeepV-Ki 开发环境启动脚本
# 用途: 自动启动 DeepV-Ki 后端 FastAPI 和前端 Next.js 开发服务器
# 用法: ./start_dev.sh [选项]
###############################################################################

set -o pipefail

# 配置
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_PORT=8001
FRONTEND_PORT=3000
VENV_DIR="${PROJECT_DIR}/.venv"
LOG_DIR="${PROJECT_DIR}/logs"
BACKEND_LOG="${LOG_DIR}/backend.log"
FRONTEND_LOG="${LOG_DIR}/frontend.log"
PID_DIR="${LOG_DIR}/pids"
BACKEND_PID_FILE="${PID_DIR}/backend.pid"
FRONTEND_PID_FILE="${PID_DIR}/frontend.pid"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 标志
BACKEND_ONLY=false
FRONTEND_ONLY=false
KILL_SERVICES=false
RESET_DEPS=false
VERBOSE=false

###############################################################################
# 辅助函数
###############################################################################

log_info() { echo -e "${BLUE}[INFO]${NC} $@"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $@"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $@"; }
log_error() { echo -e "${RED}[ERROR]${NC} $@" >&2; }

show_help() {
    cat << EOF
DeepV-Ki 开发环境启动脚本

用法: $0 [选项]

选项:
    -h, --help              显示此帮助信息
    -b, --backend-only      仅启动后端 FastAPI 服务
    -f, --frontend-only     仅启动前端 Next.js 服务
    -k, --kill              停止所有已运行的开发服务
    -r, --reset             删除依赖并重新安装 (完全重置)
    -v, --verbose           启用详细日志输出

环境信息:
    项目目录:     $PROJECT_DIR
    后端端口:     $BACKEND_PORT
    前端端口:     $FRONTEND_PORT
    日志目录:     $LOG_DIR
EOF
}

parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help) show_help; exit 0 ;;
            -b|--backend-only) BACKEND_ONLY=true; shift ;;
            -f|--frontend-only) FRONTEND_ONLY=true; shift ;;
            -k|--kill) KILL_SERVICES=true; shift ;;
            -r|--reset) RESET_DEPS=true; shift ;;
            -v|--verbose) VERBOSE=true; shift ;;
            *) log_error "未知选项: $1"; show_help; exit 1 ;;
        esac
    done
}

setup_directories() {
    mkdir -p "$LOG_DIR" "$PID_DIR"
    log_success "日志和 PID 目录已准备就绪"
}

kill_port() {
    local port=$1
    local port_name=$2
    local pid=$(lsof -ti :$port 2>/dev/null)
    if [ ! -z "$pid" ]; then
        log_warning "端口 $port ($port_name) 被占用，尝试释放..."
        kill -9 $pid 2>/dev/null || true
        sleep 1
    fi
}

check_backend_deps() {
    log_info "检查后端依赖..."
    if command -v uv &> /dev/null; then
        log_info "使用 uv 同步依赖..."
        cd "$PROJECT_DIR" || return 1
        if ! uv sync; then log_error "uv sync 失败"; return 1; fi
    else
        log_error "请安装 uv: pip install uv"
        return 1
    fi

    log_info "检查和初始化 Playwright..."
    if ! uv run python api/init_playwright.py; then
        log_warning "Playwright 初始化失败，某些功能可能不可用"
    fi
    return 0
}

check_frontend_deps() {
    log_info "检查前端依赖..."
    if ! command -v pnpm &> /dev/null; then
        log_error "pnpm 未安装，请运行: npm install -g pnpm"
        return 1
    fi

    if [ ! -d "$PROJECT_DIR/node_modules" ]; then
        log_info "安装前端依赖..."
        cd "$PROJECT_DIR" || return 1
        if ! pnpm install; then log_error "前端依赖安装失败"; return 1; fi
    fi
    return 0
}

start_backend() {
    log_info "启动 DeepV-Ki 后端服务 (端口: $BACKEND_PORT)..."
    if ! check_backend_deps; then return 1; fi
    kill_port $BACKEND_PORT "DeepV-Ki 后端"
    cd "$PROJECT_DIR" || return 1

    if [ "$VERBOSE" = true ]; then
        uv run python -m api.main 2>&1 | tee -a "$BACKEND_LOG" &
    else
        uv run python -m api.main >> "$BACKEND_LOG" 2>&1 &
    fi

    local backend_pid=$!
    echo $backend_pid > "$BACKEND_PID_FILE"
    log_info "等待后端服务启动..."

    local max_attempts=30
    local attempt=0
    while [ $attempt -lt $max_attempts ]; do
        sleep 1
        if curl -s http://localhost:$BACKEND_PORT/health > /dev/null 2>&1; then
            log_success "DeepV-Ki 后端服务已启动 (PID: $backend_pid)"
            return 0
        fi
        attempt=$((attempt + 1))
    done

    if kill -0 $backend_pid 2>/dev/null; then
        log_warning "后端进程运行中但健康检查超时，请检查日志: $BACKEND_LOG"
        return 0
    else
        log_error "后端服务启动失败"
        return 1
    fi
}

start_frontend() {
    log_info "启动 DeepV-Ki 前端服务 (端口: $FRONTEND_PORT)..."
    if ! check_frontend_deps; then return 1; fi
    kill_port $FRONTEND_PORT "DeepV-Ki 前端"

    # 进入前端目录直接运行
    cd "$PROJECT_DIR/frontend" || return 1

    # 显式设置 SERVER_BASE_URL
    export SERVER_BASE_URL="http://localhost:$BACKEND_PORT"

    if [ "$VERBOSE" = true ]; then
        pnpm run dev 2>&1 | tee -a "$FRONTEND_LOG" &
    else
        pnpm run dev >> "$FRONTEND_LOG" 2>&1 &
    fi

    local frontend_pid=$!
    echo $frontend_pid > "$FRONTEND_PID_FILE"
    log_info "等待前端服务启动..."

    sleep 5
    if kill -0 $frontend_pid 2>/dev/null; then
        log_success "DeepV-Ki 前端服务已启动 (PID: $frontend_pid)"
        return 0
    else
        log_error "前端服务启动失败"
        return 1
    fi
}

stop_services() {
    log_info "停止 DeepV-Ki 服务..."
    if [ -f "$BACKEND_PID_FILE" ]; then
        local pid=$(cat "$BACKEND_PID_FILE")
        kill -TERM $pid 2>/dev/null || kill -9 $pid 2>/dev/null
        rm -f "$BACKEND_PID_FILE"
    fi
    if [ -f "$FRONTEND_PID_FILE" ]; then
        local pid=$(cat "$FRONTEND_PID_FILE")
        kill -TERM $pid 2>/dev/null || kill -9 $pid 2>/dev/null
        rm -f "$FRONTEND_PID_FILE"
    fi
    kill_port $BACKEND_PORT "DeepV-Ki 后端"
    kill_port $FRONTEND_PORT "DeepV-Ki 前端"
    log_success "服务已停止"
}

reset_dependencies() {
    log_warning "重置依赖..."
    stop_services
    rm -rf "$VENV_DIR" uv.lock node_modules package-lock.json pnpm-lock.yaml
    rm -rf frontend/.next frontend/node_modules
    log_success "依赖已重置"
}

main() {
    parse_args "$@"
    if [ "$KILL_SERVICES" = true ]; then stop_services; exit 0; fi
    if [ "$RESET_DEPS" = true ]; then reset_dependencies; fi

    setup_directories

    if [ "$BACKEND_ONLY" = false ] && [ "$FRONTEND_ONLY" = false ]; then
        start_backend || exit 1
        start_frontend || exit 1
    elif [ "$BACKEND_ONLY" = true ]; then
        start_backend || exit 1
    elif [ "$FRONTEND_ONLY" = true ]; then
        start_frontend || exit 1
    fi

    log_success "DeepV-Ki 开发环境已就绪！"
    echo "  后端: http://localhost:$BACKEND_PORT"
    echo "  前端: http://localhost:$FRONTEND_PORT"

    while true; do sleep 10; done
}

trap 'stop_services; exit 0' INT TERM
main "$@"
