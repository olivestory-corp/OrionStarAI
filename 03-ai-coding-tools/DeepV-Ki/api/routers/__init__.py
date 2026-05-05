# 路由层 - 包含所有 API 路由

from api.routers.health import router as health_router
from api.routers.wiki import router as wiki_router
from api.routers.config import router as config_router
from api.routers.chat import router as chat_router

__all__ = [
    'health_router',
    'wiki_router',
    'config_router',
    'chat_router',
]
