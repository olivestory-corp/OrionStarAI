/**
 * 带有缓存的 Fetch Hook
 * 支持内存缓存、本地存储缓存和网络请求
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { APIClient } from '@/lib/api/client';

export interface FetchCacheOptions {
  cacheTime?: number; // 缓存时间（毫秒）
  storageKey?: string; // localStorage 键名
  skipCache?: boolean; // 跳过缓存
  onError?: (error: Error) => void; // 错误回调
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const memoryCache = new Map<string, CacheEntry<unknown>>();

export function useFetchWithCache<T>(
  url: string,
  options: FetchCacheOptions = {}
) {
  const {
    cacheTime = 5 * 60 * 1000, // 默认 5 分钟
    storageKey = `fetch_${btoa(url)}`,
    skipCache = false,
    onError,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!skipCache);
  const [error, setError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const getCachedData = useCallback((): T | null => {
    if (skipCache) return null;

    // 检查内存缓存
    const memEntry = memoryCache.get(url);
    if (memEntry && Date.now() - memEntry.timestamp < cacheTime) {
      return memEntry.data as T;
    }

    // 检查本地存储缓存
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as { data: unknown; timestamp: number };
        const { data, timestamp } = parsed;

        if (Date.now() - timestamp < cacheTime) {
          // 恢复到内存缓存
          memoryCache.set(url, { data, timestamp });
          return data as T;
        }

        // 缓存过期，清除
        localStorage.removeItem(storageKey);
      }
    } catch {
      // 忽略存储读取错误
    }

    return null;
  }, [url, cacheTime, storageKey, skipCache]);

  const setCachedData = useCallback((newData: T) => {
    // 保存到内存缓存
    memoryCache.set(url, {
      data: newData,
      timestamp: Date.now(),
    });

    // 保存到本地存储缓存
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        data: newData,
        timestamp: Date.now(),
      }));
    } catch {
      // 忽略存储写入错误
    }

    setData(newData);
  }, [url, storageKey]);

  const fetch = useCallback(async (forceRefresh = false) => {
    // 检查缓存
    if (!forceRefresh) {
      const cached = getCachedData();
      if (cached !== null) {
        setData(cached);
        setLoading(false);
        return cached;
      }
    }

    // 创建新的 AbortController
    abortControllerRef.current = new AbortController();

    setLoading(true);
    setError(null);

    try {
      const result = await APIClient.get<T>(url, {
        signal: abortControllerRef.current.signal,
      });

      setCachedData(result);
      return result;
    } catch (err) {
      // 忽略被中止的请求错误
      if (err instanceof Error && err.name === 'AbortError') {
        return null;
      }

      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      onError?.(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [url, getCachedData, setCachedData, onError]);

  const refetch = useCallback(async () => {
    return fetch(true); // forceRefresh = true
  }, [fetch]);

  const clearCache = useCallback(() => {
    memoryCache.delete(url);
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // 忽略错误
    }
  }, [url, storageKey]);

  // 初始化：尝试从缓存或网络获取数据
  useEffect(() => {
    const cached = getCachedData();
    if (cached !== null) {
      setData(cached);
      setLoading(false);
    } else {
      fetch();
    }

    // 清理：取消任何待处理的请求
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [url, getCachedData, fetch]);

  return {
    data,
    loading,
    error,
    refetch,
    clearCache,
    isCached: data !== null && memoryCache.has(url),
  };
}

/**
 * 预加载数据到缓存
 */
export function usePrefetchData(
  urls: string[]
) {
  const prefetch = useCallback(async () => {
    const promises = urls.map((url) =>
      APIClient.get(url)
        .then((data) => {
          // 保存到缓存
          memoryCache.set(url, {
            data,
            timestamp: Date.now(),
          });
        })
        .catch(() => {
          // 忽略错误
        })
    );

    await Promise.all(promises);
  }, [urls]);

  return { prefetch };
}
