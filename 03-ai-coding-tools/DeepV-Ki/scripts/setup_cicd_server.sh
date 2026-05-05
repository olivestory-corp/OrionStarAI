#!/bin/bash

###############################################################################
# DeepV-Ki CI/CD 服务器环境配置脚本
# 用途: 在服务器上一键配置 GitLab Runner 运行环境
# 用法: sudo bash setup_cicd_server.sh
###############################################################################

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

###############################################################################
# 主流程
###############################################################################

echo "============================================================"
echo "🔧 DeepV-Ki CI/CD 服务器环境配置"
echo "============================================================"
echo ""

# 检查是否是 root 用户或有 sudo 权限
if [ "$EUID" -ne 0 ]; then
    log_error "请使用 root 用户或 sudo 运行此脚本"
    exit 1
fi

# 1. 更新系统包
log_info "更新系统包..."
apt update

# 2. 安装基础依赖
log_info "安装基础依赖..."
apt install -y curl wget git rsync bc

# 3. 安装 Node.js 20
log_info "检查 Node.js..."
if ! command -v node &> /dev/null; then
    log_info "安装 Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
    log_success "Node.js 安装完成: $(node -v)"
else
    NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        log_warning "Node.js 版本过低 ($(node -v))，升级到 20..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y nodejs
        log_success "Node.js 升级完成: $(node -v)"
    else
        log_success "Node.js 已安装: $(node -v)"
    fi
fi

# 4. 检查 Python 版本
log_info "检查 Python..."
PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}' | cut -d. -f1,2)
REQUIRED_VERSION="3.11"

if ! command -v python3 &> /dev/null; then
    log_error "Python3 未安装"
    exit 1
fi

# 比较版本（使用 bc 进行浮点数比较）
if (( $(echo "$PYTHON_VERSION < $REQUIRED_VERSION" | bc -l) )); then
    log_warning "Python 版本过低 ($PYTHON_VERSION)，尝试安装 Python 3.11..."
    apt install -y python3.11 python3.11-venv python3.11-dev
    # 创建软链接（可选）
    if [ ! -f /usr/bin/python3.11 ]; then
        log_error "Python 3.11 安装失败"
        exit 1
    fi
    log_success "Python 3.11 安装完成"
else
    log_success "Python 版本满足要求: $PYTHON_VERSION"
fi

# 5. 安装 Python 虚拟环境和 pip
log_info "安装 Python 虚拟环境依赖..."
apt install -y python3-venv python3-pip

# 6. 检查 GitLab Runner
log_info "检查 GitLab Runner..."
if ! command -v gitlab-runner &> /dev/null; then
    log_warning "GitLab Runner 未安装"
    log_info "正在安装 GitLab Runner..."
    curl -L https://packages.gitlab.com/install/repositories/runner/gitlab-runner/script.deb.sh | bash
    apt-get install -y gitlab-runner
    log_success "GitLab Runner 安装完成"
else
    log_success "GitLab Runner 已安装: $(gitlab-runner --version | head -n1)"
fi

# 7. 创建部署目录
log_info "创建部署目录..."
mkdir -p /opt/deepwiki
mkdir -p /opt/deepwiki/logs
chown -R gitlab-runner:gitlab-runner /opt/deepwiki
log_success "部署目录创建完成: /opt/deepwiki"

# 8. 初始化 Python 虚拟环境（在部署目录）
log_info "初始化 Python 虚拟环境..."
cd /opt/deepwiki

# 删除旧的虚拟环境（如果存在）
if [ -d ".venv" ]; then
    log_warning "删除旧的虚拟环境..."
    rm -rf .venv
fi

# 使用 gitlab-runner 用户创建虚拟环境
sudo -u gitlab-runner python3 -m venv .venv

# 升级 pip
sudo -u gitlab-runner .venv/bin/pip install --upgrade pip

log_success "Python 虚拟环境初始化完成"

# 9. 验证环境
echo ""
log_info "验证环境配置..."
echo "----------------------------------------"
echo "Node.js:    $(node -v)"
echo "npm:        $(npm -v)"
echo "Python:     $(python3 --version)"
echo "pip:        $(python3 -m pip --version 2>/dev/null || echo 'N/A')"
echo "GitLab Runner: $(gitlab-runner --version | head -n1)"
echo "----------------------------------------"

# 验证 gitlab-runner 用户环境
log_info "验证 gitlab-runner 用户环境..."
echo "----------------------------------------"
echo "gitlab-runner Node.js: $(sudo -u gitlab-runner node -v)"
echo "gitlab-runner npm:     $(sudo -u gitlab-runner npm -v)"
echo "gitlab-runner Python:  $(sudo -u gitlab-runner python3 --version)"
echo "gitlab-runner venv:    $(sudo -u gitlab-runner /opt/deepwiki/.venv/bin/python3 --version)"
echo "gitlab-runner pip:     $(sudo -u gitlab-runner /opt/deepwiki/.venv/bin/pip --version)"
echo "----------------------------------------"

echo ""
log_success "🎉 服务器环境配置完成！"
echo ""
echo "============================================================"
echo "📋 下一步操作"
echo "============================================================"
echo ""
echo "1. 注册 GitLab Runner（如果还未注册）："
echo "   sudo gitlab-runner register"
echo ""
echo "   填写信息："
echo "   - GitLab URL: https://gitlab.example.net"
echo "   - Token: 从 GitLab 项目 Settings → CI/CD → Runners 获取"
echo "   - Description: deepwiki-runner"
echo "   - Tags: ubuntu"
echo "   - Executor: shell"
echo ""
echo "2. 配置 GitLab CI/CD 变量："
echo "   GitLab 项目 → Settings → CI/CD → Variables"
echo "   添加变量: DOTENV_FILE_CONTENT"
echo ""
echo "3. 推送代码触发 CI/CD："
echo "   git push origin main"
echo ""
echo "============================================================"

