 @echo off
cd /d "%~dp0"

start "IRON MIND Server" cmd /k "py -m http.server 8000 --bind 127.0.0.1"

timeout /t 2 /nobreak >nul

start "" msedge --app="http://127.0.0.1:8000/?v=%RANDOM%%RANDOM%"

