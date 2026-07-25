@echo off
title Inventory - Frontend Client (Next.js)
color 0E

echo ================================================
echo   Inventory Management System - Frontend Client
echo ================================================
echo.
echo Starting Next.js development server...
echo.

cd /d "%~dp0frontend"

if not exist "node_modules" (
    echo [INFO] node_modules not found. Installing dependencies...
    echo.
    npm install
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo [ERROR] npm install failed. Please check your Node.js installation.
        pause
        exit /b 1
    )
)

echo [INFO] Launching Next.js dev server...
echo.
echo   App URL : http://localhost:3000
echo.
echo Press Ctrl+C to stop the client.
echo ------------------------------------------------
echo.

npm run dev

pause
