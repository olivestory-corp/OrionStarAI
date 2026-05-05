"""
Markdown 处理工具函数
"""
import re
import logging

logger = logging.getLogger(__name__)


def fix_markdown_code_fence_spacing(content: str, context: str = "unknown") -> str:
    """
    修复代码块与后续内容之间的分隔问题
    """
    if not content:
        return content

    # 匹配代码块结尾后直接跟随非空行的情况
    # 将 ```\n<非空格文本> 改为 ```\n\n<非空格文本>
    pattern = r'(```)\n(\S)'
    replacement = r'\1\n\n\2'

    result = re.sub(pattern, replacement, content)

    if result != content:
        logger.info(f"[Markdown修复/{context}] [代码块分隔] 已添加空行分隔")

    return result


def clean_markdown_code_fence(content: str, context: str = "unknown") -> str:
    """
    清理 AI 生成内容中可能包含的外层 markdown 代码块标记

    简单逻辑：无脑删除开头的 ```markdown 和结尾的 ```，失败就忽略
    """
    if not content:
        return content

    result = content.strip()

    try:
        # 删除开头的 ```markdown
        result = re.sub(r'^```markdown\s*\n?', '', result)
    except Exception as e:
        logger.debug(f"[Markdown清理/{context}] 删除开头失败: {e}")

    try:
        # 删除结尾的 ```
        result = re.sub(r'\n```\s*$', '', result, flags=re.DOTALL)
    except Exception as e:
        logger.debug(f"[Markdown清理/{context}] 删除结尾失败: {e}")

    return result.strip()