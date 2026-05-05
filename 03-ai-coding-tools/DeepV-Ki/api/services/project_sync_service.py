"""
Project Sync Service
Handles background synchronization of user projects from GitLab to the local database.
"""

import logging
import asyncio
from datetime import datetime
from typing import Optional

from api.gitlab_client import get_user_projects, group_projects_by_role
from api.gitlab_db import get_gitlab_db
from api.audit_logger import audit_logger

logger = logging.getLogger(__name__)

class ProjectSyncService:
    """Service to handle background project synchronization"""

    @staticmethod
    async def sync_user_projects(user_email: str):
        """
        Fetch latest projects from GitLab and update the local database.
        This is designed to be run as a background task.
        """
        task_id = f"sync_{user_email}_{int(datetime.now().timestamp())}"
        logger.info(f"🔄 [Background Sync] Starting project sync for {user_email} (Task: {task_id})")

        try:
            # 1. Fetch from GitLab
            projects = await get_user_projects(user_email)

            if not projects:
                logger.warning(f"⚠️ [Background Sync] No projects found for {user_email}")
                return

            # 2. Process data (Group by role)
            grouped = group_projects_by_role(projects)

            # Prepare data structure for DB
            projects_data = {
                "member": grouped,
                "inherited": {}, # Simplified for background sync, or fetch if needed
                "member_count": len(projects),
                "inherited_count": 0
            }

            # 3. Save to Database
            db = get_gitlab_db()
            # Note: save_user_projects is synchronous (sqlite), so we run it directly
            # If it were heavy, we'd run_in_executor, but sqlite is fast enough for this context
            success = db.save_user_projects(user_email, projects_data)

            if success:
                logger.info(f"✅ [Background Sync] Successfully updated {len(projects)} projects for {user_email}")
            else:
                logger.error(f"❌ [Background Sync] Failed to save projects to DB for {user_email}")

        except Exception as e:
            logger.error(f"❌ [Background Sync] Error syncing projects for {user_email}: {str(e)}", exc_info=True)

# Global instance
project_sync_service = ProjectSyncService()
