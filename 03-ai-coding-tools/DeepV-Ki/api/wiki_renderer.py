"""
Wiki 渲染器
将 Wiki JSON 结构渲染为 HTML
"""

import markdown
import re
from typing import Dict, List, Optional
import logging

logger = logging.getLogger(__name__)


class WikiRenderer:
    """Wiki HTML 渲染器"""

    def __init__(self):
        """初始化 Markdown 渲染器"""
        # 配置 Markdown 扩展
        self.md = markdown.Markdown(
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

    def render_page(self, page: Dict) -> str:
        """
        渲染单个页面

        Args:
            page: 页面数据 {title, content, ...}

        Returns:
            渲染后的 HTML
        """
        try:
            markdown_content = page.get('content', '')

            if not markdown_content:
                return '<p>页面内容为空</p>'

            # Markdown → HTML
            self.md.reset()  # 重置状态
            html_content = self.md.convert(markdown_content)

            # 处理 Mermaid 图表
            html_content = self._process_mermaid(html_content)

            return html_content

        except Exception as e:
            logger.error(f'渲染页面失败: {e}', exc_info=True)
            return f'<p class="error">渲染失败: {str(e)}</p>'

    def _process_mermaid(self, html: str) -> str:
        """
        处理 Mermaid 代码块

        检测代码块中的 mermaid 语法并转换为 <div class="mermaid">
        """
        try:
            # Mermaid 常见关键字
            mermaid_keywords = [
                'graph TD', 'graph LR', 'graph TB', 'graph BT', 'graph RL',
                'sequenceDiagram', 'classDiagram', 'stateDiagram',
                'erDiagram', 'journey', 'gantt', 'pie', 'flowchart'
            ]

            # 匹配代码块：<div class="highlight"><pre>...</pre></div>
            pattern = r'<div class="highlight"><pre><span></span><code>(.*?)</code></pre></div>'

            def check_and_replace(match):
                code_content = match.group(1)

                # 先解码 HTML 并移除 span 标签以便检查关键字
                import html as html_module
                clean_content = html_module.unescape(code_content)
                clean_content = re.sub(r'<span[^>]*>(.*?)</span>', r'\1', clean_content, flags=re.DOTALL)
                clean_content = clean_content.strip()

                # 检查是否包含 mermaid 关键字
                for keyword in mermaid_keywords:
                    if keyword in clean_content:
                        # 是 mermaid 代码，转换
                        return f'<div class="mermaid">{clean_content}</div>'

                # 不是 mermaid，保持原样
                return match.group(0)

            html = re.sub(pattern, check_and_replace, html, flags=re.DOTALL)

            return html

        except Exception as e:
            logger.warning(f'处理 Mermaid 图表时出错: {e}')
            return html

    def render_wiki_structure(self, wiki_structure: Dict) -> Dict[str, Dict]:
        """
        渲染整个 Wiki 结构

        Args:
            wiki_structure: Wiki 结构 JSON

        Returns:
            {
                page_id: {
                    'title': 'xxx',
                    'html': 'xxx',
                    'importance': 'high'
                }
            }
        """
        rendered_pages = {}

        try:
            pages = wiki_structure.get('pages', [])

            for page in pages:
                page_id = page.get('id', '')

                if not page_id:
                    logger.warning('跳过没有 ID 的页面')
                    continue

                try:
                    html_content = self.render_page(page)

                    rendered_pages[page_id] = {
                        'title': page.get('title', ''),
                        'html': html_content,
                        'importance': page.get('importance', 'medium'),
                        'file_paths': page.get('filePaths', [])
                    }

                except Exception as e:
                    logger.error(f'渲染页面 {page_id} 失败: {e}')
                    rendered_pages[page_id] = {
                        'title': page.get('title', ''),
                        'html': f'<p class="error">渲染失败: {str(e)}</p>',
                        'importance': 'low',
                        'file_paths': []
                    }

            logger.info(f'✅ 成功渲染 {len(rendered_pages)} 个页面')
            return rendered_pages

        except Exception as e:
            logger.error(f'渲染 Wiki 结构失败: {e}', exc_info=True)
            return {}


# 单例模式
_renderer_instance: Optional[WikiRenderer] = None


def get_wiki_renderer() -> WikiRenderer:
    """获取 Wiki 渲染器实例（单例）"""
    global _renderer_instance

    if _renderer_instance is None:
        _renderer_instance = WikiRenderer()

    return _renderer_instance
