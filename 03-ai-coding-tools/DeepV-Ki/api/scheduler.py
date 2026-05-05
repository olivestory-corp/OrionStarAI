"""
后台定时任务调度器

管理所有定期执行的后台任务，如同步公开项目
"""

import logging
import asyncio
from datetime import datetime, timedelta
from typing import Optional, Callable, Any
import threading

logger = logging.getLogger(__name__)


class TaskScheduler:
    """定时任务调度器"""

    def __init__(self):
        self.tasks: dict[str, dict[str, Any]] = {}
        self.running = False
        self.thread: Optional[threading.Thread] = None

    def schedule(
        self,
        task_name: str,
        task_func: Callable,
        interval_seconds: int,
        start_immediately: bool = False
    ) -> None:
        """
        注册一个定时任务

        Args:
            task_name: 任务名称
            task_func: 异步函数
            interval_seconds: 执行间隔（秒）
            start_immediately: 是否立即执行一次
        """
        self.tasks[task_name] = {
            'func': task_func,
            'interval': interval_seconds,
            'last_run': datetime.now() if start_immediately else None,
            'next_run': datetime.now() if start_immediately else datetime.now() + timedelta(seconds=interval_seconds),
            'enabled': True,
            'run_count': 0,
            'error_count': 0,
            'last_error': None,
        }
        logger.info(f"✅ 任务已注册: {task_name} (间隔: {interval_seconds}秒)")

    def start(self) -> None:
        """启动调度器"""
        if self.running:
            logger.warning("⚠️ 调度器已在运行")
            return

        self.running = True
        self.thread = threading.Thread(target=self._run_loop, daemon=True)
        self.thread.start()
        logger.info("✅ 定时任务调度器已启动")

    def stop(self) -> None:
        """停止调度器"""
        self.running = False
        if self.thread:
            self.thread.join(timeout=5)
        logger.info("✅ 定时任务调度器已停止")

    def _run_loop(self) -> None:
        """主调度循环"""
        logger.info("🔄 调度器循环启动")

        while self.running:
            try:
                now = datetime.now()

                for task_name, task_info in self.tasks.items():
                    if not task_info['enabled']:
                        continue

                    # 检查是否应该运行
                    if now >= task_info['next_run']:
                        self._run_task(task_name, task_info, now)

                # 短暂休眠，避免 CPU 占用
                import time
                time.sleep(1)

            except Exception as e:
                logger.error(f"❌ 调度器错误: {str(e)}", exc_info=True)

    def _run_task(self, task_name: str, task_info: dict, now: datetime) -> None:
        """运行单个任务"""
        try:
            logger.info(f"▶️ 执行任务: {task_name}")
            start_time = datetime.now()

            # 运行异步任务
            task_func = task_info['func']
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

            try:
                result = loop.run_until_complete(task_func())
                elapsed = (datetime.now() - start_time).total_seconds()

                task_info['run_count'] += 1
                task_info['last_run'] = now
                task_info['next_run'] = now + timedelta(seconds=task_info['interval'])
                task_info['last_error'] = None

                logger.info(
                    f"✅ 任务完成: {task_name} "
                    f"(耗时: {elapsed:.2f}秒, 成功次数: {task_info['run_count']})"
                )

            finally:
                loop.close()

        except Exception as e:
            elapsed = (datetime.now() - start_time).total_seconds()
            task_info['error_count'] += 1
            task_info['last_error'] = str(e)
            task_info['next_run'] = now + timedelta(seconds=task_info['interval'])

            logger.error(
                f"❌ 任务失败: {task_name} "
                f"(耗时: {elapsed:.2f}秒, 错误次数: {task_info['error_count']})"
            )
            logger.error(f"   错误信息: {str(e)}")

    def get_status(self) -> dict[str, Any]:
        """获取调度器状态"""
        return {
            'running': self.running,
            'tasks': {
                name: {
                    'enabled': info['enabled'],
                    'interval': info['interval'],
                    'last_run': info['last_run'].isoformat() if info['last_run'] else None,
                    'next_run': info['next_run'].isoformat() if info['next_run'] else None,
                    'run_count': info['run_count'],
                    'error_count': info['error_count'],
                    'last_error': info['last_error'],
                }
                for name, info in self.tasks.items()
            }
        }


# 全局调度器实例
_scheduler = TaskScheduler()


def get_scheduler() -> TaskScheduler:
    """获取全局调度器实例"""
    return _scheduler


def start_scheduler() -> None:
    """启动全局调度器"""
    scheduler = get_scheduler()
    scheduler.start()


def stop_scheduler() -> None:
    """停止全局调度器"""
    scheduler = get_scheduler()
    scheduler.stop()
