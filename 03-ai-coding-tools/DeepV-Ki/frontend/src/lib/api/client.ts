/**
 * API 客户端基础
 */

export class APIError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    message: string
  ) {
    super(message);
    this.name = 'APIError';
  }
}

/**
 * API 客户端
 */
export class APIClient {
  private static getHeaders(): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Client-side only
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('deepwiki_token');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    return headers;
  }

  static async get<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(endpoint, {
      ...options,
      method: 'GET',
      headers: {
        ...this.getHeaders(),
        ...(options.headers || {}),
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new APIError(
        response.status,
        response.statusText,
        data.detail || data.error || response.statusText
      );
    }

    return response.json();
  }

  static async post<T>(endpoint: string, body?: unknown, options: RequestInit = {}): Promise<T> {
    const response = await fetch(endpoint, {
      ...options,
      method: 'POST',
      headers: {
        ...this.getHeaders(),
        ...(options.headers || {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'include',
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new APIError(
        response.status,
        response.statusText,
        data.detail || data.error || response.statusText
      );
    }

    return response.json();
  }

  static async delete<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(endpoint, {
      ...options,
      method: 'DELETE',
      headers: {
        ...this.getHeaders(),
        ...(options.headers || {}),
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new APIError(
        response.status,
        response.statusText,
        data.detail || data.error || response.statusText
      );
    }

    return response.json();
  }
}
