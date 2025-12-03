"""Database logic"""
import json
from datetime import datetime, timedelta
from pathlib import Path

import aiosqlite
from config.logger import logger
from config.settings import DB_PATH


async def init_db():
    """Initialize SQLite database (async)"""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS sensor_data (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                client TEXT,
                temperature REAL,
                humidity REAL,
                raw_data TEXT
            )
        """)
        await db.execute("""
            CREATE INDEX IF NOT EXISTS idx_timestamp ON sensor_data(timestamp)
        """)
        await db.commit()


async def save_sensor_data_batch(data_list: list[dict]):
    """Save a batch of data to SQLite (completely async)"""
    if not data_list:
        return
    
    try:
        async with aiosqlite.connect(DB_PATH) as db:
            await db.executemany("""
                INSERT INTO sensor_data (timestamp, client, temperature, humidity, raw_data)
                VALUES (?, ?, ?, ?, ?)
            """, [
                (
                    d.get("timestamp"),
                    d.get("client"),
                    d.get("temperature"),
                    d.get("humidity"),
                    json.dumps(d)
                ) for d in data_list
            ])
            await db.commit()
        logger.info(f"Saved {len(data_list)} messages to SQLite")
    except Exception as e:
        logger.error(f"SQLite save error: {e}", exc_info=True)


async def get_total_records() -> int:
    """Get total number of records"""
    try:
        async with aiosqlite.connect(DB_PATH) as db:
            cursor = await db.execute("SELECT COUNT(*) FROM sensor_data")
            row = await cursor.fetchone()
            return row[0] if row else 0
    except Exception as e:
        logger.error(f"Query error: {e}", exc_info=True)
        return 0


async def cleanup_old_data(minutes: int = 10):
    """Delete data older than specified minutes"""
    try:
        # Calculate cutoff time
        cutoff_time = datetime.now() - timedelta(minutes=minutes)
        cutoff_str = cutoff_time.isoformat()
        
        async with aiosqlite.connect(DB_PATH) as db:
            # Delete old records
            cursor = await db.execute(
                "DELETE FROM sensor_data WHERE timestamp < ?",
                (cutoff_str,)
            )
            deleted_count = cursor.rowcount
            await db.commit()
            
        if deleted_count > 0:
            logger.info(f"Deleted {deleted_count} old records (older than {minutes} minutes)")
        return deleted_count
    except Exception as e:
        logger.error(f"Cleanup error: {e}", exc_info=True)
        return 0

