"""
GitLab Client - 高效查询任意用户的项目

使用官方 python-gitlab 库与 GitLab API 交互。
直接使用 /users/{id}/projects API 获取用户项目。
"""

import logging
from typing import List, Dict, Any, Optional
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv(Path(__file__).parent.parent / '.env')

logger = logging.getLogger(__name__)

try:
    import gitlab
except ImportError:
    logger.warning("python-gitlab not installed")
    gitlab = None


class ProjectRole:
    """GitLab 项目权限级别"""
    GUEST = 10
    REPORTER = 20
    DEVELOPER = 30
    MAINTAINER = 40
    OWNER = 50

    NAMES = {
        10: 'GUEST',
        20: 'REPORTER',
        30: 'DEVELOPER',
        40: 'MAINTAINER',
        50: 'OWNER',
    }

    @classmethod
    def get_name(cls, level: int) -> str:
        return cls.NAMES.get(level, 'UNKNOWN')


class GitLabProject:
    """GitLab 项目包装"""

    def __init__(self, project_obj, access_level: int = 0, member_type: str = 'member'):
        self.id = project_obj.id
        self.name = project_obj.name
        self.name_with_namespace = project_obj.name_with_namespace
        self.description = project_obj.description or ''
        self.web_url = project_obj.web_url
        self.avatar_url = getattr(project_obj, 'avatar_url', None)
        self.path = project_obj.path
        self.path_with_namespace = project_obj.path_with_namespace
        self.visibility = project_obj.visibility
        self.access_level = access_level
        self.member_type = member_type

    @property
    def role(self) -> str:
        return ProjectRole.get_name(self.access_level)

    @property
    def role_value(self) -> int:
        return self.access_level

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'name': self.name,
            'name_with_namespace': self.name_with_namespace,
            'description': self.description,
            'web_url': self.web_url,
            'avatar_url': self.avatar_url,
            'path': self.path,
            'path_with_namespace': self.path_with_namespace,
            'visibility': self.visibility,
            'access_level': self.access_level,
            'role': self.role,
            'member_type': self.member_type,
        }


class GitLabClient:
    """GitLab API 客户端"""

    def __init__(self):
        if gitlab is None:
            logger.warning("python-gitlab not available")
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
            logger.info(f"✅ Connected to GitLab as: {auth_user.username}")
        except Exception as e:
            logger.error(f"❌ Failed to connect: {str(e)}")
            self.gl = None

    async def get_user_projects(self, user_email: str = None, status_callback=None, access_token: str = None) -> List[GitLabProject]:
        """
        获取指定用户参与的所有项目（包括直接参与和通过组继承）

        使用 user.memberships API 获取用户的真实参与情况：
        1. 获取用户的所有项目成员关系（Project Membership）
        2. 获取用户的所有组成员关系（Group Membership）
        3. 对于每个组，获取组内的所有项目
        4. 验证用户对项目的访问权限

        Args:
            user_email: 用户邮箱。如果为 None，查询当前认证用户
            status_callback: 状态回调函数 (stage, progress, message)
            access_token: 用户特定的 OAuth Access Token。如果提供，将使用此 Token 而不是系统 Token。

        Returns:
            项目列表，按：直接成员优先 > 权限级别降序 > 名称字母顺序 排序
        """

        # Determine which client instance to use
        client = self.gl
        if access_token:
            try:
                base_url = os.getenv('GITLAB_URL', '').rstrip('/')
                # Create a temporary client with the user's token
                temp_gl = gitlab.Gitlab(base_url, oauth_token=access_token)
                temp_gl.auth()
                client = temp_gl
                logger.info(f"🔐 Using user-specific OAuth token for project fetch")
            except Exception as e:
                logger.warning(f"⚠️ Failed to authenticate with user token: {str(e)}, falling back to system token")
                # Fallback to system client if user token fails
                client = self.gl

        if not client:
            logger.error("GitLab client not initialized")
            return []

        try:
            # 1. 获取用户对象
            if user_email and not access_token:
                # Only search by email if we are using system token (admin mode)
                # If using user token, we are already authenticated as that user
                logger.info(f"🔍 Fetching projects for: {user_email}")
                # We need to use the system client to search for users if the user token doesn't have permission
                # But usually we just want the current user
                target_user = self._find_user_by_email(user_email)
                if not target_user:
                    logger.error(f"❌ User not found: {user_email}")
                    return []
                user_id = target_user.id
            else:
                # If using access_token, client.user is the authenticated user
                target_user = client.user
                user_id = target_user.id
                logger.info(f"🔍 Fetching projects for current user: {target_user.username}")

            logger.info(f"📌 Target: {target_user.username} (ID: {user_id})")

            # Use the client (either system or user-specific) to fetch data
            # Note: We need to be careful. If we use user token, we can only see what the user sees.
            # If we use system token, we might see more but need to filter.

            # Re-fetch user object using the active client to ensure we have the right context
            user_obj = client.users.get(user_id)
            projects = []
            seen_project_ids = set()

            # 2. 获取用户参与的所有项目
            if status_callback:
                status_callback("fetching_direct_projects", 25, "正在获取您直接参与的项目...")
            logger.info("📥 Step 1: 获取用户直接参与的项目...")

            try:
                if access_token:
                    # If using OAuth token, use projects.list(membership=True) which is more reliable
                    # for the current user than user.memberships.list()
                    logger.info("🔐 Using projects.list(membership=True) for OAuth user")
                    # get_all=True handles pagination automatically
                    all_projects = client.projects.list(membership=True, get_all=True)

                    for proj_obj in all_projects:
                        # For OAuth, we might not get detailed access level in the list response
                        # We'll try to get it from permissions field if available, or default to GUEST
                        access_level = ProjectRole.GUEST
                        if hasattr(proj_obj, 'permissions'):
                            permissions = proj_obj.permissions
                            if permissions.get('project_access'):
                                access_level = max(access_level, permissions['project_access'].get('access_level', 0))
                            if permissions.get('group_access'):
                                access_level = max(access_level, permissions['group_access'].get('access_level', 0))

                        # If we can't determine access level, fetch details (slower but accurate)
                        if access_level == ProjectRole.GUEST:
                             try:
                                 # Try to get member info
                                 member = proj_obj.members.get(user_id)
                                 access_level = member.access_level
                             except:
                                 pass

                        gl_proj = GitLabProject(
                            proj_obj,
                            access_level=access_level,
                            member_type='member' # Treat all as member for simplicity in OAuth mode
                        )
                        projects.append(gl_proj)
                        seen_project_ids.add(proj_obj.id)
                        logger.debug(f"✅ Found: {proj_obj.name} (access_level={access_level})")

                    logger.info(f"✅ Found {len(projects)} projects via OAuth")

                    # Sort and return immediately for OAuth mode (skipping group logic which might be redundant or fail)
                    projects.sort(
                        key=lambda p: (
                            -p.role_value,
                            p.name.lower(),
                        )
                    )
                    return projects

                else:
                    # Original logic for System Token (Admin mode)
                    joined_memberships = user_obj.memberships.list(
                        type='Project',
                        get_all=True
                    )
                    logger.info(f"📌 Found {len(joined_memberships)} direct project memberships")

                    project_ids_with_access = {m.source_id: m.access_level for m in joined_memberships}

                    for project_id, access_level in project_ids_with_access.items():
                        try:
                            proj_obj = client.projects.get(project_id)
                            gl_proj = GitLabProject(
                                proj_obj,
                                access_level=access_level,
                                member_type='member'
                            )
                            projects.append(gl_proj)
                            seen_project_ids.add(project_id)
                            logger.debug(f"✅ Direct: {proj_obj.name} (access_level={access_level})")
                        except Exception as e:
                            logger.warning(f"⚠️  Failed to fetch project {project_id}: {str(e)}")

                    logger.info(f"✅ Found {len(projects)} direct member projects")
            except Exception as e:
                logger.warning(f"⚠️  Failed to fetch projects: {str(e)}")

            # 3. 获取用户所在的组 (组成员关系)
            if status_callback:
                status_callback("fetching_groups", 40, "正在获取您所在的组...")
            logger.info("📥 Step 2: 获取用户所在的组...")
            try:
                group_memberships = user_obj.memberships.list(
                    type='Namespace',
                    get_all=True
                )
                logger.info(f"📌 Found {len(group_memberships)} group memberships")

                group_ids = [m.source_id for m in group_memberships]
            except Exception as e:
                logger.warning(f"⚠️  Failed to fetch group memberships: {str(e)}")
                group_ids = []

            # 4. 对于每个组，获取组内的项目
            if status_callback:
                status_callback("fetching_group_projects", 60, "正在获取组内的项目...")
            logger.info("📥 Step 3: 获取组内的项目...")
            try:
                for group_id in group_ids:
                    try:
                        group = client.groups.get(group_id)
                        logger.debug(f"📌 Processing group: {group.name} (ID: {group_id})")

                        # 获取组内的项目（包括子组）
                        group_projects_list = group.projects.list(
                            get_all=True,
                            include_subgroups=True
                        )
                        logger.debug(f"   - Found {len(group_projects_list)} projects in group")

                        for proj_obj in group_projects_list:
                            project_id = proj_obj.id

                            # 避免重复（如果用户是项目的直接成员，已经在 Step 1 中处理）
                            if project_id in seen_project_ids:
                                logger.debug(f"   - Skip {proj_obj.name} (already in member list)")
                                continue

                            try:
                                # 4.1 验证用户对该项目的访问权限
                                full_proj = client.projects.get(project_id)
                                access_level = self._get_user_project_access_level(full_proj, user_id)

                                if access_level >= ProjectRole.GUEST:
                                    gl_proj = GitLabProject(
                                        proj_obj,
                                        access_level=access_level,
                                        member_type='inherited'
                                    )
                                    projects.append(gl_proj)
                                    seen_project_ids.add(project_id)
                                    logger.debug(f"   ✅ Inherited: {proj_obj.name} (access_level={access_level})")
                                else:
                                    logger.debug(f"   ⚠️  No access to project {proj_obj.name}")
                            except Exception as e:
                                logger.warning(f"   ⚠️  Failed to process project {project_id}: {str(e)}")

                    except Exception as e:
                        logger.warning(f"⚠️  Failed to fetch group {group_id}: {str(e)}")

                logger.info(f"✅ Found {len(projects) - len([p for p in projects if p.member_type == 'member'])} inherited projects")
            except Exception as e:
                logger.error(f"❌ Failed to process groups: {str(e)}")

            # 5. 排序
            projects.sort(
                key=lambda p: (
                    0 if p.member_type == 'member' else 1,
                    -p.role_value,
                    p.name.lower(),
                )
            )

            logger.info(f"✅ Total: {len(projects)} projects")
            return projects

        except Exception as e:
            logger.error(f"❌ Error: {str(e)}", exc_info=True)
            return []

    def _find_user_by_email(self, email: str) -> Optional[Any]:
        """通过邮箱查找用户"""
        try:
            users = self.gl.users.list(search=email, get_all=True)
            if users:
                return users[0]
        except Exception as e:
            logger.warning(f"⚠️  Failed to search user: {str(e)}")
        return None

    def _get_user_project_access_level(self, project, user_id: int) -> int:
        """获取用户在项目中的访问级别

        优先使用 members_all (包括通过组继承的成员)，
        如果找不到则检查 members (直接成员)，
        都找不到则返回 GUEST (10) 以表示只有只读访问权限
        """
        try:
            # 首先尝试从 members_all 获取 (包括继承的成员)
            try:
                all_members = project.members_all.list(get_all=True)
                for member in all_members:
                    if member.id == user_id:
                        logger.debug(f"✅ Found in members_all: user {user_id} in project {project.id}, access_level={member.access_level}")
                        return member.access_level
            except (AttributeError, gitlab.exceptions.GitlabGetError):
                logger.debug(f"⚠️  members_all not available, trying members...")

            # 如果 members_all 不可用或找不到，尝试 members (直接成员)
            try:
                member = project.members.get(user_id)
                logger.debug(f"✅ Found in members: user {user_id} in project {project.id}, access_level={member.access_level}")
                return member.access_level
            except gitlab.exceptions.GitlabGetError:
                logger.debug(f"⚠️  User {user_id} not found in project {project.id} members")

            # 都找不到，返回 GUEST 权限 (只读)
            return ProjectRole.GUEST
        except Exception as e:
            logger.warning(f"⚠️  Error getting access_level: {str(e)}")
            return ProjectRole.GUEST



# 全局实例
gitlab_client = GitLabClient()


async def get_user_projects(user_email: str = None, status_callback=None, access_token: str = None) -> List[Dict[str, Any]]:
    """公开函数：获取用户项目（字典格式）"""
    projects = await gitlab_client.get_user_projects(user_email, status_callback, access_token)
    return [p.to_dict() for p in projects]


def group_projects_by_role(projects: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    """按角色分组项目"""
    grouped = {}
    for project in projects:
        role = project.get('role', 'UNKNOWN')
        if role not in grouped:
            grouped[role] = []
        grouped[role].append(project)
    return grouped
