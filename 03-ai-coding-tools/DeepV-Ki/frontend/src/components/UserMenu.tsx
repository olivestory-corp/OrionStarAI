'use client';

import React, { useState, useRef, useEffect } from 'react';
import { FaUser, FaSignOutAlt, FaSignInAlt } from 'react-icons/fa';

export interface UserMenuProps {
  authenticated: boolean;
  user?: {
    username: string;
    uid: string;
    user_no?: string;
  } | null;
  onLogin?: () => void;
  onLogout?: () => void;
}

export default function UserMenu({
  authenticated,
  user,
  onLogin,
  onLogout,
}: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!authenticated) {
    return (
      <button
        onClick={onLogin}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)]/90 transition-colors text-sm font-semibold cursor-pointer"
      >
        <FaSignInAlt className="text-lg" />
        <span>Login</span>
      </button>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--foreground)] hover:bg-[var(--accent-primary)]/5 transition-colors text-sm cursor-pointer"
        title={user?.uid || 'User'}
      >
        <FaUser className="text-lg" />
        <span className="truncate max-w-xs">{user?.username || 'User'}</span>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg shadow-custom z-50">
          <div className="p-3 border-b border-[var(--border-color)]">
            <p className="text-sm font-semibold text-[var(--foreground)]">
              {user?.username}
            </p>
            <p className="text-xs text-[var(--muted)]">
              {user?.uid}
            </p>
            {user?.user_no && (
              <p className="text-xs text-[var(--muted)]">
                ID: {user.user_no}
              </p>
            )}
          </div>

          <div className="p-2">
            <button
              onClick={() => {
                onLogout?.();
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer"
            >
              <FaSignOutAlt />
              <span>Logout</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
