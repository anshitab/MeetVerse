"""
FastAPI Backend for Shadow Mode - AI Intern
"""
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn

from app.database import engine, Base
from app.routers import transcripts, tasks, documents, websocket
from app.websocket_manager import manager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    try:
        Base.metadata.create_all(bind=engine)
        print("✅ Database tables created/verified")
    except Exception as e:
        print(f"⚠️  Database connection warning: {e}")
        print("   The app will continue, but database features may not work.")
    yield
    # Shutdown
    pass

app = FastAPI(
    title="Shadow Mode API",
    description="AI Intern for MeetVerse",
    version="1.0.0",
    lifespan=lifespan
)

# CORS (allow all during development)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(transcripts.router, prefix="/api/transcripts", tags=["transcripts"])
app.include_router(tasks.router, prefix="/api/tasks", tags=["tasks"])
app.include_router(documents.router, prefix="/api/documents", tags=["documents"])
app.include_router(websocket.router, prefix="/ws", tags=["websocket"])

@app.get("/")
async def root():
    return {"message": "Shadow Mode API", "status": "running"}

@app.get("/health")
async def health():
    return {"status": "ok"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

