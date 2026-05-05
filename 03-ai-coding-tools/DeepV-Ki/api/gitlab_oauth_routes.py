"""
GitLab OAuth Routes

This module provides FastAPI routes for GitLab OAuth login, callback, and user management.
"""

import logging
import os
from typing import Optional
from fastapi import APIRouter, HTTPException, Request, Depends
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel, Field

from api.gitlab_oauth_client import oauth
from api.user_manager import user_manager
from api.config import GITLAB_REDIRECT_URI, FRONTEND_URL
from api.auth_utils import create_access_token
from api.auth_dependencies import get_current_session_id

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth/gitlab", tags=["authentication"])

# --- Pydantic Models ---

class GitLabUserInfoResponse(BaseModel):
    username: str
    name: str
    email: str
    avatar_url: Optional[str] = None
    id: int

class AuthStatusResponse(BaseModel):
    authenticated: bool
    user: Optional[GitLabUserInfoResponse] = None
    message: str

# --- Routes ---

@router.get("/login")
async def login_gitlab(request: Request, callback_url: Optional[str] = None):
    """
    Initiate GitLab OAuth login flow.
    """
    try:
        # Use configured redirect URI or construct one
        redirect_uri = GITLAB_REDIRECT_URI
        if not redirect_uri:
            # Fallback to constructing from request (less reliable behind proxies)
            base_url = str(request.base_url).rstrip('/')
            redirect_uri = f"{base_url}/api/auth/gitlab/callback"

        logger.info(f"Initiating GitLab login, redirect_uri: {redirect_uri}")

        # Store callback_url to redirect back to specific frontend page after login
        request.session['gitlab_callback_url'] = callback_url

        # Check if client is registered
        if not hasattr(oauth, 'gitlab'):
            logger.error("GitLab OAuth client not registered.")
            if os.environ.get('NODE_ENV') != 'production':
                return JSONResponse(
                    status_code=500,
                    content={"error": "GitLab OAuth not configured", "message": "Missing GITLAB_CLIENT_ID/SECRET"}
                )
            raise HTTPException(status_code=500, detail="GitLab OAuth configuration error")

        return await oauth.gitlab.authorize_redirect(request, redirect_uri)
    except Exception as e:
        logger.error(f"Error initiating GitLab login: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to initiate login")

@router.get("/callback")
async def gitlab_callback(request: Request):
    """
    GitLab OAuth callback.
    """
    try:
        logger.info("Processing GitLab callback")

        if not hasattr(oauth, 'gitlab'):
             logger.error("GitLab client not registered.")
             return RedirectResponse(url=f"{FRONTEND_URL}?error=config_error", status_code=302)

        token = await oauth.gitlab.authorize_access_token(request)

        # Fetch user info using the token
        resp = await oauth.gitlab.get('user', token=token)
        user_info = resp.json()

        if not user_info:
            logger.error("Failed to fetch user info from GitLab")
            return RedirectResponse(url=f"{FRONTEND_URL}?error=no_user_info", status_code=302)

        logger.info(f"User authenticated via GitLab: {user_info.get('username')}")

        # Map to internal user format
        user_data = {
            'uid': str(user_info.get('id')), # Use GitLab ID as unique ID
            'username': user_info.get('username'),
            'name': user_info.get('name'),
            'email': user_info.get('email'),
            'avatar_url': user_info.get('avatar_url'),
            'provider': 'gitlab',
            'access_token': token.get('access_token') # Store GitLab token for API calls
        }

        # Create session
        session = user_manager.create_session(user_data)

        # Create JWT
        token_payload = {
            "sub": session.session_id,
            "uid": user_data['uid'],
            "username": user_data['username'],
            "provider": "gitlab"
        }
        access_token = create_access_token(token_payload)

        # Redirect
        stored_callback_url = request.session.get('gitlab_callback_url')
        if 'gitlab_callback_url' in request.session:
            del request.session['gitlab_callback_url']

        if stored_callback_url and (stored_callback_url.startswith("http://localhost") or stored_callback_url.startswith("https://")):
             target_url = f"{stored_callback_url}?token={access_token}"
        else:
             target_url = f"{FRONTEND_URL}/auth/callback?token={access_token}"

        return RedirectResponse(url=target_url, status_code=302)

    except Exception as e:
        logger.error(f"Error in GitLab callback: {str(e)}", exc_info=True)
        return RedirectResponse(url=f"{FRONTEND_URL}?error=callback_error", status_code=302)

@router.get("/user")
async def get_user_info(session_id: Optional[str] = Depends(get_current_session_id)):
    """
    Get current user info.
    """
    if not session_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session = user_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=401, detail="Session expired")

    user_manager.update_session_last_login(session_id)

    return {
        "id": session.user_info.uid,
        "username": session.user_info.username,
        "name": getattr(session.user_info, 'name', session.user_info.username),
        "email": getattr(session.user_info, 'email', ''),
        "avatar_url": getattr(session.user_info, 'avatar_url', None)
    }

@router.post("/logout")
async def logout(session_id: Optional[str] = Depends(get_current_session_id)):
    """
    Logout.
    """
    if session_id:
        user_manager.invalidate_session(session_id)

    response = JSONResponse(content={"success": True, "message": "Logged out"})
    response.delete_cookie("deepwiki_session")
    return response
