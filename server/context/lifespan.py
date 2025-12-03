"""Application lifespan management"""
import asyncio
from contextlib import asynccontextmanager

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
            print(f"  ⚠️  Cleanup task error: {e}")


@asynccontextmanager
async def lifespan(app):
    """
    Manage application lifespan (startup and shutdown).
    """
    # Startup
    print("🚀 Starting application...")
    
    # Initialize database
    await init_db()
    print("✅ Database initialized")
    
    # Start background tasks
    cleanup_task = asyncio.create_task(periodic_cleanup())
    print(f"✅ Cleanup task started (every {CLEANUP_INTERVAL_MINUTES} minutes)")
    
    print("✅ Application started successfully")
    
    yield  # Application is running
    
    # Shutdown
    print("🛑 Shutting down application...")
    
    # Cancel background tasks
    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass
    
    print("✅ Application shut down successfully")

