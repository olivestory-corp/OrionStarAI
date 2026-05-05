"""
Wiki 缓存业务逻辑层
"""

import logging
import json
import os
from pathlib import Path
from typing import Optional, Dict, Any
from api.models.wiki import WikiCacheData, WikiStructureModel

logger = logging.getLogger(__name__)


class WikiCacheService:
    """
    Wiki 缓存服务

    负责：
    - 读取和保存 Wiki 缓存
    - 管理缓存路径
    - 缓存失效
    """

    @staticmethod
    def get_cache_path(owner: str, repo: str, repo_type: str, language: str) -> str:
        """
        获取 Wiki 缓存路径

        Args:
            owner: 仓库所有者
            repo: 仓库名
            repo_type: 仓库类型
            language: 语言

        Returns:
            缓存路径
        """
        cache_dir = Path.home() / '.adalflow' / 'wikicache'
        cache_dir.mkdir(parents=True, exist_ok=True)

        # 生成缓存文件名 (处理 owner/repo 中可能包含的斜杠)
        safe_owner = owner.replace('/', '_').replace('\\', '_')
        safe_repo = repo.replace('/', '_').replace('\\', '_')
        cache_filename = f"{repo_type}_{safe_owner}_{safe_repo}_{language}.json"
        return str(cache_dir / cache_filename)

    @staticmethod
    def load_cache(owner: str, repo: str, repo_type: str, language: str) -> Optional[WikiCacheData]:
        """
        加载 Wiki 缓存

        Args:
            owner: 仓库所有者
            repo: 仓库名
            repo_type: 仓库类型
            language: 语言

        Returns:
            Wiki 缓存数据或 None
        """
        cache_path = WikiCacheService.get_cache_path(owner, repo, repo_type, language)

        if not os.path.exists(cache_path):
            return None

        try:
            with open(cache_path, 'r', encoding='utf-8') as f:
                data = json.load(f)

            wiki_cache = WikiCacheData(**data)
            logger.info(f"✅ 从缓存加载 Wiki: {owner}/{repo} ({language})")
            return wiki_cache

        except Exception as e:
            logger.warning(f"⚠️ 加载 Wiki 缓存失败: {str(e)}")
            return None

    @staticmethod
    def save_cache(
        owner: str,
        repo: str,
        repo_type: str,
        language: str,
        wiki_structure: WikiStructureModel,
        generated_pages: Dict[str, Any]
    ) -> bool:
        """
        保存 Wiki 缓存

        Args:
            owner: 仓库所有者
            repo: 仓库名
            repo_type: 仓库类型
            language: 语言
            wiki_structure: Wiki 结构
            generated_pages: 生成的页面

        Returns:
            是否保存成功
        """
        cache_path = WikiCacheService.get_cache_path(owner, repo, repo_type, language)

        try:
            cache_data = WikiCacheData(
                wiki_structure=wiki_structure,
                generated_pages=generated_pages
            )

            with open(cache_path, 'w', encoding='utf-8') as f:
                json.dump(cache_data.model_dump(), f, ensure_ascii=False, indent=2)

            logger.info(f"✅ Wiki 缓存已保存: {cache_path}")
            return True

        except Exception as e:
            logger.error(f"❌ 保存 Wiki 缓存失败: {str(e)}", exc_info=True)
            return False

    @staticmethod
    def delete_cache(owner: str, repo: str, repo_type: str, language: str) -> bool:
        """
        删除 Wiki 缓存

        Args:
            owner: 仓库所有者
            repo: 仓库名
            repo_type: 仓库类型
            language: 语言

        Returns:
            是否删除成功
        """
        cache_path = WikiCacheService.get_cache_path(owner, repo, repo_type, language)

        try:
            if os.path.exists(cache_path):
                os.remove(cache_path)
                logger.info(f"✅ Wiki 缓存已删除: {cache_path}")

            return True

        except Exception as e:
            logger.error(f"❌ 删除 Wiki 缓存失败: {str(e)}", exc_info=True)
            return False
