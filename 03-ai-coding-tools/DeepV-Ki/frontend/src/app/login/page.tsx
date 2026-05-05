'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/hooks/useAuth';
import { FaSpinner } from 'react-icons/fa';
import ThemeToggle from '@/components/theme-toggle';

export default function LoginPage() {
  const router = useRouter();
  const { authenticated, loading, login, user } = useAuth();

  useEffect(() => {
    // If already authenticated, redirect to home
    if (!loading && authenticated) {
      router.push('/');
    }
  }, [authenticated, loading, router]);

  const handleLogin = async () => {
    try {
      await login();
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  return (
    <div className="min-h-screen paper-texture p-4 md:p-8 flex flex-col">
      {/* Header with theme toggle */}
      <header className="max-w-6xl mx-auto mb-6 h-fit w-full">
        <div className="flex items-center justify-between bg-[var(--card-bg)] rounded-lg shadow-custom border border-[var(--border-color)] p-4">
          <div className="flex items-center">
            <div className="mr-3">
              <Image
                src="/deepvki_logo_new.svg"
                alt="DeepV-Ki Logo"
                width={40}
                height={40}
                className="w-10 h-10"
              />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-[var(--accent-primary)]">
                DeepV-Ki
              </h1>
              <p className="text-xs text-[var(--muted)]">
                AI-Powered Wiki Generator
              </p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Main login content */}
      <main className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-md bg-[var(--card-bg)] rounded-lg shadow-custom border border-[var(--border-color)] p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <Image
                src="/deepvki_logo_new.svg"
                alt="DeepV-Ki Logo"
                width={96}
                height={96}
                className="w-24 h-24"
              />
            </div>
            <h2 className="text-2xl font-bold text-[var(--foreground)] mb-2">
              Welcome to DeepV-Ki
            </h2>
            <p className="text-[var(--muted)] text-sm">
              Please log in with your company account to continue
            </p>
          </div>

          {/* Loading state */}
          {loading && (
            <div className="text-center py-12">
              <FaSpinner className="text-4xl text-[var(--accent-primary)] animate-spin mx-auto mb-4" />
              <p className="text-[var(--muted)]">Checking your session...</p>
            </div>
          )}

          {/* Login form */}
          {!loading && !authenticated && (
            <div className="space-y-4">
              <p className="text-sm text-[var(--foreground)] text-center mb-6">
                Click the button below to log in using your GitLab account.
              </p>

              <button
                onClick={handleLogin}
                className="w-full btn-japanese px-6 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all bg-[#FC6D26] hover:bg-[#E24329] text-white border-none"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .41.26l2.47 7.58h8.6l2.47-7.58A.43.43 0 0 1 19.18 2a.42.42 0 0 1 .1.11.42.42 0 0 1 .01.1l2.44 7.51 1.22 3.78a.84.84 0 0 1-.3.94z" fill="currentColor"/>
                </svg>
                <span>Login with GitLab</span>
              </button>

              <div className="mt-6 p-4 bg-[var(--accent-primary)]/5 border border-[var(--accent-primary)]/20 rounded-lg">
                <p className="text-xs text-[var(--muted)]">
                  You will be redirected to GitLab to securely log in.
                </p>
              </div>
            </div>
          )}

          {/* User already logged in */}
          {!loading && authenticated && user && (
            <div className="text-center space-y-4">
              <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-green-800 dark:text-green-200 text-sm font-semibold mb-2">
                  ✓ Already logged in
                </p>
                <p className="text-sm text-green-700 dark:text-green-300">
                  Welcome, {user.username}
                </p>
              </div>
              <button
                onClick={() => router.push('/')}
                className="w-full btn-japanese px-6 py-3 rounded-lg font-semibold transition-all"
              >
                Continue to Application
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto mt-6 w-full text-center text-xs text-[var(--muted)]">
        <p>© 2025 DeepV-Ki. All rights reserved.</p>
      </footer>
    </div>
  );
}
