"""
用户项目缓存自动管理任务
定期清理过期的用户项目缓存
"""

import logging
import asyncio
from datetime import datetime, timedelta
from pathlib import Path

logger = logging.getLogger(__name__)


class CacheMaintenanceTask:
    """缓存维护任务"""

    def __init__(self, db_path: Path, interval_seconds: int = 1800):
        """
        初始化缓存维护任务

        Args:
            db_path: 数据库路径
            interval_seconds: 清理间隔（秒），默认 30 分钟
        """
        self.db_path = db_path
        self.interval_seconds = interval_seconds
        self.running = False
        self._task = None

    async def start(self):
        """启动缓存维护任务"""
        if self.running:
            logger.warning("⚠️ 缓存维护任务已在运行")
            return

        self.running = True
        logger.info(f"🚀 启动缓存维护任务 (清理间隔: {self.interval_seconds}s)")

        # 创建后台任务
        self._task = asyncio.create_task(self._run_cleanup_loop())

    async def stop(self):
        """停止缓存维护任务"""
        if not self.running:
            return

        self.running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

        logger.info("🛑 已停止缓存维护任务")

    async def _run_cleanup_loop(self):
        """后台清理循环"""
        while self.running:
            try:
                await asyncio.sleep(self.interval_seconds)

                if not self.running:
                    break

                await self._cleanup_expired_cache()

            except asyncio.CancelledError:
                logger.debug("缓存清理任务被取消")
                break
            except Exception as e:
                logger.error(f"❌ 缓存清理任务异常: {str(e)}", exc_info=True)
                # 继续运行，不要中断

    async def _cleanup_expired_cache(self):
        """执行过期缓存清理"""
        try:
            from api.cached_gitlab_client import CachedGitLabClient

            result = CachedGitLabClient.cleanup_expired_cache()

            if result['users_deleted'] > 0 or result['projects_deleted'] > 0:
                logger.info(
                    f"🧹 缓存清理完成: 删除了 {result['users_deleted']} 个用户的 "
                    f"{result['projects_deleted']} 个项目缓存"
                )

        except Exception as e:
            logger.warning(f"⚠️ 缓存清理失败: {str(e)}")

    async def get_status(self) -> dict:
        """获取任务状态"""
        return {
            "running": self.running,
            "interval_seconds": self.interval_seconds,
            "task_active": self._task is not None and not self._task.done()
        }


# 全局维护任务实例
_cache_maintenance_task: CacheMaintenanceTask = None


def get_cache_maintenance_task(db_path: Path) -> CacheMaintenanceTask:
    """获取缓存维护任务单例"""
    global _cache_maintenance_task
    if _cache_maintenance_task is None:
        _cache_maintenance_task = CacheMaintenanceTask(db_path)
    return _cache_maintenance_task


async def start_cache_maintenance(db_path: Path):
    """启动缓存维护任务"""
    task = get_cache_maintenance_task(db_path)
    await task.start()


async def stop_cache_maintenance():
    """停止缓存维护任务"""
    if _cache_maintenance_task:
        await _cache_maintenance_task.stop()


async def get_cache_maintenance_status() -> dict:
    """获取缓存维护任务状态"""
    if _cache_maintenance_task:
        return await _cache_maintenance_task.get_status()
    return {"running": False, "task": None}
