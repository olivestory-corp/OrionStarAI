"""
健康检查路由
"""

import logging
from fastapi import APIRouter

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Health"])


@router.get("/health")
async def health_check():
    """
    健康检查端点

    Returns:
        {
            "status": "healthy",
            "message": "API is running"
        }
    """
    return {
        "status": "healthy",
        "message": "API is running"
    }


@router.get("/")
async def root():
    """
    根路径

    Returns:
        欢迎消息
    """
    return {
        "message": "Welcome to DeepV-Ki API",
        "version": "0.1.0",
        "docs": "/docs"
    }
