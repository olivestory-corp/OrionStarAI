"""
Wiki 相关的 API 路由
"""

import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Cookie, Depends
from api.models.wiki_generation import WikiGenerationRequest
from api.models.wiki import WikiCacheData
from api.services.wiki_service import WikiService
from api.services.cache_service import WikiCacheService
from api.exceptions import InvalidRepositoryError, WikiGenerationError, TaskNotFoundError
from api.markdown_utils import clean_markdown_code_fence, fix_markdown_code_fence_spacing
from api.security_utils import validate_session, check_repo_access, parse_repo_info
from api.auth_dependencies import get_current_session_id
from api.user_manager import user_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["Wiki"])

# 初始化服务
_wiki_service: WikiService = None


def get_wiki_service() -> WikiService:
    """获取或初始化 Wiki 服务"""
    global _wiki_service
    if _wiki_service is None:
        _wiki_service = WikiService()
    return _wiki_service


from api.user_manager import user_manager

@router.post("/tasks/wiki/generate")
async def create_wiki_generation_task(
    request: WikiGenerationRequest,
    session_id: Optional[str] = Depends(get_current_session_id)
):
    """
    创建一个异步 Wiki 生成任务

    该端点接受 wiki 生成参数，验证后将任务添加到队列，
    立即返回任务 ID，实际处理在后台进行。

    **Security:** Requires valid session and repository access.

    Args:
        request: Wiki 生成请求
        session_id: Session ID

    Returns:
        {
            "task_id": "uuid",
            "status": "queued",
            "message": "Task created and queued for processing"
        }
    """
    try:
        # ========== 认证与权限检查 ==========
        user_email = validate_session(session_id, "/api/tasks/wiki/generate")

        # 解析仓库信息
        owner, repo = parse_repo_info(request.repo_url, request.owner, request.repo_name)

        # 检查仓库访问权限
        check_repo_access(user_email, owner, repo, "/api/tasks/wiki/generate")

        # 🔐 自动从 Session 注入 OAuth Token (如果前端未提供)
        if not request.access_token and session_id:
            session = user_manager.get_session(session_id)
            if session and session.access_token:
                logger.info(f"🔐 Injecting OAuth access token from session for user {user_email}")
                request.access_token = session.access_token

        logger.info(f"📝 收到 Wiki 生成请求: owner='{owner}', repo='{repo}', url='{request.repo_url}' (user: {user_email})")
        wiki_service = get_wiki_service()
        task_id = wiki_service.create_wiki_task(request)

        return {
            "task_id": task_id,
            "status": "queued",
            "message": "Task created and queued for processing",
            "repo_url": request.repo_url,
            "owner": request.owner,
            "repo_name": request.repo_name
        }

    except HTTPException:
        raise
    except InvalidRepositoryError as e:
        logger.warning(f"⚠️ 无效的仓库请求: {e.message}")
        raise HTTPException(status_code=400, detail=e.message)

    except WikiGenerationError as e:
        logger.error(f"❌ Wiki 生成错误: {e.message}")
        raise HTTPException(status_code=500, detail=e.message)

    except Exception as e:
        logger.error(f"❌ 创建任务失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to create task: {str(e)}")


@router.get("/tasks/queue/status")
async def get_queue_status(
    task_ids: Optional[str] = None
):
    """
    获取任务队列状态概览（隐私安全，不暴露项目信息）

    此 API 用于前端显示全局队列状态指示器：
    - 全局状态：[忙碌] ● 生成中 (N)  ● 排队中 (M)
    - 个人状态：显示用户各任务的队列位置

    Query parameters:
    - task_ids: 可选，逗号分隔的任务ID列表，用于计算各任务的队列位置

    Response example:
    ```json
    {
        "is_busy": true,
        "processing_count": 1,
        "queued_count": 3,
        "user_tasks": [
            {"task_id": "abc-123", "status": "processing", "position": -1},
            {"task_id": "def-456", "status": "queued", "position": 3}
        ]
    }
    ```
    """
    try:
        from api.gitlab_db import get_gitlab_db
        db = get_gitlab_db()

        # 解析逗号分隔的 task_ids
        task_id_list = None
        if task_ids:
            task_id_list = [tid.strip() for tid in task_ids.split(',') if tid.strip()]

        queue_status = db.get_queue_status(user_task_ids=task_id_list)

        logger.debug(f"Queue status: processing={queue_status['processing_count']}, "
                    f"queued={queue_status['queued_count']}, user_tasks={len(queue_status.get('user_tasks', []))}")

        return queue_status

    except Exception as e:
        logger.error(f"Failed to get queue status: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail='Failed to get queue status'
        )


@router.get("/tasks/{task_id}/status")
async def get_task_status(
    task_id: str,
    session_id: Optional[str] = Depends(get_current_session_id)
):
    """
    获取 Wiki 生成任务的状态和进度

    **Security:** Requires valid session.

    Args:
        task_id: 任务 ID
        session_id: Session ID

    Returns:
        {
            "task_id": "uuid",
            "status": "queued|processing|completed|failed",
            "progress": 0-100,
            "message": "状态消息",
            "repo_url": "...",
            "owner": "...",
            "repo_name": "...",
            "result": { wiki data } 或 null,
            "error_message": "错误信息" 或 null,
            "created_at": "时间戳",
            "completed_at": "时间戳" 或 null
        }
    """
    try:
        # ========== 认证检查 ==========
        validate_session(session_id, f"/api/tasks/{task_id}/status")

        wiki_service = get_wiki_service()
        task = wiki_service.get_task_status(task_id)

        if not task:
            raise HTTPException(status_code=404, detail=f"Task {task_id} not found")

        return task

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ 获取任务状态失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get task status: {str(e)}")


@router.get("/wiki_cache")
async def get_wiki_cache(
    owner: str,
    repo: str,
    repo_type: str,
    language: str,
    session_id: Optional[str] = Depends(get_current_session_id)
):
    """
    获取 Wiki 缓存

    **Security:** Requires valid session and repository access.

    Args:
        owner: 仓库所有者
        repo: 仓库名
        repo_type: 仓库类型
        language: 语言
        session_id: Session ID

    Returns:
        Wiki 缓存数据
    """
    try:
        # ========== 认证与权限检查 ==========
        user_email = validate_session(session_id, "/api/wiki_cache")
        check_repo_access(user_email, owner, repo, "/api/wiki_cache")

        wiki_cache = WikiCacheService.load_cache(owner, repo, repo_type, language)

        if wiki_cache is None:
            raise HTTPException(status_code=404, detail="Wiki cache not found")

        # 清理所有页面的 markdown 内容（移除可能的外层 ```markdown ... ``` 包裹）
        if wiki_cache.generated_pages:
            for page_id, page_data in wiki_cache.generated_pages.items():
                if isinstance(page_data, dict) and 'markdown' in page_data:
                    page_data['markdown'] = clean_markdown_code_fence(
                        page_data['markdown'],
                        context=f"Cache:wiki_cache/{owner}/{repo}/{page_id}"
                    )
                    page_data['markdown'] = fix_markdown_code_fence_spacing(
                        page_data['markdown'],
                        context=f"Cache:wiki_cache/{owner}/{repo}/{page_id}"
                    )

        return wiki_cache

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ 获取 Wiki 缓存失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get wiki cache: {str(e)}")


@router.post("/wiki_cache")
async def save_wiki_cache(
    owner: str,
    repo: str,
    repo_type: str,
    language: str,
    data: WikiCacheData,
    session_id: Optional[str] = Depends(get_current_session_id)
):
    """
    保存 Wiki 缓存

    **Security:** Requires valid session and repository access.

    Args:
        owner: 仓库所有者
        repo: 仓库名
        repo_type: 仓库类型
        language: 语言
        data: Wiki 缓存数据
        session_id: Session ID

    Returns:
        {"success": true}
    """
    try:
        # ========== 认证与权限检查 ==========
        user_email = validate_session(session_id, "/api/wiki_cache (POST)")
        check_repo_access(user_email, owner, repo, "/api/wiki_cache (POST)")

        success = WikiCacheService.save_cache(
            owner=owner,
            repo=repo,
            repo_type=repo_type,
            language=language,
            wiki_structure=data.wiki_structure,
            generated_pages=data.generated_pages
        )

        if not success:
            raise HTTPException(status_code=500, detail="Failed to save wiki cache")

        return {"success": True}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ 保存 Wiki 缓存失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to save wiki cache: {str(e)}")


@router.delete("/wiki_cache")
async def delete_wiki_cache(
    owner: str,
    repo: str,
    repo_type: str,
    language: str,
    session_id: Optional[str] = Depends(get_current_session_id)
):
    """
    删除 Wiki 缓存

    **Security:** Requires valid session and repository access.

    Args:
        owner: 仓库所有者
        repo: 仓库名
        repo_type: 仓库类型
        language: 语言
        session_id: Session ID

    Returns:
        {"success": true}
    """
    try:
        # ========== 认证与权限检查 ==========
        user_email = validate_session(session_id, "/api/wiki_cache (DELETE)")
        check_repo_access(user_email, owner, repo, "/api/wiki_cache (DELETE)")

        success = WikiCacheService.delete_cache(owner, repo, repo_type, language)

        if not success:
            raise HTTPException(status_code=500, detail="Failed to delete wiki cache")

        return {"success": True}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ 删除 Wiki 缓存失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to delete wiki cache: {str(e)}")
