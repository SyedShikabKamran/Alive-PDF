@echo off
cd /d "%~dp0"

:: Install dependencies if node_modules is missing
if not exist "node_modules\" (
  echo Installing dependencies for the first time...
  npm install
  if errorlevel 1 (
    echo.
    echo ERROR: npm install failed. Make sure Node.js is installed.
    echo Download Node.js from: https://nodejs.org
    pause
    exit /b 1
  )
)

echo Starting Alive PDF...
start "" cmd /k "npm run dev"
timeout /t 2 /nobreak >nul
start "" "http://localhost:5173"
