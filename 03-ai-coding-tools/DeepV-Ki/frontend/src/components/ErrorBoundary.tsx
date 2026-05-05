'use client';

import React from 'react';

interface Props {
  children: React.ReactNode;
  fallback?: (error: Error, reset: () => void) => React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * Error Boundary component to catch errors in child components
 * Prevents entire app from crashing due to a single component error
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      errorInfo
    });

    // Log error with component stack
    console.error('[ErrorBoundary] Caught error:', {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack
    });

    // Call parent error handler if provided
    this.props.onError?.(error, errorInfo);
  }

  reset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render() {
    if (this.state.hasError) {
      return this.props.fallback ? (
        this.props.fallback(this.state.error!, this.reset)
      ) : (
        <ErrorFallback
          error={this.state.error!}
          reset={this.reset}
          isDevelopment={process.env.NODE_ENV === 'development'}
          errorInfo={this.state.errorInfo}
        />
      );
    }

    return this.props.children;
  }
}

interface ErrorFallbackProps {
  error: Error;
  reset: () => void;
  isDevelopment: boolean;
  errorInfo: React.ErrorInfo | null;
}

/**
 * Default error fallback UI
 */
function ErrorFallback({
  error,
  reset,
  isDevelopment,
  errorInfo
}: ErrorFallbackProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-50 dark:from-gray-900 dark:to-red-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 md:p-8">
        {/* Error Icon */}
        <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 dark:bg-red-900 rounded-full">
          <svg
            className="w-6 h-6 text-red-600 dark:text-red-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4v2m0 4v2M7.343 7.343a6 6 0 1112.314 0"
            />
          </svg>
        </div>

        {/* Error Title */}
        <h2 className="mt-4 text-xl font-semibold text-gray-900 dark:text-white text-center">
          Something went wrong
        </h2>

        {/* Error Message */}
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 text-center">
          {error.message || 'An unexpected error occurred. Please try again.'}
        </p>

        {/* Development Error Details */}
        {isDevelopment && errorInfo && (
          <details className="mt-4 p-3 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono text-gray-700 dark:text-gray-300 max-h-40 overflow-auto">
            <summary className="cursor-pointer font-semibold mb-2 hover:text-gray-900 dark:hover:text-gray-100">
              Error Details (Development Only)
            </summary>
            <pre className="overflow-auto whitespace-pre-wrap break-words text-xs">
              {errorInfo.componentStack}
            </pre>
          </details>
        )}

        {/* Error Stack in Development */}
        {isDevelopment && error.stack && (
          <details className="mt-2 p-3 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono text-gray-700 dark:text-gray-300 max-h-40 overflow-auto">
            <summary className="cursor-pointer font-semibold mb-2 hover:text-gray-900 dark:hover:text-gray-100">
              Stack Trace
            </summary>
            <pre className="overflow-auto whitespace-pre-wrap break-words text-xs">
              {error.stack}
            </pre>
          </details>
        )}

        {/* Action Buttons */}
        <div className="mt-6 flex flex-col gap-3">
          <button
            onClick={reset}
            className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 dark:hover:bg-red-600 text-white rounded-lg font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
          >
            Try again
          </button>

          <button
            onClick={() => (window.location.href = '/')}
            className="w-full px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
          >
            Go to home
          </button>

          {isDevelopment && (
            <button
              onClick={() => {
                console.error('Full error object:', error);
              }}
              className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg font-medium text-xs transition-colors duration-200"
            >
              Log to console
            </button>
          )}
        </div>

        {/* Support Info */}
        <p className="mt-4 text-xs text-gray-500 dark:text-gray-400 text-center">
          If the problem persists, please contact support or check the console for more details.
        </p>
      </div>
    </div>
  );
}
