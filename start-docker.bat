@echo off
setlocal enabledelayedexpansion

:: 1. Navigate to the folder where this batch file (and docker-compose.yml) lives
cd /d "%~dp0"

:: 2. Check if Docker is running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker is not running! 
    echo Please start Docker Desktop and try running this script again.
    pause
    exit /b 1
)

:: 3. Run docker compose
echo Starting Docker containers...
echo ---------------------------------------
docker compose up -d

:: Note: If you're using an older version of Docker, replace the line above with:
:: docker-compose up -d

if %errorlevel% eq 0 (
    echo ---------------------------------------
    echo [SUCCESS] Containers started successfully!
) else (
    echo ---------------------------------------
    echo [ERROR] Failed to start containers.
)

pause