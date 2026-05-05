import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/gitlab/public-projects
 * 代理到后端 /gitlab/public-projects
 * 获取公开的 GitLab 项目
 */
export async function GET(request: NextRequest) {
  try {
    const backendUrl = process.env.PYTHON_BACKEND_HOST || process.env.SERVER_BASE_URL || 'http://localhost:8001';

    // 构建后端 URL
    const url = new URL('/gitlab/public-projects', backendUrl);

    // 复制所有查询参数
    const searchParams = request.nextUrl.searchParams;
    searchParams.forEach((value, key) => {
      url.searchParams.append(key, value);
    });

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
    console.error('GitLab public projects API error:', error);
    return NextResponse.json(
      { error: '获取公开项目失败' },
      { status: 500 }
    );
  }
}
