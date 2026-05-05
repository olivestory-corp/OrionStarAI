'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { APIClient } from '@/lib/api/client';

export interface UserInfo {
  username: string;
  uid: string;
  user_no: string;
  sex?: string;
}

export interface AuthState {
  authenticated: boolean;
  user: UserInfo | null;
  loading: boolean;
  error: string | null;
}

/**
 * Hook for managing authentication and user session
 * Checks session cookie and validates with backend
 */
export function useAuth() {
  // Try to load auth state from sessionStorage first
  const getCachedAuthState = (): AuthState => {
    try {
      const cached = sessionStorage.getItem('auth_state_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        // Return cached state with loading false for instant display
        // Background verification will happen anyway
        return {
          ...parsed,
          loading: false
        };
      }
    } catch {
      console.debug('Failed to load cached auth state');
    }
    return {
      authenticated: false,
      user: null,
      loading: true,
      error: null
    };
  };

  const [authState, setAuthState] = useState<AuthState>(getCachedAuthState());

  const checkAuthRef = useRef(false);

  /**
   * Check authentication status from backend
   */
  const checkAuth = useCallback(async () => {
    try {
      const token = localStorage.getItem('deepwiki_token');
      console.log('[useAuth] Checking auth with token:', token ? token.substring(0, 10) + '...' : 'null');

      // APIClient automatically handles token injection
      // Use GitLab user endpoint
      const data = await APIClient.get<{ id: string; username: string; name: string; email: string }>('/api/auth/gitlab/user');

      console.log('[useAuth] Status data:', data);

      const newAuthState: AuthState = data && data.username
        ? {
            authenticated: true,
            user: {
              username: data.username,
              uid: data.id,
              user_no: data.id, // Map ID to user_no for compatibility
              sex: ''
            },
            loading: false,
            error: null
          }
        : {
            authenticated: false,
            user: null,
            loading: false,
            error: null
          };

      setAuthState(newAuthState);

      // Cache the auth state in sessionStorage
      try {
        sessionStorage.setItem('auth_state_cache', JSON.stringify(newAuthState));
      } catch {
        console.debug('Failed to cache auth state');
      }
    } catch (error) {
      console.error('Error checking authentication:', error);
      setAuthState({
        authenticated: false,
        user: null,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }, []);

  /**
   * Redirect to login
   */
  const login = useCallback(() => {
    // Directly redirect to the backend login endpoint which handles the OAuth flow
    // Pass current origin as callback_url to support local development against remote backend
    const callbackUrl = encodeURIComponent(`${window.location.origin}/auth/callback`);
    // Use GitLab login endpoint
    window.location.href = `/api/auth/gitlab/login?callback_url=${callbackUrl}`;
  }, []);

  /**
   * Logout and clear session
   */
  const logout = useCallback(async () => {
    try {
      // Use GitLab logout endpoint
      await APIClient.post('/api/auth/gitlab/logout');

      const loggedOutState = {
        authenticated: false,
        user: null,
        loading: false,
        error: null
      };
      setAuthState(loggedOutState);

      // Clear auth cache
      try {
        sessionStorage.removeItem('auth_state_cache');
        localStorage.removeItem('deepwiki_token');
      } catch {
        console.debug('Failed to clear auth cache');
      }

      // Redirect to home
      window.location.href = '/';
    } catch (error) {
      console.error('Error during logout:', error);
      setAuthState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Logout failed'
      }));
    }
  }, []);

  /**
   * Check authentication on component mount
   */
  useEffect(() => {
    // Prevent multiple checks
    if (!checkAuthRef.current) {
      checkAuthRef.current = true;
      checkAuth();
    }
  }, [checkAuth]);

  return {
    ...authState,
    checkAuth,
    login,
    logout
  };
}

/**
 * Hook for requiring authentication
 * Redirects to login if not authenticated
 */
export function useRequireAuth() {
  const auth = useAuth();
  const [redirected, setRedirected] = useState(false);

  useEffect(() => {
    if (!auth.loading && !auth.authenticated && !redirected) {
      // User is not authenticated, redirect to login
      auth.login();
      setRedirected(true);
    }
  }, [auth.loading, auth.authenticated, auth.login, redirected, auth]);

  return auth;
}
