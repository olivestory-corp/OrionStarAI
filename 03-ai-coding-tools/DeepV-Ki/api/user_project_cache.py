"""
用户项目权限缓存管理模块
用于缓存每个用户的 GitLab 项目权限信息，提高查询速度

缓存策略：
1. 第一次查询时从 GitLab API 获取，然后缓存到数据库
2. 后续查询直接从缓存返回（查询速度 < 100ms）
3. 后台定期更新缓存（每隔 30 分钟自动同步一次）
4. 用户也可以主动刷新缓存
5. 缓存过期时间：30 分钟，或手动刷新
"""

import logging
import json
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path
import sqlite3
import time
import threading

logger = logging.getLogger(__name__)

# 缓存配置
CACHE_TTL_MINUTES = 30  # 缓存有效期：30 分钟
MAX_CACHE_AGE = timedelta(minutes=CACHE_TTL_MINUTES)
AUTO_REFRESH_INTERVAL = 1800  # 自动刷新间隔：30 分钟


class UserProjectCacheManager:
    """用户项目权限缓存管理器"""

    def __init__(self, db_path: Path):
        """
        初始化缓存管理器

        Args:
            db_path: SQLite 数据库路径
        """
        self.db_path = db_path
        self._ensure_cache_table_exists()
        self._last_update_times = {}  # 记录每个用户的最后更新时间

    def _ensure_cache_table_exists(self):
        """确保缓存表存在"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()

            # 创建用户项目缓存表
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS user_project_cache (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_email TEXT NOT NULL,
                    project_id INTEGER NOT NULL,
                    project_name TEXT NOT NULL,
                    project_path TEXT,
                    description TEXT,
                    web_url TEXT,
                    avatar_url TEXT,
                    visibility TEXT,
                    access_level INTEGER,
                    role TEXT,
                    member_type TEXT,
                    project_data TEXT,
                    cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(user_email, project_id)
                )
            ''')

            # 创建用户缓存元数据表（记录缓存状态）
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS user_cache_metadata (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_email TEXT UNIQUE NOT NULL,
                    total_projects INTEGER,
                    member_count INTEGER,
                    inherited_count INTEGER,
                    cache_size_kb INTEGER,
                    synced_at TIMESTAMP NOT NULL,
                    expires_at TIMESTAMP NOT NULL,
                    status TEXT DEFAULT 'valid',
                    error_message TEXT
                )
            ''')

            # 创建索引以提高查询性能
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_user_project_cache_email
                ON user_project_cache(user_email)
            ''')

            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_user_project_cache_email_project
                ON user_project_cache(user_email, project_id)
            ''')

            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_user_cache_metadata_email
                ON user_cache_metadata(user_email)
            ''')

            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_user_cache_metadata_expires
                ON user_cache_metadata(expires_at)
            ''')

            conn.commit()
            logger.info("✅ 用户项目缓存表已初始化")

    def save_user_projects_to_cache(
        self,
        user_email: str,
        projects: List[Dict[str, Any]]
    ) -> bool:
        """
        保存用户项目到缓存

        Args:
            user_email: 用户邮箱
            projects: 项目列表 (每个项目必须包含 to_dict() 或字典格式)

        Returns:
            是否保存成功
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()

                # 1. 清除旧缓存
                cursor.execute(
                    'DELETE FROM user_project_cache WHERE user_email = ?',
                    (user_email,)
                )

                # 2. 插入新缓存
                inserted_count = 0
                for project in projects:
                    try:
                        # 处理项目数据格式（支持 GitLabProject 对象或字典）
                        if hasattr(project, 'to_dict'):
                            proj_dict = project.to_dict()
                        else:
                            proj_dict = project

                        cursor.execute('''
                            INSERT INTO user_project_cache (
                                user_email, project_id, project_name, project_path,
                                description, web_url, avatar_url, visibility,
                                access_level, role, member_type, project_data
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ''', (
                            user_email,
                            proj_dict['id'],
                            proj_dict['name'],
                            proj_dict.get('path'),
                            proj_dict.get('description', ''),
                            proj_dict.get('web_url', ''),
                            proj_dict.get('avatar_url'),
                            proj_dict.get('visibility', 'private'),
                            proj_dict.get('access_level', 0),
                            proj_dict.get('role', 'UNKNOWN'),
                            proj_dict.get('member_type', 'member'),
                            json.dumps(proj_dict)
                        ))
                        inserted_count += 1
                    except Exception as e:
                        logger.warning(f"⚠️ 缓存项目失败: {str(e)}")

                # 3. 更新或插入元数据
                now = datetime.now()
                expires_at = now + MAX_CACHE_AGE

                cursor.execute('''
                    INSERT OR REPLACE INTO user_cache_metadata (
                        user_email, total_projects, cache_size_kb,
                        synced_at, expires_at, status
                    ) VALUES (?, ?, ?, ?, ?, ?)
                ''', (
                    user_email,
                    inserted_count,
                    self._get_cache_size_kb(user_email, cursor),
                    now.isoformat(),
                    expires_at.isoformat(),
                    'valid'
                ))

                conn.commit()

                logger.info(f"✅ 已缓存用户 {user_email} 的 {inserted_count} 个项目")
                self._last_update_times[user_email] = now
                return True

        except Exception as e:
            logger.error(f"❌ 缓存用户项目失败 ({user_email}): {str(e)}", exc_info=True)
            return False

    def get_cached_projects(self, user_email: str) -> Optional[Tuple[List[Dict[str, Any]], Dict[str, Any]]]:
        """
        从缓存获取用户项目

        Args:
            user_email: 用户邮箱

        Returns:
            (项目列表, 元数据) 或 None（缓存不存在或过期）
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()

                # 1. 检查缓存是否存在且未过期
                cursor.execute('''
                    SELECT synced_at, expires_at, status, total_projects
                    FROM user_cache_metadata
                    WHERE user_email = ?
                ''', (user_email,))

                metadata_row = cursor.fetchone()
                if not metadata_row:
                    logger.debug(f"⏳ 用户 {user_email} 没有缓存")
                    return None

                # 2. 检查缓存是否过期
                expires_at = datetime.fromisoformat(metadata_row['expires_at'])
                if datetime.now() > expires_at:
                    logger.info(f"⏳ 用户 {user_email} 的缓存已过期 (过期时间: {expires_at})")
                    return None

                if metadata_row['status'] != 'valid':
                    logger.warning(f"⚠️ 用户 {user_email} 的缓存状态无效: {metadata_row['status']}")
                    return None

                # 3. 获取缓存的项目
                cursor.execute('''
                    SELECT project_data FROM user_project_cache
                    WHERE user_email = ?
                    ORDER BY project_name ASC
                ''', (user_email,))

                rows = cursor.fetchall()
                projects = [json.loads(row['project_data']) for row in rows]

                # 4. 构建元数据
                metadata = {
                    'user_email': user_email,
                    'total_projects': metadata_row['total_projects'],
                    'synced_at': metadata_row['synced_at'],
                    'expires_at': metadata_row['expires_at'],
                    'cache_age_minutes': self._get_cache_age_minutes(metadata_row['synced_at'])
                }

                logger.debug(f"✅ 从缓存读取用户 {user_email} 的 {len(projects)} 个项目 (缓存年龄: {metadata['cache_age_minutes']} 分钟)")
                return projects, metadata

        except Exception as e:
            logger.error(f"❌ 读取缓存失败 ({user_email}): {str(e)}", exc_info=True)
            return None

    def invalidate_cache(self, user_email: str) -> bool:
        """
        使用户缓存失效，强制下次查询时重新从 GitLab 获取

        Args:
            user_email: 用户邮箱

        Returns:
            是否操作成功
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()

                cursor.execute(
                    'DELETE FROM user_project_cache WHERE user_email = ?',
                    (user_email,)
                )

                cursor.execute(
                    'DELETE FROM user_cache_metadata WHERE user_email = ?',
                    (user_email,)
                )

                conn.commit()

                logger.info(f"🔄 已清除用户 {user_email} 的缓存")
                if user_email in self._last_update_times:
                    del self._last_update_times[user_email]
                return True

        except Exception as e:
            logger.error(f"❌ 清除缓存失败 ({user_email}): {str(e)}", exc_info=True)
            return False

    def is_cache_valid(self, user_email: str) -> bool:
        """
        检查用户缓存是否有效（存在且未过期）

        Args:
            user_email: 用户邮箱

        Returns:
            缓存是否有效
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()

                cursor.execute('''
                    SELECT expires_at, status
                    FROM user_cache_metadata
                    WHERE user_email = ?
                ''', (user_email,))

                row = cursor.fetchone()
                if not row:
                    return False

                expires_at = datetime.fromisoformat(row[0])
                status = row[1]

                is_valid = (datetime.now() <= expires_at) and (status == 'valid')
                return is_valid

        except Exception as e:
            logger.warning(f"⚠️ 检查缓存失败 ({user_email}): {str(e)}")
            return False

    def get_cache_stats(self) -> Dict[str, Any]:
        """
        获取缓存统计信息

        Returns:
            缓存统计数据
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()

                # 统计缓存用户数
                cursor.execute('SELECT COUNT(DISTINCT user_email) FROM user_project_cache')
                total_cached_users = cursor.fetchone()[0] or 0

                # 统计缓存项目数
                cursor.execute('SELECT COUNT(*) FROM user_project_cache')
                total_cached_projects = cursor.fetchone()[0] or 0

                # 统计有效缓存
                cursor.execute('''
                    SELECT COUNT(*) FROM user_cache_metadata
                    WHERE status = 'valid' AND expires_at > datetime('now')
                ''')
                valid_caches = cursor.fetchone()[0] or 0

                # 统计已过期缓存
                cursor.execute('''
                    SELECT COUNT(*) FROM user_cache_metadata
                    WHERE expires_at <= datetime('now')
                ''')
                expired_caches = cursor.fetchone()[0] or 0

                # 统计缓存大小
                cursor.execute('SELECT SUM(cache_size_kb) FROM user_cache_metadata')
                total_cache_size_kb = cursor.fetchone()[0] or 0

                return {
                    'total_cached_users': total_cached_users,
                    'total_cached_projects': total_cached_projects,
                    'valid_caches': valid_caches,
                    'expired_caches': expired_caches,
                    'total_cache_size_mb': round(total_cache_size_kb / 1024, 2),
                    'cache_ttl_minutes': CACHE_TTL_MINUTES,
                }

        except Exception as e:
            logger.warning(f"⚠️ 获取缓存统计失败: {str(e)}")
            return {}

    def cleanup_expired_cache(self) -> Tuple[int, int]:
        """
        清理已过期的缓存

        Returns:
            (删除的用户缓存数, 删除的项目数)
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()

                # 找到已过期的用户
                cursor.execute('''
                    SELECT user_email FROM user_cache_metadata
                    WHERE expires_at <= datetime('now')
                ''')

                expired_users = [row[0] for row in cursor.fetchall()]

                # 删除过期的项目缓存
                for user_email in expired_users:
                    cursor.execute(
                        'DELETE FROM user_project_cache WHERE user_email = ?',
                        (user_email,)
                    )

                # 删除过期的元数据
                deleted_count = len(expired_users)
                cursor.execute(
                    'DELETE FROM user_cache_metadata WHERE expires_at <= datetime(\'now\')'
                )

                conn.commit()

                logger.info(f"🧹 已清理 {deleted_count} 个已过期的用户缓存")
                return deleted_count, len(expired_users) if expired_users else 0

        except Exception as e:
            logger.error(f"❌ 清理过期缓存失败: {str(e)}", exc_info=True)
            return 0, 0

    def _get_cache_size_kb(self, user_email: str, cursor: sqlite3.Cursor = None) -> int:
        """计算用户缓存大小（KB）"""
        try:
            if cursor is None:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.cursor()
                    cursor.execute('''
                        SELECT SUM(LENGTH(project_data)) FROM user_project_cache
                        WHERE user_email = ?
                    ''', (user_email,))
            else:
                cursor.execute('''
                    SELECT SUM(LENGTH(project_data)) FROM user_project_cache
                    WHERE user_email = ?
                ''', (user_email,))

            size_bytes = cursor.fetchone()[0] or 0
            return max(1, int(size_bytes / 1024))  # 最小 1KB

        except Exception as e:
            logger.warning(f"⚠️ 计算缓存大小失败: {str(e)}")
            return 0

    def _get_cache_age_minutes(self, synced_at_str: str) -> int:
        """计算缓存年龄（分钟）"""
        try:
            synced_at = datetime.fromisoformat(synced_at_str)
            age = (datetime.now() - synced_at).total_seconds() / 60
            return int(age)
        except Exception:
            return 0


# 全局缓存管理器实例
_user_project_cache_manager: Optional[UserProjectCacheManager] = None


def get_user_project_cache_manager(db_path: Path) -> UserProjectCacheManager:
    """获取用户项目缓存管理器单例"""
    global _user_project_cache_manager
    if _user_project_cache_manager is None:
        _user_project_cache_manager = UserProjectCacheManager(db_path)
    return _user_project_cache_manager
