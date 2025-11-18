"""
WebSocket connection manager
"""
from typing import Dict, List
from fastapi import WebSocket
import asyncio

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}
        self._loop = None
    
    def _get_loop(self):
        """Get or create event loop"""
        if self._loop is None:
            try:
                self._loop = asyncio.get_event_loop()
            except RuntimeError:
                self._loop = asyncio.new_event_loop()
                asyncio.set_event_loop(self._loop)
        return self._loop
    
    async def connect(self, websocket: WebSocket, meeting_id: str):
        await websocket.accept()
        if meeting_id not in self.active_connections:
            self.active_connections[meeting_id] = []
        self.active_connections[meeting_id].append(websocket)
    
    def disconnect(self, websocket: WebSocket, meeting_id: str):
        if meeting_id in self.active_connections:
            if websocket in self.active_connections[meeting_id]:
                self.active_connections[meeting_id].remove(websocket)
            if not self.active_connections[meeting_id]:
                del self.active_connections[meeting_id]
    
    async def send_personal_message(self, message: dict, websocket: WebSocket):
        await websocket.send_json(message)
    
    async def broadcast_to_meeting(self, meeting_id: str, message: dict):
        if meeting_id in self.active_connections:
            disconnected = []
            for connection in self.active_connections[meeting_id]:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    print(f"Error sending message: {e}")
                    disconnected.append(connection)
            
            # Remove disconnected connections
            for conn in disconnected:
                self.disconnect(conn, meeting_id)
    
    def send_task_update(self, meeting_id: str, update: dict):
        """Send task update (sync wrapper for async)"""
        loop = self._get_loop()
        if loop.is_running():
            asyncio.create_task(self.broadcast_to_meeting(meeting_id, {
                "type": "task_update",
                "data": update
            }))
        else:
            loop.run_until_complete(self.broadcast_to_meeting(meeting_id, {
                "type": "task_update",
                "data": update
            }))

manager = ConnectionManager()

