"""WebSocket routes"""
import asyncio
import json
from datetime import datetime

from config.logger import logger
from config.settings import DASHBOARD_INITIAL_DATA_COUNT
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from services.storage import add_sensor_data, get_latest_data
from services.websocket_manager import (
    add_connection,
    broadcast_to_dashboards,
    get_connection_count,
    is_esp32_connected,
    remove_connection,
    send_to_esp32,
    set_esp32_connection,
)

router = APIRouter()


@router.websocket("/ws")
async def websocket_esp32(websocket: WebSocket):
    """
    WebSocket endpoint for ESP32 with MAX4466 microphone.
    Receives audio data from ESP32 and broadcasts to dashboards.
    """
    client_host = websocket.client.host if websocket.client else "Unknown"
    
    try:
        await websocket.accept()
        logger.info(f"✅ WebSocket CONNECTED from {client_host}")
        await websocket.send_text('{"status":"connected","message":"Welcome!"}')
        
        is_esp32_connection = None
        
        # Heartbeat task to keep connection alive
        async def heartbeat():
            """Send periodic heartbeat to keep connection alive"""
            try:
                while True:
                    await asyncio.sleep(30)
                    try:
                        await websocket.send_text('{"type":"heartbeat","timestamp":"' + datetime.now().isoformat() + '"}')
                    except:
                        break
            except asyncio.CancelledError:
                pass
        
        heartbeat_task = asyncio.create_task(heartbeat())
        
        try:
            while True:
                message = await websocket.receive()
                
                # Check for disconnect
                if message.get("type") == "websocket.disconnect":
                    break
                
                # Handle text message (JSON from ESP32)
                if "text" not in message:
                    continue
                    
                data = message["text"]
                
                try:
                    data_json = json.loads(data)
                    
                    # Add server timestamp
                    data_json["server_timestamp"] = datetime.now().isoformat()
                    data_json["client"] = client_host
                    
                    # Handle ESP32 microphone data
                    source = data_json.get("source", "esp32")
                    msg_type = data_json.get("type", "unknown")
                    
                    if source == "esp32":
                        data_json["source"] = "esp32"
                        
                        # Register ESP32 connection on first message
                        if is_esp32_connection is None:
                            is_esp32_connection = True
                            set_esp32_connection(websocket)
                            logger.info(f"🎤 ESP32 microphone connected from {client_host}")
                        
                        if msg_type == "microphone_data":
                            if not is_esp32_connection:
                                is_esp32_connection = True
                                set_esp32_connection(websocket)
                            
                            # Broadcast ESP32 connection status (always true if receiving data)
                            status_msg = {
                                "type": "esp32_status",
                                "connected": True,
                                "timestamp": datetime.now().isoformat()
                            }
                            await broadcast_to_dashboards(json.dumps(status_msg))
                    
                    # Store data
                    add_sensor_data(data_json)
                    
                    # Broadcast to all dashboards
                    await broadcast_to_dashboards(json.dumps(data_json))
                    
                except json.JSONDecodeError:
                    logger.debug(f"Invalid JSON from {client_host}: {data[:100]}")
                
        finally:
            heartbeat_task.cancel()
            try:
                await heartbeat_task
            except asyncio.CancelledError:
                pass
            if is_esp32_connection:
                set_esp32_connection(None)
                logger.info(f"🎤 ESP32 microphone disconnected from {client_host}")
                # Broadcast ESP32 disconnection status to all dashboards
                status_msg = {
                    "type": "esp32_status",
                    "connected": False,
                    "timestamp": datetime.now().isoformat()
                }
                await broadcast_to_dashboards(json.dumps(status_msg))
            
    except WebSocketDisconnect:
        logger.info(f"❌ WebSocket DISCONNECTED from {client_host}")
        if is_esp32_connection:
            set_esp32_connection(None)
            status_msg = {
                "type": "esp32_status",
                "connected": False,
                "timestamp": datetime.now().isoformat()
            }
            await broadcast_to_dashboards(json.dumps(status_msg))
    except RuntimeError as e:
        if "disconnect" in str(e).lower():
            logger.debug(f"WebSocket {client_host} disconnected (runtime)")
        else:
            logger.error(f"❌ WebSocket RuntimeError from {client_host}: {e}")
        if is_esp32_connection:
            set_esp32_connection(None)
            status_msg = {
                "type": "esp32_status",
                "connected": False,
                "timestamp": datetime.now().isoformat()
            }
            await broadcast_to_dashboards(json.dumps(status_msg))
    except Exception as e:
        logger.error(f"❌ WebSocket ERROR from {client_host}: {type(e).__name__}: {e}")
        if is_esp32_connection:
            set_esp32_connection(None)
            status_msg = {
                "type": "esp32_status",
                "connected": False,
                "timestamp": datetime.now().isoformat()
            }
            await broadcast_to_dashboards(json.dumps(status_msg))


@router.websocket("/ws-dashboard")
async def websocket_dashboard(websocket: WebSocket):
    """
    WebSocket endpoint for Dashboard.
    Receives real-time updates from ESP32 microphone.
    """
    client_host = websocket.client.host if websocket.client else "Unknown"
    
    try:
        await websocket.accept()
        add_connection(websocket)
        logger.info(f"📊 Dashboard CONNECTED from {client_host} (Total: {get_connection_count()})")
        
        # Send latest available data immediately
        latest = get_latest_data(DASHBOARD_INITIAL_DATA_COUNT)
        if latest:
            initial_data = {
                "type": "initial_data",
                "data": latest
            }
            await websocket.send_text(json.dumps(initial_data))
        
        # Send ESP32 connection status immediately
        esp32_status = {
            "type": "esp32_status",
            "connected": is_esp32_connected(),
            "timestamp": datetime.now().isoformat()
        }
        await websocket.send_text(json.dumps(esp32_status))
        
        # Wait for messages from dashboard and forward to ESP32
        while True:
            try:
                data = await websocket.receive_text()
                
                # Parse and forward to ESP32 if it's a filter/command message
                try:
                    msg = json.loads(data)
                    if msg.get("target") == "esp32":
                        success = await send_to_esp32(data)
                        if success:
                            logger.debug(f"📤 → ESP32: {msg.get('type')}")
                        else:
                            logger.warning("❌ ESP32 not connected")
                except json.JSONDecodeError:
                    pass
                
            except WebSocketDisconnect:
                break
                
    except WebSocketDisconnect:
        logger.info(f"📊 Dashboard DISCONNECTED from {client_host}")
    except Exception as e:
        logger.error(f"❌ Dashboard ERROR from {client_host}: {type(e).__name__}: {e}", exc_info=True)
    finally:
        remove_connection(websocket)
        logger.debug(f"Active dashboards: {get_connection_count()}")
