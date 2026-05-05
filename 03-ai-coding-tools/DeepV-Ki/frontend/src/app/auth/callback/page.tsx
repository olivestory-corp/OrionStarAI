'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function AuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      // Store token in localStorage
      localStorage.setItem('deepwiki_token', token);
      // Redirect to home
      router.push('/');
    } else {
      // Handle error
      console.error('No token found in callback');
      router.push('/?error=no_token');
    }
  }, [router, searchParams]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">Authenticating...</h2>
        <p className="text-gray-500">Please wait while we log you in.</p>
      </div>
    </div>
  );
}
