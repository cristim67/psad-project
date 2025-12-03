"""WebSocket routes"""
import asyncio
import json
from datetime import datetime

from config.logger import logger
from config.settings import (
    DASHBOARD_INITIAL_DATA_COUNT,
    FLUSH_INTERVAL_SECONDS,
    SQLITE_BUFFER_SIZE,
)
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from services.storage import add_sensor_data, flush_sqlite_buffer, get_latest_data
from services.websocket_manager import (
    add_connection,
    broadcast_to_dashboards,
    get_connection_count,
    remove_connection,
)

router = APIRouter()


@router.websocket("/ws")
async def websocket_arduino(websocket: WebSocket):
    """
    WebSocket endpoint for Arduino.
    Receives data from Arduino and saves it + sends to dashboards.
    """
    client_host = websocket.client.host if websocket.client else "Unknown"
    logger.info(f"Arduino connection attempt from {client_host}")
    
    try:
        await websocket.accept()
        logger.info(f"Arduino CONNECTED from {client_host}")
        await websocket.send_text('{"status":"connected","message":"Welcome!"}')
        
        # Task for periodic flush of SQLite buffer (non-blocking)
        async def periodic_flush():
            while True:
                await asyncio.sleep(FLUSH_INTERVAL_SECONDS)
                # Run in background, don't block
                asyncio.create_task(flush_sqlite_buffer())
        
        flush_task = asyncio.create_task(periodic_flush())
        
        try:
            while True:
                data = await websocket.receive_text()
                logger.info(f"Received from Arduino [{client_host}]: {data}")
                
                try:
                    data_json = json.loads(data)
                    data_json["timestamp"] = datetime.now().isoformat()
                    data_json["client"] = client_host
                    data_json["source"] = "arduino"
                    
                    # Add to storage (memory + buffer)
                    add_sensor_data(data_json)
                    
                    # Broadcast to all dashboards
                    await broadcast_to_dashboards(json.dumps(data_json))
                    
                except json.JSONDecodeError:
                    logger.warning(f"Invalid JSON message from {client_host}: {data}")
                
                # Echo response
                await websocket.send_text(f"Echo: {data}")
                
        finally:
            flush_task.cancel()
            # Save remaining buffer (non-blocking)
            from services.storage import sqlite_buffer
            if sqlite_buffer:
                asyncio.create_task(flush_sqlite_buffer())
            
    except WebSocketDisconnect:
        logger.info(f"Arduino DISCONNECTED from {client_host}")
    except Exception as e:
        logger.error(f"WebSocket ERROR from {client_host}: {type(e).__name__}: {e}", exc_info=True)


@router.websocket("/ws-dashboard")
async def websocket_dashboard(websocket: WebSocket):
    """
    WebSocket endpoint for Dashboard.
    Receives real-time updates from Arduino.
    """
    client_host = websocket.client.host if websocket.client else "Unknown"
    logger.info(f"Dashboard connection attempt from {client_host}")
    
    try:
        await websocket.accept()
        add_connection(websocket)
        logger.info(f"Dashboard CONNECTED from {client_host} (Total: {get_connection_count()})")
        
        # Send latest available data immediately
        latest = get_latest_data(DASHBOARD_INITIAL_DATA_COUNT)
        if latest:
            initial_data = {
                "type": "initial_data",
                "data": latest
            }
            await websocket.send_text(json.dumps(initial_data))
        
        # Wait for messages from dashboard (for future commands)
        while True:
            try:
                data = await websocket.receive_text()
                logger.info(f"Received from Dashboard [{client_host}]: {data}")
                
                # Here you can process commands from dashboard
                # (e.g., send command to Arduino through another channel)
                
            except WebSocketDisconnect:
                break
                
    except WebSocketDisconnect:
        logger.info(f"Dashboard DISCONNECTED from {client_host}")
    except Exception as e:
        logger.error(f"Dashboard ERROR from {client_host}: {type(e).__name__}: {e}", exc_info=True)
    finally:
        remove_connection(websocket)
        logger.info(f"Active dashboards: {get_connection_count()}")

