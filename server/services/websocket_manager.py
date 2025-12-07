"""WebSocket connection manager"""
from typing import Optional, Set

from fastapi import WebSocket

# Set of active WebSocket connections (dashboards)
active_connections: Set[WebSocket] = set()

# ESP32 WebSocket connection (only one at a time)
esp32_connection: Optional[WebSocket] = None


def add_connection(websocket: WebSocket):
    """Add a WebSocket connection (dashboard)"""
    active_connections.add(websocket)


def remove_connection(websocket: WebSocket):
    """Remove a WebSocket connection (dashboard)"""
    active_connections.discard(websocket)


def set_esp32_connection(websocket: Optional[WebSocket]):
    """Set the ESP32 WebSocket connection"""
    global esp32_connection
    esp32_connection = websocket


def get_esp32_connection() -> Optional[WebSocket]:
    """Get the ESP32 WebSocket connection"""
    return esp32_connection


def get_connection_count() -> int:
    """Get number of active connections"""
    return len(active_connections)


def is_esp32_connected() -> bool:
    """Check if ESP32 is connected"""
    return esp32_connection is not None


async def broadcast_to_dashboards(message: str):
    """Broadcast message to all connected dashboards"""
    disconnected = set()
    for connection in active_connections:
        try:
            await connection.send_text(message)
        except:
            disconnected.add(connection)
    
    # Remove disconnected connections
    active_connections.difference_update(disconnected)


async def send_to_esp32(message: str) -> bool:
    """Send text message to ESP32 if connected"""
    if esp32_connection is None:
        return False
    
    try:
        await esp32_connection.send_text(message)
        return True
    except:
        return False
