import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/gitlab/sync-status
 * 代理到后端 /gitlab/sync-status
 * 获取 GitLab 项目同步的实时状态
 */
export async function GET(request: NextRequest) {
  const backendUrl = process.env.PYTHON_BACKEND_HOST || process.env.SERVER_BASE_URL || 'http://localhost:8001';

  // 获取查询参数
  const email = request.nextUrl.searchParams.get('email');

  if (!email) {
    return NextResponse.json(
      { error: '缺少必要的 email 参数' },
      { status: 400 }
    );
  }

  // 构建后端 URL
  const url = new URL('/gitlab/sync-status', backendUrl);
  url.searchParams.append('email', email);

  try {
    // 调用后端（带超时控制）
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 秒超时

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

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return NextResponse.json(
        { error: `后端返回 ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('GitLab sync-status API error:', error);

    // 如果是超时错误
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json(
        { error: '后端响应超时' },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: '获取同步状态失败' },
      { status: 500 }
    );
  }
}