"""
Mermaid 图表 SVG 预渲染器

支持两种渲染方式：
1. mermaid.ink API（优先，快速）
2. Playwright 本地渲染（降级，完全离线）

Author: Haifeng Kong
Email: konghaifeng@gmail.com
"""

import base64
import hashlib
import logging
import os
from pathlib import Path
from typing import Optional, Tuple
import urllib.parse

import requests

logger = logging.getLogger(__name__)

# SVG 缓存目录
CACHE_DIR = Path(__file__).parent.parent / 'cache' / 'mermaid_svg'
CACHE_DIR.mkdir(parents=True, exist_ok=True)

# mermaid.ink API 配置
MERMAID_INK_URL = 'https://mermaid.ink/svg/'
REQUEST_TIMEOUT = 10  # 秒

# Playwright 实例（延迟初始化）
_playwright_browser = None
_playwright_page = None


def _get_cache_path(mermaid_code: str) -> Path:
    """
    根据 mermaid 代码生成缓存文件路径

    Args:
        mermaid_code: Mermaid 图表代码

    Returns:
        缓存文件路径
    """
    # 使用代码的 MD5 哈希作为文件名
    code_hash = hashlib.md5(mermaid_code.encode('utf-8')).hexdigest()
    return CACHE_DIR / f'{code_hash}.svg'


def _load_from_cache(mermaid_code: str) -> Optional[str]:
    """
    从缓存加载 SVG

    Args:
        mermaid_code: Mermaid 图表代码

    Returns:
        SVG 字符串，如果缓存不存在则返回 None
    """
    cache_path = _get_cache_path(mermaid_code)
    if cache_path.exists():
        try:
            svg_content = cache_path.read_text(encoding='utf-8')
            logger.debug(f'✅ 从缓存加载 SVG: {cache_path.name}')
            return svg_content
        except Exception as e:
            logger.warning(f'⚠️ 缓存文件读取失败: {e}')
            return None
    return None


def _save_to_cache(mermaid_code: str, svg_content: str) -> None:
    """
    保存 SVG 到缓存

    Args:
        mermaid_code: Mermaid 图表代码
        svg_content: SVG 内容
    """
    cache_path = _get_cache_path(mermaid_code)
    try:
        cache_path.write_text(svg_content, encoding='utf-8')
        logger.debug(f'✅ SVG 已缓存: {cache_path.name}')
    except Exception as e:
        logger.warning(f'⚠️ SVG 缓存失败: {e}')


def _render_via_mermaid_ink(mermaid_code: str) -> Optional[str]:
    """
    通过 mermaid.ink API 渲染 SVG

    Args:
        mermaid_code: Mermaid 图表代码

    Returns:
        SVG 字符串，失败返回 None
    """
    try:
        # 编码 mermaid 代码为 base64
        encoded = base64.b64encode(mermaid_code.encode('utf-8')).decode('utf-8')
        # URL 编码
        encoded = urllib.parse.quote(encoded)

        url = f'{MERMAID_INK_URL}{encoded}'

        logger.info(f'📡 调用 mermaid.ink API...')
        response = requests.get(url, timeout=REQUEST_TIMEOUT)

        if response.status_code == 200:
            svg_content = response.text
            logger.info(f'✅ mermaid.ink API 渲染成功 ({len(svg_content)} 字节)')
            return svg_content
        else:
            logger.warning(f'⚠️ mermaid.ink API 返回错误: {response.status_code}')
            return None

    except requests.exceptions.Timeout:
        logger.warning(f'⚠️ mermaid.ink API 超时')
        return None
    except Exception as e:
        logger.warning(f'⚠️ mermaid.ink API 调用失败: {e}')
        return None


def _init_playwright():
    """
    初始化 Playwright 浏览器实例（延迟初始化）

    Returns:
        (browser, page) 元组，失败返回 (None, None)
    """
    global _playwright_browser, _playwright_page

    if _playwright_browser is not None and _playwright_page is not None:
        return _playwright_browser, _playwright_page

    try:
        from playwright.sync_api import sync_playwright

        logger.info('🎭 初始化 Playwright...')
        playwright = sync_playwright().start()
        _playwright_browser = playwright.chromium.launch(headless=True)
        _playwright_page = _playwright_browser.new_page()

        # 预加载 mermaid.js
        _playwright_page.goto('about:blank')
        _playwright_page.add_script_tag(url='https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js')

        logger.info('✅ Playwright 初始化成功')
        return _playwright_browser, _playwright_page

    except ImportError:
        logger.warning('⚠️ Playwright 模块未安装')
        return None, None
    except Exception as e:
        logger.warning(f'⚠️ Playwright 初始化失败: {type(e).__name__}: {str(e)[:100]}')
        return None, None


def _render_via_playwright(mermaid_code: str) -> Optional[str]:
    """
    通过 Playwright 本地渲染 SVG

    Args:
        mermaid_code: Mermaid 图表代码

    Returns:
        SVG 字符串，失败返回 None
    """
    browser, page = _init_playwright()

    if browser is None or page is None:
        return None

    try:
        logger.info('🎭 使用 Playwright 本地渲染...')

        # 转义 mermaid 代码中的反引号（在 f-string 外部处理）
        escaped_mermaid_code = mermaid_code.replace('`', r'\`')

        # 注入 mermaid 代码并渲染
        html_template = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
        </head>
        <body>
            <div id="mermaid-output"></div>
            <script>
                mermaid.initialize({{ startOnLoad: false, theme: 'neutral' }});
                (async () => {{
                    try {{
                        const mermaidCode = `{escaped_mermaid_code}`;
                        const {{ svg }} = await mermaid.render('mermaid-svg', mermaidCode);
                        document.getElementById('mermaid-output').innerHTML = svg;
                    }} catch (err) {{
                        console.error('Mermaid render error:', err);
                    }}
                }})();
            </script>
        </body>
        </html>
        """

        page.set_content(html_template)
        page.wait_for_timeout(1000)  # 等待渲染完成

        # 提取 SVG
        svg_content = page.evaluate("document.querySelector('#mermaid-output svg')?.outerHTML")

        if svg_content:
            logger.info(f'✅ Playwright 渲染成功 ({len(svg_content)} 字节)')
            return svg_content
        else:
            logger.warning('⚠️ Playwright 渲染失败：未找到 SVG 元素')
            return None

    except Exception as e:
        logger.error(f'❌ Playwright 渲染失败: {e}', exc_info=True)
        return None


def render_mermaid_to_svg(mermaid_code: str, use_cache: bool = True) -> Tuple[Optional[str], str]:
    """
    渲染 Mermaid 图表为 SVG

    混合方案：
    1. 首先尝试从缓存加载
    2. 尝试 mermaid.ink API（快速）
    3. 降级到 Playwright 本地渲染（可靠）
    4. 所有方法失败则返回错误

    Args:
        mermaid_code: Mermaid 图表代码
        use_cache: 是否使用缓存（默认 True）

    Returns:
        (svg_content, method) 元组
        - svg_content: SVG 字符串，失败返回 None
        - method: 渲染方法 ('cache' | 'api' | 'playwright' | 'failed')
    """
    if not mermaid_code or not mermaid_code.strip():
        logger.warning('⚠️ Mermaid 代码为空')
        return None, 'failed'

    # 1. 尝试从缓存加载
    if use_cache:
        svg_content = _load_from_cache(mermaid_code)
        if svg_content:
            return svg_content, 'cache'

    # 2. 尝试 mermaid.ink API
    svg_content = _render_via_mermaid_ink(mermaid_code)
    if svg_content:
        _save_to_cache(mermaid_code, svg_content)
        return svg_content, 'api'

    # 3. 降级到 Playwright 本地渲染
    svg_content = _render_via_playwright(mermaid_code)
    if svg_content:
        _save_to_cache(mermaid_code, svg_content)
        return svg_content, 'playwright'

    # 4. 所有方法都失败
    logger.error('❌ 所有 Mermaid 渲染方法都失败')
    return None, 'failed'


def cleanup_playwright():
    """
    清理 Playwright 资源
    """
    global _playwright_browser, _playwright_page

    if _playwright_browser:
        try:
            _playwright_browser.close()
            logger.info('✅ Playwright 浏览器已关闭')
        except Exception as e:
            logger.warning(f'⚠️ Playwright 清理失败: {e}')
        finally:
            _playwright_browser = None
            _playwright_page = None


# 注册清理函数（进程退出时自动调用）
import atexit
atexit.register(cleanup_playwright)

