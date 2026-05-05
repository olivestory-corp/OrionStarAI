"""
FastAPI 应用工厂 - 初始化和配置应用程序
"""

import logging
import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from api.logging_config import setup_logging
from api.routers import health_router, wiki_router, config_router, chat_router
from api.config import SESSION_SECRET_KEY

# 配置日志
setup_logging()
logger = logging.getLogger(__name__)


def create_app(enable_sso: bool = True, enable_gitlab: bool = True, enable_gitlab_oauth: bool = False) -> FastAPI:
    """
    创建并配置 FastAPI 应用

    Args:
        enable_sso: 是否启用 SSO 认证模块
        enable_gitlab: 是否启用 GitLab 集成模块
        enable_gitlab_oauth: 是否启用 GitLab OAuth 认证模块

    Returns:
        配置好的 FastAPI 应用实例
    """
    # 创建应用
    app = FastAPI(
        title="DeepV-Ki API",
        description="AI-powered wiki generator for GitHub, GitLab, Bitbucket, and Gerrit repositories",
        version="0.1.0"
    )

    # 配置 CORS 中间件
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # 在生产环境中应该限制
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 配置 Session 中间件 (用于 SSO)
    # 注意：在生产环境中，请务必设置 SESSION_SECRET_KEY 环境变量
    app.add_middleware(SessionMiddleware, secret_key=SESSION_SECRET_KEY)

    # 注册路由
    logger.info("📦 注册路由...")
    app.include_router(health_router)
    app.include_router(wiki_router)
    app.include_router(config_router)
    app.include_router(chat_router)

    # 注册 GitLab 路由（保持向后兼容）
    if enable_gitlab:
        try:
            from api.gitlab_routes import router as gitlab_router
            app.include_router(gitlab_router)
            logger.info("✅ GitLab 路由已注册")
        except ImportError as e:
            logger.warning(f"⚠️ GitLab 路由导入失败: {str(e)}")
            # Register fallback route to expose error
            fallback_router = APIRouter(prefix="/gitlab", tags=["gitlab"])

            @fallback_router.get("/projects")
            async def gitlab_error():
                return JSONResponse(
                    status_code=500,
                    content={
                        "error": "GitLab module failed to load",
                        "detail": str(e),
                        "type": type(e).__name__
                    }
                )
            app.include_router(fallback_router)

    # 注册 SSO 路由（保持向后兼容）
    if enable_sso:
        try:
            from api.sso_routes import router as sso_router
            app.include_router(sso_router)

            # Initialize SSO client
            from api.sso_client import init_sso
            init_sso(app)

            logger.info("✅ SSO 路由已注册")
        except ImportError as e:
            logger.warning(f"⚠️ SSO 路由导入失败: {str(e)}")
            # Register fallback route to expose error
            fallback_router = APIRouter(prefix="/api/auth", tags=["authentication"])

            @fallback_router.get("/sso/user")
            async def sso_error():
                return JSONResponse(
                    status_code=500,
                    content={
                        "error": "SSO module failed to load",
                        "detail": str(e),
                        "type": type(e).__name__
                    }
                )
            app.include_router(fallback_router)

    # 注册 GitLab OAuth 路由
    if enable_gitlab_oauth:
        try:
            from api.gitlab_oauth_routes import router as gitlab_oauth_router
            app.include_router(gitlab_oauth_router)

            # Initialize GitLab OAuth client
            from api.gitlab_oauth_client import init_gitlab_oauth
            init_gitlab_oauth(app)

            logger.info("✅ GitLab OAuth 路由已注册")
        except ImportError as e:
            logger.warning(f"⚠️ GitLab OAuth 路由导入失败: {str(e)}")
            # Register fallback route to expose error
            fallback_router = APIRouter(prefix="/api/auth/gitlab", tags=["authentication"])

            @fallback_router.get("/login")
            async def gitlab_oauth_error():
                return JSONResponse(
                    status_code=500,
                    content={
                        "error": "GitLab OAuth module failed to load",
                        "detail": str(e),
                        "type": type(e).__name__
                    }
                )
            app.include_router(fallback_router)

    # Debug 路由：列出所有注册的路由 (用于排查 404 问题)
    @app.get("/api/debug/routes")
    def list_routes():
        routes = []
        for route in app.routes:
            if hasattr(route, "path"):
                routes.append({
                    "path": route.path,
                    "name": route.name,
                    "methods": list(route.methods) if hasattr(route, "methods") else None
                })
        return {"routes": routes}

    # 注册 Wiki API 路由（保持向后兼容）
    try:
        from api.wiki_api_routes import router as wiki_api_router
        app.include_router(wiki_api_router)
        logger.info("✅ Wiki API 路由已注册")
    except ImportError:
        logger.warning("⚠️ Wiki API 路由导入失败")

    # 注册 Wiki 渲染路由（Markdown → HTML with Mermaid SVG）
    try:
        from api.wiki_render_routes import router as wiki_render_router
        app.include_router(wiki_render_router)
        logger.info("✅ Wiki 渲染路由已注册")
    except ImportError:
        logger.warning("⚠️ Wiki 渲染路由导入失败")

    # 启动事件
    @app.on_event("startup")
    async def startup_event():
        """应用启动时初始化后台任务"""
        logger.info("=" * 60)
        logger.info("🚀 应用启动事件")
        logger.info("=" * 60)

        # 初始化和启动 Wiki 生成任务队列
        try:
            from api.task_queue import init_task_queue
            init_task_queue()
            logger.info("✅ Wiki 生成任务队列已启动")
        except Exception as e:
            logger.warning(f"⚠️ Wiki 生成任务队列启动失败: {str(e)}")

        # 注册公开项目同步任务（每小时执行一次）
        try:
            from api.scheduler import get_scheduler, start_scheduler
            from api.public_projects_sync import sync_public_projects

            scheduler = get_scheduler()
            scheduler.schedule(
                task_name="sync_public_projects",
                task_func=sync_public_projects,
                interval_seconds=3600,  # 每小时（3600秒）
                start_immediately=True  # 启动时立即执行一次
            )

            # 启动调度器
            start_scheduler()
            logger.info("✅ 后台定时任务已启动")
        except Exception as e:
            logger.warning(f"⚠️ 后台定时任务启动失败: {str(e)}")

    # 关闭事件
    @app.on_event("shutdown")
    async def shutdown_event():
        """应用关闭时清理资源"""
        logger.info("=" * 60)
        logger.info("🛑 应用关闭事件")
        logger.info("=" * 60)

        # 关闭 Wiki 生成任务队列
        try:
            from api.task_queue import shutdown_task_queue
            shutdown_task_queue()
            logger.info("✅ Wiki 生成任务队列已关闭")
        except Exception as e:
            logger.warning(f"⚠️ Wiki 生成任务队列关闭失败: {str(e)}")

        # 关闭调度器
        try:
            from api.scheduler import stop_scheduler
            stop_scheduler()
            logger.info("✅ 后台定时任务已停止")
        except Exception as e:
            logger.warning(f"⚠️ 后台定时任务停止失败: {str(e)}")

    return app
