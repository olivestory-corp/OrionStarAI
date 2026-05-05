"""
Mermaid Diagram Adapter

Adapts Mermaid diagram syntax for different AI providers.
Some providers may have specific requirements for rendering Mermaid diagrams.
"""

import re
import logging
from typing import Optional, Tuple

logger = logging.getLogger(__name__)


def adapt_mermaid_diagrams(content: str, provider: str = "google", auto_fix: bool = True) -> str:
    """
    Adapt Mermaid diagrams in content for specific providers.

    Args:
        content: The markdown content containing potential Mermaid diagrams
        provider: The AI provider name (e.g., "google", "openai", "anthropic")
        auto_fix: Whether to automatically fix common Mermaid issues (deprecated, kept for compatibility)

    Returns:
        Adapted content with Mermaid diagrams formatted for the provider
    """
    if not content:
        return content

    logger.debug(f"Processing Mermaid diagrams for provider: {provider}")

    # Provider-specific adaptations
    if provider == "google":
        # Google Gemini 特定适配
        pass
    elif provider == "openai":
        # OpenAI 特定适配
        pass

    return content


def is_mermaid_diagram(code_block: str) -> bool:
    """
    Check if a code block contains Mermaid diagram syntax.

    Args:
        code_block: The code block content

    Returns:
        True if the code block appears to be a Mermaid diagram
    """
    mermaid_keywords = [
        'graph TD', 'graph LR', 'graph TB', 'graph BT', 'graph RL',
        'sequenceDiagram', 'classDiagram', 'stateDiagram',
        'erDiagram', 'journey', 'gantt', 'pie', 'flowchart'
    ]

    return any(keyword in code_block for keyword in mermaid_keywords)


def extract_mermaid_code(html_content: str) -> list:
    """
    Extract Mermaid code from HTML content.

    Args:
        html_content: HTML content potentially containing Mermaid diagrams

    Returns:
        List of Mermaid diagram code strings
    """
    pattern = r'<div class="highlight"><pre><span></span><code>(.*?)</code></pre></div>'
    matches = re.findall(pattern, html_content, re.DOTALL)

    mermaid_codes = []
    for match in matches:
        if is_mermaid_diagram(match):
            # Clean HTML entities
            import html
            cleaned_code = html.unescape(match)
            # Remove HTML tags
            cleaned_code = re.sub(r'<[^>]+>', '', cleaned_code)
            mermaid_codes.append(cleaned_code)

    return mermaid_codes


def adapt_mermaid_content(content: str, provider: str = "google") -> tuple:
    """
    Adapt Mermaid content for WebSocket streaming.

    This is a compatibility wrapper for websocket_wiki.py.
    Since auto-fixing has been removed, this function now just returns the content as-is.

    Args:
        content: The content to process
        provider: The AI provider name

    Returns:
        Tuple of (adapted_content, fixes_list)
        - adapted_content: The processed content (unchanged in current implementation)
        - fixes_list: List of fixes applied (empty in current implementation)
    """
    # 不再进行自动修复，直接返回原内容
    return content, []


def render_mermaid_in_markdown(content: str, task_id: str = "unknown") -> str:
    """
    将 Markdown 中的 Mermaid 代码块渲染成 SVG 并嵌入 HTML。

    这个函数会：
    1. 找到所有 ```mermaid ... ``` 代码块
    2. 使用 mermaid_renderer 将其渲染成 SVG
    3. 用内嵌的 SVG 替换原始代码块

    Args:
        content: Markdown 内容
        task_id: 任务 ID（用于日志）

    Returns:
        渲染后的内容，Mermaid 代码块被替换为 SVG
    """
    logger.info(f"[{task_id}] ===== 开始 Mermaid 渲染流程 =====")

    if not content:
        logger.warning(f"[{task_id}] 内容为空，跳过")
        return content

    try:
        from api.mermaid_renderer import render_mermaid_to_svg
        logger.info(f"[{task_id}] ✅ mermaid_renderer 已成功导入")
    except ImportError as e:
        logger.error(f"[{task_id}] ❌ 无法导入 mermaid_renderer: {e}")
        return content

    # 正则表达式匹配 ```mermaid ... ``` 代码块
    pattern = r'```mermaid\n(.*?)\n```'

    # 先检查有多少个代码块
    matches = list(re.finditer(pattern, content, flags=re.DOTALL))
    logger.info(f"[{task_id}] 🔍 扫描结果: 找到 {len(matches)} 个 Mermaid 代码块")

    if not matches:
        logger.info(f"[{task_id}] ⚠️  没有找到任何 Mermaid 代码块，直接返回原内容")
        return content

    success_count = 0
    failed_count = 0

    def replace_mermaid(match):
        nonlocal success_count, failed_count
        mermaid_code = match.group(1).strip()
        diagram_num = failed_count + success_count + 1

        if not mermaid_code:
            logger.warning(f"[{task_id}] 图表#{diagram_num}: 代码为空，跳过")
            failed_count += 1
            return match.group(0)

        try:
            code_preview = mermaid_code[:50] + "..." if len(mermaid_code) > 50 else mermaid_code
            logger.info(f"[{task_id}] 图表#{diagram_num}: 开始渲染 | 代码长度={len(mermaid_code)} | 预览={code_preview}")

            svg_content, method = render_mermaid_to_svg(mermaid_code, use_cache=True)

            if svg_content:
                logger.info(f"[{task_id}] 图表#{diagram_num}: ✅ 渲染成功! | 方法={method} | SVG大小={len(svg_content)}字节")
                success_count += 1
                return f'<div class="mermaid-diagram">\n{svg_content}\n</div>'
            else:
                logger.warning(f"[{task_id}] 图表#{diagram_num}: ❌ 渲染返回空，转换为代码块")
                failed_count += 1
                # 渲染失败，将 Mermaid 代码转换为代码块，以便前端可以显示代码本身
                return f'```mermaid\n{mermaid_code}\n```'

        except Exception as e:
            logger.error(f"[{task_id}] 图表#{diagram_num}: ❌ 渲染异常 | {type(e).__name__}: {str(e)[:100]}", exc_info=True)
            failed_count += 1
            # 渲染异常，将 Mermaid 代码转换为代码块
            return f'```mermaid\n{mermaid_code}\n```'

    # 替换所有 Mermaid 代码块
    result = re.sub(pattern, replace_mermaid, content, flags=re.DOTALL)

    logger.info(f"[{task_id}] ===== Mermaid 渲染完成 =====")
    logger.info(f"[{task_id}] 📊 统计: 总计={len(matches)} | 成功={success_count} | 失败={failed_count}")

    return result

