"""
Global Sync State Module
Stores the synchronization status for user projects.
"""

from typing import Dict, Any

# Global sync status tracking
# Structure: {user_email: {stage: str, progress: int, message: str, timestamp: float}}
sync_status: Dict[str, Dict[str, Any]] = {}
