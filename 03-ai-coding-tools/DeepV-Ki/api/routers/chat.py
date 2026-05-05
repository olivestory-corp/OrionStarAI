"""
Chat 和 RAG 相关的路由
代理 simple_chat.py 中的聊天完成端点
"""

import logging
from fastapi import APIRouter, HTTPException, Body
from typing import Any

logger = logging.getLogger(__name__)

router = APIRouter(prefix="", tags=["Chat"])


@router.post("/api/chat/completions/stream")
async def chat_completions_stream_proxy(request: dict = Body(...)):
    """
    代理 simple_chat 的聊天完成流端点

    这个端点将请求转发到 simple_chat.py 的实现
    """
    try:
        # 动态导入 simple_chat 中的实现
        from api.simple_chat import chat_completions_stream as simple_chat_handler
        from api.simple_chat import ChatCompletionRequest

        # 将字典转换为 ChatCompletionRequest 对象
        chat_request = ChatCompletionRequest(**request)

        # 调用原始处理函数
        return await simple_chat_handler(chat_request)

    except Exception as e:
        logger.error(f"❌ Chat completions 错误: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))