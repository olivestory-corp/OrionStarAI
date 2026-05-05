/**
 * Wiki 缓存管理 Hook
 * 提供本地存储和内存缓存的集成缓存管理
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export interface CacheConfig {
  maxAge?: number; // 最大缓存时间（毫秒）
  storageKey?: string; // localStorage 键名
  useMemory?: boolean; // 是否使用内存缓存
  useStorage?: boolean; // 是否使用本地存储
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface CacheStore<T> {
  memory: Map<string, CacheEntry<T>>;
  storage: {
    get: (key: string) => T | null;
    set: (key: string, value: T) => void;
    clear: (key: string) => void;
  };
}

export function useWikiCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  config: CacheConfig = {}
) {
  const {
    maxAge = 5 * 60 * 1000, // 默认 5 分钟
    storageKey = `wiki_${key}`,
    useMemory = true,
    useStorage = true,
  } = config;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const cacheStore = useRef<CacheStore<T>>({
    memory: new Map(),
    storage: {
      get: (storageKey: string) => {
        try {
          const item = localStorage.getItem(storageKey);
          if (!item) return null;
          const parsed = JSON.parse(item);
          return parsed.data;
        } catch {
          return null;
        }
      },
      set: (storageKey: string, value: T) => {
        try {
          localStorage.setItem(storageKey, JSON.stringify({
            data: value,
            timestamp: Date.now(),
          }));
        } catch {
          console.warn('Failed to save to localStorage');
        }
      },
      clear: (storageKey: string) => {
        localStorage.removeItem(storageKey);
      },
    },
  });

  const isCacheValid = useCallback((timestamp: number) => {
    return Date.now() - timestamp < maxAge;
  }, [maxAge]);

  const getCached = useCallback((): T | null => {
    // 先检查内存缓存
    if (useMemory) {
      const memoryEntry = cacheStore.current.memory.get(key);
      if (memoryEntry && isCacheValid(memoryEntry.timestamp)) {
        return memoryEntry.data;
      }
    }

    // 再检查本地存储缓存
    if (useStorage) {
      const storageData = cacheStore.current.storage.get(storageKey);
      if (storageData) {
        // 将本地存储的数据恢复到内存缓存
        if (useMemory) {
          cacheStore.current.memory.set(key, {
            data: storageData,
            timestamp: Date.now(),
          });
        }
        return storageData;
      }
    }

    return null;
  }, [key, storageKey, useMemory, useStorage, isCacheValid]);

  const setCached = useCallback((value: T) => {
    // 存储到内存缓存
    if (useMemory) {
      cacheStore.current.memory.set(key, {
        data: value,
        timestamp: Date.now(),
      });
    }

    // 存储到本地存储
    if (useStorage) {
      cacheStore.current.storage.set(storageKey, value);
    }

    setData(value);
  }, [key, storageKey, useMemory, useStorage]);

  const clearCache = useCallback(() => {
    cacheStore.current.memory.delete(key);
    cacheStore.current.storage.clear(storageKey);
    setData(null);
  }, [key, storageKey]);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await fetcher();
      setCached(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [fetcher, setCached]);

  // 初始化：尝试从缓存加载
  useEffect(() => {
    const cached = getCached();
    if (cached) {
      setData(cached);
      setLoading(false);
    } else {
      refetch();
    }
  }, [getCached, refetch]);

  return {
    data,
    loading,
    error,
    refetch,
    clearCache,
    isCached: data !== null,
  };
}

/**
 * 使用本地存储的 Wiki 数据缓存
 */
export function useWikiStorageCache<T>(
  key: string,
  maxAge?: number
) {
  const [data, setData] = useState<T | null>(null);

  const get = useCallback((): T | null => {
    try {
      const item = localStorage.getItem(`wiki_${key}`);
      if (!item) return null;

      const parsed = JSON.parse(item);
      const { data, timestamp } = parsed;

      // 检查是否过期
      if (maxAge && Date.now() - timestamp > maxAge) {
        localStorage.removeItem(`wiki_${key}`);
        return null;
      }

      return data;
    } catch {
      return null;
    }
  }, [key, maxAge]);

  const set = useCallback((value: T) => {
    try {
      localStorage.setItem(`wiki_${key}`, JSON.stringify({
        data: value,
        timestamp: Date.now(),
      }));
      setData(value);
    } catch (err) {
      console.warn('Failed to cache wiki data:', err);
    }
  }, [key]);

  const clear = useCallback(() => {
    localStorage.removeItem(`wiki_${key}`);
    setData(null);
  }, [key]);

  // 初始化时尝试从存储中获取
  useEffect(() => {
    const cached = get();
    if (cached) {
      setData(cached);
    }
  }, [get]);

  return { data, set, clear, get };
}
