"""
Wiki 渲染路由
将 Markdown 内容渲染为 HTML（包含 Mermaid SVG）
"""

from typing import Optional
from fastapi import APIRouter, HTTPException, Cookie
from pydantic import BaseModel
import markdown
import logging

from api.mermaid_adapter import render_mermaid_in_markdown
from api.user_manager import user_manager
from api.audit_logger import audit_logger

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/wiki", tags=["wiki"])

# 最大内容大小限制：10MB
MAX_CONTENT_SIZE = 10 * 1024 * 1024


class RenderMarkdownRequest(BaseModel):
    """Markdown 渲染请求"""
    content: str
    task_id: str = "unknown"


class RenderMarkdownResponse(BaseModel):
    """Markdown 渲染响应"""
    html: str
    success: bool
    error: str = ""


@router.post("/render-markdown")
async def render_markdown(
    request: RenderMarkdownRequest,
    deepwiki_session: Optional[str] = Cookie(None, description="SSO session ID")
) -> RenderMarkdownResponse:
    """
    将 Markdown 内容渲染为 HTML（包含 Mermaid SVG）

    **Security:** Requires valid session. Content size is limited to 10MB to prevent DoS.

    Args:
        request: 包含 Markdown 内容的请求
        deepwiki_session: Session ID

    Returns:
        渲染后的 HTML 内容
    """
    try:
        # ========== 认证检查 ==========
        if not deepwiki_session:
            audit_logger.log_unauthorized_access_attempt(
                user_email=None,
                endpoint="/api/wiki/render-markdown",
                reason="Missing session cookie"
            )
            raise HTTPException(
                status_code=401,
                detail="Authentication required. Please login first."
            )

        session = user_manager.get_session(deepwiki_session)
        if not session:
            audit_logger.log_unauthorized_access_attempt(
                user_email=None,
                endpoint="/api/wiki/render-markdown",
                reason="Invalid or expired session"
            )
            raise HTTPException(
                status_code=401,
                detail="Session expired. Please login again."
            )

        user_email = session.user_info.uid or session.user_info.username
        audit_logger.log_session_validation(user_email, deepwiki_session, True)

        # ========== 大小限制检查 ==========
        content_size = len(request.content) if request.content else 0
        logger.info(f"[{request.task_id}] 📍 收到 render-markdown 请求 | 内容大小={content_size} 字节 (user: {user_email})")

        if content_size > MAX_CONTENT_SIZE:
            logger.warning(
                f"[{request.task_id}] ⚠️ Content exceeds max size: {content_size} > {MAX_CONTENT_SIZE} bytes"
            )
            raise HTTPException(
                status_code=413,
                detail=f"Content too large. Maximum size is {MAX_CONTENT_SIZE / (1024 * 1024):.0f}MB."
            )

        if not request.content:
            return RenderMarkdownResponse(
                html="",
                success=True,
                error=None
            )

        content = request.content

        # 步骤1：渲染 Mermaid 图表为 SVG
        logger.info(f"[{request.task_id}] 开始 Mermaid 渲染...")
        content = render_mermaid_in_markdown(content, task_id=request.task_id)
        logger.info(f"[{request.task_id}] ✅ Mermaid 渲染完成")

        # 步骤2：将 Markdown 转换为 HTML
        logger.info(f"[{request.task_id}] 开始 Markdown 转 HTML...")
        md = markdown.Markdown(
            extensions=[
                'fenced_code',      # 代码块
                'tables',           # 表格
                'toc',              # 目录
                'codehilite',       # 语法高亮
                'extra',            # 额外功能
            ],
            extension_configs={
                'codehilite': {
                    'css_class': 'highlight',
                    'linenums': False,
                }
            }
        )
        html = md.convert(content)
        logger.info(f"[{request.task_id}] ✅ Markdown 转 HTML 完成，HTML 大小: {len(html)} 字节")

        return RenderMarkdownResponse(
            html=html,
            success=True,
            error=""
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[{request.task_id}] ❌ 渲染失败: {str(e)}", exc_info=True)
        return RenderMarkdownResponse(
            html="",
            success=False,
            error=str(e)
        )
