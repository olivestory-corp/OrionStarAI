"""
测试自定义异常处理
"""

import pytest
from api.exceptions import (
    DeepWikiException,
    InvalidRepositoryError,
    RepositoryError,
    GitLabAPIError,
    TaskTimeoutError,
)


class TestCustomExceptions:
    """测试自定义异常"""

    def test_deepwiki_exception(self):
        """测试基础异常"""
        exc = DeepWikiException(message="Test error", error_code="TEST_001")
        assert str(exc) == "Test error"
        assert exc.error_code == "TEST_001"

    def test_invalid_repository_error(self):
        """测试无效仓库异常"""
        exc = InvalidRepositoryError(
            repo_url="invalid-url",
            reason="Invalid format"
        )
        assert "invalid-url" in str(exc)
        assert exc.error_code == "INVALID_REPO_001"

    def test_repository_error(self):
        """测试仓库错误异常"""
        exc = RepositoryError(
            repo_url="https://github.com/user/repo",
            operation="clone",
            message="Network error"
        )
        assert "clone" in str(exc)
        assert exc.error_code == "REPO_ERROR_002"

    def test_gitlab_api_error(self):
        """测试 GitLab API 错误异常"""
        exc = GitLabAPIError(
            endpoint="/api/v4/projects",
            status_code=401,
            message="Unauthorized"
        )
        assert "401" in str(exc)
        assert exc.error_code == "GITLAB_ERROR_003"

    def test_task_timeout_error(self):
        """测试任务超时异常"""
        exc = TaskTimeoutError(
            task_id="task-123",
            timeout_seconds=300,
            message="Task execution timeout"
        )
        assert "task-123" in str(exc)
        assert exc.error_code == "TIMEOUT_ERROR_004"

    def test_exception_inheritance(self):
        """测试异常继承关系"""
        exc = InvalidRepositoryError(
            repo_url="invalid",
            reason="test"
        )
        assert isinstance(exc, DeepWikiException)
        assert isinstance(exc, Exception)

    def test_exception_with_original_exception(self):
        """测试包含原始异常的自定义异常"""
        original = ValueError("Original error")
        exc = RepositoryError(
            repo_url="https://github.com/user/repo",
            operation="clone",
            message="Clone failed",
            original_exception=original
        )
        assert exc.original_exception == original


class TestExceptionHandling:
    """测试异常处理"""

    def test_exception_catch_and_re_raise(self):
        """测试异常捕获和重新抛出"""
        with pytest.raises(RepositoryError):
            try:
                raise ValueError("Original error")
            except ValueError as e:
                raise RepositoryError(
                    repo_url="https://github.com/user/repo",
                    operation="clone",
                    message="Failed to clone",
                    original_exception=e
                )

    def test_multiple_exception_types(self):
        """测试多个异常类型的处理"""
        exceptions = [
            InvalidRepositoryError(repo_url="invalid", reason="test"),
            GitLabAPIError(endpoint="/test", status_code=404, message="Not found"),
            TaskTimeoutError(task_id="123", timeout_seconds=300, message="Timeout"),
        ]

        for exc in exceptions:
            assert isinstance(exc, DeepWikiException)
            assert hasattr(exc, "error_code")
            assert hasattr(exc, "message")
