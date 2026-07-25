@echo off
title Inventory Flow - Desktop App (Development Mode)
color 0A

echo ================================================
echo   Inventory Flow - Desktop Application Launcher
echo ================================================
echo.

cd /d "%~dp0"

echo [INFO] Starting desktop application...
echo [INFO] Backend: bin\inventory-backend\inventory-backend.exe
echo [INFO] Frontend: frontend\out\ (static export)
echo.
echo Press Ctrl+C to stop.
echo ------------------------------------------------
echo.

npx --prefix desktop electron desktop/main.js

pause
