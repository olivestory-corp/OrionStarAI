/**
 * API路由模板和工具函数
 * 提供标准化的API路由创建模板，简化开发过程
 */

import { NextRequest, NextResponse } from "next/server";
import { proxyToBackend, proxyGet, proxyPost, proxyDelete } from "./api-proxy";

/**
 * 简单代理路由模板
 * 用于只需要简单转发的API端点
 *
 * @param frontendPath 前端路径（如 '/api/auth/status'）
 * @returns API路由处理函数
 *
 * @example
 * // src/app/api/auth/status/route.ts
 * import { createSimpleProxyRoute } from '@/lib/api-route-template';
 *
 * const { GET } = createSimpleProxyRoute('/api/auth/status');
 * export { GET };
 */
export function createSimpleProxyRoute(frontendPath: string) {
  return {
    async GET(request: NextRequest) {
      return proxyGet(frontendPath, request);
    },

    async POST(request: NextRequest) {
      return proxyPost(frontendPath, request);
    },

    async PUT(request: NextRequest) {
      return proxyToBackend(frontendPath, request, { method: "PUT" });
    },

    async DELETE(request: NextRequest) {
      return proxyDelete(frontendPath, request);
    },

    async PATCH(request: NextRequest) {
      return proxyToBackend(frontendPath, request, { method: "PATCH" });
    },
  };
}

/**
 * 只读API路由模板
 * 只支持GET请求的API端点
 *
 * @param frontendPath 前端路径
 * @returns 只包含GET方法的路由处理函数
 *
 * @example
 * // src/app/api/models/config/route.ts
 * import { createReadOnlyRoute } from '@/lib/api-route-template';
 *
 * export const GET = createReadOnlyRoute('/api/models/config');
 */
export function createReadOnlyRoute(frontendPath: string) {
  return async function GET(request: NextRequest) {
    return proxyGet(frontendPath, request);
  };
}

/**
 * 带数据转换的API路由模板
 * 支持请求和响应数据的转换
 *
 * @param frontendPath 前端路径
 * @param transformers 数据转换器
 * @returns API路由处理函数
 *
 * @example
 * // src/app/api/wiki/projects/route.ts
 * import { createTransformRoute } from '@/lib/api-route-template';
 *
 * const { GET, DELETE } = createTransformRoute('/api/wiki/projects', {
 *   transformResponse: (data) => ({
 *     ...data,
 *     timestamp: new Date().toISOString()
 *   })
 * });
 *
 * export { GET, DELETE };
 */
export function createTransformRoute(
  frontendPath: string,
  transformers: {
    transformRequest?: (data: unknown) => unknown;
    transformResponse?: (data: unknown) => unknown;
  } = {}
) {
  const { transformRequest, transformResponse } = transformers;

  return {
    async GET(request: NextRequest) {
      return proxyGet(frontendPath, request, {
        transformResponse,
      });
    },

    async POST(request: NextRequest) {
      return proxyPost(frontendPath, request, {
        transformRequest,
        transformResponse,
      });
    },

    async PUT(request: NextRequest) {
      return proxyToBackend(frontendPath, request, {
        method: "PUT",
        transformRequest,
        transformResponse,
      });
    },

    async DELETE(request: NextRequest) {
      return proxyDelete(frontendPath, request, {
        transformResponse,
      });
    },
  };
}

/**
 * 缓存API路由模板
 * 支持响应缓存的API端点
 *
 * @param frontendPath 前端路径
 * @param cacheOptions 缓存选项
 * @returns 带缓存的API路由处理函数
 */
export function createCachedRoute(
  frontendPath: string,
  cacheOptions: {
    maxAge?: number; // 缓存时间（秒）
    staleWhileRevalidate?: number; // 过期后仍可使用的时间（秒）
  } = {}
) {
  const { maxAge = 300, staleWhileRevalidate = 60 } = cacheOptions;

  return {
    async GET(request: NextRequest) {
      const response = await proxyGet(frontendPath, request);

      // 添加缓存头
      response.headers.set(
        "Cache-Control",
        `public, max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`
      );

      return response;
    },
  };
}

/**
 * 流式响应API路由模板
 * 用于处理流式数据的API端点（如聊天API）
 *
 * @param frontendPath 前端路径
 * @returns 流式响应的API路由处理函数
 */
export function createStreamRoute(frontendPath: string) {
  return {
    async POST(request: NextRequest) {
      return proxyPost(frontendPath, request, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    },
  };
}

/**
 * 文件上传API路由模板
 * 处理文件上传的API端点
 *
 * @param frontendPath 前端路径
 * @returns 文件上传的API路由处理函数
 */
export function createUploadRoute(frontendPath: string) {
  return {
    async POST(request: NextRequest) {
      // 对于文件上传，不转换请求体为JSON
      return proxyToBackend(frontendPath, request, {
        method: "POST",
        headers: {
          // 让浏览器设置正确的Content-Type（包括boundary）
          "Content-Type":
            request.headers.get("content-type") || "multipart/form-data",
        },
      });
    },
  };
}

/**
 * 健康检查路由模板
 * 用于服务健康状态检查
 *
 * @param frontendPath 前端路径
 * @param customChecks 自定义检查函数
 * @returns 健康检查的API路由处理函数
 */
export function createHealthRoute(
  frontendPath: string,
  customChecks: (() => Promise<boolean>)[] = []
) {
  return {
    async GET(request: NextRequest) {
      try {
        // 执行自定义检查
        const checkResults = await Promise.all(
          customChecks.map((check) => check().catch(() => false))
        );

        const allChecksPass = checkResults.every((result) => result);

        if (!allChecksPass) {
          return NextResponse.json(
            {
              status: "unhealthy",
              checks: checkResults,
              timestamp: new Date().toISOString(),
            },
            { status: 503 }
          );
        }

        // 代理到后端进行完整的健康检查
        return proxyGet(frontendPath, request);
      } catch (error) {
        return NextResponse.json(
          {
            status: "error",
            error: error instanceof Error ? error.message : "Unknown error",
            timestamp: new Date().toISOString(),
          },
          { status: 500 }
        );
      }
    },
  };
}

/**
 * 创建自定义路由处理器
 * 提供最大的灵活性，同时保持一致的错误处理
 *
 * @param handler 自定义处理函数
 * @returns 包装后的路由处理函数
 */
export function createCustomRoute(
  handler: (request: NextRequest) => Promise<NextResponse>
) {
  return async function (request: NextRequest) {
    try {
      return await handler(request);
    } catch (error) {
      console.error("[Custom Route Error]", error);

      return NextResponse.json(
        {
          error: "Internal server error",
          details: error instanceof Error ? error.message : "Unknown error",
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      );
    }
  };
}

// 导出常用的HTTP方法类型
export type RouteHandler = (request: NextRequest) => Promise<NextResponse>;
export type RouteHandlers = {
  GET?: RouteHandler;
  POST?: RouteHandler;
  PUT?: RouteHandler;
  DELETE?: RouteHandler;
  PATCH?: RouteHandler;
};
