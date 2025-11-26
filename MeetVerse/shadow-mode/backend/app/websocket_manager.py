from typing import Dict,List
from fastapi import WebSocket

class WebSocketManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, meeting_id: str):
        # Accept WebSocket connection with proper CORS headers
        try:
            await websocket.accept()
            if meeting_id not in self.active_connections:
                self.active_connections[meeting_id] = []
            self.active_connections[meeting_id].append(websocket)
            print(f"✅ WebSocket connected for meeting: {meeting_id}")
        except Exception as e:
            print(f"❌ WebSocket connection error for meeting {meeting_id}: {e}")
            raise

    def disconnect(self, websocket: WebSocket, meeting_id: str):
        if meeting_id in self.active_connections:
            if websocket in self.active_connections[meeting_id]:
                self.active_connections[meeting_id].remove(websocket)

    async def send_personal_message(self, message: dict, websocket: WebSocket):
        try:
            await websocket.send_json(message)
        except:
            pass

    async def broadcast(self, meeting_id: str, message: dict):
        if meeting_id in self.active_connections:
            for ws in list(self.active_connections[meeting_id]):
                try:
                    await ws.send_json(message)
                except:
                    self.disconnect(ws, meeting_id)

manager = WebSocketManager()