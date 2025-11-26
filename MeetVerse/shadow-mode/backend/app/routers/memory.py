# app/routers/memory.py
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional

from app.services.memory_service import (
    add_document,
    add_transcript,
    semantic_search,
    get_meeting_context
)

router = APIRouter()

class AddDocRequest(BaseModel):
    title: str
    content: str
    doc_type: Optional[str] = "text"
    metadata: Optional[dict] = None

class AddTranscriptRequest(BaseModel):
    meeting_id: str
    text: str
    speaker: Optional[str] = None
    metadata: Optional[dict] = None

class SearchRequest(BaseModel):
    query: str
    meeting_id: Optional[str] = None
    n_results: Optional[int] = 5

@router.post("/documents")
async def create_document(req: AddDocRequest):
    result = await add_document(req.title, req.content, req.doc_type, req.metadata)
    return {"status": "ok", **result}

@router.post("/transcripts")
async def create_transcript(req: AddTranscriptRequest):
    result = await add_transcript(req.meeting_id, req.text, req.speaker, req.metadata)
    return {"status": "ok", **result}

@router.post("/search")
async def semantic_search(req: SearchRequest):
    results = semantic_search(req.query, req.meeting_id, req.n_results)
    return {"status": "ok", "results": results}

@router.get("/context/{meeting_id}")
async def meeting_context(meeting_id: str, limit: int = 10):
    results =  get_meeting_context(meeting_id, limit)
    return {"status": "ok", "context": results}
