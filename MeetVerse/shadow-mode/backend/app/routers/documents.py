"""
Document API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Document, Task

router = APIRouter()

@router.get("/task/{task_id}")
async def get_task_documents(
    task_id: int,
    db: Session = Depends(get_db)
):
    """Get all documents for a task"""
    documents = db.query(Document).filter(
        Document.task_id == task_id
    ).all()
    
    return [
        {
            "id": doc.id,
            "filename": doc.filename,
            "type": doc.document_type.value,
            "size": doc.file_size,
            "created_at": doc.created_at.isoformat()
        }
        for doc in documents
    ]

@router.get("/{document_id}/download")
async def download_document(
    document_id: int,
    db: Session = Depends(get_db)
):
    """Download document file"""
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    if not os.path.exists(document.file_path):
        raise HTTPException(status_code=404, detail="File not found")
    
    return FileResponse(
        document.file_path,
        filename=document.filename,
        media_type="application/octet-stream"
    )

