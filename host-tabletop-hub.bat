@echo off
title Tabletop Lounge - Server + Cloudflare Tunnel
cd /d "%~dp0"

echo ========================================================
echo   TABLETOP LOUNGE (6 Games Online)
echo   1-Click Local Server + Cloudflare Tunnel
echo ========================================================
echo.

:: Install dependencies if missing
if not exist "node_modules\" (
    echo [1/3] Installing npm dependencies...
    call npm.cmd install
    echo.
)

:: Check if port 3000 is already in use; if not, start server.js in background
netstat -ano | findstr ":3000 " | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo [2/3] Tabletop Hub server is already running on http://localhost:3000
) else (
    echo [2/3] Starting Tabletop Hub server on http://localhost:3000...
    start "Tabletop Hub Server" /min cmd /c "node server.js"
    timeout /t 2 /nobreak >nul
)

echo [3/3] Launching Cloudflare Quick Tunnel (look for the *.trycloudflare.com link below)...
echo ========================================================
echo   Lounge:          http://localhost:3000/
echo   Blind Heist:     http://localhost:3000/heist
echo   Love Letter:     http://localhost:3000/love-letter
echo   Slave Game:      http://localhost:3000/slave
echo   Flip 7:          http://localhost:3000/flip-7
echo   Cockroach Poker: http://localhost:3000/cockroach
echo   Let's Get Rich:  http://localhost:3000/rich
echo ========================================================
echo.

call npx.cmd -y cloudflared tunnel --url http://localhost:3000

pause