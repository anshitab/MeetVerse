# app/routers/ai.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.chroma_client import get_full_meeting_context, add_ai_response
from app.llm_agent import run_ai_agent
from app.document_generator import DocumentGenerator

router = APIRouter()

class AICommand(BaseModel):
    meeting_id: str
    command: str
    generate_document: bool = False  # optional hint

@router.post("/run")
async def run_command(payload: AICommand):
    meeting_id = payload.meeting_id
    command = payload.command

    # 1. gather context
    context = get_full_meeting_context(meeting_id, limit=50)

    # 2. process via LLM
    agent = LLMAgent()
    result = agent.process_command(command=command, meeting_id=meeting_id, context=context)

    # 3. persist AI response in Chroma (for future memory)
    try:
        add_ai_response(meeting_id=meeting_id, task_id="na", command=command, response=result.get("content",""))
    except Exception as e:
        print("Warning: failed storing AI response to Chroma:", e)

    # 4. optionally create document(s)
    documents = []
    doc_actions = ["draft","proposal","document","write","summarize","report"]
    if result.get("action") in doc_actions and result.get("file_type"):
        try:
            gen = DocumentGenerator()
            out = gen.generate(meeting_id=meeting_id, content=result.get("content",""), doc_type=result.get("file_type"))
            documents.append(out)
        except Exception as e:
            print("Document generation error:", e)

    return {
        "status": "ok",
        "action": result.get("action"),
        "file_type": result.get("file_type"),
        "content": result.get("content"),
        "documents": documents
    }
