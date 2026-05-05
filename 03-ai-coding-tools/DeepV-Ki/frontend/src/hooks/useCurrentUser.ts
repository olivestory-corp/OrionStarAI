/**
 * useCurrentUser Hook
 * 统一获取当前登录用户信息
 */

'use client';

import { useState, useEffect } from 'react';

interface CurrentUser {
  email: string;
  loading: boolean;
  error: string | null;
}

/**
 * 获取当前用户信息
 * @returns {CurrentUser} 用户信息对象
 */
export function useCurrentUser(): CurrentUser {
  const [user, setUser] = useState<CurrentUser>({
    email: '',
    loading: true,
    error: null,
  });

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch('/api/auth/sso/user');
        
        if (!response.ok) {
          throw new Error(`Failed to fetch user: ${response.status}`);
        }

        const data = await response.json();
        const email = data?.user_info?.uid || '';

        setUser({
          email,
          loading: false,
          error: null,
        });
      } catch (error) {
        console.error('Failed to get user email:', error);
        setUser({
          email: '',
          loading: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    };

    fetchUser();
  }, []);

  return user;
}

