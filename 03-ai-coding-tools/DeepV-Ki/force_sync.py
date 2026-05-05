import asyncio
import logging
from api.services.project_sync_service import project_sync_service

# Configure logging
logging.basicConfig(level=logging.INFO)

async def force_sync():
    print("🚀 Forcing project sync for liangshui@example.com...")
    await project_sync_service.sync_user_projects("liangshui@example.com")
    print("✅ Sync completed.")

if __name__ == "__main__":
    asyncio.run(force_sync())
