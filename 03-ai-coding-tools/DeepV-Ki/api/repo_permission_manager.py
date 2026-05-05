"""
Repository Permission Manager

This module handles encoding/decoding repository access permissions
in Base64 format for cookie-based authorization.
"""

import json
import base64
import logging
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class RepoPermission(BaseModel):
    """Single repository permission entry"""
    owner: str = Field(..., description="Repository owner (e.g., username or group)")
    repo: str = Field(..., description="Repository name")
    repo_type: str = Field(default="github", description="Repository type (github, gitlab, etc.)")
    access_level: str = Field(default="member", description="Access level (owner, maintainer, developer, etc.)")

    def get_key(self) -> str:
        """Get unique key for this repo: owner/repo"""
        return f"{self.owner}/{self.repo}"


class RepoPermissionSet(BaseModel):
    """Complete set of repository permissions for a user"""
    user_id: str = Field(..., description="User ID (email or username)")
    repos: List[RepoPermission] = Field(default_factory=list, description="List of accessible repositories")
    created_at: str = Field(..., description="When this permission set was created")
    version: int = Field(default=1, description="Version of permission format")

    def get_repo_keys(self) -> set:
        """Get set of all accessible repository keys (owner/repo format)"""
        return {repo.get_key() for repo in self.repos}

    def has_access(self, owner: str, repo: str) -> bool:
        """Check if user has access to a specific repository"""
        key = f"{owner}/{repo}"
        return key in self.get_repo_keys()

    def to_json(self) -> str:
        """Convert to JSON string"""
        return self.model_dump_json()

    @classmethod
    def from_json(cls, json_str: str) -> "RepoPermissionSet":
        """Load from JSON string"""
        data = json.loads(json_str)
        return cls(**data)


class RepoPermissionEncoder:
    """Encodes/decodes repository permissions to/from Base64"""

    ENCODING = "utf-8"

    @staticmethod
    def encode(permission_set: RepoPermissionSet) -> str:
        """
        Encode a permission set to Base64 string suitable for cookie

        Args:
            permission_set: RepoPermissionSet object to encode

        Returns:
            Base64 encoded string
        """
        try:
            # Convert to JSON
            json_str = permission_set.to_json()

            # Encode to Base64
            encoded = base64.b64encode(json_str.encode(RepoPermissionEncoder.ENCODING)).decode("ascii")

            logger.debug(f"Encoded permission set for user {permission_set.user_id}: {len(encoded)} bytes")
            return encoded

        except Exception as e:
            logger.error(f"Error encoding permission set: {str(e)}", exc_info=True)
            raise

    @staticmethod
    def decode(encoded_str: str) -> Optional[RepoPermissionSet]:
        """
        Decode a Base64 string back to permission set

        Args:
            encoded_str: Base64 encoded string from cookie

        Returns:
            RepoPermissionSet if valid, None if decoding fails
        """
        try:
            if not encoded_str or not isinstance(encoded_str, str):
                logger.warning("Invalid encoded string provided")
                return None

            # Decode from Base64
            decoded_bytes = base64.b64decode(encoded_str.encode("ascii"))
            json_str = decoded_bytes.decode(RepoPermissionEncoder.ENCODING)

            # Parse JSON
            permission_set = RepoPermissionSet.from_json(json_str)

            logger.debug(f"Decoded permission set for user {permission_set.user_id}: {len(permission_set.repos)} repos")
            return permission_set

        except base64.binascii.Error as e:
            logger.warning(f"Invalid Base64 encoding: {str(e)}")
            return None
        except json.JSONDecodeError as e:
            logger.warning(f"Invalid JSON in decoded permission set: {str(e)}")
            return None
        except Exception as e:
            logger.error(f"Error decoding permission set: {str(e)}", exc_info=True)
            return None


class RepoPermissionManager:
    """High-level manager for repository permissions"""

    def __init__(self):
        self.encoder = RepoPermissionEncoder()

    def create_from_gitlab_projects(
        self,
        user_id: str,
        gitlab_projects: List[Dict[str, Any]],
        created_at: str
    ) -> RepoPermissionSet:
        """
        Create permission set from GitLab project list

        Args:
            user_id: User ID (email)
            gitlab_projects: List of GitLab project dictionaries
            created_at: Timestamp of creation

        Returns:
            RepoPermissionSet object
        """
        repos = []

        for project in gitlab_projects:
            try:
                # Extract repository information
                # GitLab returns path_with_namespace like "group/project"
                path_with_namespace = project.get('path_with_namespace', '')

                if '/' in path_with_namespace:
                    owner, repo = path_with_namespace.rsplit('/', 1)
                else:
                    owner = project.get('owner', {}).get('username', 'unknown')
                    repo = project.get('name', '')

                access_level = project.get('access_level', 'member')
                access_level_name = self._get_access_level_name(access_level)

                repo_perm = RepoPermission(
                    owner=owner,
                    repo=repo,
                    repo_type="gitlab",
                    access_level=access_level_name
                )

                repos.append(repo_perm)
                logger.debug(f"Added repo permission: {repo_perm.get_key()} ({access_level_name})")

            except Exception as e:
                logger.warning(f"Error processing GitLab project: {str(e)}, project: {project}")
                continue

        permission_set = RepoPermissionSet(
            user_id=user_id,
            repos=repos,
            created_at=created_at,
            version=1
        )

        logger.info(f"Created permission set for user {user_id} with {len(repos)} repositories")
        return permission_set

    @staticmethod
    def _get_access_level_name(access_level: int) -> str:
        """
        Convert GitLab access level integer to name

        Args:
            access_level: GitLab access level (10, 20, 30, 40, 50)

        Returns:
            Access level name
        """
        access_level_map = {
            10: "guest",
            20: "reporter",
            30: "developer",
            40: "maintainer",
            50: "owner"
        }
        return access_level_map.get(access_level, "member")

    def encode_to_cookie(self, permission_set: RepoPermissionSet) -> str:
        """Encode permission set to Base64 for cookie"""
        return self.encoder.encode(permission_set)

    def decode_from_cookie(self, cookie_value: str) -> Optional[RepoPermissionSet]:
        """Decode permission set from Base64 cookie"""
        return self.encoder.decode(cookie_value)

    def check_access(self, cookie_value: str, owner: str, repo: str) -> bool:
        """
        Check if user has access to a repository based on cookie

        Args:
            cookie_value: Base64 encoded permission cookie
            owner: Repository owner
            repo: Repository name

        Returns:
            True if user has access, False otherwise
        """
        permission_set = self.decoder.decode(cookie_value)
        if not permission_set:
            return False

        return permission_set.has_access(owner, repo)


# Create singleton instance
repo_permission_manager = RepoPermissionManager()
