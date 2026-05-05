"""
Task-related API routes for wiki generation.

Handles:
- POST /api/tasks/wiki/generate - Create async wiki generation task
- GET /api/tasks/{task_id}/status - Get task status and progress
- DELETE /api/tasks/{task_id} - Cancel a task
- GET /api/tasks - List active tasks
"""

import logging
from datetime import datetime
from typing import Dict, Any, Optional
from fastapi import APIRouter, HTTPException, status, Query, Depends
from celery.result import AsyncResult

from api.celery_config import get_celery_app
from api.task_models import (
    WikiGenerationRequest,
    WikiTaskResponse,
    WikiTaskStatusResponse,
    TaskListResponse,
    TaskCancelResponse,
    TaskStatus,
)
from api.tasks import chain_wiki_generation
from api.config import WIKI_AUTH_MODE, WIKI_AUTH_CODE
from api.auth_dependencies import get_current_session_id
from api.security_utils import validate_session

logger = logging.getLogger(__name__)
celery_app = get_celery_app()

# Create router
router = APIRouter(
    prefix="/api/tasks",
    tags=["tasks"],
)


def validate_wiki_request(request: WikiGenerationRequest) -> None:
    """
    Validate wiki generation request.

    Raises:
        ValueError: If validation fails
    """
    # Validate URL format
    if not request.repo_url or not isinstance(request.repo_url, str):
        raise ValueError('Repository URL is required and must be a string')

    if not request.repo_url.startswith(('http://', 'https://')):
        raise ValueError('Repository URL must start with http:// or https://')

    # Validate repo type
    valid_types = ['github', 'gitlab', 'bitbucket', 'gerrit']
    if request.repo_type not in valid_types:
        raise ValueError(f'Invalid repository type. Must be one of: {", ".join(valid_types)}')

    # Validate provider and model (basic validation)
    # 如果为空，后端会使用配置文件的默认值，所以这里允许为空
    if request.provider and not isinstance(request.provider, str):
        raise ValueError('Provider must be a string')

    if request.model and not isinstance(request.model, str):
        raise ValueError('Model must be a string')

    # Validate language
    valid_languages = [
        'english', 'chinese', 'spanish', 'french', 'german',
        'japanese', 'korean', 'portuguese', 'russian', 'arabic'
    ]
    if request.language.lower() not in valid_languages:
        logger.warning(f'Unknown language: {request.language}, using english')


@router.post(
    '/wiki/generate',
    response_model=WikiTaskResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary='Create async wiki generation task',
    responses={
        202: {'description': 'Task created and queued'},
        400: {'description': 'Invalid request parameters'},
        401: {'description': 'Unauthorized (if auth mode enabled)'},
        500: {'description': 'Server error'},
    }
)
async def create_wiki_task(
    request: WikiGenerationRequest,
    session_id: Optional[str] = Depends(get_current_session_id)
) -> WikiTaskResponse:
    """
    Create an asynchronous wiki generation task.

    This endpoint validates the request and immediately returns a task ID.
    The actual wiki generation happens in the background using Celery.

    The client should then poll GET /api/tasks/{task_id}/status to track progress.
    """
    try:
        # Step 0: Validate session
        validate_session(session_id, "/api/tasks/wiki/generate")

        # Step 1: Validate request parameters
        logger.info(f"Creating wiki task for {request.repo_url}")
        validate_wiki_request(request)

        # Step 2: Check authorization if enabled
        if WIKI_AUTH_MODE and not WIKI_AUTH_CODE:
            logger.warning("Auth mode enabled but auth code not configured")

        # Step 3: Submit task to Celery queue
        task = chain_wiki_generation.apply_async(
            args=[
                request.repo_url,
                request.repo_type,
            ],
            kwargs={
                'token': request.token,
                'provider': request.provider,
                'model': request.model,
                'language': request.language,
                'comprehensive': request.comprehensive,
                'excluded_dirs': request.excluded_dirs,
                'excluded_files': request.excluded_files,
                'included_dirs': request.included_dirs,
                'included_files': request.included_files,
            },
            queue='default',
            expires=3600,  # Task expires after 1 hour
        )

        logger.info(f"Wiki task created: {task.id}")

        # Step 4: Return response with task ID
        return WikiTaskResponse(
            task_id=task.id,
            status=TaskStatus.PENDING,
            created_at=datetime.utcnow().isoformat(),
            redirect_url=f'/tasks/{task.id}'
        )

    except ValueError as e:
        logger.error(f"Validation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to create wiki task: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail='Failed to create wiki generation task'
        )


@router.get(
    '/{task_id}/status',
    response_model=WikiTaskStatusResponse,
    summary='Get task status and progress',
    responses={
        200: {'description': 'Task status'},
        404: {'description': 'Task not found'},
        500: {'description': 'Server error'},
    }
)
async def get_task_status(task_id: str) -> WikiTaskStatusResponse:
    """
    Get the current status and progress of a wiki generation task.

    This endpoint should be polled regularly (every 2-3 seconds) to track progress.

    Path parameters:
    - task_id: Unique task identifier returned from /api/tasks/wiki/generate

    Response example:
    ```json
    {
        "task_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        "status": "running",
        "progress": 65,
        "current_stage": "pages",
        "message": "Generating page: Architecture",
        "pages_generated": 5,
        "pages_total": 15,
        "created_at": "2024-01-01T12:00:00Z",
        "started_at": "2024-01-01T12:00:05Z",
        "error": null,
        "timestamp": "2024-01-01T12:01:30Z"
    }
    ```

    Status values:
    - pending: Task created but not yet processing
    - queued: Task queued, waiting for worker
    - running: Task currently processing
    - success: Task completed successfully
    - failed: Task failed with error
    - cancelled: Task was cancelled by user
    - timeout: Task exceeded time limit
    """
    try:
        logger.debug(f"Getting status for task {task_id}")
        result = celery_app.AsyncResult(task_id)

        # Build base response
        response = {
            'task_id': task_id,
            'created_at': datetime.utcnow().isoformat(),  # TODO: Store actual creation time
            'error': None,
            'error_code': None,
            'result': None,
        }

        # Handle different task states
        if result.state == 'PENDING':
            response.update({
                'status': 'pending',
                'progress': 0,
                'current_stage': 'validation',
                'message': 'Task pending, waiting to be processed...',
            })

        elif result.state == 'PROGRESS':
            meta = result.info or {}
            response.update({
                'status': 'running',
                'progress': meta.get('progress', 0),
                'current_stage': meta.get('stage', 'unknown'),
                'message': meta.get('message', ''),
                'pages_generated': meta.get('pages_generated', 0),
                'pages_total': meta.get('pages_total', None),
                'timestamp': meta.get('timestamp'),
            })

        elif result.state == 'SUCCESS':
            response.update({
                'status': 'success',
                'progress': 100,
                'current_stage': 'completed',
                'message': 'Task completed successfully',
                'result': result.result,
                'timestamp': datetime.utcnow().isoformat(),
            })

        elif result.state == 'FAILURE':
            error_info = result.info or {}
            if isinstance(error_info, dict):
                error_msg = error_info.get('error', 'Unknown error')
                error_code = error_info.get('error_code', 'UNKNOWN')
                timestamp = error_info.get('timestamp')
            else:
                error_msg = str(error_info)
                error_code = 'UNKNOWN'
                timestamp = None

            response.update({
                'status': 'failed',
                'progress': 0,
                'current_stage': 'failed',
                'message': error_msg,
                'error': error_msg,
                'error_code': error_code,
                'timestamp': timestamp or datetime.utcnow().isoformat(),
            })

        elif result.state == 'REVOKED':
            response.update({
                'status': 'cancelled',
                'progress': 0,
                'current_stage': 'cancelled',
                'message': 'Task was cancelled',
                'timestamp': datetime.utcnow().isoformat(),
            })

        else:
            # RETRY or other states
            response.update({
                'status': result.state.lower(),
                'progress': 0,
                'current_stage': result.state.lower(),
                'message': f'Task in {result.state} state',
                'timestamp': datetime.utcnow().isoformat(),
            })

        # Add request parameters if available
        if hasattr(result, 'args') and result.args:
            # Note: These would be populated if result_extended=True
            pass

        logger.debug(f"Task {task_id} status: {response['status']}")
        return WikiTaskStatusResponse(**response)

    except Exception as e:
        logger.error(f"Failed to get task status: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail='Failed to get task status'
        )


@router.delete(
    '/{task_id}',
    response_model=TaskCancelResponse,
    summary='Cancel a task',
    responses={
        200: {'description': 'Task cancelled'},
        404: {'description': 'Task not found'},
        500: {'description': 'Server error'},
    }
)
async def cancel_task(task_id: str) -> TaskCancelResponse:
    """
    Cancel a wiki generation task.

    This will immediately stop the task if it's still running.
    Already completed tasks cannot be cancelled.

    Path parameters:
    - task_id: Unique task identifier

    Response example:
    ```json
    {
        "task_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        "status": "cancelled",
        "message": "Task cancelled successfully"
    }
    ```
    """
    try:
        logger.info(f"Cancelling task {task_id}")

        result = celery_app.AsyncResult(task_id)

        # Check if task is already completed
        if result.state in ['SUCCESS', 'FAILURE']:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f'Cannot cancel task in {result.state} state'
            )

        # Revoke the task
        celery_app.control.revoke(task_id, terminate=True, signal='SIGKILL')

        logger.info(f"Task {task_id} revoked successfully")

        return TaskCancelResponse(
            task_id=task_id,
            status='cancelled',
            message='Task cancelled successfully'
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to cancel task: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail='Failed to cancel task'
        )


@router.get(
    '/',
    response_model=TaskListResponse,
    summary='List active tasks',
    responses={
        200: {'description': 'List of tasks'},
        500: {'description': 'Server error'},
    }
)
async def list_tasks(
    status: Optional[str] = Query(None, description='Filter by status'),
    limit: int = Query(100, ge=1, le=1000, description='Maximum number of tasks'),
    offset: int = Query(0, ge=0, description='Offset for pagination')
) -> TaskListResponse:
    """
    List active wiki generation tasks.

    Query parameters:
    - status: Filter by status (pending, running, success, failed, cancelled)
    - limit: Maximum number of tasks to return (default: 100, max: 1000)
    - offset: Number of tasks to skip (default: 0)

    Response example:
    ```json
    {
        "total": 5,
        "tasks": [
            {
                "task_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
                "status": "running",
                "progress": 65,
                ...
            }
        ]
    }
    ```

    Note: This currently returns a placeholder. For production, you'd need to:
    1. Store task metadata in a persistent database
    2. Query the database with filters and pagination
    """
    try:
        # Placeholder implementation
        # In production, you'd query a database for task history

        tasks = []
        total = 0

        logger.debug(f"Listing tasks with status={status}, limit={limit}, offset={offset}")

        return TaskListResponse(
            total=total,
            tasks=tasks
        )

    except Exception as e:
        logger.error(f"Failed to list tasks: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail='Failed to list tasks'
        )


@router.get(
    '/queue/status',
    summary='Get queue status overview (privacy-safe)',
    responses={
        200: {'description': 'Queue status'},
        500: {'description': 'Server error'},
    }
)
async def get_queue_status(
    task_ids: Optional[str] = Query(None, description='Comma-separated task IDs to check positions')
) -> Dict[str, Any]:
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

    user_tasks[].status 取值：
    - "processing": 任务正在生成中
    - "queued": 任务正在排队
    - "completed": 任务已完成
    - "failed": 任务失败
    - "not_found": 任务不存在

    user_tasks[].position 取值：
    - -1: 正在生成中
    - 0: 不在队列中（已完成/失败/不存在）
    - N (正整数): 排在第 N 位（包含正在处理的任务，即 N=1 表示下一个就是你）
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
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail='Failed to get queue status'
        )
