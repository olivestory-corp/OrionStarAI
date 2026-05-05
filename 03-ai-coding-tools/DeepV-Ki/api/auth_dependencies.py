"""
Repository-based Authorization Dependency

This module provides FastAPI dependency functions for checking repository
access based on the deepwiki_repo_permissions cookie.
"""

import logging
from typing import Optional, Tuple, Dict, Any
from fastapi import Depends, HTTPException, Cookie, Query, Header
from api.user_manager import user_manager
from api.repo_permission_manager import repo_permission_manager
from api.auth_utils import decode_access_token

logger = logging.getLogger(__name__)


async def get_token_payload(authorization: Optional[str] = Header(None)) -> Optional[Dict[str, Any]]:
    """Extract and decode JWT payload from Authorization header"""
    if authorization:
        scheme, _, token = authorization.partition(" ")
        if scheme.lower() == "bearer":
            return decode_access_token(token)
    return None


async def get_session_id_from_cookie(deepwiki_session: Optional[str] = Cookie(None)) -> Optional[str]:
    """Extract session ID from cookie"""
    return deepwiki_session


async def get_current_session_id(
    payload: Optional[Dict[str, Any]] = Depends(get_token_payload),
    cookie_session_id: Optional[str] = Depends(get_session_id_from_cookie)
) -> Optional[str]:
    """
    Get session ID from Authorization header (Bearer token) or Cookie.
    """
    # 1. Check Authorization Header
    if payload:
        session_id = payload.get("sub")

        # Check if session exists locally, if not restore it from JWT
        if not user_manager.get_session(session_id):
            user_manager.restore_session(session_id, {
                'uid': payload.get('uid'),
                'username': payload.get('username'),
                # Add other fields if available in payload
            })

        return session_id

    # 2. Check Cookie
    if cookie_session_id:
        return cookie_session_id

    return None


async def verify_repo_access(
    owner: str = Query(..., description="Repository owner"),
    repo: str = Query(..., description="Repository name"),
    deepwiki_repo_permissions: Optional[str] = Cookie(None, description="Repository permissions cookie")
) -> Tuple[str, str]:
    """
    Verify that user has access to the specified repository based on the permission cookie.

    Args:
        owner: Repository owner
        repo: Repository name
        deepwiki_repo_permissions: Base64 encoded permission set from cookie

    Returns:
        Tuple of (owner, repo) if access is granted

    Raises:
        HTTPException 403 if user doesn't have access
        HTTPException 401 if no permission cookie found
    """
    # Check if permission cookie exists
    if not deepwiki_repo_permissions:
        logger.warning(f"Access attempt without permission cookie for {owner}/{repo}")
        raise HTTPException(
            status_code=401,
            detail="No repository permissions cookie found. Please log in first."
        )

    # Decode permission set from cookie
    permission_set = repo_permission_manager.decode_from_cookie(deepwiki_repo_permissions)

    if not permission_set:
        logger.warning(f"Invalid permission cookie provided for {owner}/{repo}")
        raise HTTPException(
            status_code=401,
            detail="Invalid or corrupted permission cookie. Please log in again."
        )

    # Check access to specific repository
    if not permission_set.has_access(owner, repo):
        logger.warning(
            f"User {permission_set.user_id} denied access to {owner}/{repo}. "
            f"Has access to: {permission_set.get_repo_keys()}"
        )
        raise HTTPException(
            status_code=403,
            detail=f"You don't have access to repository {owner}/{repo}. "
                   f"Please check your permissions in GitLab."
        )

    logger.debug(f"User {permission_set.user_id} granted access to {owner}/{repo}")
    return owner, repo


async def verify_repo_access_with_session(
    owner: str = Query(..., description="Repository owner"),
    repo: str = Query(..., description="Repository name"),
    deepwiki_repo_permissions: Optional[str] = Cookie(None, description="Repository permissions cookie"),
    session_id: Optional[str] = Depends(get_current_session_id)
) -> Tuple[str, str, str, Optional[str]]:
    """
    Verify repository access AND session validity. More comprehensive check.

    Args:
        owner: Repository owner
        repo: Repository name
        deepwiki_repo_permissions: Base64 encoded permission set from cookie
        session_id: Session ID from dependency (Header or Cookie)

    Returns:
        Tuple of (owner, repo, session_id, user_id)

    Raises:
        HTTPException if access denied or session invalid
    """
    from api.user_manager import user_manager

    # Verify session exists
    if not session_id:
        raise HTTPException(
            status_code=401,
            detail="No session found. Please log in first."
        )

    session = user_manager.get_session(session_id)
    if not session:
        raise HTTPException(
            status_code=401,
            detail="Session expired or invalid. Please log in again."
        )

    user_id = session.user_info.uid

    # Verify repository access from cookie
    owner, repo = await verify_repo_access(owner, repo, deepwiki_repo_permissions)

    logger.debug(f"Session and repo access verified for user {user_id} to {owner}/{repo}")
    return owner, repo, session_id, user_id


async def get_user_from_cookie(
    deepwiki_repo_permissions: Optional[str] = Cookie(None, description="Repository permissions cookie")
) -> Optional[str]:
    """
    Extract user ID from the permission cookie.

    Args:
        deepwiki_repo_permissions: Base64 encoded permission set from cookie

    Returns:
        User ID if valid cookie, None otherwise
    """
    if not deepwiki_repo_permissions:
        return None

    permission_set = repo_permission_manager.decode_from_cookie(deepwiki_repo_permissions)
    if permission_set:
        return permission_set.user_id

    return None


async def get_user_accessible_repos(
    deepwiki_repo_permissions: Optional[str] = Cookie(None, description="Repository permissions cookie")
) -> Optional[set]:
    """
    Get all repositories the user has access to.

    Args:
        deepwiki_repo_permissions: Base64 encoded permission set from cookie

    Returns:
        Set of accessible repository keys (owner/repo format), or None if no cookie
    """
    if not deepwiki_repo_permissions:
        return None

    permission_set = repo_permission_manager.decode_from_cookie(deepwiki_repo_permissions)
    if permission_set:
        return permission_set.get_repo_keys()

    return None
