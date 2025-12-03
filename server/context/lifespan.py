"""Application lifespan management"""
import asyncio
from contextlib import asynccontextmanager

from config.logger import logger
from config.settings import CLEANUP_INTERVAL_MINUTES
from database.db import cleanup_old_data, init_db


async def periodic_cleanup():
    """Periodically clean up old data from database"""
    while True:
        try:
            await asyncio.sleep(CLEANUP_INTERVAL_MINUTES * 60)  # Convert minutes to seconds
            await cleanup_old_data(CLEANUP_INTERVAL_MINUTES)
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Cleanup task error: {e}", exc_info=True)


@asynccontextmanager
async def lifespan(app):
    """
    Manage application lifespan (startup and shutdown).
    """
    # Startup
    logger.info("Starting application...")
    
    # Initialize database
    await init_db()
    logger.info("Database initialized")
    
    # Start background tasks
    cleanup_task = asyncio.create_task(periodic_cleanup())
    logger.info(f"Cleanup task started (every {CLEANUP_INTERVAL_MINUTES} minutes)")
    
    logger.info("Application started successfully")
    
    yield  # Application is running
    
    # Shutdown
    logger.info("Shutting down application...")
    
    # Cancel background tasks
    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass
    
    logger.info("Application shut down successfully")

