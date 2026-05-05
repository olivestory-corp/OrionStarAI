import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/tasks/{taskId}/status
 *
 * 代理请求到 Python 后端，获取任务状态和进度
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const resolvedParams = await params;
    const taskId = resolvedParams.taskId;

    if (!taskId) {
      return NextResponse.json(
        { error: 'Task ID is required' },
        { status: 400 }
      );
    }

    // 后端 API URL
    const backendUrl = process.env.PYTHON_BACKEND_HOST || 'http://localhost:8001';
    const apiUrl = `${backendUrl}/api/tasks/${taskId}/status`;

    console.log(`[Frontend API] 查询任务状态: ${taskId}`);

    // 转发请求到 Python 后端
    const cookieHeader = request.headers.get('cookie') || '';
    const authHeader = request.headers.get('authorization') || '';

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Cookie': cookieHeader,
    };

    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: headers,
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`[Frontend API] 任务查询失败:`, data);
      return NextResponse.json(
        { error: data.detail || data.error || '任务查询失败' },
        { status: response.status }
      );
    }

    console.log(`[Frontend API] 任务状态: ${data.status} (${data.progress}%)`);

    // 返回任务状态
    return NextResponse.json(data, { status: 200 });

  } catch (error) {
    console.error('[Frontend API] 错误:', error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '任务查询失败',
      },
      { status: 500 }
    );
  }
}
