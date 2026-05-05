"""
Quick test to check if permissions cookie is being set correctly
"""

import requests
import json
import base64
from urllib.parse import quote

# 测试步骤：
# 1. 检查权限 cookie 是否存在
# 2. 解码权限 cookie
# 3. 尝试调用受保护的接口

BASE_URL = "http://localhost:8001"

print("=" * 60)
print("🔍 Testing Permission Cookie Setup")
print("=" * 60)

# 创建会话来保持 cookies
session = requests.Session()

# 第一步：检查权限 debug 端点
print("\n1️⃣  Checking /auth/debug/permissions endpoint...")
resp = session.get(f"{BASE_URL}/auth/debug/permissions")
print(f"Status: {resp.status_code}")
print(f"Response: {json.dumps(resp.json(), indent=2, ensure_ascii=False)}")

# 检查原始 cookies
print("\n2️⃣  Checking cookies in session...")
print(f"Cookies: {session.cookies}")
for cookie in session.cookies:
    print(f"  - {cookie.name}: {cookie.value[:50]}..." if len(cookie.value) > 50 else f"  - {cookie.name}: {cookie.value}")

# 如果有权限 cookie，尝试解码
perm_cookie = session.cookies.get('deepwiki_repo_permissions')
if perm_cookie:
    print(f"\n3️⃣  Found permission cookie, trying to decode...")
    try:
        decoded = base64.b64decode(perm_cookie).decode('utf-8')
        data = json.loads(decoded)
        print(f"✅ Decoded successfully!")
        print(f"User: {data.get('user_id')}")
        print(f"Repos: {len(data.get('repos', []))} repositories")
        for repo in data.get('repos', [])[:3]:
            print(f"  - {repo['owner']}/{repo['repo']}")
    except Exception as e:
        print(f"❌ Failed to decode: {e}")
else:
    print(f"\n3️⃣  ❌ No permission cookie found!")

# 第三步：尝试调用受保护的接口
print(f"\n4️⃣  Testing protected endpoint...")
print(f"Calling: POST /api/wiki/projects/status/batch")
resp = session.post(
    f"{BASE_URL}/api/wiki/projects/status/batch",
    json={"project_keys": ["gitlab:test/test"]}
)
print(f"Status: {resp.status_code}")
print(f"Response: {resp.json()}")

print("\n" + "=" * 60)
