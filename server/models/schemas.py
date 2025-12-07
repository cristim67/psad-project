"""DTOs and schemas for data"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class SensorData(BaseModel):
    """Schema pentru date de senzori"""
    timestamp: str
    client: Optional[str] = None
    temperature: Optional[float] = None
    humidity: Optional[float] = None
    source: Optional[str] = None
    raw_data: Optional[dict] = None


class HealthResponse(BaseModel):
    """Schema for health check"""
    status: str
    timestamp: str
    active_connections: int
    latest_data_count: int


class LatestDataResponse(BaseModel):
    """Schema for latest data"""
    count: int
    data: list[dict]


class StatsResponse(BaseModel):
    """Schema for statistics"""
    total_records: int
    db_size_kb: float
    latest_data_count: int
    active_dashboard_connections: int


class ApiInfoResponse(BaseModel):
    """Schema for API info"""
    message: str
    websocket: str
    dashboard: str
    status: str

