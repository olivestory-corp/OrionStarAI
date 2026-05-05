"""
Pytest 配置和共享的 fixtures
"""

import os
import sys
import pytest
from pathlib import Path

# 添加项目根目录到路径
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

os.environ["TESTING"] = "true"


@pytest.fixture
def test_env():
    """提供测试环境变量"""
    env = {
        "PORT": "8001",
        "SERVER_BASE_URL": "http://localhost:8001",
        "PYTHON_BACKEND_HOST": "http://localhost:8001",
        "LOG_LEVEL": "DEBUG",
    }
    return env


@pytest.fixture
def mock_config():
    """提供模拟的配置对象"""
    return {
        "default_provider": "google",
        "default_model_name": "gemini-2.5-flash",
        "providers": {
            "google": {
                "client_class": "GoogleGenAIClient",
                "default_model": "gemini-2.5-flash",
                "models": {
                    "gemini-2.5-flash": {"temperature": 0.7, "top_p": 0.95}
                }
            }
        }
    }
