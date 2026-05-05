"""
GitLab 项目和 Wiki 数据库管理模块
使用 SQLite 存储 GitLab 项目信息和生成的 Wiki 内容
"""

import json
import logging
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any, Optional
import sqlite3
import hashlib
from api.audit_logger import audit_logger

logger = logging.getLogger(__name__)

# 数据库路径
DB_DIR = Path.home() / '.adalflow'
DB_PATH = DB_DIR / 'gitlab_projects.db'


class GitLabProjectDB:
    """GitLab 项目和 Wiki 数据库管理"""

    def __init__(self):
        """初始化数据库"""
        self.db_path = DB_PATH
        self._ensure_db_exists()

    def _ensure_db_exists(self):
        """确保数据库和表存在"""
        self.db_path.parent.mkdir(parents=True, exist_ok=True)

        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()

            # 创建用户项目表
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS user_projects (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_email TEXT NOT NULL,
                    project_id INTEGER NOT NULL,
                    project_name TEXT NOT NULL,
                    project_path TEXT,
                    description TEXT,
                    web_url TEXT,
                    visibility TEXT,
                    access_level INTEGER,
                    role TEXT,
                    member_type TEXT,
                    project_data TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(user_email, project_id)
                )
            ''')

            # 创建用户元数据表
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS user_metadata (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_email TEXT UNIQUE NOT NULL,
                    total_projects INTEGER,
                    member_count INTEGER,
                    inherited_count INTEGER,
                    grouped_data TEXT,
                    synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')

            # 创建 Wiki 存储表 - 每个项目有唯一的解析结果
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS wikis (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    repo_id TEXT UNIQUE NOT NULL,
                    repo_url TEXT NOT NULL,
                    repo_type TEXT NOT NULL,
                    owner TEXT NOT NULL,
                    repo_name TEXT NOT NULL,
                    language TEXT NOT NULL,
                    provider TEXT NOT NULL,
                    model TEXT NOT NULL,
                    wiki_structure TEXT NOT NULL,
                    generated_pages TEXT NOT NULL,
                    total_pages INTEGER DEFAULT 0,
                    total_sections INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    CHECK(repo_type IN ('github', 'gitlab', 'bitbucket', 'local', 'gerrit'))
                )
            ''')

            # 创建 Wiki 索引以提高查询性能
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_wikis_repo_id
                ON wikis(repo_id)
            ''')

            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_wikis_owner_repo
                ON wikis(owner, repo_name)
            ''')

            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_wikis_language
                ON wikis(language)
            ''')

            # 创建 Wiki 生成任务队列表
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS wiki_generation_tasks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    task_id TEXT UNIQUE NOT NULL,
                    repo_url TEXT NOT NULL,
                    repo_type TEXT NOT NULL,
                    owner TEXT NOT NULL,
                    repo_name TEXT NOT NULL,
                    provider TEXT NOT NULL,
                    model TEXT NOT NULL,
                    language TEXT NOT NULL,
                    is_comprehensive BOOLEAN DEFAULT 1,
                    excluded_dirs TEXT,
                    excluded_files TEXT,
                    included_dirs TEXT,
                    included_files TEXT,
                    access_token TEXT,
                    force_refresh BOOLEAN DEFAULT 0,
                    status TEXT DEFAULT 'queued',
                    progress INTEGER DEFAULT 0,
                    message TEXT,
                    result TEXT,
                    error_message TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    started_at TIMESTAMP,
                    completed_at TIMESTAMP,
                    CHECK(status IN ('queued', 'processing', 'completed', 'failed'))
                )
            ''')

            # 创建任务队列索引
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_tasks_task_id
                ON wiki_generation_tasks(task_id)
            ''')

            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_tasks_status
                ON wiki_generation_tasks(status)
            ''')

            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_tasks_created_at
                ON wiki_generation_tasks(created_at)
            ''')

            # ==================== 新增：Wiki 项目表（项目维度管理） ====================
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS wiki_projects (
                    -- 主键：项目唯一标识
                    project_key TEXT PRIMARY KEY,

                    -- 项目基本信息
                    repo_url TEXT NOT NULL,
                    repo_type TEXT NOT NULL,
                    owner TEXT NOT NULL,
                    repo_name TEXT NOT NULL,

                    -- 项目状态（核心）
                    status TEXT NOT NULL DEFAULT 'not_generated',

                    -- 生成相关
                    current_task_id TEXT,
                    last_generated_at TIMESTAMP,
                    last_failed_at TIMESTAMP,
                    last_success_date TEXT,  -- 最后成功生成的日期（YYYY-MM-DD）
                    generation_count INTEGER DEFAULT 0,

                    -- Wiki 结果（JSON）
                    wiki_structure TEXT,
                    documents_count INTEGER,
                    pages_count INTEGER,

                    -- 配置信息
                    provider TEXT DEFAULT 'google',
                    model TEXT DEFAULT 'gemini-2.0-flash-exp',
                    language TEXT DEFAULT 'english',

                    -- 时间戳
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

                    -- 约束
                    UNIQUE(repo_type, owner, repo_name),
                    CHECK(status IN ('not_generated', 'generating', 'generated', 'failed')),
                    CHECK(repo_type IN ('github', 'gitlab', 'bitbucket', 'gerrit'))
                )
            ''')

            # 创建项目索引
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_wiki_projects_status
                ON wiki_projects(status)
            ''')

            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_wiki_projects_updated
                ON wiki_projects(updated_at)
            ''')

            # 为 wiki_projects 表添加 progress 和 message 列（如果不存在）
            cursor.execute("PRAGMA table_info(wiki_projects)")
            wiki_columns = [column[1] for column in cursor.fetchall()]

            if 'progress' not in wiki_columns:
                cursor.execute('''
                    ALTER TABLE wiki_projects
                    ADD COLUMN progress INTEGER DEFAULT 0
                ''')
                logger.info("Added 'progress' column to wiki_projects table")

            if 'message' not in wiki_columns:
                cursor.execute('''
                    ALTER TABLE wiki_projects
                    ADD COLUMN message TEXT
                ''')
                logger.info("Added 'message' column to wiki_projects table")

            # 为任务表添加项目关联字段（如果不存在）
            # SQLite 不支持 ALTER TABLE ADD COLUMN IF NOT EXISTS，需要检查
            cursor.execute("PRAGMA table_info(wiki_generation_tasks)")
            columns = [column[1] for column in cursor.fetchall()]

            if 'project_key' not in columns:
                cursor.execute('''
                    ALTER TABLE wiki_generation_tasks
                    ADD COLUMN project_key TEXT
                ''')

                cursor.execute('''
                    CREATE INDEX IF NOT EXISTS idx_tasks_project
                    ON wiki_generation_tasks(project_key)
                ''')

            # 添加 force_refresh 列（如果不存在）
            if 'force_refresh' not in columns:
                cursor.execute('''
                    ALTER TABLE wiki_generation_tasks
                    ADD COLUMN force_refresh BOOLEAN DEFAULT 0
                ''')

            # 创建渲染页面表（用于存储已渲染的 HTML）
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS wiki_pages_rendered (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    project_key TEXT NOT NULL,
                    page_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    html_content TEXT NOT NULL,
                    importance TEXT DEFAULT 'medium',
                    rendered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(project_key, page_id),
                    FOREIGN KEY(project_key) REFERENCES wiki_projects(project_key) ON DELETE CASCADE
                )
            ''')

            # 创建渲染页面索引
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_rendered_pages_project
                ON wiki_pages_rendered(project_key)
            ''')

            # 创建成本追踪表
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS cost_tracking (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    task_id TEXT NOT NULL,
                    embedding_tokens INTEGER DEFAULT 0,
                    embedding_cost REAL DEFAULT 0.0,
                    llm_tokens INTEGER DEFAULT 0,
                    llm_cost REAL DEFAULT 0.0,
                    total_cost REAL DEFAULT 0.0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(task_id)
                )
            ''')

            # 创建成本追踪索引
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_cost_task_id
                ON cost_tracking(task_id)
            ''')

            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_cost_created_at
                ON cost_tracking(created_at)
            ''')

            conn.commit()
            logger.info(f'✅ 数据库已初始化: {self.db_path}')

    def save_user_projects(self, user_email: str, projects_data: Dict[str, Any]) -> bool:
        """
        保存用户的 GitLab 项目到数据库

        Args:
            user_email: 用户邮箱
            projects_data: 包含 member 和 inherited 的项目数据

        Returns:
            是否保存成功
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()

                # 提取数据
                member_projects = projects_data.get('member', {})
                inherited_projects = projects_data.get('inherited', {})
                member_count = projects_data.get('member_count', 0)
                inherited_count = projects_data.get('inherited_count', 0)

                # 清除旧数据
                cursor.execute('DELETE FROM user_projects WHERE user_email = ?', (user_email,))

                # 插入新项目
                all_projects = []

                # 成员项目
                for role, projects in member_projects.items():
                    for project in projects:
                        self._insert_project(cursor, user_email, project, 'member')
                        all_projects.append(project)

                # 继承项目
                for role, projects in inherited_projects.items():
                    for project in projects:
                        self._insert_project(cursor, user_email, project, 'inherited')
                        all_projects.append(project)

                # 保存用户元数据
                synced_at = datetime.now().isoformat()
                cursor.execute('''
                    INSERT OR REPLACE INTO user_metadata
                    (user_email, total_projects, member_count, inherited_count, grouped_data, synced_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (
                    user_email,
                    len(all_projects),
                    member_count,
                    inherited_count,
                    json.dumps(projects_data),
                    synced_at
                ))

                conn.commit()

                # 记录审计日志
                audit_logger.log_user_projects_write(
                    user_email=user_email,
                    projects_count=len(all_projects),
                    member_count=member_count,
                    inherited_count=inherited_count,
                    operation="sync"
                )

                audit_logger.log_user_metadata_write(
                    user_email=user_email,
                    total_projects=len(all_projects),
                    member_count=member_count,
                    inherited_count=inherited_count,
                    synced_at=synced_at
                )

                logger.info(f'✅ 保存了 {len(all_projects)} 个项目到数据库 (用户: {user_email})')
                return True

        except Exception as e:
            logger.error(f'❌ 保存项目失败: {str(e)}', exc_info=True)
            return False

    def _insert_project(self, cursor: sqlite3.Cursor, user_email: str, project: Dict[str, Any], member_type: str):
        """插入单个项目"""
        cursor.execute('''
            INSERT OR REPLACE INTO user_projects
            (user_email, project_id, project_name, project_path, description,
             web_url, visibility, access_level, role, member_type, project_data, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ''', (
            user_email,
            project.get('id'),
            project.get('name'),
            project.get('path'),
            project.get('description'),
            project.get('web_url'),
            project.get('visibility'),
            project.get('access_level'),
            project.get('role'),
            member_type,
            json.dumps(project)
        ))

    def get_user_projects(self, user_email: str) -> Optional[Dict[str, Any]]:
        """
        从数据库获取用户的项目

        Args:
            user_email: 用户邮箱

        Returns:
            项目数据或 None
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()

                # 获取元数据
                cursor.execute('''
                    SELECT * FROM user_metadata WHERE user_email = ?
                ''', (user_email,))

                metadata_row = cursor.fetchone()
                if not metadata_row:
                    return None

                # 获取项目
                cursor.execute('''
                    SELECT * FROM user_projects WHERE user_email = ? ORDER BY member_type, role, project_name
                ''', (user_email,))

                projects = cursor.fetchall()

                # 重建分组结构
                grouped_data = json.loads(metadata_row['grouped_data'])

                return {
                    'member': grouped_data.get('member', {}),
                    'inherited': grouped_data.get('inherited', {}),
                    'projects': [dict(row) for row in projects],  # Add flat list of projects
                    'total': metadata_row['total_projects'],
                    'member_count': metadata_row['member_count'],
                    'inherited_count': metadata_row['inherited_count'],
                    'user_email': user_email,
                    'synced_at': metadata_row['synced_at']
                }

        except Exception as e:
            logger.error(f'❌ 获取项目失败: {str(e)}', exc_info=True)
            return None

    def get_all_users(self) -> List[str]:
        """获取所有已同步的用户邮箱"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('SELECT DISTINCT user_email FROM user_metadata ORDER BY synced_at DESC')
                return [row[0] for row in cursor.fetchall()]
        except Exception as e:
            logger.error(f'❌ 获取用户列表失败: {str(e)}')
            return []

    def clear_user_projects(self, user_email: str) -> bool:
        """清除用户的项目数据"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('DELETE FROM user_projects WHERE user_email = ?', (user_email,))
                cursor.execute('DELETE FROM user_metadata WHERE user_email = ?', (user_email,))
                conn.commit()
                logger.info(f'✅ 清除了用户 {user_email} 的项目数据')
                return True
        except Exception as e:
            logger.error(f'❌ 清除失败: {str(e)}')
            return False

    # ============ Wiki 相关方法 ============

    @staticmethod
    def _generate_repo_id(repo_type: str, owner: str, repo_name: str) -> str:
        """
        生成唯一的仓库 ID

        Args:
            repo_type: 仓库类型 (github, gitlab, bitbucket, local, gerrit)
            owner: 仓库所有者
            repo_name: 仓库名称

        Returns:
            唯一的 repo_id 字符串 (16位 hex)
        """
        key = f"{repo_type}:{owner}:{repo_name}"
        repo_id = hashlib.md5(key.encode()).hexdigest()[:16]
        return f"{repo_type}_{repo_id}"

    def save_wiki(
        self,
        repo_url: str,
        repo_type: str,
        owner: str,
        repo_name: str,
        language: str,
        provider: str,
        model: str,
        wiki_structure: Dict[str, Any],
        generated_pages: Dict[str, Any]
    ) -> bool:
        """
        保存或更新 Wiki 数据
        每个项目 (repo_id) 具有唯一的解析结果，同一项目的不同语言版本会被覆盖

        Args:
            repo_url: 仓库 URL
            repo_type: 仓库类型 (github, gitlab, bitbucket, local, gerrit)
            owner: 仓库所有者
            repo_name: 仓库名称
            language: 语言代码 (en, zh, etc.)
            provider: 使用的 AI provider (google, openai, etc.)
            model: 使用的模型名称
            wiki_structure: Wiki 结构字典
            generated_pages: 生成的页面字典

        Returns:
            保存成功返回 True，失败返回 False
        """
        try:
            repo_id = self._generate_repo_id(repo_type, owner, repo_name)

            wiki_structure_json = json.dumps(wiki_structure, ensure_ascii=False, indent=2)
            generated_pages_json = json.dumps(generated_pages, ensure_ascii=False, indent=2)

            total_pages = len(wiki_structure.get('pages', []))
            total_sections = len(wiki_structure.get('sections', []))

            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()

                cursor.execute('''
                    INSERT OR REPLACE INTO wikis
                    (repo_id, repo_url, repo_type, owner, repo_name, language,
                     provider, model, wiki_structure, generated_pages,
                     total_pages, total_sections, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ''', (
                    repo_id, repo_url, repo_type, owner, repo_name, language,
                    provider, model, wiki_structure_json, generated_pages_json,
                    total_pages, total_sections
                ))

                conn.commit()
                logger.info(
                    f'✅ Wiki 已保存: {owner}/{repo_name} (语言: {language}) '
                    f'- {total_pages} 个页面, {total_sections} 个章节 '
                    f'(repo_id: {repo_id})'
                )
                return True

        except Exception as e:
            logger.error(f'❌ 保存 Wiki 失败: {str(e)}', exc_info=True)
            return False

    def get_wiki(
        self,
        repo_type: str,
        owner: str,
        repo_name: str,
        language: str
    ) -> Optional[Dict[str, Any]]:
        """
        获取特定仓库和语言的 Wiki 数据

        Args:
            repo_type: 仓库类型
            owner: 仓库所有者
            repo_name: 仓库名称
            language: 语言代码

        Returns:
            Wiki 数据字典，不存在返回 None
        """
        try:
            repo_id = self._generate_repo_id(repo_type, owner, repo_name)

            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()

                cursor.execute('''
                    SELECT
                        repo_url, repo_type, owner, repo_name, language,
                        provider, model, wiki_structure, generated_pages,
                        created_at, updated_at
                    FROM wikis
                    WHERE repo_id = ? AND language = ?
                ''', (repo_id, language))

                row = cursor.fetchone()

                if row:
                    return {
                        'repo_url': row['repo_url'],
                        'repo_type': row['repo_type'],
                        'owner': row['owner'],
                        'repo_name': row['repo_name'],
                        'language': row['language'],
                        'provider': row['provider'],
                        'model': row['model'],
                        'wiki_structure': json.loads(row['wiki_structure']),
                        'generated_pages': json.loads(row['generated_pages']),
                        'created_at': row['created_at'],
                        'updated_at': row['updated_at']
                    }

                logger.debug(f'⚠️ Wiki 不存在: {owner}/{repo_name} (语言: {language})')
                return None

        except Exception as e:
            logger.error(f'❌ 获取 Wiki 失败: {str(e)}', exc_info=True)
            return None

    def get_wiki_languages(
        self,
        repo_type: str,
        owner: str,
        repo_name: str
    ) -> List[str]:
        """
        获取某个仓库所有可用的 Wiki 语言版本

        Args:
            repo_type: 仓库类型
            owner: 仓库所有者
            repo_name: 仓库名称

        Returns:
            语言代码列表
        """
        try:
            repo_id = self._generate_repo_id(repo_type, owner, repo_name)

            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()

                cursor.execute('''
                    SELECT DISTINCT language
                    FROM wikis
                    WHERE repo_id = ?
                    ORDER BY language
                ''', (repo_id,))

                return [row[0] for row in cursor.fetchall()]

        except Exception as e:
            logger.error(f'❌ 获取语言列表失败: {str(e)}', exc_info=True)
            return []

    def get_wiki_stats(self) -> Dict[str, Any]:
        """
        获取 Wiki 存储统计信息

        Returns:
            统计字典
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()

                # 总仓库数
                cursor.execute('SELECT COUNT(DISTINCT repo_id) as count FROM wikis')
                total_repos = cursor.fetchone()[0]

                # 总 Wiki 条目数
                cursor.execute('SELECT COUNT(*) as count FROM wikis')
                total_wikis = cursor.fetchone()[0]

                # 总页面数
                cursor.execute('SELECT SUM(total_pages) as total FROM wikis')
                total_pages = cursor.fetchone()[0] or 0

                # 总章节数
                cursor.execute('SELECT SUM(total_sections) as total FROM wikis')
                total_sections = cursor.fetchone()[0] or 0

                # 按 provider 分布
                cursor.execute('''
                    SELECT provider, COUNT(*) as count
                    FROM wikis
                    GROUP BY provider
                    ORDER BY count DESC
                ''')
                providers = {row[0]: row[1] for row in cursor.fetchall()}

                # 按语言分布
                cursor.execute('''
                    SELECT language, COUNT(*) as count
                    FROM wikis
                    GROUP BY language
                    ORDER BY count DESC
                ''')
                languages = {row[0]: row[1] for row in cursor.fetchall()}

                return {
                    'total_repositories': total_repos,
                    'total_wikis': total_wikis,
                    'total_pages': total_pages,
                    'total_sections': total_sections,
                    'providers': providers,
                    'languages': languages
                }

        except Exception as e:
            logger.error(f'❌ 获取统计信息失败: {str(e)}', exc_info=True)
            return {}

    def list_wikis(self, limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
        """
        列出所有 Wiki (支持分页)

        Args:
            limit: 最多返回数量
            offset: 分页偏移量

        Returns:
            Wiki 元数据列表
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()

                cursor.execute('''
                    SELECT
                        repo_id, repo_url, repo_type, owner, repo_name, language,
                        provider, model, total_pages, total_sections,
                        created_at, updated_at
                    FROM wikis
                    ORDER BY updated_at DESC
                    LIMIT ? OFFSET ?
                ''', (limit, offset))

                return [dict(row) for row in cursor.fetchall()]

        except Exception as e:
            logger.error(f'❌ 列表查询失败: {str(e)}', exc_info=True)
            return []

    def delete_wiki(
        self,
        repo_type: str,
        owner: str,
        repo_name: str,
        language: Optional[str] = None
    ) -> bool:
        """
        删除 Wiki 数据

        Args:
            repo_type: 仓库类型
            owner: 仓库所有者
            repo_name: 仓库名称
            language: 特定语言 (如果为 None，删除所有语言版本)

        Returns:
            成功返回 True
        """
        try:
            repo_id = self._generate_repo_id(repo_type, owner, repo_name)

            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()

                if language:
                    cursor.execute('''
                        DELETE FROM wikis
                        WHERE repo_id = ? AND language = ?
                    ''', (repo_id, language))
                    logger.info(f'✅ 删除 Wiki: {owner}/{repo_name} (语言: {language})')
                else:
                    cursor.execute('''
                        DELETE FROM wikis
                        WHERE repo_id = ?
                    ''', (repo_id,))
                    logger.info(f'✅ 删除所有 Wiki: {owner}/{repo_name}')

                conn.commit()
                return True

        except Exception as e:
            logger.error(f'❌ 删除失败: {str(e)}', exc_info=True)
            return False

    # ==================== Wiki 生成任务队列方法 ====================

    def create_wiki_generation_task(
        self,
        task_id: str,
        repo_url: str,
        repo_type: str,
        owner: str,
        repo_name: str,
        provider: str,
        model: str,
        language: str,
        is_comprehensive: bool = True,
        excluded_dirs: Optional[str] = None,
        excluded_files: Optional[str] = None,
        included_dirs: Optional[str] = None,
        included_files: Optional[str] = None,
        access_token: Optional[str] = None,
        project_key: Optional[str] = None,
        force_refresh: bool = False
    ) -> bool:
        """
        创建一个 Wiki 生成任务

        Args:
            task_id: 任务ID
            repo_url: 仓库URL
            repo_type: 仓库类型
            owner: 仓库所有者
            repo_name: 仓库名称
            provider: AI提供商
            model: 模型名称
            language: 语言
            is_comprehensive: 是否生成全面的wiki
            excluded_dirs: 排除的目录
            excluded_files: 排除的文件
            included_dirs: 包含的目录
            included_files: 包含的文件
            access_token: 访问令牌
            project_key: 项目唯一标识（关联 wiki_projects 表）

        Returns:
            成功返回 True
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT INTO wiki_generation_tasks
                    (task_id, repo_url, repo_type, owner, repo_name, provider, model, language,
                     is_comprehensive, excluded_dirs, excluded_files, included_dirs, included_files,
                     access_token, force_refresh, project_key, status, progress, message)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    task_id, repo_url, repo_type, owner, repo_name, provider, model, language,
                    is_comprehensive, excluded_dirs, excluded_files, included_dirs, included_files,
                    access_token, force_refresh, project_key, 'queued', 0, 'Task created and queued'
                ))
                conn.commit()
                logger.info(f'✅ 任务已创建: {task_id} (项目: {project_key}, force_refresh={force_refresh})')
                return True
        except Exception as e:
            logger.error(f'❌ 创建任务失败: {str(e)}', exc_info=True)
            return False

    def get_task(self, task_id: str) -> Optional[Dict[str, Any]]:
        """
        获取任务信息

        Args:
            task_id: 任务ID

        Returns:
            任务信息或 None
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                cursor.execute('SELECT * FROM wiki_generation_tasks WHERE task_id = ?', (task_id,))
                row = cursor.fetchone()
                if row:
                    task = dict(row)
                    # 解析JSON结果
                    if task.get('result'):
                        task['result'] = json.loads(task['result'])
                    return task
                return None
        except Exception as e:
            logger.error(f'❌ 获取任务失败: {str(e)}', exc_info=True)
            return None

    def update_task_status(
        self,
        task_id: str,
        status: str,
        progress: int = None,
        message: str = None,
        result: Dict[str, Any] = None,
        error_message: str = None
    ) -> bool:
        """
        更新任务状态

        Args:
            task_id: 任务ID
            status: 新状态 (queued, processing, completed, failed)
            progress: 进度 (0-100)
            message: 状态消息
            result: 结果数据
            error_message: 错误消息

        Returns:
            成功返回 True
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()

                updates = ['status = ?', 'updated_at = CURRENT_TIMESTAMP']
                params = [status]

                if progress is not None:
                    updates.append('progress = ?')
                    params.append(progress)

                if message is not None:
                    updates.append('message = ?')
                    params.append(message)

                if result is not None:
                    updates.append('result = ?')
                    params.append(json.dumps(result))

                if error_message is not None:
                    updates.append('error_message = ?')
                    params.append(error_message)

                if status == 'processing' and progress == 0:
                    updates.append('started_at = CURRENT_TIMESTAMP')
                elif status in ['completed', 'failed']:
                    updates.append('completed_at = CURRENT_TIMESTAMP')

                params.append(task_id)

                query = f"UPDATE wiki_generation_tasks SET {', '.join(updates)} WHERE task_id = ?"
                cursor.execute(query, params)
                conn.commit()
                logger.info(f'✅ 任务已更新: {task_id} -> {status} (进度: {progress}%)')
                return True
        except Exception as e:
            logger.error(f'❌ 更新任务失败: {str(e)}', exc_info=True)
            return False

    def get_queued_tasks(self, limit: int = 10) -> List[Dict[str, Any]]:
        """
        获取排队中的任务

        Args:
            limit: 返回的最大任务数

        Returns:
            任务列表
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT * FROM wiki_generation_tasks
                    WHERE status = 'queued'
                    ORDER BY created_at ASC
                    LIMIT ?
                ''', (limit,))
                rows = cursor.fetchall()
                return [dict(row) for row in rows]
        except Exception as e:
            logger.error(f'❌ 获取排队任务失败: {str(e)}', exc_info=True)
            return []

    def cleanup_interrupted_tasks(self) -> int:
        """
        清理服务器重启时中断的任务

        将所有处于中间状态的任务标记为失败，避免状态不一致

        中间状态包括：
        - queued: 排队中
        - processing: 处理中

        Returns:
            清理的任务数量
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()

                # 查找所有中间状态的任务
                cursor.execute('''
                    SELECT task_id, project_key, status
                    FROM wiki_generation_tasks
                    WHERE status IN ('queued', 'processing')
                ''')
                interrupted_tasks = cursor.fetchall()

                if not interrupted_tasks:
                    logger.info("✅ 没有需要清理的中断任务")
                    return 0

                # 更新任务状态为失败
                cursor.execute('''
                    UPDATE wiki_generation_tasks
                    SET status = 'failed',
                        progress = 0,
                        error_message = '服务器重启导致任务中断',
                        message = '任务已被标记为失败，请重新生成',
                        completed_at = CURRENT_TIMESTAMP,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE status IN ('queued', 'processing')
                ''')

                cleaned_count = cursor.rowcount

                # 更新相关项目的状态
                for task_id, project_key, old_status in interrupted_tasks:
                    if project_key:
                        cursor.execute('''
                            UPDATE wiki_projects
                            SET status = 'failed',
                                last_failed_at = CURRENT_TIMESTAMP,
                                current_task_id = NULL,
                                updated_at = CURRENT_TIMESTAMP
                            WHERE project_key = ?
                            AND status IN ('generating', 'queued')
                        ''', (project_key,))
                        logger.info(f"✅ 已清理中断任务: {task_id} (项目: {project_key}, 原状态: {old_status})")

                conn.commit()
                logger.info(f"✅ 共清理了 {cleaned_count} 个中断的任务")
                return cleaned_count

        except Exception as e:
            logger.error(f"❌ 清理中断任务失败: {str(e)}", exc_info=True)
            return 0

    def cleanup_old_tasks(self, days: int = 7) -> int:
        """
        清理旧任务（完成超过N天的任务）

        Args:
            days: 天数

        Returns:
            删除的任务数
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    DELETE FROM wiki_generation_tasks
                    WHERE status IN ('completed', 'failed')
                    AND completed_at IS NOT NULL
                    AND datetime(completed_at) < datetime('now', ? || ' days')
                ''', (f'-{days}',))
                deleted = cursor.rowcount
                conn.commit()
                if deleted > 0:
                    logger.info(f'✅ 已清理 {deleted} 个旧任务')
                return deleted
        except Exception as e:
            logger.error(f'❌ 清理旧任务失败: {str(e)}', exc_info=True)
            return 0


# 全局数据库实例
    # ==================== Wiki 项目管理方法 ====================

    def get_or_create_wiki_project(self, repo_url: str, repo_type: str,
                                    owner: str, repo_name: str) -> Dict[str, Any]:
        """
        获取或创建 Wiki 项目记录（保证全局唯一）

        Args:
            repo_url: 仓库 URL
            repo_type: 仓库类型 ('gitlab', 'github', 'bitbucket', 'gerrit')
            owner: 仓库所有者
            repo_name: 仓库名称

        Returns:
            项目记录字典
        """
        project_key = f"{repo_type}:{owner}/{repo_name}"

        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()

                # 尝试获取现有项目
                cursor.execute('''
                    SELECT * FROM wiki_projects WHERE project_key = ?
                ''', (project_key,))

                project = cursor.fetchone()

                if project:
                    logger.info(f'📦 获取现有项目: {project_key} (状态: {project["status"]})')
                    return dict(project)

                # 创建新项目
                cursor.execute('''
                    INSERT INTO wiki_projects
                    (project_key, repo_url, repo_type, owner, repo_name, status)
                    VALUES (?, ?, ?, ?, ?, 'not_generated')
                ''', (project_key, repo_url, repo_type, owner, repo_name))

                conn.commit()

                # 返回创建的项目
                cursor.execute('''
                    SELECT * FROM wiki_projects WHERE project_key = ?
                ''', (project_key,))

                project = dict(cursor.fetchone())
                logger.info(f'✅ 创建新项目: {project_key}')
                return project

        except Exception as e:
            logger.error(f'❌ 获取/创建项目失败: {e}', exc_info=True)
            raise

    def update_wiki_project_status(self, project_key: str, status: str,
                                   task_id: Optional[str] = None,
                                   last_success_date: Optional[str] = None) -> bool:
        """
        更新 Wiki 项目状态

        Args:
            project_key: 项目唯一标识
            status: 新状态 ('not_generated', 'generating', 'generated', 'failed')
            task_id: 关联的任务 ID（仅当 status='generating' 时需要）
            last_success_date: 最后成功日期 (YYYY-MM-DD)

        Returns:
            成功返回 True
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()

                if status == 'generating':
                    cursor.execute('''
                        UPDATE wiki_projects
                        SET status = ?,
                            current_task_id = ?,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE project_key = ?
                    ''', (status, task_id, project_key))

                elif status == 'generated':
                    cursor.execute('''
                        UPDATE wiki_projects
                        SET status = ?,
                            current_task_id = NULL,
                            last_generated_at = CURRENT_TIMESTAMP,
                            last_success_date = ?,
                            generation_count = generation_count + 1,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE project_key = ?
                    ''', (status, last_success_date, project_key))

                elif status == 'failed':
                    cursor.execute('''
                        UPDATE wiki_projects
                        SET status = ?,
                            current_task_id = NULL,
                            last_failed_at = CURRENT_TIMESTAMP,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE project_key = ?
                    ''', (status, project_key))

                else:  # not_generated 或其他
                    cursor.execute('''
                        UPDATE wiki_projects
                        SET status = ?,
                            current_task_id = NULL,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE project_key = ?
                    ''', (status, project_key))

                conn.commit()
                logger.info(f'✅ 项目状态已更新: {project_key} -> {status}')
                return True

        except Exception as e:
            logger.error(f'❌ 更新项目状态失败: {e}', exc_info=True)
            return False

    def save_wiki_project_result(self, project_key: str, wiki_structure: dict,
                                 documents_count: int, message: Optional[str] = None) -> bool:
        """
        保存 Wiki 生成结果到项目记录

        Args:
            project_key: 项目唯一标识
            wiki_structure: Wiki 结构（字典格式）
            documents_count: 文档数量
            message: 可选的状态消息

        Returns:
            成功返回 True
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()

                pages_count = len(wiki_structure.get('pages', []))

                # 如果没有提供消息，使用默认消息
                if not message:
                    message = f'Wiki generated successfully with {pages_count} pages'

                cursor.execute('''
                    UPDATE wiki_projects
                    SET wiki_structure = ?,
                        documents_count = ?,
                        pages_count = ?,
                        progress = 100,
                        message = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE project_key = ?
                ''', (json.dumps(wiki_structure, ensure_ascii=False),
                      documents_count, pages_count,
                      message,
                      project_key))

                conn.commit()
                logger.info(f'✅ Wiki 结果已保存: {project_key} ({pages_count} 页)')
                return True

        except Exception as e:
            logger.error(f'❌ 保存 Wiki 结果失败: {e}', exc_info=True)
            return False

    def get_wiki_project_by_key(self, project_key: str) -> Optional[Dict[str, Any]]:
        """
        根据 project_key 获取项目

        Args:
            project_key: 项目唯一标识

        Returns:
            项目记录字典，不存在则返回 None
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()

                cursor.execute('''
                    SELECT * FROM wiki_projects WHERE project_key = ?
                ''', (project_key,))

                project = cursor.fetchone()
                if not project:
                    return None

                project_dict = dict(project)

                # 如果项目正在生成中，从任务表中获取最新的进度信息
                if project_dict.get('status') == 'generating' and project_dict.get('current_task_id'):
                    cursor.execute('''
                        SELECT progress, message FROM wiki_generation_tasks WHERE task_id = ?
                    ''', (project_dict['current_task_id'],))

                    task = cursor.fetchone()
                    if task:
                        task_dict = dict(task)
                        project_dict['progress'] = task_dict.get('progress', 0)
                        project_dict['message'] = task_dict.get('message', '正在生成 Wiki...')

                return project_dict

        except Exception as e:
            logger.error(f'❌ 获取项目失败: {e}', exc_info=True)
            return None

    def get_wiki_project_by_repo(self, repo_type: str, owner: str,
                                 repo_name: str) -> Optional[Dict[str, Any]]:
        """
        根据仓库信息获取项目

        Args:
            repo_type: 仓库类型
            owner: 仓库所有者
            repo_name: 仓库名称

        Returns:
            项目记录字典，不存在则返回 None
        """
        project_key = f"{repo_type}:{owner}/{repo_name}"
        return self.get_wiki_project_by_key(project_key)

    def list_wiki_projects(self, status: Optional[str] = None,
                          limit: int = 100) -> List[Dict[str, Any]]:
        """
        列出 Wiki 项目

        Args:
            status: 可选，按状态过滤
            limit: 返回数量限制

        Returns:
            项目列表
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()

                if status:
                    cursor.execute('''
                        SELECT * FROM wiki_projects
                        WHERE status = ?
                        ORDER BY updated_at DESC
                        LIMIT ?
                    ''', (status, limit))
                else:
                    cursor.execute('''
                        SELECT * FROM wiki_projects
                        ORDER BY updated_at DESC
                        LIMIT ?
                    ''', (limit,))

                return [dict(row) for row in cursor.fetchall()]

        except Exception as e:
            logger.error(f'❌ 列出项目失败: {e}', exc_info=True)
            return []

    def save_rendered_pages(self, project_key: str, rendered_pages: Dict[str, Dict]) -> bool:
        """
        保存渲染后的页面 HTML

        Args:
            project_key: 项目唯一标识
            rendered_pages: {page_id: {title, html, importance}}

        Returns:
            成功返回 True
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()

                # 先删除旧的渲染数据
                cursor.execute('''
                    DELETE FROM wiki_pages_rendered WHERE project_key = ?
                ''', (project_key,))

                # 插入新的渲染数据
                for page_id, page_data in rendered_pages.items():
                    cursor.execute('''
                        INSERT INTO wiki_pages_rendered
                        (project_key, page_id, title, html_content, importance)
                        VALUES (?, ?, ?, ?, ?)
                    ''', (
                        project_key,
                        page_id,
                        page_data.get('title', ''),
                        page_data.get('html', ''),
                        page_data.get('importance', 'medium')
                    ))

                conn.commit()
                logger.info(f'✅ 保存了 {len(rendered_pages)} 个渲染页面: {project_key}')
                return True

        except Exception as e:
            logger.error(f'❌ 保存渲染页面失败: {e}', exc_info=True)
            return False

    def save_markdown_pages(self, project_key: str, markdown_pages: Dict[str, Dict]) -> bool:
        """
        保存 Markdown 页面（不渲染 HTML，由前端处理）

        Args:
            project_key: 项目唯一标识
            markdown_pages: {page_id: {title, markdown, importance}}

        Returns:
            成功返回 True
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()

                # 先删除旧的数据
                cursor.execute('''
                    DELETE FROM wiki_pages_rendered WHERE project_key = ?
                ''', (project_key,))

                # 插入新的 markdown 数据（存储在 html_content 字段，但内容是 markdown）
                for page_id, page_data in markdown_pages.items():
                    cursor.execute('''
                        INSERT INTO wiki_pages_rendered
                        (project_key, page_id, title, html_content, importance)
                        VALUES (?, ?, ?, ?, ?)
                    ''', (
                        project_key,
                        page_id,
                        page_data.get('title', ''),
                        page_data.get('markdown', ''),  # 存储 markdown 内容
                        page_data.get('importance', 'medium')
                    ))

                conn.commit()
                logger.info(f'✅ 保存了 {len(markdown_pages)} 个 Markdown 页面: {project_key}')
                return True

        except Exception as e:
            logger.error(f'❌ 保存 Markdown 页面失败: {e}', exc_info=True)
            return False

    def get_rendered_page(self, project_key: str, page_id: str) -> Optional[Dict[str, str]]:
        """
        获取页面 Markdown 内容（原名 get_rendered_page 保持不变以兼容旧代码）

        Args:
            project_key: 项目唯一标识
            page_id: 页面 ID

        Returns:
            页面数据 {page_id, title, markdown, rendered_at} 或 None
        """
        try:
            from api.markdown_utils import clean_markdown_code_fence, fix_markdown_code_fence_spacing

            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()

                cursor.execute('''
                    SELECT page_id, title, html_content, importance, rendered_at
                    FROM wiki_pages_rendered
                    WHERE project_key = ? AND page_id = ?
                ''', (project_key, page_id))

                row = cursor.fetchone()

                if row:
                    markdown_content = row['html_content']
                    page_id_value = row['page_id']
                    # 清理可能的外层 markdown 代码块包裹
                    markdown_content = clean_markdown_code_fence(
                        markdown_content,
                        context=f"DB:get_page/{project_key}/{page_id_value}"
                    )
                    # 修复代码块分隔问题
                    markdown_content = fix_markdown_code_fence_spacing(
                        markdown_content,
                        context=f"DB:get_page/{project_key}/{page_id_value}"
                    )

                    return {
                        'page_id': page_id_value,
                        'title': row['title'],
                        'markdown': markdown_content,  # 返回清理后的 markdown
                        'importance': row['importance'],
                        'rendered_at': row['rendered_at']
                    }

                return None

        except Exception as e:
            logger.error(f'❌ 获取页面失败: {e}', exc_info=True)
            return None

    def get_all_rendered_pages(self, project_key: str) -> List[Dict[str, str]]:
        """
        获取项目的所有 Markdown 页面

        Args:
            project_key: 项目唯一标识

        Returns:
            页面列表
        """
        try:
            from api.markdown_utils import clean_markdown_code_fence, fix_markdown_code_fence_spacing

            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()

                cursor.execute('''
                    SELECT page_id, title, html_content, importance, rendered_at
                    FROM wiki_pages_rendered
                    WHERE project_key = ?
                    ORDER BY importance DESC, page_id ASC
                ''', (project_key,))

                return [
                    {
                        'page_id': row['page_id'],
                        'title': row['title'],
                        'markdown': fix_markdown_code_fence_spacing(
                            clean_markdown_code_fence(
                                row['html_content'],
                                context=f"DB:get_all_pages/{project_key}/{row['page_id']}"
                            ),
                            context=f"DB:get_all_pages/{project_key}/{row['page_id']}"
                        ),
                        'importance': row['importance'],
                        'rendered_at': row['rendered_at']
                    }
                    for row in cursor.fetchall()
                ]

        except Exception as e:
            logger.error(f'❌ 获取所有页面失败: {e}', exc_info=True)
            return []

    def save_cost_tracking(self, task_id: str, embedding_tokens: int, embedding_cost: float,
                          llm_tokens: int, llm_cost: float) -> bool:
        """保存成本追踪数据到数据库

        Args:
            task_id: 任务 ID
            embedding_tokens: Embedding tokens 数量
            embedding_cost: Embedding 成本（USD）
            llm_tokens: LLM tokens 数量
            llm_cost: LLM 成本（USD）

        Returns:
            是否保存成功
        """
        try:
            total_cost = embedding_cost + llm_cost

            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()

                cursor.execute('''
                    INSERT OR REPLACE INTO cost_tracking
                    (task_id, embedding_tokens, embedding_cost, llm_tokens, llm_cost, total_cost, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ''', (task_id, embedding_tokens, embedding_cost, llm_tokens, llm_cost, total_cost))

                conn.commit()
                logger.info(
                    f"✅ 成本数据已保存 [Task {task_id}] - "
                    f"Embedding: ${embedding_cost:.6f}, LLM: ${llm_cost:.6f}, "
                    f"Total: ${total_cost:.6f}"
                )
                return True

        except Exception as e:
            logger.error(f'❌ 保存成本数据失败 [Task {task_id}]: {e}', exc_info=True)
            return False

    def get_cost_tracking(self, task_id: str) -> Optional[Dict[str, Any]]:
        """获取任务的成本追踪数据

        Args:
            task_id: 任务 ID

        Returns:
            成本数据字典，如果不存在则返回 None
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()

                cursor.execute('''
                    SELECT embedding_tokens, embedding_cost, llm_tokens, llm_cost, total_cost, created_at, updated_at
                    FROM cost_tracking
                    WHERE task_id = ?
                ''', (task_id,))

                row = cursor.fetchone()
                if row:
                    return {
                        'embedding_tokens': row['embedding_tokens'],
                        'embedding_cost': row['embedding_cost'],
                        'llm_tokens': row['llm_tokens'],
                        'llm_cost': row['llm_cost'],
                        'total_cost': row['total_cost'],
                        'created_at': row['created_at'],
                        'updated_at': row['updated_at']
                    }
                return None

        except Exception as e:
            logger.error(f'❌ 获取成本数据失败 [Task {task_id}]: {e}', exc_info=True)
            return None

    def get_cost_tracking_by_project(self, owner: str, repo_name: str, repo_type: str = 'github') -> Optional[Dict[str, Any]]:
        """获取项目的最新成本数据

        Args:
            owner: 仓库所有者
            repo_name: 仓库名称
            repo_type: 仓库类型

        Returns:
            最新的成本数据，如果不存在则返回 None
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()

                # 获取项目最近生成任务的成本数据
                cursor.execute('''
                    SELECT c.embedding_tokens, c.embedding_cost, c.llm_tokens, c.llm_cost, c.total_cost, c.created_at, c.updated_at
                    FROM cost_tracking c
                    INNER JOIN wiki_generation_tasks t ON c.task_id = t.task_id
                    WHERE t.owner = ? AND t.repo_name = ? AND t.repo_type = ?
                    ORDER BY c.updated_at DESC
                    LIMIT 1
                ''', (owner, repo_name, repo_type))

                row = cursor.fetchone()
                if row:
                    return {
                        'embedding_tokens': row['embedding_tokens'],
                        'embedding_cost': row['embedding_cost'],
                        'llm_tokens': row['llm_tokens'],
                        'llm_cost': row['llm_cost'],
                        'total_cost': row['total_cost'],
                        'created_at': row['created_at'],
                        'updated_at': row['updated_at']
                    }
                return None

        except Exception as e:
            logger.error(f'❌ 获取项目成本数据失败 [{owner}/{repo_name}]: {e}', exc_info=True)
            return None

    def get_cost_statistics(self, days: int = 7) -> Dict[str, Any]:
        """获取指定天数内的成本统计

        Args:
            days: 统计天数，默认 7 天

        Returns:
            包含总成本、平均成本、任务数等统计信息
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()

                # 计算指定天数内的统计
                cursor.execute('''
                    SELECT
                        COUNT(*) as task_count,
                        SUM(embedding_cost) as total_embedding_cost,
                        SUM(llm_cost) as total_llm_cost,
                        SUM(total_cost) as total_cost,
                        AVG(total_cost) as avg_cost,
                        MIN(total_cost) as min_cost,
                        MAX(total_cost) as max_cost
                    FROM cost_tracking
                    WHERE created_at >= datetime('now', '-' || ? || ' days')
                ''', (days,))

                row = cursor.fetchone()
                if row:
                    return {
                        'period_days': days,
                        'task_count': row[0] or 0,
                        'total_embedding_cost': round(row[1] or 0.0, 6),
                        'total_llm_cost': round(row[2] or 0.0, 6),
                        'total_cost': round(row[3] or 0.0, 6),
                        'avg_cost': round(row[4] or 0.0, 6),
                        'min_cost': round(row[5] or 0.0, 6),
                        'max_cost': round(row[6] or 0.0, 6)
                    }
                return {
                    'period_days': days,
                    'task_count': 0,
                    'total_embedding_cost': 0.0,
                    'total_llm_cost': 0.0,
                    'total_cost': 0.0,
                    'avg_cost': 0.0,
                    'min_cost': 0.0,
                    'max_cost': 0.0
                }

        except Exception as e:
            logger.error(f'❌ 获取成本统计失败: {e}', exc_info=True)
            return {}

    def get_queue_status(self, user_task_ids: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        获取队列状态概览（隐私安全，不暴露项目信息）

        Args:
            user_task_ids: 用户当前关注的任务ID列表（可选）

        Returns:
            队列状态信息：
            - processing_count: 当前生成中的任务数
            - queued_count: 排队等待的任务数
            - is_busy: 队列是否繁忙
            - user_tasks: 用户任务状态列表，每个包含：
                - task_id: 任务ID
                - status: 任务状态（processing/queued/completed/failed）
                - position: 队列位置（-1=生成中，N=排在第N位，0=不在队列中）
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()

                # 统计当前 processing 的任务数
                cursor.execute('''
                    SELECT COUNT(*) FROM wiki_generation_tasks
                    WHERE status = 'processing'
                ''')
                processing_count = cursor.fetchone()[0]

                # 统计当前 queued 的任务数
                cursor.execute('''
                    SELECT COUNT(*) FROM wiki_generation_tasks
                    WHERE status = 'queued'
                ''')
                queued_count = cursor.fetchone()[0]

                # 用户任务状态列表
                user_tasks = []

                if user_task_ids:
                    for task_id in user_task_ids:
                        # 查询用户任务的状态
                        cursor.execute('''
                            SELECT status, created_at FROM wiki_generation_tasks
                            WHERE task_id = ?
                        ''', (task_id,))
                        user_task = cursor.fetchone()

                        if user_task:
                            task_status, task_created_at = user_task
                            position = 0

                            if task_status == 'processing':
                                position = -1  # -1 表示正在生成中
                            elif task_status == 'queued':
                                # 计算综合位置：processing任务数 + 在你前面排队的任务数
                                cursor.execute('''
                                    SELECT COUNT(*) FROM wiki_generation_tasks
                                    WHERE status = 'queued'
                                    AND created_at < ?
                                ''', (task_created_at,))
                                queued_before = cursor.fetchone()[0]
                                # 位置 = 正在处理的 + 排在前面的 + 1（自己）
                                position = processing_count + queued_before + 1

                            user_tasks.append({
                                'task_id': task_id,
                                'status': task_status,
                                'position': position
                            })
                        else:
                            # 任务不存在
                            user_tasks.append({
                                'task_id': task_id,
                                'status': 'not_found',
                                'position': 0
                            })

                return {
                    'processing_count': processing_count,
                    'queued_count': queued_count,
                    'is_busy': processing_count > 0 or queued_count > 0,
                    'user_tasks': user_tasks
                }

        except Exception as e:
            logger.error(f'❌ 获取队列状态失败: {e}', exc_info=True)
            return {
                'processing_count': 0,
                'queued_count': 0,
                'is_busy': False,
                'user_tasks': [],
                'error': str(e)
            }


_gitlab_db = None


def get_gitlab_db() -> GitLabProjectDB:
    """获取全局数据库实例"""
    global _gitlab_db
    if _gitlab_db is None:
        _gitlab_db = GitLabProjectDB()
    return _gitlab_db
