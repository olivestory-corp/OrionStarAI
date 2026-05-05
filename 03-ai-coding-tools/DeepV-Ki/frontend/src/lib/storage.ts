/**
 * SSR-safe storage utility for localStorage operations
 * Prevents errors when accessing localStorage on the server side
 */

const isBrowser = typeof window !== 'undefined';

export interface StorageError {
  code: string;
  message: string;
  originalError?: Error;
}

/**
 * Safe localStorage wrapper that handles SSR environments
 */
export const storage = {
  /**
   * Retrieve an item from localStorage
   * @param key - The storage key
   * @returns The stored value or null if not found or in SSR
   */
  getItem: (key: string): string | null => {
    if (!isBrowser) {
      return null;
    }

    try {
      return localStorage.getItem(key);
    } catch {
      console.warn(`[Storage] Failed to read from localStorage: ${key}`);
      return null;
    }
  },

  /**
   * Store an item in localStorage
   * @param key - The storage key
   * @param value - The value to store
   * @returns true if successful, false otherwise
   */
  setItem: (key: string, value: string): boolean => {
    if (!isBrowser) {
      return false;
    }

    try {
      localStorage.setItem(key, value);
      return true;
    } catch (error) {
      console.warn(`[Storage] Failed to write to localStorage: ${key}`, error);
      return false;
    }
  },

  /**
   * Remove an item from localStorage
   * @param key - The storage key
   * @returns true if successful, false otherwise
   */
  removeItem: (key: string): boolean => {
    if (!isBrowser) {
      return false;
    }

    try {
      localStorage.removeItem(key);
      return true;
    } catch {
      console.warn(`[Storage] Failed to remove from localStorage: ${key}`);
      return false;
    }
  },

  /**
   * Clear all items from localStorage
   * @returns true if successful, false otherwise
   */
  clear: (): boolean => {
    if (!isBrowser) {
      return false;
    }

    try {
      localStorage.clear();
      return true;
    } catch (error) {
      console.warn('[Storage] Failed to clear localStorage', error);
      return false;
    }
  },

  /**
   * Check if a key exists in localStorage
   * @param key - The storage key
   * @returns true if key exists, false otherwise
   */
  hasItem: (key: string): boolean => {
    if (!isBrowser) {
      return false;
    }

    try {
      return localStorage.getItem(key) !== null;
    } catch {
      return false;
    }
  },

  /**
   * Get all keys from localStorage
   * @returns Array of storage keys
   */
  keys: (): string[] => {
    if (!isBrowser) {
      return [];
    }

    try {
      return Object.keys(localStorage);
    } catch {
      console.warn('[Storage] Failed to get storage keys');
      return [];
    }
  },

  /**
   * Get the number of items in localStorage
   * @returns Number of items
   */
  length: (): number => {
    if (!isBrowser) {
      return 0;
    }

    try {
      return localStorage.length;
    } catch {
      return 0;
    }
  },

  /**
   * Store a JSON object
   * @param key - The storage key
   * @param value - The object to store
   * @returns true if successful, false otherwise
   */
  setJSON: <T = unknown>(key: string, value: T): boolean => {
    if (!isBrowser) {
      return false;
    }

    try {
      const json = JSON.stringify(value);
      localStorage.setItem(key, json);
      return true;
    } catch (error) {
      console.warn(`[Storage] Failed to write JSON to localStorage: ${key}`, error);
      return false;
    }
  },

  /**
   * Retrieve a JSON object
   * @param key - The storage key
   * @returns The parsed object or null if not found or parsing failed
   */
  getJSON: <T = unknown>(key: string): T | null => {
    if (!isBrowser) {
      return null;
    }

    try {
      const json = localStorage.getItem(key);
      return json ? (JSON.parse(json) as T) : null;
    } catch {
      console.warn(`[Storage] Failed to read JSON from localStorage: ${key}`);
      return null;
    }
  }
};

/**
 * Hook-friendly storage API with React integration
 * Use this in React components for better integration with component lifecycle
 */
export const useStorage = (key: string, initialValue?: string) => {
  const getStoredValue = (): string | null => {
    return storage.getItem(key) ?? initialValue ?? null;
  };

  const setValue = (value: string): boolean => {
    return storage.setItem(key, value);
  };

  const removeValue = (): boolean => {
    return storage.removeItem(key);
  };

  return {
    value: getStoredValue(),
    setValue,
    removeValue,
    clear: () => storage.clear()
  };
};

/**
 * Session storage wrapper (similar to storage but for sessionStorage)
 */
export const sessionStorage_ = {
  getItem: (key: string): string | null => {
    if (!isBrowser) {
      return null;
    }

    try {
      return sessionStorage.getItem(key);
    } catch (error) {
      console.warn(`[SessionStorage] Failed to read from sessionStorage: ${key}`, error);
      return null;
    }
  },

  setItem: (key: string, value: string): boolean => {
    if (!isBrowser) {
      return false;
    }

    try {
      sessionStorage.setItem(key, value);
      return true;
    } catch (error) {
      console.warn(`[SessionStorage] Failed to write to sessionStorage: ${key}`, error);
      return false;
    }
  },

  removeItem: (key: string): boolean => {
    if (!isBrowser) {
      return false;
    }

    try {
      sessionStorage.removeItem(key);
      return true;
    } catch (error) {
      console.warn(`[SessionStorage] Failed to remove from sessionStorage: ${key}`, error);
      return false;
    }
  },

  clear: (): boolean => {
    if (!isBrowser) {
      return false;
    }

    try {
      sessionStorage.clear();
      return true;
    } catch (error) {
      console.warn('[SessionStorage] Failed to clear sessionStorage', error);
      return false;
    }
  }
};
