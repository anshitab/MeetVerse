"""
Transcript API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.database import get_db
from app.models import Transcript
from app.chroma_client import add_transcript, search_transcripts, get_meeting_context

router = APIRouter()

class TranscriptCreate(BaseModel):
    meeting_id: str
    content: str

class TranscriptResponse(BaseModel):
    id: int
    meeting_id: str
    content: str
    timestamp: str
    
    class Config:
        from_attributes = True

@router.post("/", response_model=TranscriptResponse)
async def create_transcript(
    transcript: TranscriptCreate,
    db: Session = Depends(get_db)
):
    """Store transcript and create embedding"""
    db_transcript = Transcript(
        meeting_id=transcript.meeting_id,
        content=transcript.content
    )
    db.add(db_transcript)
    db.commit()
    db.refresh(db_transcript)
    
    # Add to ChromaDB
    add_transcript(
        meeting_id=transcript.meeting_id,
        content=transcript.content,
        transcript_id=db_transcript.id
    )
    
    return db_transcript

@router.get("/meeting/{meeting_id}")
async def get_meeting_transcripts(
    meeting_id: str,
    db: Session = Depends(get_db)
):
    """Get all transcripts for a meeting"""
    transcripts = db.query(Transcript).filter(
        Transcript.meeting_id == meeting_id
    ).order_by(Transcript.timestamp).all()
    
    return transcripts

@router.get("/search")
async def search_meeting_transcripts(
    query: str,
    meeting_id: Optional[str] = None,
    n_results: int = 5
):
    """Search transcripts by semantic similarity"""
    results = search_transcripts(query, meeting_id, n_results)
    return results

