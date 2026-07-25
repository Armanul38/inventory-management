@echo off
title Inventory Flow - Desktop Build Script
color 0B

echo ================================================
echo   Building Desktop Application Release
echo ================================================
echo.

cd /d "%~dp0"

echo [1/3] Compiling Python FastAPI backend with PyInstaller...
backend\.venv\Scripts\pyinstaller.exe --noconfirm --onedir --name inventory-backend --clean --distpath desktop/bin backend/server_entry.py
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Backend compilation failed!
    pause
    exit /b 1
)

echo.
echo [2/3] Exporting Next.js frontend to static HTML...
cd /d "%~dp0frontend"
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Frontend build failed!
    pause
    exit /b 1
)

echo.
echo [3/3] Packaging Electron Desktop Application...
cd /d "%~dp0desktop"
call npm run dist
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Desktop packaging failed!
    pause
    exit /b 1
)

echo.
echo ================================================
echo SUCCESS! Release installer generated in dist-desktop/
echo ================================================
pause
