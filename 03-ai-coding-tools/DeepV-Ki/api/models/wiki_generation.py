"""
Wiki 生成请求模型
"""

from typing import Optional
from pydantic import BaseModel, Field


class WikiGenerationRequest(BaseModel):
    """Wiki 生成请求模型"""
    repo_url: str = Field(..., description="仓库 URL")
    repo_type: str = Field(default="github", description="仓库类型 (github, gitlab, bitbucket, gerrit)")
    owner: str = Field(..., description="仓库所有者")
    repo_name: str = Field(..., description="仓库名称")
    provider: Optional[str] = Field(None, description="AI 提供商（可选，不指定时使用后端默认配置）")
    model: Optional[str] = Field(None, description="模型名称（可选，不指定时使用后端默认配置）")
    language: str = Field(default="english", description="生成语言")
    is_comprehensive: bool = Field(default=True, description="是否生成全面的 wiki", alias="comprehensive")
    excluded_dirs: Optional[str] = Field(None, description="排除的目录（换行符分隔）")
    excluded_files: Optional[str] = Field(None, description="排除的文件（换行符分隔）")
    included_dirs: Optional[str] = Field(None, description="包含的目录（换行符分隔）")
    included_files: Optional[str] = Field(None, description="包含的文件（换行符分隔）")
    access_token: Optional[str] = Field(None, description="访问令牌（用于私有仓库）")
    force_refresh: bool = Field(default=False, description="强制刷新：删除缓存的仓库并重新从源下载")

    class Config:
        populate_by_name = True
