/**
 * Unified logging utility for the entire application
 * All logs are in English for consistency
 * Provides level-based filtering based on NODE_ENV
 */

const isDev = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  timestamp?: Date;
  stack?: string;
  [key: string]: unknown;
}

/**
 * Unified logger instance
 */
export const logger = {
  /**
   * Debug level - only shown in development
   * Use for detailed diagnostic information
   */
  debug: (message: string, context?: LogContext | unknown) => {
    if (isDev) {
      console.debug(`[DEBUG] ${message}`, context);
    }
  },

  /**
   * Info level - shown in all environments
   * Use for general informational messages
   */
  info: (message: string, context?: LogContext | unknown) => {
    if (!isProduction || isDev) {
      console.log(`[INFO] ${message}`, context);
    }
  },

  /**
   * Warning level - shown in all environments
   * Use for potentially problematic situations
   */
  warn: (message: string, context?: LogContext | unknown) => {
    console.warn(`[WARN] ${message}`, context);
  },

  /**
   * Error level - shown in all environments
   * Use for error conditions
   */
  error: (message: string, error?: Error | unknown) => {
    const errorObj = error instanceof Error ? error : null;
    const context = {
      message: errorObj?.message || String(error),
      stack: errorObj?.stack,
      timestamp: new Date().toISOString()
    };
    console.error(`[ERROR] ${message}`, context);
  },

  /**
   * Performance timing - only shown in development
   * Use for performance measurements
   */
  time: (label: string) => {
    if (isDev) {
      console.time(`[PERF] ${label}`);
    }
    return () => {
      if (isDev) {
        console.timeEnd(`[PERF] ${label}`);
      }
    };
  },

  /**
   * Group related logs together
   */
  group: (label: string, callback: () => void) => {
    if (isDev) {
      console.group(`[GROUP] ${label}`);
      callback();
      console.groupEnd();
    } else {
      callback();
    }
  },

  /**
   * Assert a condition and log error if false
   */
  assert: (condition: boolean, message: string, context?: unknown) => {
    if (!condition) {
      console.error(`[ASSERTION FAILED] ${message}`, context);
    }
  }
};

/**
 * Logger for API calls
 */
export const apiLogger = {
  request: (method: string, url: string, data?: unknown) => {
    logger.debug(`API ${method} request`, { url, data });
  },

  response: (method: string, url: string, status: number, duration: number) => {
    const statusColor =
      status >= 200 && status < 300
        ? '✅'
        : status >= 300 && status < 400
          ? '🔄'
          : status >= 400 && status < 500
            ? '⚠️'
            : '❌';

    logger.info(`API ${statusColor} ${method} ${url}`, { status, duration: `${duration}ms` });
  },

  error: (method: string, url: string, error: Error) => {
    logger.error(`API ${method} ${url} failed`, error);
  }
};

/**
 * Logger for component lifecycle
 */
export const componentLogger = {
  mount: (componentName: string) => {
    logger.debug(`Component mounted`, { component: componentName });
  },

  unmount: (componentName: string) => {
    logger.debug(`Component unmounted`, { component: componentName });
  },

  update: (componentName: string, props?: unknown) => {
    logger.debug(`Component updated`, { component: componentName, props });
  },

  error: (componentName: string, error: Error) => {
    logger.error(`Component error in ${componentName}`, error);
  }
};

/**
 * Logger for WebSocket connections
 */
export const wsLogger = {
  connecting: (url: string) => {
    logger.info(`WebSocket connecting`, { url });
  },

  connected: (url: string) => {
    logger.info(`✅ WebSocket connected`, { url });
  },

  disconnected: (url: string, reason?: string) => {
    logger.info(`🔌 WebSocket disconnected`, { url, reason });
  },

  error: (url: string, error: Error) => {
    logger.error(`WebSocket error`, { url, error: error.message });
  },

  message: (url: string, direction: 'sent' | 'received', size: number) => {
    logger.debug(`WebSocket message ${direction}`, { url, size });
  },

  retry: (url: string, attempt: number, maxAttempts: number) => {
    logger.warn(`WebSocket retry`, { url, attempt, maxAttempts });
  }
};

/**
 * Logger for storage operations
 */
export const storageLogger = {
  set: (key: string) => {
    logger.debug(`Storage set`, { key });
  },

  get: (key: string, found: boolean) => {
    logger.debug(`Storage get`, { key, found });
  },

  remove: (key: string) => {
    logger.debug(`Storage remove`, { key });
  },

  error: (operation: string, key: string, error: Error) => {
    logger.error(`Storage ${operation} error`, { key, error: error.message });
  }
};

/**
 * Logger for authentication
 */
export const authLogger = {
  login: (provider: string, userId?: string) => {
    logger.info(`User login attempt`, { provider, userId: userId ? '***' : 'anonymous' });
  },

  loginSuccess: (provider: string, userId?: string) => {
    logger.info(`✅ User login successful`, { provider, userId: userId ? '***' : 'anonymous' });
  },

  logout: () => {
    logger.info(`User logout`);
  },

  error: (provider: string, error: Error) => {
    logger.error(`Authentication error`, { provider, error: error.message });
  }
};

export default logger;
