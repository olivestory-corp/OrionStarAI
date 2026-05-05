"""
项目相关的数据模型
"""

from typing import Optional
from pydantic import BaseModel


class ProcessedProjectEntry(BaseModel):
    """已处理的项目条目"""
    id: str  # 文件名
    owner: str
    repo: str
    name: str  # owner/repo
    repo_type: str  # 重命名自 'type' 以区别于现有模型
    submittedAt: int  # 时间戳
    language: str  # 从文件名提取


class RepoInfo(BaseModel):
    """仓库信息"""
    owner: str
    repo: str
    type: str
    token: Optional[str] = None
    localPath: Optional[str] = None
    repoUrl: Optional[str] = None
