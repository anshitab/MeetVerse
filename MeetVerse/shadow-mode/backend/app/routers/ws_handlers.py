from fastapi import WebSocket
from app.websocket_manager import manager
from app.services.llm_agent import LLMAgent
from app.services.memory_service import (
    get_meeting_context,
    semantic_search,
    add_transcript
)

async def handle_user_message(websocket: WebSocket, meeting_id: str, content: str):
    await manager.send_personal_message(
        {"event": "agent_status", "status": "thinking"},
        websocket
    )

    memory = await get_meeting_context(meeting_id)

    docs = memory.get("documents", []) if memory else []

    agent = LLMAgent()
    result = agent.run(
        command=content,
        meeting_id=meeting_id,
        context_docs=docs,
        toolset=["summarize", "search_memory", "write_code", "generate_document"]
    )

    await manager.send_personal_message(
        {"event": "agent_response", "result": result},
        websocket
    )


async def handle_memory_search(websocket: WebSocket, meeting_id: str, query: str):
    results = await semantic_search(query=query, meeting_id=meeting_id)
    await manager.send_personal_message(
        {"event": "memory_search_results", "query": query, "results": results},
        websocket
    )


async def handle_save_transcript(websocket: WebSocket, meeting_id: str, text: str):
    saved = await add_transcript(meeting_id=meeting_id, text=text)
    await manager.send_personal_message(
        {"event": "transcript_saved", "mongo_id": saved["mongo_id"], "chroma_id": saved["chroma_id"]},
        websocket
    )
