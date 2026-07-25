@echo off
title Inventory - Backend Server (FastAPI)
color 0A

echo ================================================
echo   Inventory Management System - Backend Server
echo ================================================
echo.
echo Starting FastAPI backend server...
echo.

cd /d "%~dp0backend"

:: Check virtual environment exists
if not exist ".venv\Scripts\python.exe" (
    echo [ERROR] Virtual environment not found in backend\.venv
    echo.
    echo Please set up the virtual environment first:
    echo   python -m venv .venv
    echo   .venv\Scripts\pip install -r requirements.txt
    echo.
    pause
    exit /b 1
)

echo [INFO] Launching Uvicorn via .venv python...
echo.
echo   API URL  : http://localhost:8000
echo   API Docs : http://localhost:8000/docs
echo.
echo Press Ctrl+C to stop the server.
echo ------------------------------------------------
echo.

:: Run uvicorn as a module via the venv's python.exe
:: This avoids the broken launcher that points to a wrong Python path
.venv\Scripts\python.exe -m uvicorn main:app --reload --host 0.0.0.0 --port 8000

pause
