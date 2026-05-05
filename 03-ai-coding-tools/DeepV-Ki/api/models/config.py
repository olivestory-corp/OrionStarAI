"""
配置相关的数据模型
"""

from typing import List, Dict, Any
from pydantic import BaseModel


class Model(BaseModel):
    """模型信息"""
    id: str
    name: str


class Provider(BaseModel):
    """AI 提供商"""
    id: str
    name: str
    models: List[Model]
    supportsCustomModel: bool = False


class ModelConfig(BaseModel):
    """模型配置"""
    default_provider: str
    default_model_name: str
    providers: List[Provider]


class AuthorizationConfig(BaseModel):
    """授权配置"""
    is_authorized: bool
    user_info: Dict[str, Any] = {}
