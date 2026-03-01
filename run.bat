@echo off
title Hist-Hack Orchestrator
echo ---------------------------------------
echo STARTING HIST-HACK LOCAL SERVICES
echo ---------------------------------------

:: 1. Launch Backend in a new window
echo Launching Backend (uv + uvicorn)...
start "Backend (Port 8000)" cmd /k "uv run uvicorn app-backend.main:app --reload --port 8000"

:: 2. Launch Frontend in a new window
echo Launching Frontend (npm + vite)...
start "Frontend (Port 3000)" cmd /k "cd app && npm run dev -- --port 3000"

echo.
echo Done! 
echo Frontend: http://localhost:3000
echo Backend:  http://localhost:8000
echo.
echo Leave this window open to keep them running: ensure all dependencies are installed
pause