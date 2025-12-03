"""Application configuration"""
from pathlib import Path

# Paths
BASE_DIR = Path(__file__).parent.parent
DB_PATH = BASE_DIR / "sensor_data.db"
STATIC_DIR = BASE_DIR / "static"

# Database settings
SQLITE_BUFFER_SIZE = 10
LATEST_DATA_MAX_SIZE = 100
DASHBOARD_INITIAL_DATA_COUNT = 10

# WebSocket settings
FLUSH_INTERVAL_SECONDS = 5

# Cleanup settings
CLEANUP_INTERVAL_MINUTES = 10  # Delete data older than this

