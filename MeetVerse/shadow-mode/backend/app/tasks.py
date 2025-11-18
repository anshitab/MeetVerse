"""
Celery tasks for AI processing
"""
from app.celery_app import celery_app
from app.llm_agent import LLMAgent
from app.document_generator import DocumentGenerator
from app.database import SessionLocal
from app.models import Task, TaskStatus, Document
from app.websocket_manager import manager
from datetime import datetime
import os

@celery_app.task(bind=True)
def process_ai_task(self, task_id: int):
    """Process AI task asynchronously"""
    db = SessionLocal()
    try:
        task = db.query(Task).filter(Task.id == task_id).first()
        if not task:
            return {"error": "Task not found"}
        
        # Update status
        task.status = TaskStatus.PROCESSING
        task.celery_task_id = self.request.id
        db.commit()
        
        # Notify via WebSocket
        manager.send_task_update(task.meeting_id, {
            "task_id": task.id,
            "status": "processing",
            "message": "Processing your request..."
        })
        
        # Initialize LLM agent
        agent = LLMAgent()
        
        # Get meeting context from ChromaDB
        from app.chroma_client import get_meeting_context
        context = get_meeting_context(task.meeting_id)
        
        # Process command
        result = agent.process_command(
            command=task.command,
            meeting_id=task.meeting_id,
            context=context
        )
        
        # Generate documents if requested
        documents = []
        if result.get("generate_document"):
            doc_gen = DocumentGenerator()
            doc_type = result.get("document_type", "docx")
            content = result.get("content", "")
            
            file_path = doc_gen.generate(
                content=content,
                filename=f"task_{task_id}",
                doc_type=doc_type
            )
            
            # Save document record
            doc = Document(
                task_id=task.id,
                filename=os.path.basename(file_path),
                file_path=file_path,
                document_type=doc_type,
                file_size=os.path.getsize(file_path) if os.path.exists(file_path) else 0
            )
            db.add(doc)
            documents.append({
                "id": doc.id,
                "filename": doc.filename,
                "type": doc.document_type.value,
                "path": f"/api/documents/{doc.id}/download"
            })
        
        # Update task
        task.status = TaskStatus.COMPLETED
        task.result = result.get("response", "")
        task.completed_at = datetime.utcnow()
        db.commit()
        
        # Notify completion
        manager.send_task_update(task.meeting_id, {
            "task_id": task.id,
            "status": "completed",
            "result": result.get("response", ""),
            "documents": documents
        })
        
        return {
            "task_id": task.id,
            "status": "completed",
            "result": result.get("response", ""),
            "documents": documents
        }
        
    except Exception as e:
        if task:
            task.status = TaskStatus.FAILED
            task.error = str(e)
            db.commit()
            
            manager.send_task_update(task.meeting_id, {
                "task_id": task.id,
                "status": "failed",
                "error": str(e)
            })
        return {"error": str(e)}
    finally:
        db.close()

