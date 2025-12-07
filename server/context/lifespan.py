"""Application lifespan management"""
from contextlib import asynccontextmanager

from config.logger import logger


@asynccontextmanager
async def lifespan(app):
    """
    Manage application lifespan (startup and shutdown).
    """
    # Startup
    logger.info("Starting application...")
    logger.info("Application started successfully")
    
    yield  # Application is running
    
    # Shutdown
    logger.info("Shutting down application...")
    logger.info("Application shut down successfully")

