from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import json
from app.websocket_manager import manager
from app.services.llm_agent import LLMAgent
from app.services.memory_service import (
    semantic_search,
    get_meeting_context,
    add_transcript,
    add_document
)
from app.routers.ws_handlers import (
    handle_user_message,
    handle_memory_search,
    handle_save_transcript
)


router = APIRouter()

@router.websocket("/{meeting_id}")
async def websocket_endpoint(websocket: WebSocket, meeting_id: str):
    # WebSocket connections are handled by FastAPI with CORS middleware
    # The accept() call will respect the CORS configuration
    await manager.connect(websocket, meeting_id)

    try:
        while True:
            raw = await websocket.receive_text()

            try:
                data = json.loads(raw)
            except:
                await manager.send_personal_message(
                    {"event": "error", "message": "Invalid JSON from client"},
                    websocket
                )
                continue

            event = data.get("event")

            if event == "ping":
                await manager.send_personal_message({"event": "pong"}, websocket)

            elif event == "user_message":
                await handle_user_message(
                    websocket=websocket,
                    meeting_id=meeting_id,
                    content=data.get("content", "")
                )

            elif event == "search_memory":
                await handle_memory_search(
                    websocket=websocket,
                    meeting_id=meeting_id,
                    query=data.get("query", "")
                )

            elif event == "save_transcript":
                await handle_save_transcript(
                    websocket=websocket,
                    meeting_id=meeting_id,
                    text=data.get("text", "")
                )

            else:
                await manager.send_personal_message(
                    {"event": "error", "message": f"Unknown event: {event}"},
                    websocket
                )

    except WebSocketDisconnect:
        manager.disconnect(websocket, meeting_id)

    except Exception as e:
        print("WebSocket Error:", e)
        manager.disconnect(websocket, meeting_id)
