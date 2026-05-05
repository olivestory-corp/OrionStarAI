"""
带缓存的 GitLab 用户项目查询
集成 user_project_cache，实现快速查询用户项目
"""

import logging
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path
import time

logger = logging.getLogger(__name__)

# 延迟导入以避免循环依赖
_gitlab_client = None
_cache_manager = None


def get_gitlab_client_cached():
    """获取 GitLab 客户端"""
    global _gitlab_client
    if _gitlab_client is None:
        from api.gitlab_client import gitlab_client
        _gitlab_client = gitlab_client
    return _gitlab_client


def get_cache_manager():
    """获取缓存管理器"""
    global _cache_manager
    if _cache_manager is None:
        from api.user_project_cache import get_user_project_cache_manager
        from api.gitlab_db import DB_PATH
        _cache_manager = get_user_project_cache_manager(DB_PATH)
    return _cache_manager


class CachedGitLabClient:
    """
    带缓存的 GitLab 用户项目查询客户端

    查询流程：
    1. 检查缓存是否存在且有效（< 30 分钟）
    2. 如果有效，直接从缓存返回（快速）
    3. 如果无效或不存在，从 GitLab API 查询并缓存（较慢）
    4. 支持手动刷新缓存
    """

    @staticmethod
    async def get_user_projects(
        user_email: str = None,
        use_cache: bool = True,
        force_refresh: bool = False
    ) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
        """
        获取用户项目，支持缓存

        Args:
            user_email: 用户邮箱
            use_cache: 是否使用缓存
            force_refresh: 是否强制刷新缓存

        Returns:
            (项目列表, 元数据) 其中元数据包含缓存状态信息
        """
        cache_manager = get_cache_manager()

        # 1. 强制刷新：直接清除缓存
        if force_refresh:
            logger.info(f"🔄 用户 {user_email} 请求刷新项目缓存")
            cache_manager.invalidate_cache(user_email)

        # 2. 尝试从缓存获取
        if use_cache:
            cached_result = cache_manager.get_cached_projects(user_email)
            if cached_result:
                projects, metadata = cached_result
                metadata['source'] = 'cache'
                metadata['query_time_ms'] = 0  # 缓存查询极快
                logger.info(f"⚡ 从缓存返回用户 {user_email} 的 {len(projects)} 个项目")
                return projects, metadata

        # 3. 缓存无效，从 GitLab API 查询
        logger.info(f"🔄 从 GitLab API 查询用户 {user_email} 的项目...")
        start_time = time.time()

        gitlab_client = get_gitlab_client_cached()
        gitlab_projects = await gitlab_client.get_user_projects(user_email)

        query_time_ms = int((time.time() - start_time) * 1000)
        logger.info(f"📊 GitLab 查询耗时: {query_time_ms}ms，获得 {len(gitlab_projects)} 个项目")

        # 4. 缓存结果
        if use_cache:
            success = cache_manager.save_user_projects_to_cache(user_email, gitlab_projects)
            cache_status = 'saved' if success else 'save_failed'
        else:
            cache_status = 'disabled'

        # 5. 转换为字典格式
        projects_dict = [
            (p.to_dict() if hasattr(p, 'to_dict') else p)
            for p in gitlab_projects
        ]

        metadata = {
            'user_email': user_email,
            'total_projects': len(projects_dict),
            'source': 'gitlab_api',
            'query_time_ms': query_time_ms,
            'cache_status': cache_status,
            'timestamp': time.time()
        }

        return projects_dict, metadata

    @staticmethod
    def invalidate_user_cache(user_email: str) -> bool:
        """
        使用户缓存失效

        Args:
            user_email: 用户邮箱

        Returns:
            是否操作成功
        """
        cache_manager = get_cache_manager()
        return cache_manager.invalidate_cache(user_email)

    @staticmethod
    def get_cache_stats() -> Dict[str, Any]:
        """获取缓存统计信息"""
        cache_manager = get_cache_manager()
        return cache_manager.get_cache_stats()

    @staticmethod
    def cleanup_expired_cache() -> Dict[str, int]:
        """清理过期缓存"""
        cache_manager = get_cache_manager()
        users_deleted, projects_deleted = cache_manager.cleanup_expired_cache()
        return {
            'users_deleted': users_deleted,
            'projects_deleted': projects_deleted
        }


# 导出高级 API
async def get_user_projects_cached(
    user_email: str = None,
    use_cache: bool = True,
    force_refresh: bool = False
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """
    高级 API：获取用户项目（自动缓存）

    使用示例：
    ```python
    projects, metadata = await get_user_projects_cached(
        user_email="user@example.com",
        force_refresh=False
    )
    print(f"获取了 {len(projects)} 个项目，缓存状态: {metadata['source']}")
    print(f"查询耗时: {metadata.get('query_time_ms', 0)}ms")
    ```
    """
    return await CachedGitLabClient.get_user_projects(
        user_email=user_email,
        use_cache=use_cache,
        force_refresh=force_refresh
    )
