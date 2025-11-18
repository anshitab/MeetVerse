"""
Task API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from app.database import get_db
from app.models import Task, TaskStatus
from app.tasks import process_ai_task

router = APIRouter()

class TaskCreate(BaseModel):
    meeting_id: str
    user_id: str
    command: str

class TaskResponse(BaseModel):
    id: int
    meeting_id: str
    user_id: str
    command: str
    status: str
    result: Optional[str] = None
    error: Optional[str] = None
    created_at: str
    
    class Config:
        from_attributes = True

@router.post("/", response_model=TaskResponse)
async def create_task(
    task: TaskCreate,
    db: Session = Depends(get_db)
):
    """Create new AI task"""
    db_task = Task(
        meeting_id=task.meeting_id,
        user_id=task.user_id,
        command=task.command,
        status=TaskStatus.PENDING
    )
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    
    # Queue Celery task
    process_ai_task.delay(db_task.id)
    
    return db_task

@router.get("/meeting/{meeting_id}", response_model=List[TaskResponse])
async def get_meeting_tasks(
    meeting_id: str,
    db: Session = Depends(get_db)
):
    """Get all tasks for a meeting"""
    tasks = db.query(Task).filter(
        Task.meeting_id == meeting_id
    ).order_by(Task.created_at.desc()).all()
    
    return tasks

@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: int,
    db: Session = Depends(get_db)
):
    """Get task by ID"""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task

