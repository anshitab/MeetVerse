"""
Task API endpoints - In-memory task storage via tasks_service
"""
from fastapi import APIRouter, HTTPException
from typing import List
from app.tasks_service import create_task, get_tasks_for_meeting, TASK_STORE, TaskRequest, TaskResponse

router = APIRouter()

@router.post("/", response_model=TaskResponse)
async def create_task_endpoint(task: TaskRequest):
    """Create new AI task"""
    try:
        result = await create_task(task)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create task: {str(e)}")

@router.get("/meeting/{meeting_id}", response_model=List[TaskResponse])
async def get_meeting_tasks(meeting_id: str):
    """Get all tasks for a meeting"""
    try:
        tasks = get_tasks_for_meeting(meeting_id)
        return tasks
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get tasks: {str(e)}")

@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(task_id: str):
    """Get task by ID"""
    try:
        task = TASK_STORE.get(task_id)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        return TaskResponse(**task)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get task: {str(e)}")
