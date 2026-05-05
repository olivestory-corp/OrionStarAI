"""
Wiki 相关的数据模型
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class WikiPage(BaseModel):
    """Wiki 页面"""
    id: str
    title: str
    content: str
    filePaths: List[str]
    importance: str  # 应该是 Literal['high', 'medium', 'low']
    relatedPages: List[str]


class WikiSection(BaseModel):
    """Wiki 部分"""
    id: str
    title: str
    pages: List[str]
    subsections: Optional[List[str]] = None


class WikiStructureModel(BaseModel):
    """Wiki 结构"""
    id: str
    title: str
    description: str
    pages: List[WikiPage]
    sections: Optional[List[WikiSection]] = None
    rootSections: Optional[List[str]] = None


class WikiCacheData(BaseModel):
    """Wiki 缓存数据"""
    wiki_structure: WikiStructureModel
    generated_pages: Dict[str, WikiPage]
    repo_url: Optional[str] = None
    repo: Optional[Dict[str, Any]] = None  # 暂时使用 Dict 而不是前向引用
