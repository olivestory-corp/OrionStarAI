"""
审计日志模块 - 记录用户项目和元数据写入操作
"""

import logging
from typing import Optional, Dict, Any
from datetime import datetime

logger = logging.getLogger(__name__)


class AuditLogger:
    """用于记录敏感操作的审计日志"""

    @staticmethod
    def log_user_projects_write(
        user_email: str,
        projects_count: int,
        member_count: int,
        inherited_count: int,
        operation: str = "sync"
    ) -> None:
        """
        记录用户项目写入到数据库的操作

        Args:
            user_email: 用户邮箱
            projects_count: 项目总数
            member_count: 成员项目数
            inherited_count: 继承项目数
            operation: 操作类型（sync/update/delete 等）
        """
        timestamp = datetime.now().isoformat()
        logger.info(
            f"[AUDIT] 📊 用户项目表操作: {operation.upper()} - "
            f"用户: {user_email} | "
            f"项目总数: {projects_count} | "
            f"成员项目: {member_count} | "
            f"继承项目: {inherited_count} | "
            f"时间: {timestamp}"
        )

    @staticmethod
    def log_user_metadata_write(
        user_email: str,
        total_projects: int,
        member_count: int,
        inherited_count: int,
        synced_at: str
    ) -> None:
        """
        记录用户元数据写入到数据库的操作

        Args:
            user_email: 用户邮箱
            total_projects: 项目总数
            member_count: 成员项目数
            inherited_count: 继承项目数
            synced_at: 同步时间
        """
        timestamp = datetime.now().isoformat()
        logger.info(
            f"[AUDIT] 📝 用户元数据表写入 - "
            f"用户: {user_email} | "
            f"项目总数: {total_projects} | "
            f"成员数: {member_count} | "
            f"继承数: {inherited_count} | "
            f"同步时间: {synced_at} | "
            f"写入时间: {timestamp}"
        )

    @staticmethod
    def log_project_access_check(
        user_email: str,
        owner: str,
        repo: str,
        granted: bool,
        reason: str = ""
    ) -> None:
        """
        记录项目访问权限检查

        Args:
            user_email: 用户邮箱
            owner: 项目所有者
            repo: 项目名称
            granted: 是否授予访问权限
            reason: 原因
        """
        status = "✅ 允许" if granted else "❌ 拒绝"
        timestamp = datetime.now().isoformat()
        reason_str = f" | 原因: {reason}" if reason else ""
        logger.info(
            f"[AUDIT] 🔐 访问权限检查: {status} - "
            f"用户: {user_email} | "
            f"项目: {owner}/{repo}{reason_str} | "
            f"时间: {timestamp}"
        )

    @staticmethod
    def log_wiki_code_access_request(
        user_email: str,
        owner: str,
        repo: str,
        file_path: str,
        granted: bool,
        reason: str = ""
    ) -> None:
        """
        记录用户查看 Wiki 代码的请求

        Args:
            user_email: 用户邮箱
            owner: 项目所有者
            repo: 项目名称
            file_path: 文件路径
            granted: 是否授予访问权限
            reason: 原因
        """
        status = "✅ 允许" if granted else "❌ 拒绝"
        timestamp = datetime.now().isoformat()
        reason_str = f" | 原因: {reason}" if reason else ""
        logger.info(
            f"[AUDIT] 📄 Wiki代码访问 - "
            f"用户: {user_email} | "
            f"项目: {owner}/{repo} | "
            f"文件: {file_path} | "
            f"结果: {status}{reason_str} | "
            f"时间: {timestamp}"
        )

    @staticmethod
    def log_unauthorized_access_attempt(
        user_email: Optional[str],
        endpoint: str,
        reason: str
    ) -> None:
        """
        记录未授权访问尝试

        Args:
            user_email: 用户邮箱（如果可知）
            endpoint: 端点路径
            reason: 拒绝原因
        """
        user_info = user_email if user_email else "匿名用户"
        timestamp = datetime.now().isoformat()
        logger.warning(
            f"[AUDIT] 🚫 未授权访问尝试 - "
            f"用户: {user_info} | "
            f"接口: {endpoint} | "
            f"原因: {reason} | "
            f"时间: {timestamp}"
        )

    @staticmethod
    def log_session_validation(
        user_email: str,
        session_id: str,
        valid: bool
    ) -> None:
        """
        记录 Session 验证

        Args:
            user_email: 用户邮箱
            session_id: Session ID
            valid: Session 是否有效
        """
        status = "✅ 有效" if valid else "❌ 无效/过期"
        timestamp = datetime.now().isoformat()
        logger.info(
            f"[AUDIT] 🔑 Session验证 - "
            f"用户: {user_email} | "
            f"SessionID: {session_id[:16]}... | "
            f"状态: {status} | "
            f"时间: {timestamp}"
        )


# 全局实例
audit_logger = AuditLogger()
