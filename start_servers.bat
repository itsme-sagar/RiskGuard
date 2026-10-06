@echo off
chcp 65001 >nul
echo ============================================
echo Predictive Maintenance System - Startup
echo ============================================
echo.

REM Check if Python is available
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH
    pause
    exit /b 1
)

REM Check if Node.js is available
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed or not in PATH
    pause
    exit /b 1
)

REM Get script directory
set SCRIPT_DIR=%~dp0

REM Setup Backend
echo [1/4] Setting up backend...
cd /d "%SCRIPT_DIR%backend"
if not exist venv (
    echo     Creating virtual environment...
    python -m venv venv
)

echo     Activating virtual environment...
call venv\Scripts\activate.bat 2>nul

echo     Installing Python dependencies...
pip install -q -r requirements.txt
if errorlevel 1 (
    echo ERROR: Failed to install Python dependencies
    pause
    exit /b 1
)

REM Setup Frontend
echo [2/4] Setting up frontend...
cd /d "%SCRIPT_DIR%frontend"
echo     Installing Node dependencies...
npm install 2>nul
if errorlevel 1 (
    echo ERROR: Failed to install Node dependencies
    pause
    exit /b 1
)

REM Start Backend
echo [3/4] Starting backend server (port 8000)...
start "PredMaint Backend" cmd /c "call venv\Scripts\activate.bat && uvicorn main:app --port 8000 --reload"

REM Wait for backend to start
timeout /t 3 /nobreak >nul

REM Start Frontend
echo [4/4] Starting frontend development server (port 5173)...
start "PredMaint Frontend" cmd /c "npm run dev"

echo.
echo ============================================
echo System started successfully!
echo ============================================
echo.
echo Backend API:   http://localhost:8000
echo Frontend:      http://localhost:5173
echo API Docs:      http://localhost:8000/docs
echo.
echo Press any key to open the dashboard...
pause >nul
start http://localhost:5173