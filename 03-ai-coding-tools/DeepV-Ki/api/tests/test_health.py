"""
测试健康检查端点
"""

import pytest
from fastapi.testclient import TestClient
from api.api import app


class TestHealthEndpoint:
    """测试健康检查端点"""

    @pytest.fixture
    def client(self):
        """创建测试客户端"""
        return TestClient(app)

    def test_health_check_endpoint(self, client):
        """测试 /health 端点"""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert data["status"] == "ok"

    def test_health_check_response_structure(self, client):
        """测试健康检查响应结构"""
        response = client.get("/health")
        data = response.json()

        # 检查响应包含必要字段
        assert "status" in data
        assert "timestamp" in data or "version" in data

    def test_concurrent_health_checks(self, client):
        """测试并发健康检查"""
        responses = []
        for _ in range(5):
            response = client.get("/health")
            responses.append(response)

        # 所有请求都应该成功
        assert all(r.status_code == 200 for r in responses)
        assert all(r.json()["status"] == "ok" for r in responses)
