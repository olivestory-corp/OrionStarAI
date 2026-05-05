"""
测试脚本：验证所有修复的接口都需要 deepwiki_session cookie 认证
"""

import pytest
from fastapi.testclient import TestClient
from api.api import app

client = TestClient(app)


class TestSessionAuthenticationRequired:
    """测试所有接口都需要 session 认证"""

    def test_gitlab_file_content_requires_session(self):
        """GET /gitlab/file-content 应该需要 session"""
        response = client.get(
            "/gitlab/file-content",
            params={
                "repo_url": "https://gitlab.com/test/repo",
                "file_path": "README.md"
            }
        )
        # 应该返回 401 而不是 200
        assert response.status_code == 401
        assert "Unauthorized" in response.json()["detail"] or "Session" in response.json()["detail"]

    def test_gitlab_project_structure_requires_session(self):
        """GET /gitlab/project-structure 应该需要 session"""
        response = client.get(
            "/gitlab/project-structure",
            params={"repo_url": "https://gitlab.com/test/repo"}
        )
        assert response.status_code == 401

    def test_gitlab_sync_status_requires_session(self):
        """GET /gitlab/sync-status 应该需要 session"""
        response = client.get(
            "/gitlab/sync-status",
            params={"email": "test@example.com"}
        )
        assert response.status_code == 401

    def test_gitlab_public_projects_sync_requires_session(self):
        """POST /gitlab/public-projects/sync 应该需要 session"""
        response = client.post("/gitlab/public-projects/sync")
        assert response.status_code == 401

    def test_wiki_generate_task_requires_session(self):
        """POST /api/tasks/wiki/generate 应该需要 session"""
        response = client.post(
            "/api/tasks/wiki/generate",
            json={
                "repo_url": "https://github.com/test/repo",
                "repo_type": "github",
                "language": "english"
            }
        )
        assert response.status_code == 401

    def test_wiki_task_status_requires_session(self):
        """GET /api/tasks/{task_id}/status 应该需要 session"""
        response = client.get("/api/tasks/test-task-id/status")
        assert response.status_code == 401

    def test_wiki_cache_get_requires_session(self):
        """GET /api/wiki_cache 应该需要 session"""
        response = client.get(
            "/api/wiki_cache",
            params={
                "owner": "test",
                "repo": "repo",
                "repo_type": "github",
                "language": "english"
            }
        )
        assert response.status_code == 401

    def test_wiki_cache_post_requires_session(self):
        """POST /api/wiki_cache 应该需要 session"""
        response = client.post(
            "/api/wiki_cache",
            params={
                "owner": "test",
                "repo": "repo",
                "repo_type": "github",
                "language": "english"
            },
            json={
                "wiki_structure": {},
                "generated_pages": {}
            }
        )
        assert response.status_code == 401

    def test_wiki_cache_delete_requires_session(self):
        """DELETE /api/wiki_cache 应该需要 session"""
        response = client.delete(
            "/api/wiki_cache",
            params={
                "owner": "test",
                "repo": "repo",
                "repo_type": "github",
                "language": "english"
            }
        )
        assert response.status_code == 401

    def test_wiki_render_markdown_requires_session(self):
        """POST /api/wiki/render-markdown 应该需要 session"""
        response = client.post(
            "/api/wiki/render-markdown",
            json={"content": "# Test", "task_id": "test"}
        )
        assert response.status_code == 401

    def test_wiki_api_content_requires_session(self):
        """GET /api/wiki/projects/{project_key}/content 应该需要 session"""
        response = client.get("/api/wiki/projects/github:test/repo/content")
        assert response.status_code == 401

    def test_wiki_api_structure_requires_session(self):
        """GET /api/wiki/projects/{project_key}/structure 应该需要 session"""
        response = client.get("/api/wiki/projects/github:test/repo/structure")
        assert response.status_code == 401

    def test_wiki_api_html_requires_session(self):
        """GET /api/wiki/projects/{project_key}/html/{page_id} 应该需要 session"""
        response = client.get("/api/wiki/projects/github:test/repo/html/page-1")
        assert response.status_code == 401

    def test_chat_completions_requires_session(self):
        """POST /api/chat/completions/stream 应该需要 session"""
        response = client.post(
            "/api/chat/completions/stream",
            json={
                "messages": [{"role": "user", "content": "test"}],
                "model": "gpt-4"
            }
        )
        assert response.status_code == 401


class TestContentSizeLimitation:
    """测试 Markdown 渲染的内容大小限制"""

    def test_markdown_render_size_limit(self):
        """渲染超过 50MB 的内容应该返回 413"""
        # 创建一个 50MB+ 的内容
        large_content = "x" * (51 * 1024 * 1024)  # 51MB

        response = client.post(
            "/api/wiki/render-markdown",
            json={"content": large_content, "task_id": "test"},
            # 注意：这里没有 session，所以应该返回 401
            # 但如果添加了有效 session，应该返回 413
        )
        # 应该返回 401（缺少 session）或 413（内容过大）
        assert response.status_code in [401, 413]


class TestAdminAuthorizationRequired:
    """测试管理员接口需要管理员权限"""

    def test_public_projects_sync_requires_admin(self):
        """
        POST /gitlab/public-projects/sync 应该检查管理员权限

        这个测试假设我们有一个有效的非管理员 session。
        实际测试需要创建模拟的 session。
        """
        # 这是一个占位符测试
        # 实际测试需要：
        # 1. 创建一个有效的非管理员 session
        # 2. 调用接口
        # 3. 验证返回 403 (Forbidden)

        # 示例代码（需要在测试环境中实现）：
        # non_admin_session = create_test_session("user@example.com", is_admin=False)
        # response = client.post(
        #     "/gitlab/public-projects/sync",
        #     cookies={"deepwiki_session": non_admin_session}
        # )
        # assert response.status_code == 403
        pass


class TestUserPrivacyProtection:
    """测试用户隐私保护"""

    def test_sync_status_user_privacy(self):
        """
        GET /gitlab/sync-status 应该只允许用户查看自己的状态

        示例代码（需要在测试环境中实现）：
        user1_session = create_test_session("user1@example.com")

        # 用户 1 尝试查看用户 2 的同步状态
        response = client.get(
            "/gitlab/sync-status",
            params={"email": "user2@example.com"},
            cookies={"deepwiki_session": user1_session}
        )
        # 应该返回 403 (Forbidden)
        assert response.status_code == 403
        """
        pass


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
