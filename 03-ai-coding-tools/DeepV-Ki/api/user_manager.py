"""
User Manager for SSO Integration

This module handles user information storage, cookie management,
and session persistence.
"""

import json
import logging
import os
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from pathlib import Path
import hashlib
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class UserInfo(BaseModel):
    """User information model"""
    username: str = Field(..., description="User's name")
    uid: str = Field(..., description="User ID (usually email)")
    user_no: str = Field(..., description="User number")
    sex: str = Field(default="", description="User's gender")
    is_admin: bool = Field(default=False, description="Whether user is admin")
    created_at: str = Field(..., description="When user info was first saved")
    last_login: str = Field(..., description="Last login timestamp")


class UserSession(BaseModel):
    """User session information"""
    session_id: str = Field(..., description="Unique session ID")
    user_info: UserInfo = Field(..., description="User information")
    id_token: Optional[str] = Field(None, description="OIDC ID Token for logout")
    access_token: Optional[str] = Field(None, description="OAuth Access Token")
    created_at: str = Field(..., description="Session creation time")
    expires_at: str = Field(..., description="Session expiration time")
    valid: bool = Field(default=True, description="Whether session is valid")


class UserManager:
    """Manages user information and sessions"""

    # Session configuration
    SESSION_DURATION_DAYS = 30
    SESSION_STORAGE_DIR = os.path.expanduser(os.path.join("~", ".adalflow", "sessions"))

    def __init__(self):
        # Create session storage directory
        Path(self.SESSION_STORAGE_DIR).mkdir(parents=True, exist_ok=True)
        logger.info(f"UserManager initialized with session dir: {self.SESSION_STORAGE_DIR}")

    @staticmethod
    def generate_session_id(uid: str) -> str:
        """
        Generate a unique session ID

        Args:
            uid: User ID (email)

        Returns:
            Hash-based session ID
        """
        timestamp = datetime.now().isoformat()
        data = f"{uid}:{timestamp}".encode('utf-8')
        session_id = hashlib.sha256(data).hexdigest()
        return session_id

    def create_session(self, user_data: Dict[str, Any]) -> UserSession:
        """
        Create a new user session

        Args:
            user_data: Dictionary containing user information
                      May include 'is_admin' key for admin status
                      May include 'id_token' for OIDC logout

        Returns:
            UserSession object
        """
        session_id = self.generate_session_id(user_data.get('uid', ''))
        now = datetime.now()
        expires_at = now + timedelta(days=self.SESSION_DURATION_DAYS)

        # Create UserInfo object
        user_info = UserInfo(
            username=user_data.get('username', ''),
            uid=user_data.get('uid', ''),
            user_no=user_data.get('user_no', ''),
            sex=user_data.get('sex', ''),
            is_admin=user_data.get('is_admin', False),
            created_at=now.isoformat(),
            last_login=now.isoformat()
        )

        # Create session
        session = UserSession(
            session_id=session_id,
            user_info=user_info,
            id_token=user_data.get('id_token'),
            access_token=user_data.get('access_token'),
            created_at=now.isoformat(),
            expires_at=expires_at.isoformat(),
            valid=True
        )

        # Save session to file
        self._save_session(session)

        logger.info(f"Created session for user: {user_data.get('uid')}")
        return session

    def restore_session(self, session_id: str, user_data: Dict[str, Any]) -> UserSession:
        """
        Restore session from trusted source (e.g. JWT)

        Args:
            session_id: The session ID to restore
            user_data: User information

        Returns:
            UserSession object
        """
        now = datetime.now()
        expires_at = now + timedelta(days=self.SESSION_DURATION_DAYS)

        # Create UserInfo object
        user_info = UserInfo(
            username=user_data.get('username', ''),
            uid=user_data.get('uid', ''),
            user_no=user_data.get('user_no', ''),
            sex=user_data.get('sex', ''),
            is_admin=user_data.get('is_admin', False),
            created_at=now.isoformat(),
            last_login=now.isoformat()
        )

        # Create session
        session = UserSession(
            session_id=session_id,
            user_info=user_info,
            id_token=user_data.get('id_token'),
            access_token=user_data.get('access_token'),
            created_at=now.isoformat(),
            expires_at=expires_at.isoformat(),
            valid=True
        )

        # Save session to file
        self._save_session(session)

        logger.info(f"Restored session {session_id} for user {user_data.get('uid')}")
        return session

    def get_session(self, session_id: str) -> Optional[UserSession]:
        """
        Retrieve session by ID

        Args:
            session_id: Session ID to retrieve

        Returns:
            UserSession if valid and not expired, None otherwise
        """
        session = self._load_session(session_id)

        if not session:
            logger.debug(f"Session not found: {session_id}")
            return None

        # Check if session is expired
        expires_at = datetime.fromisoformat(session.expires_at)
        if datetime.now() > expires_at:
            logger.info(f"Session expired: {session_id}")
            self._invalidate_session(session_id)
            return None

        # Check if session is marked as invalid
        if not session.valid:
            logger.info(f"Session marked as invalid: {session_id}")
            return None

        return session

    def update_session_last_login(self, session_id: str) -> bool:
        """
        Update the last login timestamp for a session

        Args:
            session_id: Session ID to update

        Returns:
            True if successful, False otherwise
        """
        session = self._load_session(session_id)

        if not session:
            return False

        session.user_info.last_login = datetime.now().isoformat()
        self._save_session(session)

        logger.debug(f"Updated last login for session: {session_id}")
        return True

    def invalidate_session(self, session_id: str) -> bool:
        """
        Invalidate a session (logout)

        Args:
            session_id: Session ID to invalidate

        Returns:
            True if successful, False otherwise
        """
        session = self._load_session(session_id)

        if not session:
            return False

        self._invalidate_session(session_id)
        logger.info(f"Invalidated session: {session_id}")
        return True

    def _save_session(self, session: UserSession) -> None:
        """Save session to file"""
        session_file = os.path.join(self.SESSION_STORAGE_DIR, f"{session.session_id}.json")
        try:
            with open(session_file, 'w', encoding='utf-8') as f:
                json.dump(session.model_dump(), f, indent=2)
            logger.debug(f"Saved session to: {session_file}")
        except Exception as e:
            logger.error(f"Error saving session: {str(e)}", exc_info=True)

    def _load_session(self, session_id: str) -> Optional[UserSession]:
        """Load session from file"""
        session_file = os.path.join(self.SESSION_STORAGE_DIR, f"{session_id}.json")
        try:
            if not os.path.exists(session_file):
                return None

            with open(session_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                session = UserSession(**data)
                return session
        except Exception as e:
            logger.error(f"Error loading session: {str(e)}", exc_info=True)
            return None

    def _invalidate_session(self, session_id: str) -> None:
        """Mark session as invalid"""
        session = self._load_session(session_id)
        if session:
            session.valid = False
            self._save_session(session)

    @staticmethod
    def get_user_from_session(session: UserSession) -> Dict[str, str]:
        """
        Extract user info from session

        Args:
            session: UserSession object

        Returns:
            Dictionary with user information
        """
        return {
            'username': session.user_info.username,
            'uid': session.user_info.uid,
            'user_no': session.user_info.user_no,
            'sex': session.user_info.sex,
        }


# Create singleton instance
user_manager = UserManager()
