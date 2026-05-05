"""
Wiki 认证模块 - 统一管理所有项目的权限验证和缓存
"""

import logging
import time
from hashlib import sha256
from typing import Optional, Dict, Set
from fastapi import HTTPException, Cookie

from api.user_manager import user_manager
from api.gitlab_client import get_user_projects

logger = logging.getLogger(__name__)


class WikiAuthManager:
    """Wiki 认证管理器 - 负责一次性认证所有项目，生成和验证 tokens"""

    @staticmethod
    async def authenticate_user_all_projects(
        deepwiki_session: Optional[str],
        wiki_access_tokens: Optional[str] = None
    ) -> tuple[str, Set[str], Optional[str]]:
        """
        认证用户并获取其所有项目的权限

        策略：
        1. 如果有缓存的 tokens，先用缓存
        2. 如果没有缓存，就一次性拉取所有项目权限
        3. 为所有项目生成 tokens 并返回

        Args:
            deepwiki_session: Session ID from cookie
            wiki_access_tokens: 缓存的访问令牌 (逗号分隔)

        Returns:
            (user_email, accessible_projects, updated_tokens)
            - user_email: 用户邮箱
            - accessible_projects: 用户有权访问的项目集合 {"owner/repo", "owner/repo", ...}
            - updated_tokens: 更新后的 tokens 字符串（如果需要更新则返回，否则返回 None）

        Raises:
            HTTPException: 未登录或 Session 过期
        """
        # 1. 验证 Session
        if not deepwiki_session:
            logger.warning(f"❌ 未提供 Session Cookie")
            raise HTTPException(status_code=401, detail="Login required")

        session = user_manager.get_session(deepwiki_session)
        if not session:
            logger.warning(f"❌ Session 无效或已过期")
            raise HTTPException(status_code=401, detail="Session invalid or expired")

        user_email = session.user_info.uid or session.user_info.username
        logger.info(f"✅ 用户 {user_email} 已认证")

        # 2. 检查缓存是否有效
        if wiki_access_tokens:
            cached_projects = WikiAuthManager._parse_cached_tokens(
                wiki_access_tokens, user_email
            )
            if cached_projects:
                logger.info(
                    f"✅ 使用缓存的权限信息: {len(cached_projects)} 个项目"
                )
                return user_email, cached_projects, None  # 缓存命中，无需更新

        # 3. 缓存未命中，一次性拉取所有项目权限
        logger.info(f"📋 缓存未命中或已过期，从 GitLab 获取用户的所有项目权限...")
        try:
            user_projects = await get_user_projects(user_email)
            accessible_projects = set()

            for proj in user_projects:
                path_with_namespace = proj.get("path_with_namespace", "")
                if path_with_namespace:
                    accessible_projects.add(path_with_namespace)

            logger.info(
                f"✅ 从 GitLab 获取到 {len(accessible_projects)} 个项目"
            )

            # 4. 生成新的 tokens（为所有项目）
            new_tokens = WikiAuthManager._generate_tokens_for_projects(
                list(accessible_projects), user_email
            )

            return user_email, accessible_projects, new_tokens

        except Exception as e:
            logger.error(f"❌ 获取用户权限失败: {str(e)}", exc_info=True)
            raise HTTPException(status_code=500, detail="Error checking permissions")

    @staticmethod
    def verify_project_access(
        project_key: str, accessible_projects: Set[str]
    ) -> bool:
        """
        验证用户是否有权访问该项目

        Args:
            project_key: 项目唯一标识 (格式: gitlab:owner/repo)
            accessible_projects: 用户有权访问的项目集合

        Returns:
            True 如果有权访问，否则 False
        """
        try:
            # 解析 project_key
            repo_type, path = project_key.split(":", 1)
            owner, repo = path.split("/", 1)
            project_path = f"{owner}/{repo}"

            has_access = project_path in accessible_projects
            if has_access:
                logger.info(f"✅ 用户有权访问项目: {project_key}")
            else:
                logger.warning(f"❌ 用户无权访问项目: {project_key}")

            return has_access
        except ValueError:
            logger.warning(f"❌ 无效的 project_key 格式: {project_key}")
            return False

    @staticmethod
    def _parse_cached_tokens(
        wiki_access_tokens: str, user_email: str
    ) -> Optional[Set[str]]:
        """
        解析缓存的 tokens，提取用户有权访问的项目列表

        Token 格式: "owner1_repo1_timestamp_hash,owner2_repo2_timestamp_hash,..."

        Args:
            wiki_access_tokens: 缓存的 tokens 字符串
            user_email: 用户邮箱（用于生成哈希进行验证）

        Returns:
            项目集合 {"owner/repo", "owner/repo", ...} 或 None 如果缓存无效
        """
        if not wiki_access_tokens:
            return None

        try:
            tokens_list = wiki_access_tokens.split(",")
            accessible_projects = set()
            current_time = int(time.time())
            valid_count = 0

            for token in tokens_list:
                token = token.strip()
                if not token:
                    continue

                try:
                    # 格式: owner_repo_timestamp_hash
                    parts = token.split("_")
                    if len(parts) >= 3:
                        owner = parts[0]
                        repo = parts[1]
                        timestamp_str = parts[2]
                        timestamp = int(timestamp_str)

                        # 检查是否在2天内
                        if current_time - timestamp <= 172800:
                            accessible_projects.add(f"{owner}/{repo}")
                            valid_count += 1
                        else:
                            logger.debug(
                                f"⏰ Token 已过期: {owner}/{repo}"
                            )
                except (ValueError, IndexError):
                    logger.debug(f"⚠️ Token 格式错误: {token}")
                    continue

            if valid_count > 0:
                logger.info(
                    f"✅ 缓存有效: {valid_count} 个项目 token 未过期"
                )
                return accessible_projects
            else:
                logger.info(f"⏰ 所有 token 已过期，需要重新认证")
                return None

        except Exception as e:
            logger.debug(f"⚠️ 解析缓存失败: {str(e)}")
            return None

    @staticmethod
    def _generate_tokens_for_projects(
        projects: list, user_email: str
    ) -> str:
        """
        为所有项目生成 tokens

        Args:
            projects: 项目列表 ["owner/repo", "owner/repo", ...]
            user_email: 用户邮箱

        Returns:
            tokens 字符串 (逗号分隔)
        """
        timestamp = int(time.time())
        email_hash = sha256(user_email.encode()).hexdigest()[:16]
        tokens = []

        for project_path in projects:
            try:
                owner, repo = project_path.split("/", 1)
                token = f"{owner}_{repo}_{timestamp}_{email_hash}"
                tokens.append(token)
            except ValueError:
                logger.warning(f"⚠️ 项目路径格式错误: {project_path}")
                continue

        result = ",".join(tokens)
        logger.info(f"✅ 为用户 {user_email} 生成了 {len(tokens)} 个项目的 token")
        return result


# 全局实例
wiki_auth_manager = WikiAuthManager()
