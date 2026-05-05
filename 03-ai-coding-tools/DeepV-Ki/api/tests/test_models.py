"""
测试数据模型的有效性
"""

import pytest
from api.models import (
    WikiPage,
    WikiSection,
    WikiStructureModel,
    WikiCacheData,
    WikiGenerationRequest,
    RepoInfo,
    ProcessedProjectEntry,
)


class TestWikiModels:
    """测试 Wiki 相关模型"""

    def test_wiki_page_creation(self):
        """测试 WikiPage 创建"""
        page = WikiPage(
            id="page-1",
            title="Overview",
            content="# Overview\n\nThis is an overview page",
            filePaths=["README.md"],
            importance="high",
            relatedPages=["architecture", "setup"]
        )
        assert page.id == "page-1"
        assert page.title == "Overview"
        assert page.importance == "high"

    def test_wiki_structure_creation(self):
        """测试 WikiStructureModel 创建"""
        page = WikiPage(
            id="page-1",
            title="Overview",
            content="Content",
            filePaths=["README.md"],
            importance="high",
            relatedPages=[]
        )

        structure = WikiStructureModel(
            id="wiki-1",
            title="Project Wiki",
            description="Complete wiki for the project",
            pages=[page],
            sections=None,
            rootSections=None
        )
        assert structure.id == "wiki-1"
        assert len(structure.pages) == 1

    def test_wiki_cache_data_creation(self):
        """测试 WikiCacheData 创建"""
        page = WikiPage(
            id="page-1",
            title="Overview",
            content="Content",
            filePaths=["README.md"],
            importance="high",
            relatedPages=[]
        )

        structure = WikiStructureModel(
            id="wiki-1",
            title="Project Wiki",
            description="Description",
            pages=[page]
        )

        cache_data = WikiCacheData(
            wiki_structure=structure,
            generated_pages={"page-1": page},
            repo_url="https://github.com/user/repo",
            repo=None
        )
        assert cache_data.repo_url == "https://github.com/user/repo"
        assert len(cache_data.generated_pages) == 1

    def test_wiki_generation_request_creation(self):
        """测试 WikiGenerationRequest 创建"""
        request = WikiGenerationRequest(
            repo_url="https://github.com/user/repo",
            provider="google",
            model="gemini-2.5-flash",
            language="en"
        )
        assert request.repo_url == "https://github.com/user/repo"
        assert request.provider == "google"

    def test_repo_info_creation(self):
        """测试 RepoInfo 创建"""
        repo = RepoInfo(
            owner="user",
            repo_name="project",
            repo_url="https://github.com/user/project",
            platform="github",
            default_branch="main"
        )
        assert repo.owner == "user"
        assert repo.repo_name == "project"
        assert repo.platform == "github"


class TestModelValidation:
    """测试模型验证"""

    def test_wiki_generation_request_validation(self):
        """测试 WikiGenerationRequest 字段验证"""
        with pytest.raises(Exception):  # Pydantic ValidationError
            WikiGenerationRequest(
                repo_url="invalid-url",
                provider="",
                model=""
            )

    def test_wiki_page_missing_required_fields(self):
        """测试 WikiPage 缺失必填字段"""
        with pytest.raises(Exception):
            WikiPage(
                id="page-1",
                title="Test"
                # 缺失其他必填字段
            )

    def test_wiki_structure_empty_pages(self):
        """测试空页面列表的 WikiStructureModel"""
        structure = WikiStructureModel(
            id="wiki-1",
            title="Empty Wiki",
            description="Wiki with no pages",
            pages=[]
        )
        assert len(structure.pages) == 0
        assert structure.id == "wiki-1"
