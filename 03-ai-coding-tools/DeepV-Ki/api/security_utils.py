"""
Security Utility Module

Provides centralized functions for session validation and repository access control
backed by the database and integrated with audit logging.
"""

import logging
import asyncio
import json
from datetime import datetime, timedelta
from typing import Optional, Tuple
from fastapi import HTTPException
from urllib.parse import urlparse

from api.user_manager import user_manager
from api.gitlab_db import get_gitlab_db
from api.audit_logger import audit_logger
from api.services.project_sync_service import project_sync_service

logger = logging.getLogger(__name__)


def validate_session(session_id: Optional[str], endpoint: str) -> str:
    """
    Validate the session ID and return the user email.
    Logs unauthorized attempts.

    Args:
        session_id: The session ID from the cookie.
        endpoint: The endpoint being accessed (for logging).

    Returns:
        The user's email (uid).

    Raises:
        HTTPException: If session is missing, invalid, or expired.
    """
    if not session_id:
        audit_logger.log_unauthorized_access_attempt(
            user_email=None,
            endpoint=endpoint,
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
            endpoint=endpoint,
            reason="Invalid or expired session"
        )
        raise HTTPException(
            status_code=401,
            detail="Session expired. Please login again."
        )

    user_email = session.user_info.uid or session.user_info.username
    audit_logger.log_session_validation(user_email, session_id, True)
    return user_email


def check_repo_access(user_email: str, owner: str, repo: str, endpoint: str) -> bool:
    """
    Check if the user has access to the specified repository using the database.
    Logs the access check result.

    **Optimization:** Triggers a background sync from GitLab if the local data is stale (> 60s).

    Args:
        user_email: The user's email.
        owner: Repository owner.
        repo: Repository name.
        endpoint: The endpoint being accessed (for logging context).

    Returns:
        True if access is granted.

    Raises:
        HTTPException: If access is denied (403).
    """
    db = get_gitlab_db()
    user_projects = db.get_user_projects(user_email)

    # ========== Background Sync Trigger ==========
    # Check if we need to refresh data from GitLab (stale check)
    should_sync = False
    if not user_projects:
        should_sync = True
    else:
        synced_at_str = user_projects.get('synced_at')
        if not synced_at_str:
            should_sync = True
        else:
            try:
                synced_at = datetime.fromisoformat(synced_at_str)
                # Sync if data is older than 1 hour (3600 seconds) to protect GitLab from overload
                if datetime.now() - synced_at > timedelta(hours=1):
                    should_sync = True
            except Exception:
                should_sync = True

    if should_sync:
        try:
            # Fire and forget background task
            loop = asyncio.get_running_loop()
            loop.create_task(project_sync_service.sync_user_projects(user_email))
            logger.debug(f"🚀 [Security] Triggered background project sync for {user_email} (Data stale)")
        except RuntimeError:
            # No running loop (e.g. in tests or script), skip background sync
            logger.debug("⚠️ [Security] Could not trigger background sync: No running event loop")

    # ========== Access Check ==========
    has_access = False
    target_path_suffix = f"{owner}/{repo}".lower()  # Normalize to lowercase

    if user_projects and user_projects.get('projects'):
        for proj in user_projects['projects']:
            # 1. Try direct fields
            proj_path = proj.get('path_with_namespace', '') or proj.get('project_path', '')

            # 2. Try parsing project_data JSON if available and path looks incomplete (no slash)
            # This handles cases where DB has 'DeepCode' but we need 'ai/DeepCode'
            if not proj_path or '/' not in proj_path:
                try:
                    project_data_str = proj.get('project_data')
                    if project_data_str:
                        project_data = json.loads(project_data_str)
                        # Prefer path_with_namespace from JSON
                        proj_path = project_data.get('path_with_namespace', proj_path)
                except Exception:
                    # Ignore JSON parsing errors
                    pass

            if not proj_path:
                continue

            proj_path_lower = proj_path.lower()

            # Check for exact match or suffix match (to handle groups)
            if proj_path_lower == target_path_suffix or proj_path_lower.endswith("/" + target_path_suffix):
                has_access = True
                break

            # 3. Subgroup loose match:
            # If user asks for "group/repo" but actual is "group/subgroup/repo"
            # We check if it starts with owner/ and ends with /repo
            # This handles cases where the user/frontend omits the subgroup in the URL
            if '/' not in repo and proj_path_lower.startswith(owner.lower() + "/") and proj_path_lower.endswith("/" + repo.lower()):
                has_access = True
                break

            # Debug logging for troubleshooting (only if access denied initially)
            # logger.debug(f"Checking access: {proj_path} vs {target_path_suffix}")

    if not has_access:
        # Log detailed debug info to help troubleshoot
        logger.warning(f"🔐 Access Check Failed: User {user_email} wants {owner}/{repo} (normalized: {target_path_suffix})")
        if user_projects and user_projects.get('projects'):
            # Log first 5 projects to see format
            sample_projects = [p.get('path_with_namespace', '') or p.get('project_path', '') for p in user_projects['projects'][:5]]
            logger.warning(f"🔐 Available projects sample: {sample_projects}")

        audit_logger.log_project_access_check(
            user_email=user_email,
            owner=owner,
            repo=repo,
            granted=False,
            reason=f"User not in project member list (DB check) for {endpoint}"
        )
        raise HTTPException(
            status_code=403,
            detail=f"You don't have access to repository {owner}/{repo}. Please check your permissions."
        )

    audit_logger.log_project_access_check(
        user_email=user_email,
        owner=owner,
        repo=repo,
        granted=True,
        reason=f"User in project member list (DB check) for {endpoint}"
    )
    return True


def parse_repo_info(repo_url: str, owner: Optional[str] = None, repo_name: Optional[str] = None) -> Tuple[str, str]:
    """
    Extract owner and repo name from URL, project key, or provided arguments.
    """
    if owner and repo_name:
        return owner, repo_name

    # Try to parse from project key (e.g., "gitlab:owner/repo")
    if ":" in repo_url and "/" in repo_url and not repo_url.startswith("http"):
        try:
            # Handle "gitlab:owner/repo"
            parts = repo_url.split(":", 1)
            if len(parts) == 2:
                path = parts[1]
                path_parts = path.split("/", 1)
                if len(path_parts) == 2:
                    return path_parts[0], path_parts[1]
        except Exception:
            pass

    # Try to parse from URL
    try:
        path = repo_url
        if repo_url.startswith("http"):
            parsed = urlparse(repo_url)
            path = parsed.path.lstrip('/').replace('.git', '')

        # Remove domain if present (e.g. gitlab.com/owner/repo -> owner/repo)
        # This handles cases where urlparse might not have stripped the domain if scheme was missing
        if '/' in path:
            parts = path.split('/')
            # Filter out empty parts
            parts = [p for p in parts if p]

            if len(parts) >= 2:
                # Take the last two parts as owner and repo
                # e.g. "gitlab.com/ai/ghost_cms" -> "ai", "ghost_cms"
                # e.g. "ai/ghost_cms" -> "ai", "ghost_cms"
                return parts[-2], parts[-1]
    except Exception as e:
        logger.error(f"Error parsing repo info from {repo_url}: {e}")
        pass

    return owner or "unknown", repo_name or "unknown"
