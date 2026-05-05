"""
配置业务逻辑层
"""

import logging
import json
from pathlib import Path
from typing import Dict, Any, List
from api.models.config import ModelConfig, Provider, Model

logger = logging.getLogger(__name__)


class ConfigService:
    """
    配置服务

    负责：
    - 加载和管理 AI 提供商配置
    - 提供模型列表
    - 验证配置
    """

    _config_cache: Dict[str, Any] = {}

    @staticmethod
    def load_generator_config() -> Dict[str, Any]:
        """
        加载 AI 提供商配置

        Returns:
            提供商配置字典
        """
        if 'generator' in ConfigService._config_cache:
            return ConfigService._config_cache['generator']

        try:
            config_path = Path(__file__).parent.parent / 'config' / 'generator.json'
            with open(config_path, 'r', encoding='utf-8') as f:
                config = json.load(f)

            ConfigService._config_cache['generator'] = config
            logger.info(f"✅ 加载 generator 配置成功")
            return config

        except Exception as e:
            logger.error(f"❌ 加载 generator 配置失败: {str(e)}", exc_info=True)
            return {}

    @staticmethod
    def get_model_config() -> ModelConfig:
        """
        获取模型配置（转换为 ModelConfig 对象）

        Returns:
            ModelConfig 对象
        """
        config = ConfigService.load_generator_config()

        if not config:
            # 返回默认配置
            return ModelConfig(
                default_provider="google",
                default_model_name="gemini-2.5-flash",
                providers=[]
            )

        default_provider = config.get('default_provider', 'google')
        default_model = config.get('default_model_name', 'gemini-2.5-flash')

        # 转换提供商列表
        providers_data = config.get('providers', {})
        providers = []

        for provider_id, provider_config in providers_data.items():
            models = []
            for model_id, model_config in provider_config.get('models', {}).items():
                models.append(Model(id=model_id, name=model_id))

            providers.append(Provider(
                id=provider_id,
                name=provider_config.get('name', provider_id.capitalize()),  # Use 'name' from config or capitalize ID
                models=models,
                supportsCustomModel=provider_config.get('supportsCustomModel', False)
            ))

        return ModelConfig(
            default_provider=default_provider,
            default_model_name=default_model,
            providers=providers
        )

    @staticmethod
    def get_available_providers() -> List[str]:
        """
        获取可用的 AI 提供商列表

        Returns:
            提供商 ID 列表
        """
        config = ConfigService.load_generator_config()
        return list(config.get('providers', {}).keys())

    @staticmethod
    def get_models_for_provider(provider_id: str) -> List[str]:
        """
        获取指定提供商的模型列表

        Args:
            provider_id: 提供商 ID

        Returns:
            模型 ID 列表
        """
        config = ConfigService.load_generator_config()
        providers = config.get('providers', {})

        if provider_id not in providers:
            logger.warning(f"⚠️ 提供商 {provider_id} 不存在")
            return []

        provider_config = providers[provider_id]
        return list(provider_config.get('models', {}).keys())

    @staticmethod
    def clear_cache() -> None:
        """清除配置缓存"""
        ConfigService._config_cache.clear()
        logger.info("✅ 配置缓存已清除")
