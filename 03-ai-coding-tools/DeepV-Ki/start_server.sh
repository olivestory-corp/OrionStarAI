#!/bin/bash

###############################################################################
# DeepV-Ki 生产环境启动脚本
# 用途: 自动启动后端 FastAPI 和前端 Next.js 生产服务器
# 用法: ./start_server.sh [选项]
#
# 选项:
#   -h, --help              显示帮助信息
#   -b, --backend-only      仅启动后端
#   -f, --frontend-only     仅启动前端
#   -k, --kill              停止所有已运行的服务
#   -d, --daemon            后台模式（不阻塞，适合 CI/CD）
#   -s, --status            查看服务状态
#   -v, --verbose           启用详细日志输出
#   --rebuild               重新构建前端
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
REBUILD=false
VERBOSE=false
DAEMON_MODE=false
SHOW_STATUS=false

###############################################################################
# 辅助函数
###############################################################################

# 打印信息
log_info() {
    echo -e "${BLUE}[INFO]${NC} $@"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $@"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $@"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $@" >&2
}

# 显示帮助
show_help() {
    cat << EOF
DeepV-Ki 生产环境启动脚本

用法: $0 [选项]

选项:
    -h, --help              显示此帮助信息
    -b, --backend-only      仅启动后端 FastAPI 服务
    -f, --frontend-only     仅启动前端 Next.js 服务
    -k, --kill              停止所有已运行的服务
    -d, --daemon            后台模式（不阻塞，适合 CI/CD）
    -s, --status            查看服务状态
    -v, --verbose           启用详细日志输出
    --rebuild               重新构建前端（执行 npm run build）

示例:
    # 启动完整的生产环境 (前端 + 后端)
    $0

    # 后台模式启动（适合 CI/CD）
    $0 --daemon

    # 仅启动后端
    $0 --backend-only

    # 停止所有服务
    $0 --kill

    # 查看服务状态
    $0 --status

    # 重新构建并启动
    $0 --rebuild

环境信息:
    项目目录:     $PROJECT_DIR
    后端端口:     $BACKEND_PORT
    前端端口:     $FRONTEND_PORT
    虚拟环境:     $VENV_DIR
    日志目录:     $LOG_DIR
    后端日志:     $BACKEND_LOG
    前端日志:     $FRONTEND_LOG

注意:
    - 此脚本用于生产环境，使用 npm start (而非 npm run dev)
    - 后端使用 Python 虚拟环境或 uv
    - 使用 --daemon 模式时，服务在后台运行，脚本立即返回

EOF
}

# 解析命令行参数
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -b|--backend-only)
                BACKEND_ONLY=true
                shift
                ;;
            -f|--frontend-only)
                FRONTEND_ONLY=true
                shift
                ;;
            -k|--kill)
                KILL_SERVICES=true
                shift
                ;;
            -d|--daemon)
                DAEMON_MODE=true
                shift
                ;;
            -s|--status)
                SHOW_STATUS=true
                shift
                ;;
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            --rebuild)
                REBUILD=true
                shift
                ;;
            *)
                log_error "未知选项: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

# 创建必要的目录
setup_directories() {
    mkdir -p "$LOG_DIR" "$PID_DIR"
    log_success "日志和 PID 目录已准备就绪"
}

# 杀死占用的端口
kill_port() {
    local port=$1
    local port_name=$2

    local pid=$(lsof -ti :$port 2>/dev/null)

    if [ ! -z "$pid" ]; then
        log_warning "端口 $port ($port_name) 被占用 (PID: $pid)，尝试释放..."
        kill -9 $pid 2>/dev/null || true
        sleep 2
    fi
}

# 检查虚拟环境
check_virtual_env() {
    if command -v uv &> /dev/null; then
        # 使用 uv 管理虚拟环境
        log_info "检查 uv 虚拟环境..."

        if [ ! -d "$VENV_DIR" ]; then
            log_info "虚拟环境不存在，使用 uv sync 创建..."
            cd "$PROJECT_DIR" || return 1

            if ! uv sync; then
                log_error "uv sync 失败"
                return 1
            fi

            log_success "虚拟环境已创建"
        else
            log_success "虚拟环境已存在"
        fi

        # 初始化 Playwright
        log_info "检查和初始化 Playwright..."
        cd "$PROJECT_DIR" || return 1
        if ! uv run python api/init_playwright.py; then
            log_warning "Playwright 初始化失败，某些功能可能不可用"
            log_info "手动安装: python -m playwright install chromium"
        fi
    else
        # 使用传统的 python3 -m venv
        if [ ! -d "$VENV_DIR" ]; then
            log_warning "Python 虚拟环境不存在"
            log_info "创建虚拟环境..."

            python3 -m venv "$VENV_DIR"

            if [ $? -eq 0 ]; then
                log_success "虚拟环境已创建"

                # 安装依赖
                source "$VENV_DIR/bin/activate"
                pip install -e .
                deactivate
            else
                log_error "虚拟环境创建失败"
                return 1
            fi
        fi

        # 初始化 Playwright
        log_info "检查和初始化 Playwright..."
        source "$VENV_DIR/bin/activate"
        if ! python api/init_playwright.py; then
            log_warning "Playwright 初始化失败，某些功能可能不可用"
            log_info "手动安装: python -m playwright install chromium"
        fi
        deactivate
    fi
}

# 启动后端服务
start_backend() {
    log_info "启动后端服务 (FastAPI, 端口: $BACKEND_PORT)..."

    # 检查虚拟环境
    if ! check_virtual_env; then
        log_error "虚拟环境检查失败"
        return 1
    fi

    # 强制更新依赖
    log_info "检查并更新后端依赖..."
    if command -v uv &> /dev/null; then
        cd "$PROJECT_DIR" || return 1
        uv sync
    else
        if [ -f "$VENV_DIR/bin/activate" ]; then
            source "$VENV_DIR/bin/activate"
            pip install -e .
            deactivate
        fi
    fi

    # 杀死占用的端口
    kill_port $BACKEND_PORT "后端"

    # 启动后端
    cd "$PROJECT_DIR" || return 1

    if command -v uv &> /dev/null; then
        # 使用 uv run
        if [ "$VERBOSE" = true ]; then
            nohup uv run --project "$PROJECT_DIR" python -m api.main >> "$BACKEND_LOG" 2>&1 &
        else
            nohup uv run --project "$PROJECT_DIR" python -m api.main >> "$BACKEND_LOG" 2>&1 &
        fi
    else
        # 使用传统的虚拟环境
        if [ -f "$VENV_DIR/bin/activate" ]; then
            source "$VENV_DIR/bin/activate"
            if [ "$VERBOSE" = true ]; then
                nohup python -m api.main >> "$BACKEND_LOG" 2>&1 &
            else
                nohup python -m api.main >> "$BACKEND_LOG" 2>&1 &
            fi
            deactivate
        else
            log_error "无法找到虚拟环境"
            return 1
        fi
    fi

    local backend_pid=$!
    echo $backend_pid > "$BACKEND_PID_FILE"

    # 等待服务启动
    log_info "等待后端服务启动..."

    local max_attempts=30
    local attempt=0

    while [ $attempt -lt $max_attempts ]; do
        sleep 1

        if curl -s http://localhost:$BACKEND_PORT/health > /dev/null 2>&1; then
            log_success "后端服务已启动 (PID: $backend_pid)"
            return 0
        fi

        attempt=$((attempt + 1))
        if [ $((attempt % 5)) -eq 0 ]; then
            log_info "继续等待后端启动... ($attempt/$max_attempts)"
        fi
    done

    # 如果进程仍在运行，认为启动成功
    if kill -0 $backend_pid 2>/dev/null; then
        log_warning "后端进程已启动，但健康检查超时，请查看日志: $BACKEND_LOG"
        return 0
    else
        log_error "后端服务启动失败，请检查日志: $BACKEND_LOG"
        tail -n 20 "$BACKEND_LOG"
        return 1
    fi
}

# 构建前端
build_frontend() {
    log_info "构建前端..."
    cd "$PROJECT_DIR" || return 1

    # 检查 node_modules
    if [ ! -d "node_modules" ]; then
        log_info "安装前端依赖..."
        if ! npm install; then
            log_error "前端依赖安装失败"
            return 1
        fi
    fi

    # 清理旧的构建
    if [ -d ".next" ]; then
        log_info "清理旧的构建..."
        rm -rf .next
    fi

    # 构建
    log_info "执行 npm run build（这可能需要 1-2 分钟）..."
    if ! npm run build; then
        log_error "前端构建失败"
        return 1
    fi

    log_success "前端构建完成"
    return 0
}

# 启动前端服务
start_frontend() {
    log_info "启动前端服务 (Next.js, 端口: $FRONTEND_PORT)..."

    cd "$PROJECT_DIR" || return 1

    # 如果需要重新构建
    if [ "$REBUILD" = true ]; then
        if ! build_frontend; then
            return 1
        fi
    else
        # 检查是否已构建
        if [ ! -d ".next" ]; then
            log_warning "前端未构建，开始构建..."
            if ! build_frontend; then
                return 1
            fi
        fi
    fi

    # 杀死占用的端口
    kill_port $FRONTEND_PORT "前端"

    # 启动前端（生产模式）
    if [ "$VERBOSE" = true ]; then
        nohup npm start >> "$FRONTEND_LOG" 2>&1 &
    else
        nohup npm start >> "$FRONTEND_LOG" 2>&1 &
    fi

    local frontend_pid=$!
    echo $frontend_pid > "$FRONTEND_PID_FILE"

    # 等待服务启动
    log_info "等待前端服务启动..."

    local max_attempts=30
    local attempt=0

    while [ $attempt -lt $max_attempts ]; do
        sleep 1

        if curl -s http://localhost:$FRONTEND_PORT > /dev/null 2>&1; then
            log_success "前端服务已启动 (PID: $frontend_pid)"
            return 0
        fi

        attempt=$((attempt + 1))
        if [ $((attempt % 5)) -eq 0 ]; then
            log_info "继续等待前端启动... ($attempt/$max_attempts)"
        fi
    done

    # 如果进程仍在运行，认为启动成功
    if kill -0 $frontend_pid 2>/dev/null; then
        log_warning "前端进程已启动，但健康检查超时，请查看日志: $FRONTEND_LOG"
        return 0
    else
        log_error "前端服务启动失败，请检查日志: $FRONTEND_LOG"
        tail -n 20 "$FRONTEND_LOG"
        return 1
    fi
}

# 停止服务
stop_services() {
    log_info "停止所有服务..."

    # 停止后端
    if [ -f "$BACKEND_PID_FILE" ]; then
        local backend_pid=$(cat "$BACKEND_PID_FILE")
        if kill -0 $backend_pid 2>/dev/null; then
            log_info "停止后端服务 (PID: $backend_pid)..."
            kill -TERM $backend_pid 2>/dev/null || kill -9 $backend_pid 2>/dev/null
            sleep 1
        fi
        rm -f "$BACKEND_PID_FILE"
    fi

    # 停止前端
    if [ -f "$FRONTEND_PID_FILE" ]; then
        local frontend_pid=$(cat "$FRONTEND_PID_FILE")
        if kill -0 $frontend_pid 2>/dev/null; then
            log_info "停止前端服务 (PID: $frontend_pid)..."
            kill -TERM $frontend_pid 2>/dev/null || kill -9 $frontend_pid 2>/dev/null
            sleep 1
        fi
        rm -f "$FRONTEND_PID_FILE"
    fi

    # 额外清理：杀死占用端口的进程
    kill_port $BACKEND_PORT "后端"
    kill_port $FRONTEND_PORT "前端"

    log_success "所有服务已停止"
}

# 显示服务状态
show_status() {
    echo ""
    log_info "========== 服务状态 =========="
    echo ""

    # 后端状态
    if [ -f "$BACKEND_PID_FILE" ]; then
        local backend_pid=$(cat "$BACKEND_PID_FILE")
        if kill -0 $backend_pid 2>/dev/null; then
            log_success "后端服务运行中 (PID: $backend_pid)"
            echo "  地址:     http://localhost:$BACKEND_PORT"
            echo "  健康检查: http://localhost:$BACKEND_PORT/health"
            echo "  API 文档: http://localhost:$BACKEND_PORT/docs"
            echo "  日志:     $BACKEND_LOG"

            # 尝试健康检查
            if curl -s http://localhost:$BACKEND_PORT/health > /dev/null 2>&1; then
                log_success "  健康检查: ✓ 通过"
            else
                log_warning "  健康检查: ✗ 失败"
            fi
        else
            log_error "后端服务未运行 (PID 文件存在但进程已退出)"
            rm -f "$BACKEND_PID_FILE"
        fi
    else
        log_warning "后端服务未启动"
    fi

    echo ""

    # 前端状态
    if [ -f "$FRONTEND_PID_FILE" ]; then
        local frontend_pid=$(cat "$FRONTEND_PID_FILE")
        if kill -0 $frontend_pid 2>/dev/null; then
            log_success "前端服务运行中 (PID: $frontend_pid)"
            echo "  地址:     http://localhost:$FRONTEND_PORT"
            echo "  日志:     $FRONTEND_LOG"

            # 尝试健康检查
            if curl -s http://localhost:$FRONTEND_PORT > /dev/null 2>&1; then
                log_success "  健康检查: ✓ 通过"
            else
                log_warning "  健康检查: ✗ 失败"
            fi
        else
            log_error "前端服务未运行 (PID 文件存在但进程已退出)"
            rm -f "$FRONTEND_PID_FILE"
        fi
    else
        log_warning "前端服务未启动"
    fi

    echo ""
    log_info "================================"
    echo ""
}

###############################################################################
# 主程序
###############################################################################

main() {
    # 解析参数
    parse_args "$@"

    # 如果是查看状态模式
    if [ "$SHOW_STATUS" = true ]; then
        show_status
        exit 0
    fi

    # 如果是杀死模式
    if [ "$KILL_SERVICES" = true ]; then
        stop_services
        exit 0
    fi

    # 创建目录
    setup_directories

    log_info "启动 DeepV-Ki 生产环境..."
    echo ""

    # 根据标志启动相应服务
    if [ "$BACKEND_ONLY" = false ] && [ "$FRONTEND_ONLY" = false ]; then
        # 启动完整环境
        start_backend || exit 1
        start_frontend || exit 1
    elif [ "$BACKEND_ONLY" = true ]; then
        # 仅启动后端
        start_backend || exit 1
    elif [ "$FRONTEND_ONLY" = true ]; then
        # 仅启动前端
        start_frontend || exit 1
    fi

    # 显示状态
    show_status

    log_success "DeepV-Ki 生产环境已就绪！"
    echo ""

    # Daemon 模式：直接退出
    if [ "$DAEMON_MODE" = true ]; then
        log_info "Daemon 模式：服务已在后台运行"
        log_info "查看状态: $0 --status"
        log_info "停止服务: $0 --kill"
        exit 0
    fi

    log_info "按 Ctrl+C 停止服务"

    # 保持脚本运行，监听服务状态
    while true; do
        sleep 10

        # 检查后端是否仍在运行
        if [ -f "$BACKEND_PID_FILE" ]; then
            local backend_pid=$(cat "$BACKEND_PID_FILE")
            if ! kill -0 $backend_pid 2>/dev/null; then
                log_warning "后端服务已停止"
                rm -f "$BACKEND_PID_FILE"
            fi
        fi

        # 检查前端是否仍在运行
        if [ -f "$FRONTEND_PID_FILE" ]; then
            local frontend_pid=$(cat "$FRONTEND_PID_FILE")
            if ! kill -0 $frontend_pid 2>/dev/null; then
                log_warning "前端服务已停止"
                rm -f "$FRONTEND_PID_FILE"
            fi
        fi
    done
}

# 处理 Ctrl+C
trap 'log_info "接收到中断信号，正在停止服务..."; stop_services; exit 0' INT TERM

# 启动主程序
main "$@"
