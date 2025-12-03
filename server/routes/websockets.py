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
    send_to_arduino,
    set_arduino_connection,
)

router = APIRouter()


@router.websocket("/ws")
async def websocket_arduino(websocket: WebSocket):
    """
    WebSocket endpoint for Arduino and laptop microphone.
    Receives data from both sources and saves it + sends to dashboards.
    """
    client_host = websocket.client.host if websocket.client else "Unknown"
    logger.info(f"WebSocket connection attempt from {client_host}")
    
    try:
        await websocket.accept()
        logger.info(f"WebSocket CONNECTED from {client_host}")
        await websocket.send_text('{"status":"connected","message":"Welcome!"}')
        
        # Determine if this is Arduino or laptop microphone based on first message
        is_arduino_connection = None
        
        # Task for periodic flush of SQLite buffer (non-blocking)
        async def periodic_flush():
            while True:
                await asyncio.sleep(FLUSH_INTERVAL_SECONDS)
                # Run in background, don't block
                asyncio.create_task(flush_sqlite_buffer())
        
        flush_task = asyncio.create_task(periodic_flush())
        
        # Heartbeat task to keep connection alive (important for ngrok)
        async def heartbeat():
            """Send periodic heartbeat to keep connection alive"""
            try:
                while True:
                    await asyncio.sleep(30)  # Send heartbeat every 30 seconds
                    try:
                        await websocket.send_text('{"type":"heartbeat","timestamp":"' + datetime.now().isoformat() + '"}')
                    except:
                        break
            except asyncio.CancelledError:
                pass
        
        heartbeat_task = asyncio.create_task(heartbeat())
        
        try:
            while True:
                data = await websocket.receive_text()
                logger.info(f"Received from client [{client_host}]: {data}")
                
                try:
                    data_json = json.loads(data)
                    data_json["timestamp"] = datetime.now().isoformat()
                    data_json["client"] = client_host
                    
                    # Determine source from message
                    if "source" in data_json:
                        source = data_json["source"]
                        if source == "laptop_microphone":
                            # This is laptop microphone - don't set as Arduino connection
                            data_json["source"] = "laptop_microphone"
                            is_arduino_connection = False
                        else:
                            # This is Arduino
                            data_json["source"] = "arduino"
                            if is_arduino_connection is None:
                                is_arduino_connection = True
                                set_arduino_connection(websocket)
                    else:
                        # Default to arduino if no source specified
                        if "source" not in data_json:
                            data_json["source"] = "arduino"
                        if is_arduino_connection is None:
                            is_arduino_connection = True
                            set_arduino_connection(websocket)
                    
                    # Add to storage (memory + buffer)
                    add_sensor_data(data_json)
                    
                    # Broadcast to all dashboards
                    await broadcast_to_dashboards(json.dumps(data_json))
                    
                    # If this is laptop microphone data, forward to Arduino if connected
                    if data_json["source"] == "laptop_microphone":
                        if await send_to_arduino(data):
                            logger.debug(f"Forwarded audio data to Arduino")
                    
                except json.JSONDecodeError:
                    logger.warning(f"Invalid JSON message from {client_host}: {data}")
                
                # Echo response
                await websocket.send_text(f"Echo: {data}")
                
        finally:
            flush_task.cancel()
            heartbeat_task.cancel()
            try:
                await heartbeat_task
            except asyncio.CancelledError:
                pass
            if is_arduino_connection:
                set_arduino_connection(None)
            # Save remaining buffer (non-blocking)
            from services.storage import sqlite_buffer
            if sqlite_buffer:
                asyncio.create_task(flush_sqlite_buffer())
            
    except WebSocketDisconnect:
        logger.info(f"WebSocket DISCONNECTED from {client_host} (normal disconnect)")
        set_arduino_connection(None)
    except Exception as e:
        logger.error(f"WebSocket ERROR from {client_host}: {type(e).__name__}: {e}", exc_info=True)
        set_arduino_connection(None)


@router.websocket("/ws-microphone")
async def websocket_microphone(websocket: WebSocket):
    """
    WebSocket endpoint for laptop microphone client.
    Receives audio data from laptop and forwards it to Arduino.
    """
    client_host = websocket.client.host if websocket.client else "Unknown"
    logger.info(f"Microphone client connection attempt from {client_host}")
    
    try:
        await websocket.accept()
        logger.info(f"Microphone client CONNECTED from {client_host}")
        
        # Send welcome message immediately to keep connection alive
        await websocket.send_text('{"status":"connected","message":"Welcome! Microphone endpoint ready."}')
        
        # Heartbeat task to keep connection alive (important for ngrok)
        async def heartbeat():
            """Send periodic heartbeat to keep connection alive"""
            try:
                while True:
                    await asyncio.sleep(30)  # Send heartbeat every 30 seconds
                    try:
                        await websocket.send_text('{"type":"heartbeat","timestamp":"' + datetime.now().isoformat() + '"}')
                    except:
                        break
            except asyncio.CancelledError:
                pass
        
        heartbeat_task = asyncio.create_task(heartbeat())
        
        try:
            while True:
                # Use timeout to prevent hanging forever
                try:
                    data = await asyncio.wait_for(websocket.receive_text(), timeout=60.0)
                    logger.info(f"Received from microphone [{client_host}]: {data}")
                    
                    try:
                        data_json = json.loads(data)
                        data_json["timestamp"] = datetime.now().isoformat()
                        data_json["client"] = client_host
                        data_json["source"] = "laptop_microphone"
                        
                        # Add to storage (memory + buffer)
                        add_sensor_data(data_json)
                        
                        # Broadcast to all dashboards
                        await broadcast_to_dashboards(json.dumps(data_json))
                        
                        # Forward to Arduino if connected
                        if await send_to_arduino(data):
                            logger.debug(f"Forwarded audio data to Arduino")
                        
                    except json.JSONDecodeError:
                        logger.warning(f"Invalid JSON message from microphone [{client_host}]: {data}")
                        
                except asyncio.TimeoutError:
                    # Send heartbeat to keep connection alive
                    try:
                        await websocket.send_text('{"type":"heartbeat","timestamp":"' + datetime.now().isoformat() + '"}')
                        logger.debug(f"Heartbeat sent to microphone client [{client_host}]")
                    except:
                        break
                
        except WebSocketDisconnect:
            logger.info(f"Microphone client DISCONNECTED from {client_host}")
        finally:
            heartbeat_task.cancel()
            try:
                await heartbeat_task
            except asyncio.CancelledError:
                pass
            
    except WebSocketDisconnect:
        logger.info(f"Microphone client DISCONNECTED from {client_host}")
    except Exception as e:
        logger.error(f"Microphone client ERROR from {client_host}: {type(e).__name__}: {e}", exc_info=True)


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

