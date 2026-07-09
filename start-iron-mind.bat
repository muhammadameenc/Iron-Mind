@echo off
cd /d "%~dp0"
start "" python -m http.server 8000
timeout /t 2 >nul
start "" msedge --app=http://localhost:8000