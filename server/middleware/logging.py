"""Request logging middleware"""
from config.logger import logger
from fastapi import Request


async def log_requests(request: Request, call_next):
    """Log all HTTP requests (only errors)"""
    # Log only errors (4xx, 5xx) to reduce spam
    response = await call_next(request)
    if response.status_code >= 400:
        logger.warning(f"{request.method} {request.url.path} - Status: {response.status_code}")
    return response

