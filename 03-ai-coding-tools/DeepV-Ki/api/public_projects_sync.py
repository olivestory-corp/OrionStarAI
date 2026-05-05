"""
GitLab 公开项目同步模块

独立的定时任务，定期同步 GitLab 中的所有公开项目
与特定用户无关，供所有用户共享
"""

import logging
import os
import json
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv

# Load environment variables
load_dotenv(Path(__file__).parent.parent / '.env')

logger = logging.getLogger(__name__)

try:
    import gitlab
except ImportError:
    logger.warning("python-gitlab not installed")
    gitlab = None


class PublicProjectsManager:
    """管理 GitLab 公开项目的同步和缓存"""

    def __init__(self):
        self.cache_file = Path.home() / '.adalflow' / 'gitlab_public_projects.json'
        self.cache_file.parent.mkdir(parents=True, exist_ok=True)

        if gitlab is None:
            logger.warning("GitLab client not available")
            self.gl = None
            return

        base_url = os.getenv('GITLAB_URL', '').rstrip('/')
        token = os.getenv('GITLAB_TOKEN', '')

        if not base_url or not token:
            logger.warning("GitLab configuration incomplete")
            self.gl = None
            return

        try:
            self.gl = gitlab.Gitlab(base_url, private_token=token)
            self.gl.auth()
            auth_user = self.gl.user
            logger.info(f"✅ GitLab Client initialized for public projects sync: {auth_user.username}")
        except Exception as e:
            logger.error(f"❌ Failed to initialize GitLab client: {str(e)}")
            self.gl = None

    def fetch_public_projects(self) -> List[Dict[str, Any]]:
        """
        获取 GitLab 中的所有公开项目

        使用条件查询而不是全量获取后过滤，提高效率

        Returns:
            公开项目列表
        """
        if not self.gl:
            logger.error("GitLab client not initialized")
            return []

        projects = []

        try:
            logger.info("📥 开始查询 GitLab 公开项目...")

            # 直接使用条件查询，不要全量获取
            # 这样可以减少 API 调用和网络传输
            public_projects = self.gl.projects.list(
                get_all=True,
                visibility='public',  # 条件查询：只获取公开项目
                simple=False,          # 需要完整数据
                per_page=100           # 每页 100 条，减少 API 调用次数
            )

            logger.info(f"✅ 查询完成，找到 {len(public_projects)} 个公开项目")

            # 转换为字典格式
            for proj_obj in public_projects:
                try:
                    project_data = {
                        'id': proj_obj.id,
                        'name': proj_obj.name,
                        'name_with_namespace': proj_obj.name_with_namespace,
                        'description': proj_obj.description or '',
                        'web_url': proj_obj.web_url,
                        'avatar_url': getattr(proj_obj, 'avatar_url', None),
                        'path': proj_obj.path,
                        'path_with_namespace': proj_obj.path_with_namespace,
                        'visibility': proj_obj.visibility,
                        'access_level': 10,  # GUEST - 公开项目默认访问级别
                        'role': 'GUEST',
                        'member_type': 'public',
                    }
                    projects.append(project_data)
                except Exception as e:
                    logger.debug(f"⚠️ 处理项目 {proj_obj.id} 时出错: {str(e)}")

            logger.info(f"✅ 成功处理 {len(projects)} 个公开项目")
            return projects

        except Exception as e:
            logger.error(f"❌ 查询公开项目失败: {str(e)}", exc_info=True)
            return []

    def group_projects_by_role(self, projects: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
        """按角色分组项目"""
        grouped = {}
        for project in projects:
            role = project.get('role', 'UNKNOWN')
            if role not in grouped:
                grouped[role] = []
            grouped[role].append(project)

        # 按项目名称排序
        for role in grouped:
            grouped[role].sort(key=lambda p: p['name'].lower())

        return grouped

    def save_to_cache(self, projects: List[Dict[str, Any]]) -> bool:
        """
        保存公开项目到本地缓存

        Args:
            projects: 项目列表

        Returns:
            是否保存成功
        """
        try:
            # 分组
            grouped = self.group_projects_by_role(projects)

            # 准备缓存数据
            cache_data = {
                'public': grouped,
                'total': len(projects),
                'public_count': len(projects),
                'synced_at': datetime.now().isoformat(),
            }

            # 保存到文件
            with open(self.cache_file, 'w', encoding='utf-8') as f:
                json.dump(cache_data, f, ensure_ascii=False, indent=2)

            logger.info(f"✅ 公开项目已保存到缓存: {self.cache_file}")
            logger.info(f"   - 总数: {len(projects)} 个")
            logger.info(f"   - 最后同步时间: {cache_data['synced_at']}")
            return True

        except Exception as e:
            logger.error(f"❌ 保存缓存失败: {str(e)}", exc_info=True)
            return False

    def load_from_cache(self) -> Optional[Dict[str, Any]]:
        """
        从本地缓存加载公开项目

        Returns:
            缓存数据或 None
        """
        try:
            if not self.cache_file.exists():
                logger.debug(f"缓存文件不存在: {self.cache_file}")
                return None

            with open(self.cache_file, 'r', encoding='utf-8') as f:
                cache_data = json.load(f)

            logger.debug(f"✅ 从缓存加载了 {cache_data.get('total', 0)} 个公开项目")
            return cache_data

        except Exception as e:
            logger.error(f"❌ 读取缓存失败: {str(e)}")
            return None

    def sync(self) -> bool:
        """
        执行同步：查询 GitLab 并保存到缓存

        Returns:
            是否同步成功
        """
        logger.info("=" * 60)
        logger.info("🔄 开始同步 GitLab 公开项目")
        logger.info("=" * 60)

        # 查询公开项目
        projects = self.fetch_public_projects()
        if not projects:
            logger.warning("⚠️ 未找到任何公开项目或查询失败")
            return False

        # 保存到缓存
        success = self.save_to_cache(projects)

        if success:
            logger.info("=" * 60)
            logger.info("✅ 公开项目同步完成")
            logger.info("=" * 60)
        else:
            logger.error("=" * 60)
            logger.error("❌ 公开项目同步失败")
            logger.error("=" * 60)

        return success


# 全局实例
_public_projects_manager = None


def get_public_projects_manager() -> PublicProjectsManager:
    """获取全局 PublicProjectsManager 实例"""
    global _public_projects_manager
    if _public_projects_manager is None:
        _public_projects_manager = PublicProjectsManager()
    return _public_projects_manager


async def sync_public_projects() -> bool:
    """
    定时任务：同步公开项目

    这个函数应该由后台调度器定期调用（如每小时一次）
    """
    manager = get_public_projects_manager()
    return manager.sync()


def get_cached_public_projects() -> Optional[Dict[str, Any]]:
    """获取缓存的公开项目"""
    manager = get_public_projects_manager()
    return manager.load_from_cache()
