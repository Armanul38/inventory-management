@echo off
title Inventory Flow - Seed Database
color 0E

echo ================================================
echo   Inventory Flow - Seed Database Script
echo ================================================
echo.

cd /d "%~dp0backend"

:: Check virtual environment exists
if not exist ".venv\Scripts\python.exe" (
    echo [ERROR] Virtual environment not found in backend\.venv
    echo Please set up the environment and install requirements first.
    pause
    exit /b 1
)

echo [INFO] Running backend/seed.py to populate database...
.venv\Scripts\python.exe seed.py

echo.
echo Database seeding complete!
pause
