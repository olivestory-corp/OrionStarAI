#requires -Version 5.0
<#
.SYNOPSIS
DeepV-Ki 开发环境启动脚本 (Windows PowerShell 版本)

.DESCRIPTION
自动启动后端 FastAPI 和前端 Next.js 开发服务器

.PARAMETER BackendOnly
仅启动后端服务

.PARAMETER FrontendOnly
仅启动前端服务

.PARAMETER Kill
停止所有已运行的服务

.PARAMETER Reset
重置依赖并重新启动

.PARAMETER Verbose
启用详细日志输出

.EXAMPLE
# 启动完整的开发环境
.\start_dev_server.ps1

# 仅启动后端
.\start_dev_server.ps1 -BackendOnly

# 仅启动前端
.\start_dev_server.ps1 -FrontendOnly

# 停止所有服务
.\start_dev_server.ps1 -Kill

# 完全重置后重新启动
.\start_dev_server.ps1 -Reset

# 启用详细输出
.\start_dev_server.ps1 -Verbose
#>

param(
    [switch]$BackendOnly,
    [switch]$FrontendOnly,
    [switch]$Kill,
    [switch]$Reset,
    [switch]$Verbose
)

# 设置错误处理
$ErrorActionPreference = "Stop"

# 配置
$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendPort = 8001
$FrontendPort = 3000
$VenvDir = Join-Path $ProjectDir ".venv"
$LogDir = Join-Path $ProjectDir "logs"
$BackendLog = Join-Path $LogDir "backend.log"
$FrontendLog = Join-Path $LogDir "frontend.log"
$PidDir = Join-Path $LogDir "pids"
$BackendPidFile = Join-Path $PidDir "backend.pid"
$FrontendPidFile = Join-Path $PidDir "frontend.pid"

# 颜色定义
$Colors = @{
    Info    = "Cyan"
    Success = "Green"
    Warning = "Yellow"
    Error   = "Red"
}

###############################################################################
# 辅助函数
###############################################################################

function Write-Log {
    param(
        [string]$Message,
        [ValidateSet("Info", "Success", "Warning", "Error")]
        [string]$Level = "Info"
    )

    $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $Color = $Colors[$Level]
    $Prefix = "[{0}]" -f $Level.ToUpper()

    Write-Host "$Prefix $Message" -ForegroundColor $Color

    # 同时写入日志文件
    "$Timestamp $Prefix $Message" | Out-File -FilePath (Join-Path $LogDir "general.log") -Append -Encoding UTF8
}

function Show-Help {
    @"
DeepV-Ki 开发环境启动脚本

用法: .\$([System.IO.Path]::GetFileName($PSCommandPath)) [选项]

选项:
    -BackendOnly            仅启动后端 FastAPI 服务
    -FrontendOnly           仅启动前端 Next.js 服务
    -Kill                   停止所有已运行的开发服务
    -Reset                  删除依赖并重新安装 (完全重置)
    -Verbose                启用详细日志输出
    -Help                   显示此帮助信息

示例:
    # 启动完整的开发环境 (前端 + 后端)
    .\$([System.IO.Path]::GetFileName($PSCommandPath))

    # 仅启动后端
    .\$([System.IO.Path]::GetFileName($PSCommandPath)) -BackendOnly

    # 仅启动前端
    .\$([System.IO.Path]::GetFileName($PSCommandPath)) -FrontendOnly

    # 停止所有服务
    .\$([System.IO.Path]::GetFileName($PSCommandPath)) -Kill

    # 完全重置后重新启动
    .\$([System.IO.Path]::GetFileName($PSCommandPath)) -Reset

环境信息:
    项目目录:     $ProjectDir
    后端端口:     $BackendPort
    前端端口:     $FrontendPort
    虚拟环境:     $VenvDir
    日志目录:     $LogDir

注意:
    - 此脚本使用 Python venv 创建虚拟环境
    - 确保已安装 Python 3.12+
    - 确保已安装 Node.js 18+
    - 首次运行需要管理员权限来杀死占用的端口

"@
}

function Setup-Directories {
    Write-Log "创建日志目录..." "Info"

    if (-not (Test-Path $LogDir)) {
        New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
    }

    if (-not (Test-Path $PidDir)) {
        New-Item -ItemType Directory -Path $PidDir -Force | Out-Null
    }

    Write-Log "日志和 PID 目录已准备就绪" "Success"
}

function Check-Dependencies {
    Write-Log "检查系统依赖..." "Info"

    # 检查 Node.js
    $node = Get-Command node -ErrorAction SilentlyContinue
    if (-not $node) {
        Write-Log "Node.js 未安装，请先安装 Node.js" "Error"
        exit 1
    }
    $nodeVersion = & node --version
    Write-Log "Node.js: $nodeVersion" "Success"

    # 检查 npm
    $npm = Get-Command npm -ErrorAction SilentlyContinue
    if (-not $npm) {
        Write-Log "npm 未安装" "Error"
        exit 1
    }
    $npmVersion = & npm --version
    Write-Log "npm: $npmVersion" "Success"

    # 检查 Python
    $python = Get-Command python -ErrorAction SilentlyContinue
    if (-not $python) {
        Write-Log "Python 未安装" "Error"
        exit 1
    }
    $pythonVersion = & python --version
    Write-Log "$pythonVersion" "Success"
}

function Kill-Port {
    param(
        [int]$Port,
        [string]$PortName
    )

    $process = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue |
               Select-Object -ExpandProperty OwningProcess -First 1

    if ($process) {
        Write-Log "端口 $Port ($PortName) 被占用，尝试释放..." "Warning"
        try {
            Stop-Process -Id $process -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 1
        }
        catch {
            Write-Log "无法释放端口，可能需要管理员权限" "Warning"
        }
    }
}

function Check-VirtualEnv {
    if (-not (Test-Path $VenvDir)) {
        Write-Log "Python 虚拟环境不存在，创建虚拟环境..." "Info"

        try {
            & python -m venv $VenvDir
            Write-Log "虚拟环境已创建" "Success"
        }
        catch {
            Write-Log "虚拟环境创建失败: $_" "Error"
            exit 1
        }
    }
    else {
        Write-Log "虚拟环境已存在" "Success"
    }
}

function Activate-VirtualEnv {
    $activateScript = Join-Path $VenvDir "Scripts\Activate.ps1"

    if (Test-Path $activateScript) {
        & $activateScript
    }
    else {
        Write-Log "无法找到虚拟环境激活脚本" "Error"
        exit 1
    }
}

function Check-BackendDeps {
    Write-Log "检查后端依赖..." "Info"

    Check-VirtualEnv
    Activate-VirtualEnv

    # 检查必需的包
    try {
        & python -c "import fastapi, uvicorn, pydantic" 2>$null
    }
    catch {
        Write-Log "后端依赖未完全安装" "Warning"
        Write-Log "安装后端依赖..." "Info"

        try {
            Push-Location $ProjectDir
            & pip install -e .
            Pop-Location
        }
        catch {
            Write-Log "后端依赖安装失败: $_" "Error"
            exit 1
        }
    }

    # 初始化 Playwright
    Write-Log "检查和初始化 Playwright..." "Info"
    try {
        Push-Location $ProjectDir
        & python api\init_playwright.py 2>$null
        Pop-Location
    }
    catch {
        Write-Log "Playwright 初始化失败，某些功能可能不可用" "Warning"
        Write-Log "手动安装: python -m playwright install chromium" "Info"
    }

    Write-Log "后端依赖检查完成" "Success"
}

function Check-FrontendDeps {
    Write-Log "检查前端依赖..." "Info"

    $nodeModulesPath = Join-Path $ProjectDir "node_modules"

    if (-not (Test-Path $nodeModulesPath)) {
        Write-Log "前端依赖未安装" "Warning"
        Write-Log "安装前端依赖 (这可能需要 1-2 分钟)..." "Info"

        try {
            Push-Location $ProjectDir
            & npm install
            Pop-Location
        }
        catch {
            Write-Log "前端依赖安装失败: $_" "Error"
            exit 1
        }
    }

    Write-Log "前端依赖检查完成" "Success"
}

function Start-Backend {
    Write-Log "启动后端服务 (FastAPI, 端口: $BackendPort)..." "Info"

    Check-BackendDeps
    Activate-VirtualEnv
    Kill-Port $BackendPort "后端"

    Push-Location $ProjectDir

    # 启动后端服务
    if ($Verbose) {
        $process = Start-Process python -ArgumentList "-m api.main" -NoNewWindow -PassThru
    }
    else {
        $process = Start-Process python -ArgumentList "-m api.main" -NoNewWindow -PassThru -RedirectStandardOutput $BackendLog -RedirectStandardError $BackendLog
    }

    $process.Id | Out-File -FilePath $BackendPidFile -Encoding UTF8

    Pop-Location

    # 等待服务启动
    Write-Log "等待后端服务启动..." "Info"

    $maxAttempts = 30
    $attempt = 0

    while ($attempt -lt $maxAttempts) {
        Start-Sleep -Seconds 1

        try {
            $response = Invoke-WebRequest -Uri "http://localhost:$BackendPort/health" -ErrorAction SilentlyContinue
            if ($response.StatusCode -eq 200) {
                Write-Log "后端服务已启动 (PID: $($process.Id))" "Success"
                return 0
            }
        }
        catch {
            # 继续尝试
        }

        $attempt++
        if ($attempt % 5 -eq 0) {
            Write-Log "继续等待后端启动... ($attempt/$maxAttempts)" "Info"
        }
    }

    # 检查进程是否仍在运行
    if (Get-Process -Id $process.Id -ErrorAction SilentlyContinue) {
        Write-Log "后端进程已启动，但健康检查失败，请查看日志: $BackendLog" "Warning"
        return 0
    }
    else {
        Write-Log "后端服务启动失败，请检查日志: $BackendLog" "Error"
        exit 1
    }
}

function Start-Frontend {
    Write-Log "启动前端服务 (Next.js, 端口: $FrontendPort)..." "Info"

    Check-FrontendDeps
    Kill-Port $FrontendPort "前端"

    Push-Location $ProjectDir

    # 启动前端服务
    if ($Verbose) {
        $process = Start-Process npm -ArgumentList "run dev" -NoNewWindow -PassThru
    }
    else {
        $process = Start-Process npm -ArgumentList "run dev" -NoNewWindow -PassThru -RedirectStandardOutput $FrontendLog -RedirectStandardError $FrontendLog
    }

    $process.Id | Out-File -FilePath $FrontendPidFile -Encoding UTF8

    Pop-Location

    # 等待服务启动
    Write-Log "等待前端服务启动..." "Info"

    $maxAttempts = 60
    $attempt = 0

    while ($attempt -lt $maxAttempts) {
        Start-Sleep -Seconds 1

        try {
            $response = Invoke-WebRequest -Uri "http://localhost:$FrontendPort" -ErrorAction SilentlyContinue
            if ($response.StatusCode -eq 200) {
                Write-Log "前端服务已启动 (PID: $($process.Id))" "Success"
                return 0
            }
        }
        catch {
            # 继续尝试
        }

        $attempt++
        if ($attempt % 10 -eq 0) {
            Write-Log "继续等待前端启动... ($attempt/$maxAttempts)" "Info"
        }
    }

    # 检查进程是否仍在运行
    if (Get-Process -Id $process.Id -ErrorAction SilentlyContinue) {
        Write-Log "前端进程已启动，编译中... 请检查日志: $FrontendLog" "Warning"
        return 0
    }
    else {
        Write-Log "前端服务启动失败，请检查日志: $FrontendLog" "Error"
        exit 1
    }
}

function Stop-Services {
    Write-Log "停止所有开发服务..." "Info"

    # 停止 Python 进程（后端）
    Get-Process python -ErrorAction SilentlyContinue | Where-Object { $_.Name -eq "python" } | Stop-Process -Force -ErrorAction SilentlyContinue

    # 停止 Node 进程（前端）
    Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.Name -eq "node" } | Stop-Process -Force -ErrorAction SilentlyContinue

    # 清理 PID 文件
    Remove-Item -Path $BackendPidFile -ErrorAction SilentlyContinue
    Remove-Item -Path $FrontendPidFile -ErrorAction SilentlyContinue

    Write-Log "所有服务已停止" "Success"
}

function Reset-Dependencies {
    Write-Log "重置项目依赖..." "Warning"

    Stop-Services

    # 清理后端
    Write-Log "清理后端依赖..." "Info"
    if (Test-Path $VenvDir) {
        Remove-Item -Path $VenvDir -Recurse -Force -ErrorAction SilentlyContinue
        Write-Log "虚拟环境已删除" "Success"
    }

    # 清理前端
    Write-Log "清理前端依赖..." "Info"

    Push-Location $ProjectDir

    if (Test-Path "node_modules") {
        Remove-Item -Path "node_modules" -Recurse -Force -ErrorAction SilentlyContinue
        Write-Log "node_modules 已删除" "Success"
    }

    if (Test-Path "package-lock.json") {
        Remove-Item -Path "package-lock.json" -ErrorAction SilentlyContinue
        Write-Log "package-lock.json 已删除" "Success"
    }

    if (Test-Path ".next") {
        Remove-Item -Path ".next" -Recurse -Force -ErrorAction SilentlyContinue
        Write-Log ".next 缓存已删除" "Success"
    }

    Pop-Location

    Write-Log "依赖重置完成" "Success"
}

function Show-Status {
    Write-Host ""
    Write-Log "========== 开发环境状态 ==========" "Info"
    Write-Host ""

    # 后端状态
    $backendProcess = $null
    if (Test-Path $BackendPidFile) {
        $pid = Get-Content -Path $BackendPidFile -ErrorAction SilentlyContinue
        if ($pid) {
            $backendProcess = Get-Process -Id $pid -ErrorAction SilentlyContinue
        }
    }

    if ($backendProcess) {
        Write-Log "后端服务运行中 (PID: $($backendProcess.Id))" "Success"
        Write-Host "  地址:        http://localhost:$BackendPort"
        Write-Host "  健康检查:    http://localhost:$BackendPort/health"
        Write-Host "  API 文档:    http://localhost:$BackendPort/docs"
        Write-Host "  日志:        $BackendLog"
    }
    else {
        Write-Log "后端服务未运行" "Error"
    }

    Write-Host ""

    # 前端状态
    $frontendProcess = $null
    if (Test-Path $FrontendPidFile) {
        $pid = Get-Content -Path $FrontendPidFile -ErrorAction SilentlyContinue
        if ($pid) {
            $frontendProcess = Get-Process -Id $pid -ErrorAction SilentlyContinue
        }
    }

    if ($frontendProcess) {
        Write-Log "前端服务运行中 (PID: $($frontendProcess.Id))" "Success"
        Write-Host "  地址:        http://localhost:$FrontendPort"
        Write-Host "  日志:        $FrontendLog"
    }
    else {
        Write-Log "前端服务未运行" "Error"
    }

    Write-Host ""
    Write-Log "================================" "Info"
    Write-Host ""
}

function Show-QuickReference {
    Write-Host ""
    Write-Log "========== 快速命令参考 ==========" "Info"
    Write-Host ""
    Write-Host "查看后端日志:"
    Write-Host "  Get-Content '$BackendLog' -Tail 50"
    Write-Host ""
    Write-Host "实时查看后端日志:"
    Write-Host "  Get-Content '$BackendLog' -Wait"
    Write-Host ""
    Write-Host "查看前端日志:"
    Write-Host "  Get-Content '$FrontendLog' -Tail 50"
    Write-Host ""
    Write-Host "实时查看前端日志:"
    Write-Host "  Get-Content '$FrontendLog' -Wait"
    Write-Host ""
    Write-Host "停止所有服务:"
    Write-Host "  .\$([System.IO.Path]::GetFileName($PSCommandPath)) -Kill"
    Write-Host ""
    Write-Host "重置依赖:"
    Write-Host "  .\$([System.IO.Path]::GetFileName($PSCommandPath)) -Reset"
    Write-Host ""
    Write-Log "================================" "Info"
    Write-Host ""
}

###############################################################################
# 主程序
###############################################################################

try {
    # 如果是杀死模式
    if ($Kill) {
        Stop-Services
        exit 0
    }

    # 如果是重置模式
    if ($Reset) {
        Reset-Dependencies
        Write-Log "现在启动服务..." "Info"
        Start-Sleep -Seconds 1
    }

    # 检查依赖
    Check-Dependencies

    # 创建目录
    Setup-Directories

    Write-Log "启动 DeepV-Ki 开发环境..." "Info"
    Write-Host ""

    # 启动服务
    if (-not $BackendOnly -and -not $FrontendOnly) {
        # 启动完整环境
        Start-Backend
        Start-Frontend
    }
    elseif ($BackendOnly) {
        # 仅启动后端
        Start-Backend
    }
    elseif ($FrontendOnly) {
        # 仅启动前端
        Start-Frontend
    }

    # 显示状态
    Show-Status

    # 显示快速参考
    Show-QuickReference

    Write-Log "开发环境已就绪！" "Success"
    Write-Host ""
    Write-Log "按 Ctrl+C 停止脚本（注意：服务会继续运行）" "Info"

    # 保持脚本运行
    while ($true) {
        Start-Sleep -Seconds 10
    }
}
catch {
    Write-Log "发生错误: $_" "Error"
    exit 1
}
finally {
    # 清理
    Write-Log "脚本已退出" "Info"
}
