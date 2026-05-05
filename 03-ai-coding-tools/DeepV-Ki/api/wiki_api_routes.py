"""
Wiki API Routes
提供 Wiki 项目状态查询的 API 端点
"""

from fastapi import APIRouter, HTTPException, Cookie, Depends
from pydantic import BaseModel
from typing import List, Dict, Optional
import logging

from api.gitlab_db import get_gitlab_db
from api.security_utils import validate_session, check_repo_access, parse_repo_info
from api.auth_dependencies import get_current_session_id

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/wiki", tags=["wiki"])


# ==================== Request/Response Models ====================

class BatchStatusRequest(BaseModel):
    """批量状态查询请求"""
    project_keys: List[str]


class WikiProjectStatusResponse(BaseModel):
    """Wiki 项目状态响应"""
    project_key: str
    status: str
    current_task_id: Optional[str] = None
    pages_count: Optional[int] = None
    documents_count: Optional[int] = None
    last_generated_at: Optional[str] = None
    generation_count: int = 0
    progress: Optional[int] = None  # 生成进度百分比 (0-100)
    message: Optional[str] = None   # 当前阶段的说明文字


# ==================== API Endpoints ====================

@router.get("/projects/{project_key:path}/status")
async def get_project_wiki_status(project_key: str) -> WikiProjectStatusResponse:
    """
    获取单个项目的 Wiki 状态

    Args:
        project_key: 项目唯一标识 (格式: {repo_type}:{owner}/{repo_name})

    Returns:
        Wiki 项目状态
    """
    try:
        db = get_gitlab_db()
        project = db.get_wiki_project_by_key(project_key)

        if not project:
            raise HTTPException(
                status_code=404,
                detail=f"Wiki project not found: {project_key}"
            )

        return WikiProjectStatusResponse(
            project_key=project['project_key'],
            status=project['status'],
            current_task_id=project.get('current_task_id'),
            pages_count=project.get('pages_count'),
            documents_count=project.get('documents_count'),
            last_generated_at=project.get('last_generated_at'),
            generation_count=project.get('generation_count', 0),
            progress=project.get('progress'),
            message=project.get('message')
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting wiki status for {project_key}: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get wiki status: {str(e)}"
        )


@router.post("/projects/status/batch")
async def get_batch_wiki_status(request: BatchStatusRequest) -> Dict[str, WikiProjectStatusResponse]:
    """
    批量获取多个项目的 Wiki 状态

    Args:
        request: 包含 project_keys 列表的请求

    Returns:
        项目状态字典 {project_key: status_info}
    """
    try:
        db = get_gitlab_db()
        result = {}

        for project_key in request.project_keys:
            try:
                project = db.get_wiki_project_by_key(project_key)

                if project:
                    result[project_key] = WikiProjectStatusResponse(
                        project_key=project['project_key'],
                        status=project['status'],
                        current_task_id=project.get('current_task_id'),
                        pages_count=project.get('pages_count'),
                        documents_count=project.get('documents_count'),
                        last_generated_at=project.get('last_generated_at'),
                        generation_count=project.get('generation_count', 0),
                        progress=project.get('progress'),
                        message=project.get('message')
                    )
                else:
                    # 项目不存在，返回 not_generated 状态
                    # logger.debug(f"Project not found in DB: {project_key}")
                    result[project_key] = WikiProjectStatusResponse(
                        project_key=project_key,
                        status='not_generated',
                        generation_count=0
                    )
            except Exception as e:
                logger.warning(f"Error getting status for {project_key}: {e}")
                # 发生错误时也返回 not_generated
                result[project_key] = WikiProjectStatusResponse(
                    project_key=project_key,
                    status='not_generated',
                    generation_count=0
                )

        return result

    except Exception as e:
        logger.error(f"Error in batch wiki status: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get batch wiki status: {str(e)}"
        )


@router.get("/projects/{project_key:path}/content")
async def get_project_wiki_content(
    project_key: str,
    session_id: Optional[str] = Depends(get_current_session_id)
) -> Dict:
    """
    获取项目的 Wiki 内容

    **Security:** Requires valid session and repository access.

    Args:
        project_key: 项目唯一标识 (格式: {repo_type}:{owner}/{repo_name})
        session_id: Session ID (from Cookie or Header)

    Returns:
        Wiki 结构和内容
    """
    try:
        # ========== 认证与权限检查 ==========
        user_email = validate_session(session_id, f"/api/wiki/projects/{project_key}/content")

        owner, repo = parse_repo_info(project_key)
        check_repo_access(user_email, owner, repo, f"/api/wiki/projects/{project_key}/content")

        db = get_gitlab_db()
        project = db.get_wiki_project_by_key(project_key)

        if not project:
            raise HTTPException(
                status_code=404,
                detail=f"Wiki project not found: {project_key}"
            )

        if project['status'] != 'generated':
            raise HTTPException(
                status_code=400,
                detail=f"Wiki not generated yet. Current status: {project['status']}"
            )

        # 解析 wiki_structure JSON
        import json
        wiki_structure = json.loads(project.get('wiki_structure', '{}'))

        if not wiki_structure:
            raise HTTPException(
                status_code=404,
                detail="Wiki structure is empty"
            )

        return {
            'wiki_structure': wiki_structure,
            'project_key': project['project_key'],
            'status': project['status'],
            'pages_count': project.get('pages_count'),
            'documents_count': project.get('documents_count'),
            'last_generated_at': project.get('last_generated_at')
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting wiki content for {project_key}: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get wiki content: {str(e)}"
        )


@router.get("/projects/{project_key:path}/structure")
async def get_wiki_structure(
    project_key: str,
    session_id: Optional[str] = Depends(get_current_session_id)
) -> Dict:
    """
    获取 Wiki 结构（导航用）- 只返回结构不返回内容

    **Security:** Requires valid session and repository access.

    Args:
        project_key: 项目唯一标识
        session_id: Session ID (from Cookie or Header)

    Returns:
        Wiki 结构信息（标题、页面列表、分区）
    """
    try:
        # ========== 认证与权限检查 ==========
        user_email = validate_session(session_id, f"/api/wiki/projects/{project_key}/structure")

        owner, repo = parse_repo_info(project_key)
        check_repo_access(user_email, owner, repo, f"/api/wiki/projects/{project_key}/structure")

        db = get_gitlab_db()
        project = db.get_wiki_project_by_key(project_key)

        if not project:
            raise HTTPException(
                status_code=404,
                detail=f"Wiki not found: {project_key}"
            )

        if project['status'] != 'generated':
            raise HTTPException(
                status_code=400,
                detail=f"Wiki not generated yet. Status: {project['status']}"
            )

        # 解析 Wiki 结构
        import json
        wiki_structure = json.loads(project.get('wiki_structure', '{}'))

        # 只返回结构信息，不返回页面内容（减少数据传输）
        structure = {
            'title': wiki_structure.get('title', ''),
            'description': wiki_structure.get('description', ''),
            'pages': [
                {
                    'id': p.get('id', ''),
                    'title': p.get('title', ''),
                    'importance': p.get('importance', 'medium')
                }
                for p in wiki_structure.get('pages', [])
            ],
            'sections': wiki_structure.get('sections', []),
            'rootSections': wiki_structure.get('rootSections', [])
        }

        return structure

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting wiki structure: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get wiki structure: {str(e)}"
        )


@router.get("/projects/{project_key:path}/html/{page_id}")
async def get_page_html(
    project_key: str,
    page_id: str,
    session_id: Optional[str] = Depends(get_current_session_id)
) -> Dict:
    """
    获取单个页面的 Markdown 内容（路径保持 /html/ 以兼容前端，但返回 markdown）

    **Security:** Requires valid session and repository access.

    Args:
        project_key: 项目唯一标识
        page_id: 页面 ID
        session_id: Session ID (from Cookie or Header)

    Returns:
        页面数据 {page_id, title, markdown, importance, rendered_at}
    """
    try:
        # ========== 认证与权限检查 ==========
        user_email = validate_session(session_id, f"/api/wiki/projects/{project_key}/html/{page_id}")

        owner, repo = parse_repo_info(project_key)
        check_repo_access(user_email, owner, repo, f"/api/wiki/projects/{project_key}/html/{page_id}")

        db = get_gitlab_db()

        # 从数据库获取 Markdown 内容（已在数据库层清理）
        page_data = db.get_rendered_page(project_key, page_id)

        if not page_data:
            raise HTTPException(
                status_code=404,
                detail=f"Page not found: {page_id}"
            )

        return page_data

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting page for {project_key}/{page_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get page: {str(e)}"
        )
