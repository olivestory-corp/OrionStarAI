import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/tasks/wiki/generate
 *
 * 代理请求到 Python 后端的任务队列系统
 * 创建新的 wiki 生成任务或返回已存在的任务 ID（去重）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 验证必要的字段（provider 和 model 可选，后端会使用默认配置）
    const requiredFields = ['repo_url', 'repo_type', 'owner', 'repo_name', 'language'];
    const missingFields = requiredFields.filter(field => !body[field]);

    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: `缺少必要字段: ${missingFields.join(', ')}` },
        { status: 400 }
      );
    }

    // 后端 API URL
    const backendUrl = process.env.PYTHON_BACKEND_HOST || 'http://localhost:8001';
    const apiUrl = `${backendUrl}/api/tasks/wiki/generate`;

    console.log(`[Frontend API] 代理请求到后端: ${apiUrl}`);
    console.log(`[Frontend API] 请求内容:`, {
      owner: body.owner,
      repo_name: body.repo_name,
      provider: body.provider,
      model: body.model,
    });

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
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`[Frontend API] 后端错误:`, data);
      return NextResponse.json(
        { error: data.detail || data.error || '后端处理失败' },
        { status: response.status }
      );
    }

    console.log(`[Frontend API] 任务创建成功:`, {
      task_id: data.task_id,
      status: data.status || 'queued',
    });

    // 返回任务 ID 和状态信息
    return NextResponse.json(
      {
        task_id: data.task_id,
        status: data.status || 'queued',
        message: data.message || 'Task created and queued for processing',
        repo_url: body.repo_url,
        owner: body.owner,
        repo_name: body.repo_name,
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('[Frontend API] 错误:', error);

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: '请求体格式无效' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '任务创建失败',
      },
      { status: 500 }
    );
  }
}
