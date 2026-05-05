/**
 * Next.js API Route: GET /api/wiki/projects/{projectKey}/html/{pageId}
 * 代理到 Python 后端获取页面 HTML
 */

import { NextRequest, NextResponse } from 'next/server';

const PYTHON_BACKEND = process.env.PYTHON_BACKEND_HOST || 'http://localhost:8001';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectKey: string; pageId: string }> }
) {
  try {
    const params = await context.params;
    const { projectKey, pageId } = params;

    const url = `${PYTHON_BACKEND}/api/wiki/projects/${encodeURIComponent(projectKey)}/html/${encodeURIComponent(pageId)}`;

    const cookieHeader = request.headers.get('cookie') || '';
    const authHeader = request.headers.get('authorization') || '';

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Cookie': cookieHeader,
    };

    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: errorText || 'Failed to get page HTML' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error proxying page HTML request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
