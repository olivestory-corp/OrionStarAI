"""
配置路由
"""

import logging
from fastapi import APIRouter
from api.services.config_service import ConfigService
from api.models.config import ModelConfig, AuthorizationConfig
# from api.sso_client import validate_sso_token

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["Config"])


@router.get("/lang/config")
async def get_language_config():
    """获取语言配置"""
    # TODO: 从配置文件加载语言列表
    return {
        "languages": [
            {"code": "en", "name": "English"},
            {"code": "zh", "name": "中文"},
            {"code": "es", "name": "Español"},
            {"code": "fr", "name": "Français"},
            {"code": "de", "name": "Deutsch"},
            {"code": "ja", "name": "日本語"},
            {"code": "ko", "name": "한국어"},
            {"code": "pt", "name": "Português"},
            {"code": "ru", "name": "Русский"},
            {"code": "ar", "name": "العربية"},
        ]
    }


@router.get("/auth/status")
async def get_auth_status():
    """
    获取认证状态

    Returns:
        {
            "is_authorized": bool,
            "user_info": {}
        }
    """
    # TODO: 从会话获取认证状态
    return AuthorizationConfig(is_authorized=False, user_info={})


@router.post("/auth/validate")
async def validate_auth(token: str):
    """
    验证认证令牌 (Deprecated for OIDC)

    Args:
        token: 认证令牌

    Returns:
        验证结果
    """
    return {
        "valid": False,
        "error": "This endpoint is deprecated. Please use OIDC authentication."
    }
    # try:
    #     result = validate_sso_token(token)
    #     return {
    #         "valid": result is not None,
    #         "user": result
    #     }
    # except Exception as e:
    #     logger.error(f"❌ 令牌验证失败: {str(e)}")
    #     return {
    #         "valid": False,
    #         "error": str(e)
    #     }


@router.get("/models/config", response_model=ModelConfig)
async def get_models_config():
    """
    获取 AI 模型配置

    Returns:
        ModelConfig 对象，包含所有可用的 AI 提供商和模型
    """
    try:
        config = ConfigService.get_model_config()
        return config
    except Exception as e:
        logger.error(f"❌ 获取模型配置失败: {str(e)}", exc_info=True)
        return ModelConfig(
            default_provider="google",
            default_model_name="gemini-2.5-flash",
            providers=[]
        )
