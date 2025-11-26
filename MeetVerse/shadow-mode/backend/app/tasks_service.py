"""
Task service — handles AI task execution and memory storage.
Pure Chroma backend. No MongoDB, no Celery.
"""

import uuid
from datetime import datetime
from pydantic import BaseModel
from typing import Optional

from app.services.llm_agent import run_ai_agent
from app.vector_store import (
    add_ai_response,
    get_full_meeting_context
)

# Task models
class TaskRequest(BaseModel):
    meeting_id: str
    user_id: str
    command: str

class TaskResponse(BaseModel):
    task_id: str
    meeting_id: str
    user_id: str
    command: str
    status: str
    result: Optional[str] = None
    error: Optional[str] = None
    created_at: str


# In-memory task list (since no DB)
TASK_STORE = {}   # task_id → task object


async def create_task(payload: TaskRequest) -> TaskResponse:
    """
    Run AI command immediately and store result in Chroma memory.
    """
    task_id = str(uuid.uuid4())

    # Build initial task object
    task = {
        "task_id": task_id,
        "meeting_id": payload.meeting_id,
        "user_id": payload.user_id,
        "command": payload.command,
        "status": "processing",
        "result": None,
        "created_at": datetime.utcnow().isoformat()
    }

    TASK_STORE[task_id] = task

    # 1️⃣ Get semantic meeting context
    context = get_full_meeting_context(payload.meeting_id)

    # 2️⃣ Run AI agent
    ai_output = await run_ai_agent(payload.command, context)

    # 3️⃣ Store the AI response in Chroma memory
    add_ai_response(
        meeting_id=payload.meeting_id,
        task_id=task_id,
        command=payload.command,
        response=ai_output
    )

    # 4️⃣ Update task result
    task["status"] = "completed"
    task["result"] = ai_output

    return TaskResponse(**task)


def get_tasks_for_meeting(meeting_id: str):
    """
    Return all tasks in memory for a meeting.
    """
    return [
        task
        for task in TASK_STORE.values()
        if task["meeting_id"] == meeting_id
    ]
