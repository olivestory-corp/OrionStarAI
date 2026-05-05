"""
DeepV-Ki API 主应用程序

该文件作为应用程序入口点，使用分层架构组织代码。
所有的业务逻辑、服务和路由已分离到不同的模块中。

架构：
  - api/models/    → 数据模型（Pydantic）
  - api/services/  → 业务逻辑层
  - api/routers/   → API 路由层
  - api/app_factory.py → 应用工厂
"""

import logging
from api.app_factory import create_app
from api.logging_config import setup_logging

# 配置日志
setup_logging()
logger = logging.getLogger(__name__)

# 创建应用
app = create_app(enable_sso=False, enable_gitlab=True, enable_gitlab_oauth=True)

logger.info("✅ DeepV-Ki API 应用已初始化 (使用分层架构)")
logger.info("📊 API 文档地址: http://localhost:8001/docs")