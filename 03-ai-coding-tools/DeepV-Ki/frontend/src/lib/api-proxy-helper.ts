/**
 * API Proxy Helper - Common utilities for proxying requests to Python backend
 * Ensures cookies are properly forwarded to maintain authentication
 */

import { NextRequest, NextResponse } from 'next/server';

const PYTHON_BACKEND_HOST = process.env.PYTHON_BACKEND_HOST || 'http://localhost:8001';

/**
 * Common fetch options for proxying to Python backend
 * Automatically includes cookies from the request
 */
export function getProxyFetchOptions(request: NextRequest, overrides?: RequestInit): RequestInit {
  const cookieHeader = request.headers.get('cookie') || '';

  const options: RequestInit = {
    headers: {
      'Cookie': cookieHeader,  // Forward browser cookies
      ...overrides?.headers,
    },
    ...overrides,
  };

  return options;
}

/**
 * Get Python backend URL
 */
export function getPythonBackendUrl(): string {
  return PYTHON_BACKEND_HOST;
}

/**
 * Proxy a request to Python backend, ensuring cookies are forwarded
 */
export async function proxyToBackend(
  request: NextRequest,
  backendPath: string,
  method: string = 'GET',
  body?: unknown
): Promise<Response> {
  const cookieHeader = request.headers.get('cookie') || '';

  console.log(`🔍 proxyToBackend: ${method} ${backendPath}`);
  console.log(`📋 Cookies: ${cookieHeader.substring(0, 100)}...`);
  console.log(`✅ Has deepwiki_repo_permissions: ${cookieHeader.includes('deepwiki_repo_permissions')}`);

  const headers: HeadersInit = {
    'Cookie': cookieHeader,
    'Content-Type': 'application/json',
  };

  const fetchOptions: RequestInit = {
    method,
    headers,
  };

  if (body) {
    fetchOptions.body = JSON.stringify(body);
  }

  const url = `${PYTHON_BACKEND_HOST}${backendPath}`;

  try {
    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        { error: text || `Request failed with status ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error(`Error proxying to ${url}:`, error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
