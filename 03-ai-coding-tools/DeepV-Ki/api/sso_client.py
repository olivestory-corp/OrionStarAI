"""
SSO (Single Sign-On) Client for OA Integration (OIDC)

This module handles the SSO authentication with the company OA system using OpenID Connect.
It uses Authlib to manage the OAuth2 flow.
"""

import os
import logging
from authlib.integrations.starlette_client import OAuth
from api.config import SSO_CLIENT_ID, SSO_CLIENT_SECRET, SSO_SERVER_METADATA_URL

logger = logging.getLogger(__name__)

# Initialize OAuth registry
oauth = OAuth()

def init_sso(app):
    """
    Initialize SSO client with FastAPI app.
    This should be called during application startup.
    """
    if not SSO_CLIENT_ID or not SSO_CLIENT_SECRET:
        logger.warning("SSO_CLIENT_ID or SSO_CLIENT_SECRET not set. SSO will not work.")
        return

    logger.info(f"Initializing SSO with metadata URL: {SSO_SERVER_METADATA_URL}")

    oauth.register(
        name='oa_sso',
        client_id=SSO_CLIENT_ID,
        client_secret=SSO_CLIENT_SECRET,
        server_metadata_url=SSO_SERVER_METADATA_URL,
        client_kwargs={
            'scope': 'openid profile email',
            'timeout': 10.0
        }
    )