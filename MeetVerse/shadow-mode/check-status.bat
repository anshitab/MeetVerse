@echo off
echo ========================================
echo Shadow Mode - Status Check
echo ========================================
echo.

echo Checking backend health...
curl -s http://localhost:8000/health >nul 2>&1
if errorlevel 1 (
    echo ❌ Backend is NOT running
    echo.
    echo To start: run start.bat
) else (
    echo ✅ Backend is running at http://localhost:8000
    echo.
    echo API Docs: http://localhost:8000/docs
    echo Health: http://localhost:8000/health
)

echo.
pause

