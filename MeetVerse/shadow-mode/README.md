# Shadow Mode - AI Intern

AI-powered meeting assistant with document generation, summaries, and semantic search.

## Quick Start

1. **Start all services:**
   ```bash
   start.bat
   ```
   Or manually:
   ```bash
   docker-compose up
   ```

2. **Access:**
   - Backend API: http://localhost:8000
   - API Docs: http://localhost:8000/docs
   - Health: http://localhost:8000/health

## Configuration

Environment variables (auto-configured in `.env`):
- `GEMINI_API_KEY` - Google Gemini API key
- `CHROMA_API_KEY` - ChromaDB Cloud API key
- `CHROMA_TENANT` - ChromaDB tenant ID
- `CHROMA_DATABASE` - Database name (MeetVerse)

## Architecture

- **Backend**: FastAPI + PostgreSQL + Redis + Celery
- **Vector DB**: ChromaDB Cloud
- **LLM**: Google Gemini
- **Frontend**: React component (integrated in MeetVerse)

## Integration

The ShadowMode component is already integrated into `MeetingPage.js`. Just start the backend and it will automatically connect.

## Commands

- `start.bat` - Start all services
- `docker-compose up` - Start services
- `docker-compose down` - Stop services
- `docker-compose logs -f` - View logs
