"""API routes"""
from fastapi import APIRouter
from models.schemas import (
    ApiInfoResponse,
    HealthResponse,
    LatestDataResponse,
    StatsResponse,
)
from services.storage import get_latest_data, get_latest_data_count
from services.websocket_manager import get_connection_count

router = APIRouter()


@router.get("/", response_model=ApiInfoResponse)
async def home():
    """API info endpoint"""
    return {
        "message": "IoT WebSocket Server",
        "websocket": "/ws",
        "dashboard": "/ws-dashboard",
        "status": "running"
    }


@router.get("/health", response_model=HealthResponse)
async def health():
    """Health check endpoint"""
    from datetime import datetime
    return {
        "status": "ok",
        "timestamp": datetime.now().isoformat(),
        "active_connections": get_connection_count(),
        "latest_data_count": get_latest_data_count()
    }


@router.get("/data/latest", response_model=LatestDataResponse)
async def get_latest_data_route(count: int = 10):
    """Get latest N data points (for HTTP dashboard)"""
    data = get_latest_data(count)
    return {
        "count": len(data),
        "data": data
    }


@router.get("/data/stats", response_model=StatsResponse)
async def get_stats():
    """Statistics about current data"""
    return {
        "total_records": 0,
        "db_size_kb": 0,
        "latest_data_count": get_latest_data_count(),
        "active_dashboard_connections": get_connection_count()
    }

