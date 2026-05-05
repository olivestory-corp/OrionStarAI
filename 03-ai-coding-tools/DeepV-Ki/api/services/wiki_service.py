"""
Wiki 生成业务逻辑层
"""

import logging
from typing import Optional, Dict, Any
from api.models.wiki_generation import WikiGenerationRequest
from api.exceptions import InvalidRepositoryError, WikiGenerationError

logger = logging.getLogger(__name__)


class WikiService:
    """
    Wiki 生成服务

    负责：
    - 验证 Wiki 生成请求
    - 创建任务
    - 管理任务状态
    """

    def __init__(self, task_queue=None):
        """
        初始化 Wiki 服务

        Args:
            task_queue: 任务队列管理器（可注入）
        """
        self.task_queue = task_queue

    def validate_request(self, request: WikiGenerationRequest) -> None:
        """
        验证 Wiki 生成请求

        Args:
            request: Wiki 生成请求

        Raises:
            InvalidRepositoryError: 请求参数无效
        """
        # 验证仓库 URL
        if not request.repo_url:
            raise InvalidRepositoryError("repo_url is required")

        # 验证仓库类型
        if request.repo_type not in ['github', 'gitlab', 'bitbucket', 'gerrit']:
            raise InvalidRepositoryError("Invalid repo_type")

        # 验证所有者和仓库名
        if not request.owner or not request.repo_name:
            raise InvalidRepositoryError("owner and repo_name are required")

    def create_wiki_task(self, request: WikiGenerationRequest) -> str:
        """
        创建 Wiki 生成任务

        Args:
            request: Wiki 生成请求

        Returns:
            task_id: 任务 ID

        Raises:
            WikiGenerationError: 任务创建失败
        """
        try:
            # 验证请求
            self.validate_request(request)

            # 如果没有注入任务队列，导入默认实例
            if self.task_queue is None:
                from api.task_queue import get_task_queue_manager
                self.task_queue = get_task_queue_manager()

            # 如果 provider 或 model 为空，使用配置默认值
            from api.config import configs
            provider = request.provider or configs.get('default_provider', 'google')
            model = request.model or configs.get('default_model', 'gemini-2.5-flash')

            # 创建任务
            task_id = self.task_queue.create_task(
                repo_url=request.repo_url,
                repo_type=request.repo_type,
                owner=request.owner,
                repo_name=request.repo_name,
                provider=provider,
                model=model,
                language=request.language,
                is_comprehensive=request.is_comprehensive,
                excluded_dirs=request.excluded_dirs,
                excluded_files=request.excluded_files,
                included_dirs=request.included_dirs,
                included_files=request.included_files,
                access_token=request.access_token,
                force_refresh=request.force_refresh
            )

            logger.info(f"✅ Wiki 生成任务创建成功: {task_id}")
            return task_id

        except InvalidRepositoryError:
            raise
        except Exception as e:
            logger.error(f"❌ 创建 Wiki 任务失败: {str(e)}", exc_info=True)
            raise WikiGenerationError(f"Failed to create wiki task: {str(e)}") from e

    def get_task_status(self, task_id: str) -> Optional[Dict[str, Any]]:
        """
        获取任务状态

        Args:
            task_id: 任务 ID

        Returns:
            任务状态信息或 None
        """
        try:
            # 如果没有注入任务队列，导入默认实例
            if self.task_queue is None:
                from api.task_queue import get_task_queue_manager
                self.task_queue = get_task_queue_manager()

            return self.task_queue.get_task_status(task_id)

        except Exception as e:
            logger.error(f"❌ 获取任务状态失败: {str(e)}", exc_info=True)
            return None
