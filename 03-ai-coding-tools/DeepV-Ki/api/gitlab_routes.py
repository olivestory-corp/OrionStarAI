"""
GitLab API Routes

Provides endpoints for fetching and managing user's GitLab projects.
"""

import logging
from fastapi import APIRouter, HTTPException, Query, Cookie, Depends
from typing import Dict, Any, List, Optional
import time
import threading
import asyncio

from .gitlab_client import get_user_projects, group_projects_by_role
from .user_manager import user_manager
from .gitlab_db import get_gitlab_db
from api.security_utils import validate_session, check_repo_access, parse_repo_info
from api.auth_dependencies import get_current_session_id

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/gitlab", tags=["gitlab"])

# 全局同步状态追踪 - 用于轮询
# 结构: {user_email: {stage: str, progress: int, message: str, timestamp: float}}
_sync_status: Dict[str, Dict[str, Any]] = {}


@router.get("/projects")
async def get_projects(
    email: Optional[str] = Query(None, description="User email to fetch projects for"),
    session_id: Optional[str] = Depends(get_current_session_id)
) -> Dict[str, Any]:
    """
    Fetch all projects the current user is a member of
    """
    try:
        # Determine user email and access token
        user_email = email
        access_token = None

        # If not provided in query, try to get from session cookie
        if session_id:
            try:
                session = user_manager.get_session(session_id)
                if session and session.user_info:
                    # user_info is a Pydantic object, access as attributes
                    user_email = user_email or session.user_info.uid or session.user_info.username
                    # Get access token if available (for GitLab OAuth)
                    access_token = getattr(session, 'access_token', None)
                    logger.info(f"📧 Got user email from session: {user_email}")
            except Exception as e:
                logger.debug(f"Could not get user from session: {str(e)}")

        if user_email:
            logger.info(f"Fetching projects for user: {user_email}")
        else:
            logger.warning("No user email found - aborting project fetch")
            return {
                "success": False,
                "projects": [],
                "total": 0,
                "grouped_by_role": {},
                "user_email": None,
                "message": "Authentication required: No user email found in session or query params"
            }

        # Fetch projects using user's access token if available
        projects = await get_user_projects(user_email, access_token=access_token)

        if not projects:
            logger.warning(f"No projects found for user {user_email or 'authenticated'}")

        # Group projects by role
        grouped = group_projects_by_role(projects)

        # Sort roles by access level (highest first)
        role_order = ['OWNER', 'MAINTAINER', 'DEVELOPER', 'REPORTER', 'GUEST']
        grouped_ordered = {}
        for role in role_order:
            if role in grouped:
                grouped_ordered[role] = grouped[role]

        return {
            "success": True,
            "projects": projects,
            "total": len(projects),
            "grouped_by_role": grouped_ordered,
            "user_email": user_email,
            "message": f"Successfully fetched {len(projects)} projects for {user_email or 'authenticated user'}"
        }

    except Exception as e:
        logger.error(f"Error fetching projects: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch projects: {str(e)}"
        )


def _sync_projects_background(user_email: str, access_token: str = None):
    """
    后台线程任务：执行 GitLab 项目同步
    在独立线程中运行，不会阻塞 FastAPI 请求
    """
    try:
        logger.info(f"🔄 后台线程任务开始：同步项目 ({user_email})")

        # 定义状态更新回调
        def update_status(stage, progress, message):
            _sync_status[user_email] = {
                'stage': stage,
                'progress': progress,
                'message': message,
                'timestamp': time.time()
            }

        # 初始化状态
        update_status('fetching_direct_projects', 25, '正在获取您直接参与的项目...')

        # 获取项目（在新事件循环中运行 async 函数）
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            # 传入回调函数和 access_token
            projects = loop.run_until_complete(get_user_projects(user_email, update_status, access_token))
        finally:
            loop.close()
        logger.info(f"✅ 获取到 {len(projects)} 个项目")

        # 更新状态
        update_status('processing', 70, f'正在处理 {len(projects)} 个项目...')

        # Separate by member type
        member_projects = [p for p in projects if p['member_type'] == 'member']
        inherited_projects = [p for p in projects if p['member_type'] == 'inherited']

        # Group each by role
        member_grouped = group_projects_by_role(member_projects)
        inherited_grouped = group_projects_by_role(inherited_projects)

        # Order by role
        role_order = ['OWNER', 'MAINTAINER', 'DEVELOPER', 'REPORTER', 'GUEST']

        member_ordered = {}
        for role in role_order:
            if role in member_grouped:
                member_ordered[role] = member_grouped[role]

        inherited_ordered = {}
        for role in role_order:
            if role in inherited_grouped:
                inherited_ordered[role] = inherited_grouped[role]

        # 保存到数据库
        update_status('saving', 85, '正在保存数据...')

        db = get_gitlab_db()
        projects_data = {
            'member': member_ordered,
            'inherited': inherited_ordered,
            'member_count': len(member_projects),
            'inherited_count': len(inherited_projects)
        }
        db.save_user_projects(user_email, projects_data)
        logger.info(f"✅ 项目数据已保存到数据库 (用户: {user_email})")

        # 完成同步
        _sync_status[user_email] = {
            'stage': 'completed',
            'progress': 100,
            'message': f'✅ 同步完成！共发现 {len(member_projects)} 个个人项目和 {len(inherited_projects)} 个团队项目',
            'timestamp': time.time(),
            'member_count': len(member_projects),
            'inherited_count': len(inherited_projects),
            'total': len(projects)
        }

    except Exception as e:
        logger.error(f"❌ 后台同步失败: {str(e)}", exc_info=True)
        _sync_status[user_email] = {
            'stage': 'error',
            'progress': 0,
            'message': f'❌ 同步失败: {str(e)}',
            'timestamp': time.time(),
            'error': str(e)
        }


@router.get("/projects/grouped")
async def get_projects_grouped(
    email: Optional[str] = Query(None, description="User email to fetch projects for"),
    session_id: Optional[str] = Depends(get_current_session_id)
) -> Dict[str, Any]:
    """
    Fetch user projects grouped by role

    **非阻塞操作**：立即返回缓存数据，在后台异步执行同步任务
    """
    import asyncio

    try:
        # Determine user email and access token
        user_email = email
        access_token = None

        # If not provided in query, try to get from session cookie
        if session_id:
            try:
                session = user_manager.get_session(session_id)
                if session and session.user_info:
                    user_email = user_email or session.user_info.uid or session.user_info.username
                    # Get access token if available
                    access_token = getattr(session, 'access_token', None)
                    logger.info(f"📧 Got user email from session: {user_email}")
            except Exception as e:
                logger.debug(f"Could not get user from session: {str(e)}")

        if not user_email:
            logger.warning("⚠️  No user email found")
            raise HTTPException(status_code=400, detail="User email is required")

        logger.info(f"📧 Fetching grouped projects for user: {user_email}")

        # 1. 立即初始化状态
        _sync_status[user_email] = {
            'stage': 'initializing',
            'progress': 0,
            'message': '正在初始化...',
            'timestamp': time.time()
        }

        # 2. 尝试从数据库读取缓存数据
        db = get_gitlab_db()
        cached_data = db.get_user_projects(user_email)

        # 3. 在后台启动同步任务（不等待，使用线程）
        # Pass access_token to background task
        sync_thread = threading.Thread(
            target=_sync_projects_background,
            args=(user_email, access_token),
            daemon=True,
            name=f"gitlab_sync_{user_email}"
        )
        sync_thread.start()
        logger.info(f"🔄 已启动后台线程任务 (用户: {user_email}, 线程: {sync_thread.name})")

        # 4. 立即返回（如果有缓存则返回缓存，否则返回空）
        if cached_data:
            logger.info(f"✅ 返回缓存的项目数据 (用户: {user_email})")
            return {
                "success": True,
                "member": cached_data.get('member', {}),
                "inherited": cached_data.get('inherited', {}),
                "total": cached_data.get('member_count', 0) + cached_data.get('inherited_count', 0),
                "member_count": cached_data.get('member_count', 0),
                "inherited_count": cached_data.get('inherited_count', 0),
                "user_email": user_email,
                "cached": True,
                "syncing": True
            }

        # 如果没有缓存，返回空结果
        logger.info(f"📋 首次同步，返回空数据，正在后台同步 (用户: {user_email})")
        return {
            "success": True,
            "member": {},
            "inherited": {},
            "total": 0,
            "member_count": 0,
            "inherited_count": 0,
            "user_email": user_email,
            "cached": False,
            "syncing": True
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching grouped projects: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch projects: {str(e)}"
        )


@router.get("/public-projects")
async def get_public_projects() -> Dict[str, Any]:
    """
    获取缓存的公开项目（不依赖用户）

    Returns:
        缓存的公开项目数据
    """
    try:
        from .public_projects_sync import get_cached_public_projects

        cached_data = get_cached_public_projects()

        if cached_data:
            logger.info(f"✅ 返回缓存的 {cached_data.get('total', 0)} 个公开项目")
            return {
                "success": True,
                "message": f"Found {cached_data.get('total', 0)} cached public projects",
                "data": cached_data
            }
        else:
            logger.info("⚠️ 公开项目缓存不存在，请运行同步任务")
            return {
                "success": False,
                "message": "No cached public projects. Please run sync task.",
                "data": None
            }

    except Exception as e:
        logger.error(f"Error getting public projects: {str(e)}", exc_info=True)
        return {
            "success": False,
            "message": str(e),
            "data": None
        }


@router.post("/public-projects/sync")
async def sync_public_projects_endpoint(
    session_id: Optional[str] = Depends(get_current_session_id)
) -> Dict[str, Any]:
    """
    手动触发公开项目同步（仅管理员）

    **Security:** Requires valid admin session.

    Returns:
        同步结果
    """
    try:
        from api.audit_logger import audit_logger
        from .public_projects_sync import sync_public_projects

        # ========== 认证检查 ==========
        if not session_id:
            audit_logger.log_unauthorized_access_attempt(
                user_email=None,
                endpoint="/gitlab/public-projects/sync",
                reason="Missing session cookie"
            )
            raise HTTPException(
                status_code=401,
                detail="Authentication required. Please login first."
            )

        session = user_manager.get_session(session_id)
        if not session:
            audit_logger.log_unauthorized_access_attempt(
                user_email=None,
                endpoint="/gitlab/public-projects/sync",
                reason="Invalid or expired session"
            )
            raise HTTPException(
                status_code=401,
                detail="Session expired. Please login again."
            )

        user_email = session.user_info.uid or session.user_info.username

        # ========== 管理员权限检查 ==========
        if not session.user_info.is_admin:
            audit_logger.log_unauthorized_access_attempt(
                user_email=user_email,
                endpoint="/gitlab/public-projects/sync",
                reason="User is not admin"
            )
            raise HTTPException(
                status_code=403,
                detail="This operation requires admin privileges."
            )

        audit_logger.log_session_validation(user_email, session_id, True)
        logger.info(f"✅ Admin user {user_email} triggered public projects sync")

        logger.info("📊 手动触发公开项目同步...")
        success = await sync_public_projects()

        if success:
            logger.info(f"✅ Public projects sync completed by {user_email}")
            return {
                "success": True,
                "message": "Public projects sync completed successfully"
            }
        else:
            logger.warning(f"⚠️ Public projects sync failed (triggered by {user_email})")
            return {
                "success": False,
                "message": "Public projects sync failed"
            }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error syncing public projects: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to sync public projects: {str(e)}"
        )


@router.get("/health")
async def health_check() -> Dict[str, Any]:
    """Check GitLab API connectivity"""
    try:
        from .gitlab_client import gitlab_client

        if not gitlab_client.gl:
            return {
                "status": "not_configured",
                "message": "GitLab not configured"
            }

        return {
            "status": "healthy",
            "message": "GitLab connection ready"
        }

    except Exception as e:
        logger.error(f"GitLab health check failed: {str(e)}")
        return {
            "status": "error",
            "message": str(e)
        }


@router.get("/cache")
async def get_cached_projects(
    email: Optional[str] = Query(None, description="User email"),
    session_id: Optional[str] = Depends(get_current_session_id)
) -> Dict[str, Any]:
    """
    从缓存数据库获取用户项目（不重新查询 GitLab）

    Query Parameters:
        email: User email (optional)
        session_id: SSO session ID (optional)

    Returns:
        缓存的项目数据或 null
    """
    try:
        # 确定用户邮箱
        user_email = email

        if not user_email and session_id:
            try:
                session = user_manager.get_session(session_id)
                if session and session.user_info:
                    user_email = session.user_info.uid or session.user_info.username
            except Exception as e:
                logger.debug(f"Could not get user from session: {str(e)}")

        if not user_email:
            return {
                "success": False,
                "message": "No user email provided",
                "data": None
            }

        # 从数据库读取
        db = get_gitlab_db()
        cached_data = db.get_user_projects(user_email)

        if cached_data:
            logger.info(f"✅ 从缓存读取了 {cached_data['total']} 个项目 (用户: {user_email})")
            return {
                "success": True,
                "message": f"Found {cached_data['total']} cached projects",
                "data": cached_data
            }
        else:
            logger.info(f"⚠️ 数据库中没有用户 {user_email} 的缓存")
            return {
                "success": False,
                "message": "No cached data found. Please run sync first.",
                "data": None
            }

    except Exception as e:
        logger.error(f"Error reading cache: {str(e)}", exc_info=True)
        return {
            "success": False,
            "message": str(e),
            "data": None
        }


@router.get("/project-structure")
async def get_project_structure(
    repo_url: str = Query(..., description="GitLab project URL or path (owner/repo)"),
    branch: str = Query("main", description="Git branch name"),
    session_id: Optional[str] = Depends(get_current_session_id)
) -> Dict[str, Any]:
    """
    Fetch the file tree and README for a GitLab project.

    Uses the system's configured GitLab token from .env for authentication.
    **Security:** Requires valid session and repository access permissions.
    """
    try:
        from api.audit_logger import audit_logger

        import os
        import gitlab
        from urllib.parse import urlparse

        # ========== 认证与权限检查 ==========
        user_email = validate_session(session_id, "/gitlab/project-structure")

        owner, repo = parse_repo_info(repo_url)
        check_repo_access(user_email, owner, repo, "/gitlab/project-structure")

        logger.info(f"🔍 Fetching project structure for: {repo_url}")

        # Parse GitLab instance and project path
        gitlab_instance = "https://gitlab.com"

        if repo_url.startswith("http"):
            parsed = urlparse(repo_url)
            gitlab_instance = f"{parsed.scheme}://{parsed.netloc}"
        else:
            gitlab_instance = os.getenv('GITLAB_URL', 'https://gitlab.com').rstrip('/')

        # Get GitLab token
        gitlab_token = os.getenv('GITLAB_TOKEN', '')
        if not gitlab_token:
            raise ValueError("GitLab token not configured in .env")

        # Connect to GitLab
        gl = gitlab.Gitlab(gitlab_instance, private_token=gitlab_token)
        gl.auth()
        logger.info(f"✅ Connected to GitLab: {gitlab_instance}")

        # Get project
        project = gl.projects.get(project_path)
        logger.info(f"📌 Fetched project: {project.name_with_namespace}")

        # Get the project's default branch
        default_branch = project.default_branch or 'main'
        logger.info(f"📌 Project default branch: {default_branch}")

        # Use the provided branch, or fall back to default branch
        actual_branch = branch if branch != 'main' else default_branch
        logger.info(f"🔀 Using branch for tree: {actual_branch}")

        # Fetch file tree
        file_tree = ""
        try:
            # Use all=True to handle pagination automatically
            files = project.repository_tree(ref=actual_branch, recursive=True, all=True)
            file_list = [f['path'] for f in files if f.get('type') == 'blob']
            file_tree = '\n'.join(file_list)
            logger.info(f"📂 Found {len(file_list)} files")
        except Exception as e:
            logger.warning(f"⚠️ Could not fetch file tree: {str(e)}")
            logger.error(f"Exception details: {e}", exc_info=True)

        # Fetch README
        readme = ""
        # Add lowercase variants for case-insensitive matching
        readme_variants = [
            'README.md', 'README.rst', 'README.txt', 'README',
            'readme.md', 'readme.rst', 'readme.txt', 'readme'
        ]
        for readme_name in readme_variants:
            try:
                file_obj = project.files.get(readme_name, ref=actual_branch)
                readme = file_obj.decode().decode('utf-8')
                logger.info(f"✅ Found {readme_name}")
                break
            except gitlab.exceptions.GitlabGetError as e:
                logger.debug(f"⚠️ {readme_name} not found: {e}")
                continue
            except Exception as e:
                logger.debug(f"⚠️ Error reading {readme_name}: {e}")

        if not readme:
            readme = "No README file found"

        return {
            "success": True,
            "file_tree": file_tree,
            "readme": readme,
            "message": "Project structure fetched successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error: {str(e)}", exc_info=True)
        return {
            "success": False,
            "message": str(e),
            "file_tree": "",
            "readme": ""
        }


@router.get("/file-content")
async def get_file_content(
    repo_url: str = Query(..., description="GitLab project URL or path (owner/repo)"),
    file_path: str = Query(..., description="Path to the file"),
    branch: Optional[str] = Query(None, description="Git branch name"),
    session_id: Optional[str] = Depends(get_current_session_id)
) -> Dict[str, Any]:
    """
    Fetch the content of a specific file from a GitLab project.
    Uses the provided branch or the project's default branch.

    **Security:** Requires valid session and repository access permissions.
    """
    try:
        from api.audit_logger import audit_logger

        import os
        import gitlab
        from urllib.parse import urlparse
        import base64
        from pathlib import PureWindowsPath

        # ========== 认证与权限检查 ==========
        user_email = validate_session(session_id, "/gitlab/file-content")

        owner, repo = parse_repo_info(repo_url)
        check_repo_access(user_email, owner, repo, "/gitlab/file-content")

        logger.info(f"🔍 Fetching file content: {file_path} from {repo_url} (branch: {branch})")

        # Parse GitLab instance and project path
        project_path = None
        gitlab_instance = "https://gitlab.com"

        if repo_url.startswith("http"):
            parsed = urlparse(repo_url)
            gitlab_instance = f"{parsed.scheme}://{parsed.netloc}"
            project_path = parsed.path.lstrip('/').replace('.git', '')
        else:
            gitlab_instance = os.getenv('GITLAB_URL', 'https://gitlab.com').rstrip('/')
            project_path = repo_url

        # Get GitLab token
        gitlab_token = os.getenv('GITLAB_TOKEN', '')
        if not gitlab_token:
            raise ValueError("GitLab token not configured in .env")

        # Connect to GitLab
        gl = gitlab.Gitlab(gitlab_instance, private_token=gitlab_token)
        gl.auth()

        # Get project
        try:
            project = gl.projects.get(project_path)
        except gitlab.exceptions.GitlabGetError:
            # Try removing 'gitlab:' prefix if present
            if project_path.startswith('gitlab:'):
                project_path = project_path.replace('gitlab:', '')
                project = gl.projects.get(project_path)
            else:
                raise

        # Helper function to try fetching file
        def try_fetch(ref):
            try:
                # Normalize file path to POSIX style (forward slashes)
                # Using PureWindowsPath ensures that backslashes are treated as separators
                # regardless of the server OS (Windows or Ubuntu), and as_posix() converts them to '/'
                # This is crucial for GitLab API compatibility which requires '/'
                normalized_path = PureWindowsPath(file_path).as_posix()
                f = project.files.get(normalized_path, ref=ref)
                return f.decode().decode('utf-8')
            except Exception:
                return None

        # Determine target branch
        # If branch is provided, use it; otherwise use project's default branch
        target_branch = branch if branch else project.default_branch

        # Try fetching content
        content = try_fetch(target_branch)
        used_branch = target_branch

        # If failed, and we tried a specific branch that wasn't the default,
        # try the default branch as a fallback (just in case)
        if content is None and target_branch != project.default_branch:
            logger.info(f"⚠️ Failed to fetch from {target_branch}, trying default branch {project.default_branch}")
            content = try_fetch(project.default_branch)
            if content is not None:
                used_branch = project.default_branch

        if content is None:
            raise HTTPException(status_code=404, detail=f"File not found: {file_path} (branch: {used_branch})")

        # 记录代码访问日志
        audit_logger.log_wiki_code_access_request(
            user_email=user_email,
            owner=owner,
            repo=repo,
            file_path=file_path,
            granted=True,
            reason="File content fetched successfully"
        )

        return {
            "success": True,
            "content": content,
            "branch": used_branch,
            "file_path": file_path
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error fetching file content: {str(e)}", exc_info=True)
        return {
            "success": False,
            "message": str(e)
        }


@router.get("/sync-status")
async def get_sync_status(
    email: Optional[str] = Query(None, description="User email to get sync status for"),
    session_id: Optional[str] = Depends(get_current_session_id)
) -> Dict[str, Any]:
    """
    获取 GitLab 项目同步的实时状态

    用于轮询，获取同步进度和当前阶段信息

    **Security:** Requires valid session and can only query own status.

    Query Parameters:
        email: 用户邮箱（可选，如果不提供则使用 session 中的邮箱）
        session_id: Session ID

    Response:
    {
        "stage": "fetching_direct_projects",     # 当前阶段
        "progress": 25,                          # 进度百分比 (0-100)
        "message": "正在获取您直接参与的项目...",  # 用户友好的消息
        "timestamp": 1234567890.0                # 状态更新时间戳
    }

    可能的 stage 值:
    - initializing: 初始化中
    - fetching_user: 获取用户信息
    - fetching_direct_projects: 获取直接参与的项目
    - fetching_groups: 获取用户所在的组
    - fetching_group_projects: 获取组内项目
    - processing: 处理数据
    - saving: 保存到数据库
    - completed: 同步完成
    - error: 出错
    """
    try:
        from api.audit_logger import audit_logger

        # ========== 认证检查 ==========
        if not session_id:
            audit_logger.log_unauthorized_access_attempt(
                user_email=None,
                endpoint="/gitlab/sync-status",
                reason="Missing session cookie"
            )
            raise HTTPException(
                status_code=401,
                detail="Authentication required. Please login first."
            )

        session = user_manager.get_session(session_id)
        if not session:
            audit_logger.log_unauthorized_access_attempt(
                user_email=None,
                endpoint="/gitlab/sync-status",
                reason="Invalid or expired session"
            )
            raise HTTPException(
                status_code=401,
                detail="Session expired. Please login again."
            )

        user_email = session.user_info.uid or session.user_info.username

        # ========== 权限检查 - 用户只能查看自己的同步状态 ==========
        query_email = email if email else user_email

        if query_email != user_email and not session.user_info.is_admin:
            audit_logger.log_unauthorized_access_attempt(
                user_email=user_email,
                endpoint="/gitlab/sync-status",
                reason=f"User trying to query another user's sync status: {query_email}"
            )
            raise HTTPException(
                status_code=403,
                detail="You can only view your own sync status."
            )

        if query_email not in _sync_status:
            # 如果没有同步状态，返回空闲状态
            return {
                "stage": "idle",
                "progress": 0,
                "message": "未在同步中",
                "timestamp": time.time()
            }

        return _sync_status[query_email]

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting sync status: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get sync status: {str(e)}"
        )
