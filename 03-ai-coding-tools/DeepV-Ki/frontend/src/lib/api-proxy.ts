/**
 * 统一的API代理工具
 * 用于将前端API请求代理到Python后端
 */

import { NextRequest, NextResponse } from "next/server";

// 获取后端URL的统一配置
const getBackendUrl = (): string => {
  return process.env.PYTHON_BACKEND_HOST || "http://localhost:8001";
};

// API路径映射表 - 前端路径到后端路径的映射
export const API_MAPPINGS: Record<string, string> = {
  // 认证相关
  "/api/auth/status": "/api/auth/status",
  "/api/auth/validate": "/api/auth/validate",

  // 配置相关
  "/api/models/config": "/api/models/config",
  "/api/lang/config": "/api/lang/config",

  // 项目和缓存管理
  "/api/wiki/projects": "/api/processed_projects",
  "/api/wiki/cache": "/api/wiki_cache",

  // 聊天相关
  "/api/chat/stream": "/chat/completions/stream",

  // WebSocket相关（注意：Next.js App Router不支持WebSocket升级）
  "/api/ws/chat": "/ws/chat",

  // 其他端点
  "/health": "/",
  "/export/wiki": "/export/wiki",
  "/local_repo/structure": "/local_repo/structure",
};

// 请求转换选项
export interface ProxyOptions {
  method?: string;
  transformRequest?: (body: unknown) => unknown;
  transformResponse?: (data: unknown) => unknown;
  headers?: Record<string, string>;
  timeout?: number;
}

// 错误响应格式
interface ErrorResponse {
  error: string;
  details?: string;
  timestamp: string;
  path: string;
}

/**
 * 创建标准化的错误响应
 */
const createErrorResponse = (
  error: string,
  status: number,
  path: string,
  details?: string
): NextResponse => {
  const errorResponse: ErrorResponse = {
    error,
    details,
    timestamp: new Date().toISOString(),
    path,
  };

  console.error(`[API Proxy Error] ${status} ${error}`, {
    path,
    details,
    timestamp: errorResponse.timestamp,
  });

  return NextResponse.json(errorResponse, { status });
};

/**
 * 统一的API代理函数
 * @param frontendPath 前端请求路径
 * @param request Next.js请求对象
 * @param options 代理选项
 * @returns 代理响应
 */
export async function proxyToBackend(
  frontendPath: string,
  request: NextRequest,
  options: ProxyOptions = {}
): Promise<NextResponse> {
  const {
    method = request.method,
    transformRequest,
    transformResponse,
    headers: customHeaders = {},
    timeout = 30000,
  } = options;

  try {
    // 获取后端路径
    const backendPath = API_MAPPINGS[frontendPath];
    if (!backendPath) {
      return createErrorResponse(
        "API endpoint not found",
        404,
        frontendPath,
        `No mapping found for ${frontendPath}`
      );
    }

    // 构建完整的后端URL
    const backendUrl = getBackendUrl();
    const fullUrl = `${backendUrl}${backendPath}`;

    // 处理请求体
    let body: string | undefined;
    if (method !== "GET" && method !== "HEAD") {
      try {
        const rawBody = await request.text();
        if (rawBody) {
          const parsedBody = JSON.parse(rawBody);
          const transformedBody = transformRequest
            ? transformRequest(parsedBody)
            : parsedBody;
          body = JSON.stringify(transformedBody);
        }
      } catch {
        return createErrorResponse(
          "Invalid request body",
          400,
          frontendPath,
          "Request body must be valid JSON"
        );
      }
    }

    // 构建请求头
    const requestHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...customHeaders,
    };

    // 复制相关的原始请求头
    const headersToForward = ["authorization", "user-agent", "accept-language"];
    headersToForward.forEach((headerName) => {
      const headerValue = request.headers.get(headerName);
      if (headerValue) {
        requestHeaders[headerName] = headerValue;
      }
    });

    // 发送请求到后端
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(fullUrl, {
      method,
      headers: requestHeaders,
      body,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // 处理后端错误响应
    if (!response.ok) {
      let errorDetails = `Backend returned ${response.status} ${response.statusText}`;
      try {
        const errorBody = await response.text();
        if (errorBody) {
          errorDetails += `: ${errorBody}`;
        }
      } catch {
        // 忽略解析错误
      }

      return createErrorResponse(
        "Backend service error",
        response.status,
        frontendPath,
        errorDetails
      );
    }

    // 处理响应数据
    const contentType = response.headers.get("content-type");
    let responseData: unknown;

    if (contentType?.includes("application/json")) {
      responseData = await response.json();
      if (transformResponse) {
        responseData = transformResponse(responseData);
      }
      return NextResponse.json(responseData);
    } else {
      // 处理非JSON响应（如文件下载等）
      const responseBody = await response.arrayBuffer();
      return new NextResponse(responseBody, {
        status: response.status,
        headers: {
          "Content-Type": contentType || "application/octet-stream",
        },
      });
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        return createErrorResponse(
          "Request timeout",
          408,
          frontendPath,
          `Request to backend timed out after ${timeout}ms`
        );
      }

      return createErrorResponse(
        "Proxy error",
        500,
        frontendPath,
        error.message
      );
    }

    return createErrorResponse(
      "Unknown proxy error",
      500,
      frontendPath,
      "An unexpected error occurred"
    );
  }
}

/**
 * 简化的GET请求代理
 */
export async function proxyGet(
  frontendPath: string,
  request: NextRequest,
  options?: Omit<ProxyOptions, "method">
): Promise<NextResponse> {
  return proxyToBackend(frontendPath, request, { ...options, method: "GET" });
}

/**
 * 简化的POST请求代理
 */
export async function proxyPost(
  frontendPath: string,
  request: NextRequest,
  options?: Omit<ProxyOptions, "method">
): Promise<NextResponse> {
  return proxyToBackend(frontendPath, request, { ...options, method: "POST" });
}

/**
 * 简化的DELETE请求代理
 */
export async function proxyDelete(
  frontendPath: string,
  request: NextRequest,
  options?: Omit<ProxyOptions, "method">
): Promise<NextResponse> {
  return proxyToBackend(frontendPath, request, {
    ...options,
    method: "DELETE",
  });
}

/**
 * 获取当前后端配置信息（用于调试）
 */
export function getProxyConfig() {
  return {
    backendUrl: getBackendUrl(),
    mappings: API_MAPPINGS,
    timestamp: new Date().toISOString(),
  };
}
