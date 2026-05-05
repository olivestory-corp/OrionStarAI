import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/gitlab/cache
 * 代理到后端 /gitlab/cache
 * 获取 GitLab 项目缓存数据
 */
export async function GET(request: NextRequest) {
  try {
    const backendUrl = process.env.PYTHON_BACKEND_HOST || process.env.SERVER_BASE_URL || 'http://localhost:8001';

    // 获取查询参数
    const email = request.nextUrl.searchParams.get('email');

    // 构建后端 URL
    const url = new URL('/gitlab/cache', backendUrl);
    if (email) {
      url.searchParams.append('email', email);
    }

    // 获取请求中的 Cookie 和 Authorization
    const cookieHeader = request.headers.get('cookie') || '';
    const authHeader = request.headers.get('authorization') || '';

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Cookie': cookieHeader,
    };

    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    // 调用后端
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: headers,
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `后端返回 ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('GitLab cache API error:', error);
    return NextResponse.json(
      { error: '获取缓存失败' },
      { status: 500 }
    );
  }
}
