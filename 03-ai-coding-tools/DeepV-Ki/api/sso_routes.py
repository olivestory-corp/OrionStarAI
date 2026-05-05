"""
SSO Routes for User Authentication (OIDC)

This module provides FastAPI routes for SSO login, logout, and user validation using OpenID Connect.
"""

import logging
import os
from typing import Optional
from fastapi import APIRouter, Cookie, HTTPException, Request, Depends
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel, Field

from api.sso_client import oauth
from api.user_manager import user_manager
from api.config import SSO_CLIENT_ID, SSO_SERVER_METADATA_URL
from api.auth_utils import create_access_token
from api.auth_dependencies import get_current_session_id

logger = logging.getLogger(__name__)

# Create router for SSO routes
router = APIRouter(prefix="/api/auth", tags=["authentication"])

# Frontend URL for SSO redirects
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:3000')


# --- Pydantic Models for SSO ---

class UserInfoResponse(BaseModel):
    """Response model for user information"""
    username: str = Field(..., description="User's name")
    uid: str = Field(..., description="User ID (usually email)")
    user_no: str = Field(..., description="User number")
    sex: str = Field(default="", description="User's gender")


class SessionValidationResponse(BaseModel):
    """Response for session validation"""
    valid: bool = Field(..., description="Whether session is valid")
    user_info: Optional[UserInfoResponse] = Field(None, description="User information if valid")
    message: str = Field(..., description="Response message")


class LogoutResponse(BaseModel):
    """Response for logout endpoint"""
    success: bool = Field(..., description="Whether logout was successful")
    message: str = Field(..., description="Response message")


# --- SSO Routes ---

@router.get("/login/redirect")
async def login_redirect(request: Request, callback_url: Optional[str] = None):
    """
    Initiate SSO login flow.
    Redirects the user to the SSO provider.
    """
    try:
        # Construct callback URL
        # Use FRONTEND_URL if available to ensure consistency with Keycloak config
        # This handles cases where backend is behind a proxy (e.g. Next.js rewrites)
        if FRONTEND_URL:
            base_url = FRONTEND_URL.rstrip('/')
        else:
            base_url = str(request.base_url).rstrip('/')

        redirect_uri = f"{base_url}/api/auth/sso/callback"

        # Handle protocol mismatch if behind proxy (e.g. http vs https)
        # Only apply if we are NOT using FRONTEND_URL (which should already be correct)
        if not FRONTEND_URL and base_url.startswith("https://") and redirect_uri.startswith("http://"):
            redirect_uri = redirect_uri.replace("http://", "https://", 1)

        logger.info(f"Initiating SSO login, redirect_uri: {redirect_uri}")

        # Pass callback_url in state to redirect back to the correct frontend (e.g. localhost)
        request.session['sso_callback_url'] = callback_url

        # Check if oa_sso client is registered
        if not hasattr(oauth, 'oa_sso'):
            logger.error("SSO client 'oa_sso' not registered. Check SSO_CLIENT_ID and SSO_CLIENT_SECRET.")
            # For development: if not configured, maybe redirect to a mock login or return error
            if os.environ.get('NODE_ENV') != 'production':
                # In dev, we might want to simulate a login or just show a clear error
                return JSONResponse(
                    status_code=500,
                    content={
                        "error": "SSO not configured",
                        "message": "SSO_CLIENT_ID or SSO_CLIENT_SECRET is missing. Please configure them in .env or use a mock login."
                    }
                )
            raise HTTPException(status_code=500, detail="SSO configuration error")

        return await oauth.oa_sso.authorize_redirect(request, redirect_uri)
    except Exception as e:
        logger.error(f"Error initiating login redirect: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Failed to initiate login flow"
        )


@router.get("/sso/callback")
async def sso_callback(request: Request):
    """
    SSO callback endpoint.
    Exchanges the authorization code for an access token and creates a user session.
    """
    try:
        logger.info("Processing SSO callback")

        # Check if oa_sso client is registered
        if not hasattr(oauth, 'oa_sso'):
             logger.error("SSO client 'oa_sso' not registered.")
             return RedirectResponse(
                url=f"{FRONTEND_URL}?error=sso_config_error",
                status_code=302
            )

        # Exchange code for token
        token = await oauth.oa_sso.authorize_access_token(request)
        user_info = token.get('userinfo')
        id_token = token.get('id_token')

        if not user_info:
            logger.error("No user info received from SSO")
            return RedirectResponse(
                url=f"{FRONTEND_URL}?error=no_user_info",
                status_code=302
            )

        logger.info(f"User authenticated via SSO: {user_info.get('preferred_username')}")

        # Map OIDC user info to internal format
        # Adjust these mappings based on actual Keycloak claims
        user_data = {
            'uid': user_info.get('email') or user_info.get('sub'),
            'username': user_info.get('preferred_username') or user_info.get('name', 'Unknown'),
            'user_no': user_info.get('sub'), # Using sub as user_no fallback
            'sex': '', # Not typically provided in standard OIDC
            'id_token': id_token # Store ID token for logout
        }

        # Create user session
        session = user_manager.create_session(user_data)

        # Create JWT token
        token_payload = {
            "sub": session.session_id,
            "uid": user_data['uid'],
            "username": user_data['username']
        }
        access_token = create_access_token(token_payload)

        # Redirect to frontend with token
        # Check if we have a stored callback URL (for local development)
        stored_callback_url = request.session.get('sso_callback_url')
        # Clear it
        if 'sso_callback_url' in request.session:
            del request.session['sso_callback_url']

        if stored_callback_url and (stored_callback_url.startswith("http://localhost") or stored_callback_url.startswith("https://deepwiki.example.com")):
             target_url = f"{stored_callback_url}?token={access_token}"
        else:
             target_url = f"{FRONTEND_URL}/auth/callback?token={access_token}"

        logger.info(f"Redirecting to frontend with token: {target_url}")
        return RedirectResponse(url=target_url, status_code=302)

    except Exception as e:
        logger.error(f"Error in SSO callback: {str(e)}", exc_info=True)
        return RedirectResponse(
            url=f"{FRONTEND_URL}?error=callback_error",
            status_code=302
        )


@router.get("/sso/user")
async def get_user_info(session_id: Optional[str] = Depends(get_current_session_id)):
    """
    Get current user information from session (Cookie or Header).
    Used by frontend to check login status.
    """
    try:
        if not session_id:
            return SessionValidationResponse(
                valid=False,
                message="No session found"
            )

        # Retrieve and validate session
        session = user_manager.get_session(session_id)

        if not session:
            return SessionValidationResponse(
                valid=False,
                message="Session expired or invalid"
            )

        # Update last login timestamp
        user_manager.update_session_last_login(session_id)

        # Get user info
        user_info = UserInfoResponse(
            username=session.user_info.username,
            uid=session.user_info.uid,
            user_no=session.user_info.user_no,
            sex=session.user_info.sex
        )

        return SessionValidationResponse(
            valid=True,
            user_info=user_info,
            message="User information retrieved successfully"
        )

    except Exception as e:
        logger.error(f"Error getting user info: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve user information"
        )


@router.post("/sso/logout")
async def logout(session_id: Optional[str] = Depends(get_current_session_id)):
    """
    Logout current user by invalidating session and returning SSO logout URL.
    """
    try:
        id_token_hint = None
        if session_id:
            # Retrieve session to get ID token before invalidating
            session = user_manager.get_session(session_id)
            if session:
                id_token_hint = session.id_token

            user_manager.invalidate_session(session_id)
            logger.info(f"Session invalidated: {session_id}")

        # Construct SSO logout URL
        sso_logout_url = None
        if SSO_SERVER_METADATA_URL and SSO_CLIENT_ID:
            # Derive logout endpoint from metadata URL (standard Keycloak structure)
            # Metadata: .../realms/{realm}/.well-known/openid-configuration
            # Logout:   .../realms/{realm}/protocol/openid-connect/logout
            if "/.well-known/openid-configuration" in SSO_SERVER_METADATA_URL:
                base_sso_url = SSO_SERVER_METADATA_URL.replace("/.well-known/openid-configuration", "")
                logout_endpoint = f"{base_sso_url}/protocol/openid-connect/logout"

                # Use FRONTEND_URL as post_logout_redirect_uri
                # Ensure FRONTEND_URL is in Keycloak's "Valid post logout redirect URIs"
                redirect_uri = FRONTEND_URL

                sso_logout_url = f"{logout_endpoint}?post_logout_redirect_uri={redirect_uri}&client_id={SSO_CLIENT_ID}"

                # Add id_token_hint to skip confirmation page
                if id_token_hint:
                    sso_logout_url += f"&id_token_hint={id_token_hint}"

                logger.info(f"Generated SSO logout URL: {sso_logout_url}")

        # Create response with message and logout URL
        response = JSONResponse(
            content={
                "success": True,
                "message": "Logged out successfully",
                "sso_logout_url": sso_logout_url
            },
            status_code=200
        )

        # Delete session cookie
        response.delete_cookie("deepwiki_session")

        return response

    except Exception as e:
        logger.error(f"Error during logout: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Failed to logout"
        )


@router.get("/sso/status")
async def get_auth_status(session_id: Optional[str] = Depends(get_current_session_id)):
    """
    Check current authentication status.
    Simple endpoint for health checks or middleware.
    """
    try:
        if not session_id:
            return {
                "authenticated": False,
                "message": "No session found"
            }

        session = user_manager.get_session(session_id)

        if not session:
            return {
                "authenticated": False,
                "message": "Session expired or invalid"
            }

        return {
            "authenticated": True,
            "user": {
                "username": session.user_info.username,
                "uid": session.user_info.uid,
                "user_no": session.user_info.user_no,
            },
            "message": "User is authenticated"
        }

    except Exception as e:
        logger.error(f"Error checking auth status: {str(e)}", exc_info=True)
        return {
            "authenticated": False,
            "message": "Error checking authentication status"
        }
