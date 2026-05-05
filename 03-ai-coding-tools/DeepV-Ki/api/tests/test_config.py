"""
测试配置加载
"""

import pytest
import json
from pathlib import Path
from api.config import Config


class TestConfigLoading:
    """测试配置加载"""

    def test_config_initialization(self):
        """测试配置初始化"""
        config = Config()
        assert config is not None
        # Config 应该有 get 方法
        assert hasattr(config, "get")

    def test_config_get_method(self):
        """测试 config.get() 方法"""
        config = Config()
        # 测试获取已存在的配置
        value = config.get("default_provider")
        # 如果配置存在，应该不为 None
        if value is not None:
            assert isinstance(value, str)

    def test_config_file_existence(self):
        """测试配置文件存在"""
        config_dir = Path(__file__).parent.parent / "config"
        required_configs = ["generator.json", "embedder.json", "repo.json", "lang.json"]

        for config_file in required_configs:
            config_path = config_dir / config_file
            assert config_path.exists(), f"配置文件不存在: {config_file}"

    def test_generator_config_structure(self):
        """测试 generator.json 结构"""
        config_path = Path(__file__).parent.parent / "config" / "generator.json"
        with open(config_path, "r") as f:
            config = json.load(f)

        # 检查必要的字段
        assert "default_provider" in config
        assert "providers" in config
        assert isinstance(config["providers"], dict)

    def test_embedder_config_structure(self):
        """测试 embedder.json 结构"""
        config_path = Path(__file__).parent.parent / "config" / "embedder.json"
        with open(config_path, "r") as f:
            config = json.load(f)

        # 检查必要的字段
        assert "embedder" in config or "embedding_model" in config

    def test_repo_config_structure(self):
        """测试 repo.json 结构"""
        config_path = Path(__file__).parent.parent / "config" / "repo.json"
        with open(config_path, "r") as f:
            config = json.load(f)

        # 检查必要的字段
        assert "inclusion" in config or "rules" in config

    def test_lang_config_structure(self):
        """测试 lang.json 结构"""
        config_path = Path(__file__).parent.parent / "config" / "lang.json"
        with open(config_path, "r") as f:
            config = json.load(f)

        # 检查必要的字段
        assert "supported_languages" in config or "languages" in config
