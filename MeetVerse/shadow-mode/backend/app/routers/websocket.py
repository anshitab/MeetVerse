"""
WebSocket endpoints for real-time updates
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.websocket_manager import manager

router = APIRouter()

@router.websocket("/{meeting_id}")
async def websocket_endpoint(websocket: WebSocket, meeting_id: str):
    """WebSocket connection for task updates"""
    await manager.connect(websocket, meeting_id)
    try:
        while True:
            data = await websocket.receive_text()
            # Echo back or process message
            await manager.send_personal_message(
                {"type": "echo", "message": data},
                websocket
            )
    except WebSocketDisconnect:
        manager.disconnect(websocket, meeting_id)
    except Exception as e:
        print(f"WebSocket error: {e}")
        manager.disconnect(websocket, meeting_id)

