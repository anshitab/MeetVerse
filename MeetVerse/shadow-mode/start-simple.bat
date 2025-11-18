@echo off
echo ========================================
echo Shadow Mode - Starting Backend
echo ========================================
echo.

cd backend

REM Check if venv exists
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
)

echo Activating virtual environment...
call venv\Scripts\activate.bat

echo Installing/updating dependencies...
pip install -q -r requirements.txt

echo.
echo ========================================
echo Starting Shadow Mode Backend
echo ========================================
echo.
echo Backend will start at: http://localhost:8000
echo API Docs: http://localhost:8000/docs
echo.
echo NOTE: The backend will work even without PostgreSQL/Redis
echo       for basic transcript storage and AI features.
echo.
echo Press Ctrl+C to stop
echo.

REM Load environment variables from parent .env if it exists
if exist "..\\.env" (
    echo Loading environment from .env file...
    for /f "tokens=*" %%a in ('type "..\\.env"') do (
        set "%%a"
    )
)

python main.py

pause

