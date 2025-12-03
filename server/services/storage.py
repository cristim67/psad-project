"""Storage service for managing sensor data (in-memory only, no SQLite)"""
from collections import deque
from typing import Dict

from config.settings import LATEST_DATA_MAX_SIZE

# In-memory storage for dashboard (latest N values)
latest_data: deque = deque(maxlen=LATEST_DATA_MAX_SIZE)


def add_sensor_data(data: Dict):
    """Add sensor data to memory (fast, no SQLite)"""
    latest_data.append(data)


def get_latest_data(count: int = 10) -> list:
    """Get latest N data points"""
    return list(latest_data)[-count:]


def get_latest_data_count() -> int:
    """Get count of latest data"""
    return len(latest_data)

