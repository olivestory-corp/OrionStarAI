@echo off
cd /d "%~dp0"

echo ==================================================
echo Starting DeepV-Ki Development Environment
echo ==================================================

REM 1. Check Python Virtual Environment
if not exist ".venv" (
    echo [INFO] Creating Python virtual environment...
    python -m venv .venv
    if errorlevel 1 (
        echo [ERROR] Failed to create virtual environment. Please check Python installation.
        pause
        exit /b 1
    )
)

REM 2. Start Backend (FastAPI)
echo [INFO] Starting Backend Server (Port 8001)...
start "DeepV-Ki Backend" cmd /k "call .venv\Scripts\activate.bat && python -m api.main"

REM 3. Start Frontend (Next.js)
echo [INFO] Starting Frontend Server (Port 3000)...
start "DeepV-Ki Frontend" cmd /k "npm run dev"

echo.
echo ==================================================
echo Services are launching in separate windows.
echo Do not close this window immediately.
echo.
echo Backend URL:  http://localhost:8001
echo Frontend URL: http://localhost:3000
echo ==================================================
echo.

timeout 3