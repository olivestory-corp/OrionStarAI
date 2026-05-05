/**
 * API Route: GET /api/wiki/projects/{projectKey}/status
 * 获取单个项目的 Wiki 状态
 */

import { NextRequest, NextResponse } from 'next/server';

const PYTHON_BACKEND_HOST = process.env.PYTHON_BACKEND_HOST || 'http://localhost:8001';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectKey: string }> }
) {
  try {
    const params = await context.params;
    const projectKey = decodeURIComponent(params.projectKey);

    // 转发请求头
    const cookieHeader = request.headers.get('cookie') || '';
    const authHeader = request.headers.get('authorization') || '';

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Cookie': cookieHeader,
    };

    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    // 调用 Python 后端
    const response = await fetch(
      `${PYTHON_BACKEND_HOST}/api/wiki/projects/${encodeURIComponent(projectKey)}/status`,
      {
        method: 'GET',
        headers: headers,
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: 'Project not found' },
          { status: 404 }
        );
      }

      const error = await response.text();
      return NextResponse.json(
        { error: error || 'Failed to get wiki status' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Error in wiki status API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
