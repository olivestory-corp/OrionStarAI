"""
在应用启动时自动初始化和检查 Playwright
"""

import subprocess
import sys
import os
from pathlib import Path

def ensure_playwright_installed():
    """
    检查 Playwright 浏览器是否已安装，如果未安装则自动安装
    """
    try:
        # 检查 Playwright 是否已安装
        from playwright.sync_api import sync_playwright

        # 尝试启动浏览器来验证安装
        with sync_playwright() as p:
            browser = p.chromium.launch()
            browser.close()

        print("✅ Playwright Chromium 已安装并可用")
        return True
    except ImportError:
        print("❌ Playwright 未安装")
        print("   请运行：pip install playwright")
        return False
    except Exception as e:
        # 浏览器未安装或其他错误
        print(f"⚠️  Playwright Chromium 未找到：{str(e)[:100]}")
        print("📦 尝试自动安装 Chromium...")

        try:
            result = subprocess.run(
                [sys.executable, "-m", "playwright", "install", "chromium"],
                capture_output=True,
                text=True,
                timeout=300  # 30 分钟超时
            )

            if result.returncode == 0:
                print("✅ Playwright Chromium 安装成功！")
                return True
            else:
                print(f"❌ Playwright Chromium 安装失败")
                print(f"   错误：{result.stderr}")
                print("   请手动运行：python -m playwright install chromium")
                return False
        except subprocess.TimeoutExpired:
            print("⏱️  Chromium 安装超时（超过 30 分钟）")
            print("   请手动运行：python -m playwright install chromium")
            return False
        except Exception as install_error:
            print(f"❌ 安装失败：{install_error}")
            print("   请手动运行：python -m playwright install chromium")
            return False

if __name__ == "__main__":
    success = ensure_playwright_installed()
    sys.exit(0 if success else 1)
