"""DTOs și scheme pentru date"""
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
    """Schema pentru health check"""
    status: str
    timestamp: str
    active_connections: int
    latest_data_count: int


class LatestDataResponse(BaseModel):
    """Schema pentru ultimele date"""
    count: int
    data: list[dict]


class StatsResponse(BaseModel):
    """Schema pentru statistici"""
    total_records: int
    db_size_kb: float
    latest_data_count: int
    active_dashboard_connections: int


class ApiInfoResponse(BaseModel):
    """Schema pentru info API"""
    message: str
    websocket: str
    dashboard: str
    status: str

