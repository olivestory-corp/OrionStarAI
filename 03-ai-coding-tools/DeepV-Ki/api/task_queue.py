"""
Wiki 生成任务队列管理模块

负责：
- 管理异步wiki生成任务
- 持久化任务状态到SQLite
- 后台处理任务队列
- 提供任务状态查询接口
- 任务超时控制
"""

import logging
import uuid
import threading
import time
import os
import sqlite3
from pathlib import Path
from typing import Optional, Dict, Any
from datetime import datetime
from dotenv import load_dotenv
from api.gitlab_db import get_gitlab_db
from api.data_pipeline import download_repo, read_all_documents
from api.rag import RAG
from api.exceptions import TaskTimeoutError

# 加载环境变量（与 gitlab_client.py 保持一致）
load_dotenv(Path(__file__).parent.parent / '.env')

logger = logging.getLogger(__name__)


class TaskQueueManager:
    """
    Wiki 生成任务队列管理器

    功能：
    - 创建和跟踪任务
    - 管理任务队列
    - 后台处理任务
    - 更新任务进度
    - 全局并发控制（同时只能处理 1 个任务）
    - 日期限制（每个项目每天只能成功生成 1 次）
    """

    def __init__(self, max_concurrent_tasks: int = 1, poll_interval: int = 2):
        """
        初始化任务队列管理器

        Args:
            max_concurrent_tasks: 最多同时处理的任务数（默认1个，全局限制）
            poll_interval: 后台线程轮询间隔（秒）
        """
        self.db = get_gitlab_db()
        self.max_concurrent_tasks = max_concurrent_tasks  # 全局限制：改为 1
        self.global_execution_lock = threading.Lock()  # 全局执行锁
        self.poll_interval = poll_interval
        self.active_tasks = {}  # 记录当前正在处理的任务
        self.worker_thread = None
        self.running = False

    def create_task(
        self,
        repo_url: str,
        repo_type: str,
        owner: str,
        repo_name: str,
        provider: str,
        model: str,
        language: str,
        is_comprehensive: bool = True,
        excluded_dirs: Optional[str] = None,
        excluded_files: Optional[str] = None,
        included_dirs: Optional[str] = None,
        included_files: Optional[str] = None,
        access_token: Optional[str] = None,
        force_refresh: bool = False
    ) -> str:
        """
        创建一个新的wiki生成任务

        Args:
            repo_url: 仓库URL
            repo_type: 仓库类型 (github, gitlab, bitbucket, gerrit)
            owner: 仓库所有者
            repo_name: 仓库名称
            provider: AI提供商 (google, openai, openrouter, etc.)
            model: 模型名称
            language: 生成语言
            is_comprehensive: 是否生成全面的wiki
            excluded_dirs: 排除的目录
            excluded_files: 排除的文件
            included_dirs: 包含的目录
            included_files: 包含的文件
            access_token: 访问令牌（用于私有仓库）

        Returns:
            任务ID 或 已存在的任务ID（如果队列中存在相同项目的任务）
        """
        # 步骤 1: 获取或创建项目记录（项目维度管理）
        project_key = f"{repo_type}:{owner}/{repo_name}"
        project = self.db.get_or_create_wiki_project(
            repo_url=repo_url,
            repo_type=repo_type,
            owner=owner,
            repo_name=repo_name
        )

        # 步骤 2: 检查项目当前状态
        if project['status'] == 'generating':
            logger.info(f"⚠️ 项目 {project_key} 正在生成中，任务ID: {project['current_task_id']}")
            return project['current_task_id']

        # 步骤 3: 创建新任务
        task_id = str(uuid.uuid4())
        logger.info(f"✅ 为项目 {project_key} 创建新任务: {task_id}")

        # 步骤 4: 保存任务到数据库
        success = self.db.create_wiki_generation_task(
            task_id=task_id,
            repo_url=repo_url,
            repo_type=repo_type,
            owner=owner,
            repo_name=repo_name,
            provider=provider,
            model=model,
            language=language,
            is_comprehensive=is_comprehensive,
            excluded_dirs=excluded_dirs,
            excluded_files=excluded_files,
            included_dirs=included_dirs,
            included_files=included_files,
            access_token=access_token,
            project_key=project_key,
            force_refresh=force_refresh
        )

        if success:
            # 步骤 5: 更新项目状态为 generating
            self.db.update_wiki_project_status(project_key, 'generating', task_id)

            logger.info(f"✅ 任务已创建: {task_id} (项目: {project_key})")

            # 步骤 6: 如果worker线程没有运行，启动它
            if not self.running:
                self.start()
            return task_id
        else:
            logger.error(f"❌ 创建任务失败: {project_key}")
            raise Exception("Failed to create task in database")

    def _check_duplicate_task(self, owner: str, repo_name: str) -> Optional[Dict[str, Any]]:
        """
        检查是否存在相同项目的任务（项目级别去重）

        项目级别去重：同一个项目（owner/repo_name），不同用户只共享同一个任务

        检查优先级：
        1. queued/processing 状态的任务 → 直接复用（正在处理或等待处理）
        2. 24小时内completed的任务 → 复用（缓存命中）
        3. 其他情况 → 创建新任务

        Args:
            owner: 仓库所有者
            repo_name: 仓库名称

        Returns:
            如果存在可复用的任务则返回任务信息，否则返回None
        """
        try:
            import sqlite3
            from datetime import datetime, timedelta

            with sqlite3.connect(self.db.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()

                # 首先检查 queued 和 processing 状态（优先级最高）
                cursor.execute('''
                    SELECT * FROM wiki_generation_tasks
                    WHERE owner = ? AND repo_name = ?
                    AND status IN ('queued', 'processing')
                    ORDER BY created_at DESC
                    LIMIT 1
                ''', (owner, repo_name))
                row = cursor.fetchone()
                if row:
                    logger.info(f"⚠️ 项目 {owner}/{repo_name} 已在处理中，复用任务 (status: {row['status']}, task_id: {row['task_id']})")
                    return dict(row)

                # 不复用已完成的任务，允许用户重新生成（应对代码更新）
                logger.info(f"✓ 项目 {owner}/{repo_name} 没有进行中的任务，允许创建新任务")
                return None

        except Exception as e:
            logger.warning(f"检查重复任务时出错: {str(e)}")
            return None

    def get_task_status(self, task_id: str) -> Optional[Dict[str, Any]]:
        """
        获取任务状态

        Args:
            task_id: 任务ID

        Returns:
            任务信息字典或 None
        """
        task = self.db.get_task(task_id)
        if task:
            # 转换为前端友好的格式
            return {
                'task_id': task['task_id'],
                'status': task['status'],
                'progress': task['progress'],
                'message': task['message'],
                'repo_url': task['repo_url'],
                'repo_type': task['repo_type'],
                'owner': task['owner'],
                'repo_name': task['repo_name'],
                'provider': task['provider'],
                'model': task['model'],
                'language': task['language'],
                'result': task.get('result'),
                'error_message': task.get('error_message'),
                'created_at': task['created_at'],
                'completed_at': task.get('completed_at'),
            }
        return None

    def start(self):
        """启动后台worker线程处理任务"""
        if self.running:
            logger.warning("Worker thread is already running")
            return

        self.running = True
        self.worker_thread = threading.Thread(target=self._worker_loop, daemon=True)
        self.worker_thread.start()
        logger.info("✅ 任务队列worker线程已启动")

    def stop(self):
        """停止后台worker线程"""
        self.running = False
        if self.worker_thread and self.worker_thread.is_alive():
            self.worker_thread.join(timeout=10)
        logger.info("🛑 任务队列worker线程已停止")

    def _worker_loop(self):
        """后台worker线程主循环"""
        logger.info("🔄 任务队列worker线程启动，开始处理任务...")

        while self.running:
            try:
                # 检查是否有可用的处理槽位
                active_count = len(self.active_tasks)
                if active_count < self.max_concurrent_tasks:
                    # 获取下一个排队的任务
                    queued_tasks = self.db.get_queued_tasks(limit=1)
                    if queued_tasks:
                        task = queued_tasks[0]
                        task_id = task['task_id']
                        logger.info(f"📋 开始处理任务: {task_id}")

                        # 记录正在处理的任务
                        self.active_tasks[task_id] = True

                        # 在线程中处理任务
                        task_thread = threading.Thread(
                            target=self._process_task,
                            args=(task,),
                            daemon=False
                        )
                        task_thread.start()

                # 等待一段时间后再检查
                time.sleep(self.poll_interval)

            except Exception as e:
                logger.error(f"❌ Worker线程发生错误: {str(e)}", exc_info=True)
                time.sleep(self.poll_interval)

    def _process_task(self, task: Dict[str, Any]):
        """
        处理单个任务

        Args:
            task: 任务信息字典
        """
        task_id = task['task_id']

        try:
            # 导入必要的模块（在函数开头导入，避免 UnboundLocalError）
            import os
            from pathlib import Path

            logger.info(f"🚀 [Task {task_id}] 开始处理...")

            # 更新状态为处理中
            self.db.update_task_status(
                task_id=task_id,
                status='processing',
                progress=0,
                message='Starting wiki generation...'
            )

            # 第1阶段：下载仓库（进度0-20%）
            logger.info(f"[Task {task_id}] Stage 1: Downloading repository...")
            self.db.update_task_status(
                task_id=task_id,
                status='processing',
                progress=5,
                message='Downloading repository...'
            )

            # 🔐 从环境变量获取 access_token（如果任务中没有提供）
            # 参考 gitlab_client.py 的做法，直接使用 os.getenv
            access_token = task.get('access_token')
            logger.info(f"[Task {task_id}] 🔐 Token from task: {'YES (length: ' + str(len(access_token)) + ')' if access_token else 'NO'}")

            if not access_token:
                if task['repo_type'] == 'gitlab':
                    # 对于 GitLab，从环境变量获取全局 token
                    access_token = os.getenv('GITLAB_TOKEN', '')
                    if access_token:
                        logger.info(f"[Task {task_id}] ✅ Using GITLAB_TOKEN from environment (length: {len(access_token)})")
                    else:
                        logger.warning(f"[Task {task_id}] ⚠️ GITLAB_TOKEN not configured in environment")
                elif task['repo_type'] == 'github':
                    # 对于 GitHub，从环境变量获取全局 token
                    access_token = os.getenv('GITHUB_TOKEN', '')
                    if access_token:
                        logger.info(f"[Task {task_id}] ✅ Using GITHUB_TOKEN from environment (length: {len(access_token)})")
                    else:
                        logger.warning(f"[Task {task_id}] ⚠️ GITHUB_TOKEN not configured in environment")

            # Generate local path for repository
            adalflow_root = Path.home() / '.adalflow' / 'repos'
            repo_local_path = str(adalflow_root / task['owner'] / task['repo_name'])

            repo_path = download_repo(
                repo_url=task['repo_url'],
                local_path=repo_local_path,
                repo_type=task['repo_type'],
                access_token=access_token,  # ← 使用从环境变量获取的 token
                force_refresh=task.get('force_refresh', False)  # ← 从任务中获取 force_refresh 标志
            )
            logger.info(f"[Task {task_id}] Repository cloned to {repo_path}")

            # 第2阶段：提取文档（进度20-40%）
            logger.info(f"[Task {task_id}] Stage 2: Extracting documents...")
            self.db.update_task_status(
                task_id=task_id,
                status='processing',
                progress=20,
                message='Extracting documents from repository...'
            )

            excluded_dirs = task['excluded_dirs'].split('\n') if task['excluded_dirs'] else None
            excluded_files = task['excluded_files'].split('\n') if task['excluded_files'] else None
            included_dirs = task['included_dirs'].split('\n') if task['included_dirs'] else None
            included_files = task['included_files'].split('\n') if task['included_files'] else None

            documents = read_all_documents(
                path=repo_path,
                excluded_dirs=excluded_dirs,
                excluded_files=excluded_files,
                included_dirs=included_dirs,
                included_files=included_files
            )
            logger.info(f"[Task {task_id}] Extracted {len(documents)} documents")

            # 第3阶段：生成embeddings和准备retriever（进度40-70%）
            logger.info(f"[Task {task_id}] Stage 3: Generating embeddings...")
            self.db.update_task_status(
                task_id=task_id,
                status='processing',
                progress=40,
                message=f'Generating embeddings for {len(documents)} documents...'
            )

            # 使用默认值如果 provider 或 model 为空（从配置文件读取）
            from api.config import configs
            default_provider = configs.get('default_provider', 'google')
            default_model = configs.get('default_model', 'gemini-2.5-flash')
            provider = task['provider'] or default_provider
            model = task['model'] or default_model

            logger.info(f"[Task {task_id}] Config defaults - provider: {default_provider}, model: {default_model}")
            logger.info(f"[Task {task_id}] Task values - provider: {task.get('provider')}, model: {task.get('model')}")

            logger.info(f"[Task {task_id}] Using provider: {provider}, model: {model}")

            rag = RAG(
                provider=provider,
                model=model
            )

            # access_token 已经在 Stage 1 从环境变量获取，直接使用
            logger.info(f"[Task {task_id}] 📦 About to prepare retriever:")
            logger.info(f"[Task {task_id}]    - Repo URL: {task['repo_url']}")
            logger.info(f"[Task {task_id}]    - Repo Type: {task['repo_type']}")
            logger.info(f"[Task {task_id}]    - Has Token: {'YES' if access_token else 'NO'}")
            logger.info(f"[Task {task_id}]    - Excluded Dirs: {excluded_dirs[:50] if excluded_dirs else 'None'}")
            logger.info(f"[Task {task_id}]    - Excluded Files: {excluded_files[:50] if excluded_files else 'None'}")

            try:
                force_refresh = task.get('force_refresh', False)
                logger.info(f"[Task {task_id}] 🔄 Force refresh: {force_refresh}")

                rag.prepare_retriever(
                    repo_url_or_path=task['repo_url'],
                    type=task['repo_type'],
                    access_token=access_token,
                    excluded_dirs=excluded_dirs,
                    excluded_files=excluded_files,
                    included_dirs=included_dirs,
                    included_files=included_files,
                    force_refresh=force_refresh
                )
                logger.info(f"[Task {task_id}] ✅ Retriever prepared successfully")
            except Exception as e:
                logger.error(f"[Task {task_id}] ❌ Failed to prepare retriever: {type(e).__name__}: {str(e)}")
                raise

            # 第4阶段：生成wiki结构和内容（进度70-95%）
            logger.info(f"[Task {task_id}] Stage 4: Generating wiki structure and content...")
            self.db.update_task_status(
                task_id=task_id,
                status='processing',
                progress=70,
                message='Generating wiki structure...'
            )

            # 调用独立的 wiki 生成模块
            from api.wiki_generator import generate_wiki

            # 定义进度回调函数
            def update_wiki_progress(progress_pct, stage, detail_msg):
                """回调函数用于更新wiki生成的细粒度进度"""
                self.db.update_task_status(
                    task_id=task_id,
                    status='processing',
                    progress=progress_pct,
                    message=detail_msg
                )

                # 同时更新wiki_projects表中的进度
                project_key = task.get('project_key')
                if project_key:
                    try:
                        with sqlite3.connect(self.db.db_path) as conn:
                            cursor = conn.cursor()
                            cursor.execute('''
                                UPDATE wiki_projects
                                SET progress = ?, message = ?
                                WHERE project_key = ?
                            ''', (progress_pct, detail_msg, project_key))
                            conn.commit()
                    except Exception as e:
                        logger.warning(f"[Task {task_id}] Failed to update wiki_projects progress: {e}")

                logger.info(f"[Task {task_id}] {stage}: {detail_msg}")

            wiki_structure, documents_count = generate_wiki(task, rag, progress_callback=update_wiki_progress)

            logger.info(f"[Task {task_id}] Wiki structure and content generated")

            # 第5阶段：保存结果并完成（进度95-100%）
            logger.info(f"[Task {task_id}] Stage 5: Saving results and finalizing...")
            self.db.update_task_status(
                task_id=task_id,
                status='processing',
                progress=95,
                message='Saving wiki results...'
            )

            # 获取成本信息
            cost_message = 'Wiki generation completed successfully!'
            try:
                from api.cost_tracker import get_cost_tracker, clear_cost_tracker
                cost_tracker = get_cost_tracker(task_id)
                cost_message = cost_tracker.get_cost_message()
                cost_tracker.log_summary()
                clear_cost_tracker(task_id)
            except Exception as e:
                logger.debug(f"[Task {task_id}] Could not get cost info: {e}")

            # 保存结果到项目记录
            project_key = task.get('project_key')
            if project_key:
                success = self.db.save_wiki_project_result(
                    project_key=project_key,
                    wiki_structure=wiki_structure,
                    documents_count=documents_count,
                    message=cost_message  # 传入成本消息
                )

                if success:
                    logger.info(f"[Task {task_id}] Wiki results saved to project: {project_key}")

                    # ===== 保存 Markdown 页面（不渲染 HTML，由前端处理） =====
                    try:
                        logger.info(f"[Task {task_id}] Saving wiki pages as Markdown...")

                        # 从 wiki_structure 提取页面的 markdown 内容
                        markdown_pages = {}
                        pages = wiki_structure.get('pages', [])

                        for page in pages:
                            page_id = page.get('id', '')
                            if not page_id:
                                logger.warning(f"[Task {task_id}] Skipping page without ID")
                                continue

                            markdown_pages[page_id] = {
                                'title': page.get('title', ''),
                                'markdown': page.get('content', ''),  # 直接保存 markdown
                                'importance': page.get('importance', 'medium'),
                                'file_paths': page.get('filePaths', [])
                            }

                        # 保存 markdown 内容（复用 save_rendered_pages，但存储的是 markdown）
                        if markdown_pages:
                            save_success = self.db.save_markdown_pages(project_key, markdown_pages)
                            if save_success:
                                logger.info(f"✅ [Task {task_id}] Saved {len(markdown_pages)} pages as Markdown")
                            else:
                                logger.warning(f"[Task {task_id}] Failed to save markdown pages")
                        else:
                            logger.warning(f"[Task {task_id}] No pages to save")

                    except Exception as e:
                        logger.error(f"[Task {task_id}] Error saving markdown pages: {e}", exc_info=True)
                        # 保存失败不影响整体流程，继续
                    # ===== 保存结束 =====
                else:
                    logger.warning(f"[Task {task_id}] Failed to save wiki results to project")
            else:
                logger.warning(f"[Task {task_id}] No project_key found, skipping project result save")

            # 保存结果到任务记录
            self.db.update_task_status(
                task_id=task_id,
                status='completed',
                progress=100,
                message=cost_message,
                result={
                    'wiki_structure': wiki_structure,
                    'documents_count': documents_count,
                    'repo_path': repo_path
                }
            )

            # 更新项目状态为 generated，并记录成功日期
            if project_key:
                today = datetime.now().strftime('%Y-%m-%d')
                self.db.update_wiki_project_status(project_key, 'generated', last_success_date=today)
                logger.info(f"[Task {task_id}] Project {project_key} marked as generated (date: {today})")

            logger.info(f"✅ [Task {task_id}] 任务完成！生成了 {len(wiki_structure['pages'])} 个页面")

        except TaskTimeoutError as e:
            logger.error(f"⏱️ [Task {task_id}] 任务执行超时: {e.message}")

            # 更新任务状态
            self.db.update_task_status(
                task_id=task_id,
                status='failed',
                progress=0,
                message='Task execution timeout',
                error_message=e.message
            )

            # 更新项目状态为 failed
            project_key = task.get('project_key')
            if project_key:
                self.db.update_wiki_project_status(project_key, 'failed')
                logger.info(f"[Task {task_id}] Project {project_key} marked as failed due to timeout")

        except Exception as e:
            logger.error(f"❌ [Task {task_id}] 任务处理失败: {str(e)}", exc_info=True)

            # 更新任务状态
            self.db.update_task_status(
                task_id=task_id,
                status='failed',
                progress=0,
                message='Task failed',
                error_message=str(e)
            )

            # 更新项目状态为 failed
            project_key = task.get('project_key')
            if project_key:
                self.db.update_wiki_project_status(project_key, 'failed')
                logger.info(f"[Task {task_id}] Project {project_key} marked as failed")

        finally:
            # 从活跃任务中移除
            if task_id in self.active_tasks:
                del self.active_tasks[task_id]
            logger.info(f"[Task {task_id}] Removed from active tasks")


# 全局任务队列管理器实例
_task_queue_manager: Optional[TaskQueueManager] = None


def get_task_queue_manager() -> TaskQueueManager:
    """获取全局任务队列管理器实例"""
    global _task_queue_manager
    if _task_queue_manager is None:
        _task_queue_manager = TaskQueueManager()
    return _task_queue_manager


def init_task_queue():
    """初始化任务队列（在应用启动时调用）"""
    # 1. 清理服务器重启时中断的任务
    try:
        db = get_gitlab_db()
        cleaned_count = db.cleanup_interrupted_tasks()
        if cleaned_count > 0:
            logger.warning(f"⚠️ 服务器重启检测到 {cleaned_count} 个中断的任务，已标记为失败")
            logger.warning(f"💡 请相关人员重新生成这些项目的 Wiki")
    except Exception as e:
        logger.error(f"❌ 清理中断任务失败: {str(e)}")

    # 2. 启动任务队列管理器
    manager = get_task_queue_manager()
    manager.start()
    logger.info("✅ 任务队列管理器已初始化并启动")


def shutdown_task_queue():
    """关闭任务队列（在应用关闭时调用）"""
    global _task_queue_manager
    if _task_queue_manager:
        _task_queue_manager.stop()
        _task_queue_manager = None
    logger.info("🛑 任务队列管理器已关闭")
