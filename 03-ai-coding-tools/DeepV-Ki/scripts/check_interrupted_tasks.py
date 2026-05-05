#!/usr/bin/env python3
"""
检查并清理中断的 Wiki 生成任务

用法：
    python scripts/check_interrupted_tasks.py [--fix]
    
选项：
    --fix    自动修复中断的任务（将状态改为 failed）
"""

import sys
import os
import sqlite3
from pathlib import Path

# 添加项目根目录到 Python 路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from api.gitlab_db import get_gitlab_db


def check_tasks():
    """检查数据库中的任务状态"""
    db = get_gitlab_db()
    
    print("=" * 60)
    print("🔍 检查中断的 Wiki 生成任务")
    print("=" * 60)
    print()
    
    # 1. 检查任务表
    print("📋 检查 wiki_generation_tasks 表...")
    with sqlite3.connect(db.db_path) as conn:
        cursor = conn.cursor()
        
        # 查询所有中间状态的任务
        cursor.execute('''
            SELECT task_id, project_key, status, progress, message, created_at, updated_at
            FROM wiki_generation_tasks
            WHERE status IN ('queued', 'processing')
            ORDER BY created_at DESC
        ''')
        tasks = cursor.fetchall()
        
        if tasks:
            print(f"⚠️ 发现 {len(tasks)} 个中断的任务：")
            print()
            for task in tasks:
                task_id, project_key, status, progress, message, created_at, updated_at = task
                print(f"  任务 ID: {task_id}")
                print(f"  项目: {project_key}")
                print(f"  状态: {status}")
                print(f"  进度: {progress}%")
                print(f"  消息: {message}")
                print(f"  创建时间: {created_at}")
                print(f"  更新时间: {updated_at}")
                print()
        else:
            print("✅ 没有发现中断的任务")
            print()
    
    # 2. 检查项目表
    print("📋 检查 wiki_projects 表...")
    with sqlite3.connect(db.db_path) as conn:
        cursor = conn.cursor()
        
        # 查询所有生成中的项目
        cursor.execute('''
            SELECT project_key, status, current_task_id, last_generated_at, last_failed_at, updated_at
            FROM wiki_projects
            WHERE status IN ('generating', 'queued')
            ORDER BY updated_at DESC
        ''')
        projects = cursor.fetchall()
        
        if projects:
            print(f"⚠️ 发现 {len(projects)} 个生成中的项目：")
            print()
            for project in projects:
                project_key, status, current_task_id, last_generated_at, last_failed_at, updated_at = project
                print(f"  项目: {project_key}")
                print(f"  状态: {status}")
                print(f"  关联任务: {current_task_id}")
                print(f"  最后生成时间: {last_generated_at}")
                print(f"  最后失败时间: {last_failed_at}")
                print(f"  更新时间: {updated_at}")
                print()
        else:
            print("✅ 没有发现生成中的项目")
            print()


def fix_tasks():
    """修复中断的任务"""
    db = get_gitlab_db()
    
    print("=" * 60)
    print("🔧 修复中断的任务")
    print("=" * 60)
    print()
    
    cleaned_count = db.cleanup_interrupted_tasks()
    
    if cleaned_count > 0:
        print(f"✅ 成功清理了 {cleaned_count} 个中断的任务")
    else:
        print("✅ 没有需要清理的任务")
    
    print()


def main():
    """主函数"""
    import argparse
    
    parser = argparse.ArgumentParser(description='检查并清理中断的 Wiki 生成任务')
    parser.add_argument('--fix', action='store_true', help='自动修复中断的任务')
    
    args = parser.parse_args()
    
    try:
        if args.fix:
            fix_tasks()
        
        check_tasks()
        
    except Exception as e:
        print(f"❌ 错误: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()

