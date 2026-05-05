#!/usr/bin/env python3
"""
自动安装 Playwright 浏览器
在项目初始化时运行
"""

import subprocess
import sys

def install_playwright_browsers():
    """安装 Playwright Chromium 浏览器"""
    try:
        print("📦 正在安装 Playwright Chromium 浏览器...")
        result = subprocess.run(
            [sys.executable, "-m", "playwright", "install", "chromium"],
            check=True,
            capture_output=False
        )
        if result.returncode == 0:
            print("✅ Playwright Chromium 安装成功！")
            return True
        else:
            print("⚠️  Playwright Chromium 安装失败，请手动运行：")
            print("   python -m playwright install chromium")
            return False
    except Exception as e:
        print(f"❌ 错误：{e}")
        print("⚠️  请手动运行：python -m playwright install chromium")
        return False

if __name__ == "__main__":
    success = install_playwright_browsers()
    sys.exit(0 if success else 1)
