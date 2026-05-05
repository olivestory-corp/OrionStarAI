/**
 * Unified error handling system for the application
 * Provides consistent error types and messages across the codebase
 */

export type ErrorCode =
  | 'UNKNOWN'
  | 'INVALID_INPUT'
  | 'NETWORK_ERROR'
  | 'API_ERROR'
  | 'AUTHENTICATION_ERROR'
  | 'AUTHORIZATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'VALIDATION_ERROR'
  | 'TIMEOUT_ERROR'
  | 'WEBSOCKET_ERROR'
  | 'STORAGE_ERROR'
  | 'PARSE_ERROR'
  | 'COMPONENT_ERROR';

export interface ErrorDetails {
  code: ErrorCode;
  message: string;
  statusCode?: number;
  originalError?: Error;
  context?: Record<string, unknown>;
  timestamp?: Date;
}

/**
 * Custom application error class
 */
export class AppError extends Error {
  public code: ErrorCode;
  public statusCode?: number;
  public context?: Record<string, unknown>;
  public timestamp: Date;

  constructor(details: ErrorDetails | string) {
    let parsedDetails: ErrorDetails;

    if (typeof details === 'string') {
      parsedDetails = {
        code: 'UNKNOWN',
        message: details
      };
    } else {
      parsedDetails = details as ErrorDetails;
    }

    super(parsedDetails.message);
    this.name = 'AppError';
    this.code = parsedDetails.code;
    this.statusCode = parsedDetails.statusCode;
    this.context = parsedDetails.context;
    this.timestamp = parsedDetails.timestamp || new Date();

    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, AppError.prototype);

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert error to JSON for logging
   */
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      context: this.context,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack
    };
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage(): string {
    switch (this.code) {
      case 'INVALID_INPUT':
        return 'Please check your input and try again';
      case 'NETWORK_ERROR':
        return 'Network error. Please check your connection';
      case 'API_ERROR':
        return 'Server error. Please try again later';
      case 'AUTHENTICATION_ERROR':
        return 'Authentication failed. Please login again';
      case 'AUTHORIZATION_ERROR':
        return 'You do not have permission to access this resource';
      case 'NOT_FOUND':
        return 'Resource not found';
      case 'TIMEOUT_ERROR':
        return 'Request timeout. Please try again';
      case 'WEBSOCKET_ERROR':
        return 'Connection error. Please refresh the page';
      case 'VALIDATION_ERROR':
        return 'Please check your input and try again';
      default:
        return this.message || 'An unexpected error occurred';
    }
  }
}

/**
 * Error handler utility functions
 */
export const errorHandler = {
  /**
   * Normalize any error type to AppError
   */
  normalize: (error: unknown): AppError => {
    if (error instanceof AppError) {
      return error;
    }

    if (error instanceof Error) {
      return new AppError({
        code: 'UNKNOWN',
        message: error.message,
        originalError: error
      });
    }

    if (typeof error === 'string') {
      return new AppError({
        code: 'UNKNOWN',
        message: error
      });
    }

    if (typeof error === 'object' && error !== null) {
      const errorObj = error as Record<string, unknown>;
      return new AppError({
        code: (errorObj.code as ErrorCode) || 'UNKNOWN',
        message: (errorObj.message as string) || String(error),
        statusCode: errorObj.statusCode as number | undefined,
        context: errorObj
      });
    }

    return new AppError({
      code: 'UNKNOWN',
      message: 'An unknown error occurred'
    });
  },

  /**
   * Handle network/API errors
   */
  handleNetworkError: (error: unknown, url?: string): AppError => {
    const normalized = errorHandler.normalize(error);

    if (error instanceof TypeError && error.message.includes('fetch')) {
      return new AppError({
        code: 'NETWORK_ERROR',
        message: 'Failed to connect to the server',
        originalError: normalized,
        context: { url }
      });
    }

    return normalized;
  },

  /**
   * Handle API response errors
   */
  handleApiError: (status: number, data?: unknown): AppError => {
    let code: ErrorCode = 'API_ERROR';
    let message = 'An error occurred';
    const dataObj = data as Record<string, unknown> | null;

    switch (status) {
      case 400:
        code = 'VALIDATION_ERROR';
        message = (dataObj?.message as string) || 'Invalid request';
        break;
      case 401:
        code = 'AUTHENTICATION_ERROR';
        message = (dataObj?.message as string) || 'Authentication required';
        break;
      case 403:
        code = 'AUTHORIZATION_ERROR';
        message = (dataObj?.message as string) || 'Access denied';
        break;
      case 404:
        code = 'NOT_FOUND';
        message = (dataObj?.message as string) || 'Resource not found';
        break;
      case 409:
        code = 'CONFLICT';
        message = (dataObj?.message as string) || 'Conflict with existing resource';
        break;
      case 408:
      case 504:
        code = 'TIMEOUT_ERROR';
        message = (dataObj?.message as string) || 'Request timeout';
        break;
      case 500:
      case 502:
      case 503:
        code = 'API_ERROR';
        message = (dataObj?.message as string) || 'Server error';
        break;
      default:
        message = (dataObj?.message as string) || `Error ${status}`;
    }

    return new AppError({
      code,
      message,
      statusCode: status,
      context: dataObj || undefined
    });
  },

  /**
   * Log error with context
   */
  log: (error: AppError | Error, context?: Record<string, unknown>) => {
    const appError = error instanceof AppError ? error : errorHandler.normalize(error);

    const logData = {
      code: appError.code,
      message: appError.message,
      statusCode: appError.statusCode,
      context: { ...appError.context, ...context },
      timestamp: appError.timestamp.toISOString()
    };

    if (process.env.NODE_ENV === 'development') {
      console.error('[AppError]', logData);
      if (appError.stack) {
        console.error('Stack trace:', appError.stack);
      }
    } else {
      console.error(`[${appError.code}]`, logData.message);
    }

    return logData;
  },

  /**
   * Create a specific error type
   */
  create: (
    code: ErrorCode,
    message: string,
    statusCode?: number,
    context?: Record<string, unknown>
  ): AppError => {
    return new AppError({
      code,
      message,
      statusCode,
      context
    });
  }
};

/**
 * Retry utility for failed operations
 */
export const retry = async <T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    delayMs?: number;
    backoffMultiplier?: number;
    onRetry?: (attempt: number, error: Error) => void;
  } = {}
): Promise<T> => {
  const maxAttempts = options.maxAttempts ?? 3;
  const delayMs = options.delayMs ?? 1000;
  const backoffMultiplier = options.backoffMultiplier ?? 2;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxAttempts) {
        const delay = delayMs * Math.pow(backoffMultiplier, attempt - 1);
        options.onRetry?.(attempt, lastError);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Max retry attempts reached');
};

/**
 * Timeout utility
 */
export const timeout = async <T>(
  promise: Promise<T>,
  ms: number
): Promise<T> => {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(
        new AppError({
          code: 'TIMEOUT_ERROR',
          message: `Operation timed out after ${ms}ms`,
          statusCode: 408
        })
      );
    }, ms);
  });

  return Promise.race([promise, timeoutPromise]);
};

export default AppError;
