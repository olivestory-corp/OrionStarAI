"""
带缓存的 GitLab 项目查询路由
提供快速的用户项目查询接口
"""

import logging
from fastapi import APIRouter, HTTPException, Query, Cookie
from typing import Dict, Any, Optional
import time

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/gitlab", tags=["gitlab-cached"])


@router.get("/projects/cached")
async def get_projects_cached(
    email: Optional[str] = Query(None, description="User email to fetch projects for"),
    force_refresh: bool = Query(False, description="Force refresh from GitLab API"),
    deepwiki_session: Optional[str] = Cookie(None, description="SSO session ID")
) -> Dict[str, Any]:
    """
    获取用户项目（带缓存加速）

    **性能对比：**
    - 第一次查询: ~5-10 秒（从 GitLab API）
    - 后续查询: ~100ms（从缓存）
    - 缓存有效期: 30 分钟

    Query Parameters:
        email: User email (optional)
        force_refresh: Force refresh from GitLab API (default: false)
        deepwiki_session: SSO session ID (cookie)

    Returns:
        {
            "success": true,
            "projects": [...],
            "total": 10,
            "metadata": {
                "source": "cache" | "gitlab_api",
                "query_time_ms": 150,
                "cache_status": "saved" | "disabled",
                "synced_at": "2025-11-22T12:00:00"
            }
        }
    """
    # 验证 session
    if not deepwiki_session:
        logger.warning(f"🚫 获取缓存项目请求缺少 session")
        raise HTTPException(status_code=401, detail="Unauthorized - Session required")

    from api.user_manager import user_manager
    session = user_manager.get_session(deepwiki_session)
    if not session:
        logger.warning(f"🚫 获取缓存项目请求 session 无效或已过期")
        raise HTTPException(status_code=401, detail="Session expired or invalid. Please log in again.")

    user_email = email
    if not user_email and session:
        user_email = session.user_info.uid or session.user_info.username
        logger.debug(f"📧 从 session 获取用户邮箱: {user_email}")

    if not user_email:
        raise HTTPException(status_code=400, detail="User email is required")

    try:
        from api.cached_gitlab_client import get_user_projects_cached

        logger.info(f"📊 查询用户 {user_email} 的项目 (force_refresh={force_refresh})")

        start_time = time.time()
        projects, metadata = await get_user_projects_cached(
            user_email=user_email,
            use_cache=True,
            force_refresh=force_refresh
        )
        total_time_ms = int((time.time() - start_time) * 1000)

        # 分组项目
        from api.gitlab_client import group_projects_by_role
        grouped = group_projects_by_role(projects)

        return {
            "success": True,
            "projects": projects,
            "total": len(projects),
            "grouped_by_role": grouped,
            "user_email": user_email,
            "metadata": {
                **metadata,
                "total_time_ms": total_time_ms,  # 包括网络往返时间
            },
            "message": f"Successfully fetched {len(projects)} projects for {user_email}"
        }

    except Exception as e:
        logger.error(f"❌ 获取缓存项目失败: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch projects: {str(e)}"
        )


@router.get("/cache/stats")
async def get_cache_stats(
    deepwiki_session: Optional[str] = Cookie(None, description="SSO session ID")
) -> Dict[str, Any]:
    """
    获取缓存统计信息

    需要 session 认证
    """
    # 验证 session
    if not deepwiki_session:
        raise HTTPException(status_code=401, detail="Unauthorized - Session required")

    from api.user_manager import user_manager
    session = user_manager.get_session(deepwiki_session)
    if not session:
        raise HTTPException(status_code=401, detail="Session expired or invalid.")

    try:
        from api.cached_gitlab_client import CachedGitLabClient

        stats = CachedGitLabClient.get_cache_stats()

        return {
            "success": True,
            "cache_stats": stats,
            "cache_ttl_minutes": 30,
            "auto_cleanup_enabled": True
        }

    except Exception as e:
        logger.error(f"❌ 获取缓存统计失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/cache/cleanup")
async def cleanup_expired_cache(
    deepwiki_session: Optional[str] = Cookie(None, description="SSO session ID")
) -> Dict[str, Any]:
    """
    手动清理过期缓存

    需要 session 认证
    """
    # 验证 session
    if not deepwiki_session:
        raise HTTPException(status_code=401, detail="Unauthorized - Session required")

    from api.user_manager import user_manager
    session = user_manager.get_session(deepwiki_session)
    if not session:
        raise HTTPException(status_code=401, detail="Session expired or invalid.")

    user_email = session.user_info.uid or session.user_info.username
    logger.info(f"🧹 用户 {user_email} 触发缓存清理")

    try:
        from api.cached_gitlab_client import CachedGitLabClient

        result = CachedGitLabClient.cleanup_expired_cache()

        return {
            "success": True,
            "message": f"Cleaned up {result['users_deleted']} expired user caches",
            "cleanup_result": result
        }

    except Exception as e:
        logger.error(f"❌ 清理缓存失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/cache/invalidate")
async def invalidate_user_cache(
    email: str = Query(..., description="User email to invalidate cache for"),
    deepwiki_session: Optional[str] = Cookie(None, description="SSO session ID")
) -> Dict[str, Any]:
    """
    使特定用户的缓存失效

    需要 session 认证
    """
    # 验证 session
    if not deepwiki_session:
        raise HTTPException(status_code=401, detail="Unauthorized - Session required")

    from api.user_manager import user_manager
    session = user_manager.get_session(deepwiki_session)
    if not session:
        raise HTTPException(status_code=401, detail="Session expired or invalid.")

    current_user_email = session.user_info.uid or session.user_info.username

    # 用户只能清除自己的缓存
    if current_user_email != email:
        logger.warning(f"🚫 用户 {current_user_email} 尝试清除其他用户 {email} 的缓存")
        raise HTTPException(
            status_code=403,
            detail="Forbidden - Can only invalidate your own cache"
        )

    try:
        from api.cached_gitlab_client import CachedGitLabClient

        success = CachedGitLabClient.invalidate_user_cache(email)

        if success:
            logger.info(f"✅ 已清除用户 {email} 的缓存")
            return {
                "success": True,
                "message": f"Cache invalidated for {email}",
                "user_email": email
            }
        else:
            raise Exception("Failed to invalidate cache")

    except Exception as e:
        logger.error(f"❌ 清除缓存失败 ({email}): {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
