"""
Shadow Intern FastAPI Backend (Mongo + ChromaDB)
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn
import chromadb
from motor.motor_asyncio import AsyncIOMotorClient


# ------------------------------------------------------------------------------
# Lifespan (startup/shutdown)
# ------------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🔵 Shadow Intern Backend starting (MongoDB + ChromaDB)")
    yield
    print("🔴 Shadow Intern Backend shutting down")


# ------------------------------------------------------------------------------
# Main FastAPI App
# ------------------------------------------------------------------------------

app = FastAPI(
    title="Shadow Mode API",
    description="Shadow Intern Backend",
    version="1.0.0",
    lifespan=lifespan
)


# ------------------------------------------------------------------------------
# CORS
# ------------------------------------------------------------------------------

# CORS Configuration - Allow localhost and 127.0.0.1 on any port for development
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:5000",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5000",
    "http://127.19.136:*",  # Allow the malformed IP from typo
]

# In development, allow all localhost/127.x.x.x origins
import re
def is_allowed_origin(origin: str) -> bool:
    if not origin:
        return True  # Allow requests with no origin
    # Allow localhost on any port
    if re.match(r"^http://localhost(:\d+)?$", origin):
        return True
    # Allow 127.0.0.1 on any port
    if re.match(r"^http://127\.0\.0\.1(:\d+)?$", origin):
        return True
    # Allow any 127.x.x.x on any port for development
    if re.match(r"^http://127\.\d+\.\d+\.\d+(:\d+)?$", origin):
        return True
    return origin in ALLOWED_ORIGINS

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.\d+\.\d+\.\d+)(:\d+)?",  # Allow localhost and 127.x.x.x on any port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ------------------------------------------------------------------------------
# MongoDB (Motor)
# ------------------------------------------------------------------------------

MONGO_URL = "mongodb://localhost:27017"
mongo_client = AsyncIOMotorClient(MONGO_URL)
db = mongo_client["shadow_intern"]


# ------------------------------------------------------------------------------
# ChromaDB Local Client
# ------------------------------------------------------------------------------

chroma_client = chromadb.Client()


# ------------------------------------------------------------------------------
# Health Check
# ------------------------------------------------------------------------------

@app.get("/health")
async def health():
    return {"status": "ok", "mongo": "connected", "chroma": "ready"}


@app.get("/")
async def root():
    return {"status": "running", "database": "MongoDB + ChromaDB"}


# ------------------------------------------------------------------------------
# Routers
# ------------------------------------------------------------------------------

from app.routers import memory
from app.routers import websocket
from app.routers import tasks

# Memory (REST)
app.include_router(memory.router, prefix="/api/memory", tags=["memory"])

# Tasks (REST)
app.include_router(tasks.router, prefix="/api/tasks", tags=["tasks"])

# WebSocket
app.include_router(websocket.router, prefix="/ws", tags=["websocket"])


# ------------------------------------------------------------------------------
# Start Server
# ------------------------------------------------------------------------------

if __name__ == "__main__":
    import os
    PORT = int(os.getenv("PORT", "8000"))  # Default to 8000 to avoid conflict with main backend on 5000
    uvicorn.run("main:app", host="0.0.0.0", port=PORT, reload=True)
