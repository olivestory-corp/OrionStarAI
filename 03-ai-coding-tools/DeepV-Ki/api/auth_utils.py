"""
Authentication Utilities (JWT)

This module handles JWT token generation and validation.
"""

import jwt
import os
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from api.config import SESSION_SECRET_KEY

logger = logging.getLogger(__name__)

# Use the same secret key as session middleware
SECRET_KEY = SESSION_SECRET_KEY
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30

def create_access_token(data: Dict[str, Any]) -> str:
    """
    Create a JWT access token

    Args:
        data: Payload data to encode

    Returns:
        Encoded JWT string
    """
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})

    try:
        encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
        return encoded_jwt
    except Exception as e:
        logger.error(f"Error creating access token: {str(e)}")
        raise

def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Decode and validate a JWT access token

    Args:
        token: JWT string

    Returns:
        Decoded payload or None if invalid
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        logger.error("Token expired")
        return None
    except jwt.InvalidTokenError as e:
        logger.error(f"Invalid token: {str(e)}")
        return None
    except Exception as e:
        logger.error(f"Error decoding token: {str(e)}")
        return None
