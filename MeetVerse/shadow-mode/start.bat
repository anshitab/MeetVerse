@echo off
echo ========================================
echo Shadow Mode - AI Intern
echo ========================================
echo.

REM Check if .env exists, create if not
if not exist .env (
    echo Creating .env file with your credentials...
    (
        echo GEMINI_API_KEY=AIzaSyANHNak2lRceDbdHlK5s9HkHbhGXvX6Rh0
        echo GEMINI_MODEL=gemini-pro
        echo CHROMA_API_KEY=ck-FyNuxRjv1B48oLi4a9dq5M5zaKU2fSmzCAxAvAmwfKsx
        echo CHROMA_TENANT=ca9ef9e7-c73f-48e4-ad67-e58f1f185635
        echo CHROMA_DATABASE=MeetVerse
        echo DATABASE_URL=postgresql://postgres:postgres@localhost:5432/shadowmode
        echo REDIS_URL=redis://localhost:6379/0
    ) > .env
    echo .env file created!
    echo.
)

REM Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found!
    echo Please install Python 3.11+ from https://www.python.org/
    pause
    exit /b 1
)

echo Checking Python dependencies...
cd backend
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
)

echo Activating virtual environment...
call venv\Scripts\activate.bat

echo Installing dependencies...
pip install -q -r requirements.txt

echo.
echo ========================================
echo Starting Shadow Mode Backend
echo ========================================
echo.
echo Backend API: http://localhost:8000
echo API Docs: http://localhost:8000/docs
echo Health Check: http://localhost:8000/health
echo.
echo NOTE: Make sure PostgreSQL and Redis are running!
echo       If using Docker: docker-compose up -d postgres redis
echo.
echo Press Ctrl+C to stop
echo.

python main.py

pause
