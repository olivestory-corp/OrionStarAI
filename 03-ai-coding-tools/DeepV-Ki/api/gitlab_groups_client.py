"""
GitLab Groups Client for fetching user groups and their projects

This module handles fetching user's groups and projects within those groups.
"""

import logging
from typing import List, Dict, Any, Optional
import aiohttp

logger = logging.getLogger(__name__)


class GitLabGroupsClient:
    """Client for fetching user groups and group projects"""

    def __init__(self, gitlab_url: str, gitlab_token: str):
        self.url = gitlab_url.rstrip('/')
        self.token = gitlab_token

    async def get_user_groups(self, user_id: int) -> List[Dict[str, Any]]:
        """
        Get all groups that a user belongs to

        Args:
            user_id: GitLab user ID

        Returns:
            List of group data
        """
        groups = []
        page = 1
        per_page = 20

        async with aiohttp.ClientSession() as session:
            while True:
                try:
                    url = f"{self.url}/api/v4/users/{user_id}/groups"
                    headers = {
                        'PRIVATE-TOKEN': self.token,
                        'User-Agent': 'DeepV-Ki/1.0'
                    }

                    async with session.get(
                        url,
                        params={'per_page': per_page, 'page': page},
                        headers=headers,
                        timeout=aiohttp.ClientTimeout(total=10),
                        ssl=False
                    ) as response:
                        if response.status != 200:
                            logger.debug(f"Failed to get groups for user {user_id}: {response.status}")
                            break

                        data = await response.json()
                        if not data:
                            break

                        groups.extend(data)

                        if len(data) < per_page:
                            break

                        page += 1

                except Exception as e:
                    logger.warning(f"Error fetching groups for user {user_id}: {str(e)}")
                    break

        logger.info(f"Found {len(groups)} groups for user {user_id}")
        return groups

    async def get_group_projects(self, group_id: int) -> List[Dict[str, Any]]:
        """
        Get all projects in a group

        Args:
            group_id: GitLab group ID

        Returns:
            List of project data
        """
        projects = []
        page = 1
        per_page = 20

        async with aiohttp.ClientSession() as session:
            while True:
                try:
                    url = f"{self.url}/api/v4/groups/{group_id}/projects"
                    headers = {
                        'PRIVATE-TOKEN': self.token,
                        'User-Agent': 'DeepV-Ki/1.0'
                    }

                    async with session.get(
                        url,
                        params={
                            'per_page': per_page,
                            'page': page,
                            'include_subgroups': 'true',
                            'with_shared': 'false'
                        },
                        headers=headers,
                        timeout=aiohttp.ClientTimeout(total=10),
                        ssl=False
                    ) as response:
                        if response.status != 200:
                            logger.debug(f"Failed to get projects for group {group_id}: {response.status}")
                            break

                        data = await response.json()
                        if not data:
                            break

                        projects.extend(data)

                        if len(data) < per_page:
                            break

                        page += 1

                except Exception as e:
                    logger.warning(f"Error fetching projects for group {group_id}: {str(e)}")
                    break

        logger.info(f"Found {len(projects)} projects in group {group_id}")
        return projects
