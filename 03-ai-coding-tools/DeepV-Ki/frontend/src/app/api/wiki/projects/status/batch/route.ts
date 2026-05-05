/**
 * API Route: POST /api/wiki/projects/status/batch
 * 批量获取多个项目的 Wiki 状态
 */

import { NextRequest, NextResponse } from 'next/server';

const PYTHON_BACKEND_HOST = process.env.PYTHON_BACKEND_HOST || 'http://localhost:8001';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { project_keys } = body;

    if (!Array.isArray(project_keys)) {
      return NextResponse.json(
        { error: 'project_keys must be an array' },
        { status: 400 }
      );
    }

    // 调用 Python 后端
    const cookieHeader = request.headers.get('cookie') || '';
    const authHeader = request.headers.get('authorization') || '';

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Cookie': cookieHeader,
    };

    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    const response = await fetch(
      `${PYTHON_BACKEND_HOST}/api/wiki/projects/status/batch`,
      {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ project_keys }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: error || 'Failed to get batch wiki status' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Error in batch wiki status API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
