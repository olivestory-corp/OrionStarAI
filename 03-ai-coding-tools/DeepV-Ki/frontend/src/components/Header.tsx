'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { FiCopy, FiCheck } from 'react-icons/fi';
import { FaBars } from 'react-icons/fa';
import ThemeToggle from '@/components/theme-toggle';
import UserMenu from '@/components/UserMenu';
import { useAuth } from '@/hooks/useAuth';

interface HeaderProps {
  showLogo?: boolean;
  centerContent?: React.ReactNode;
  onMenuClick?: () => void;
  showMenuButton?: boolean;
}

export default function Header({ showLogo = true, centerContent, onMenuClick, showMenuButton = false }: HeaderProps) {
  const { authenticated, loading: authLoading, user, login, logout } = useAuth();
  const [copied, setCopied] = useState(false);

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const defaultCenterContent = (
    <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-2 max-w-[calc(100vw-200px)] px-4 whitespace-nowrap">
      <p className="font-light text-gray-500 dark:text-gray-400 text-sm truncate">DeepV-Ki</p>
      <button
        onClick={handleCopyUrl}
        className="p-1 hover:bg-gray-200 dark:hover:bg-slate-700 rounded transition-colors cursor-pointer flex-shrink-0"
        title="Copy URL"
      >
        {copied ? (
          <FiCheck className="w-4 h-4 text-green-500" />
        ) : (
          <FiCopy className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        )}
      </button>
    </div>
  );

  return (
    <header className="sticky top-0 z-50 bg-white/90 dark:bg-slate-900/80 backdrop-blur-md backdrop-saturate-150 border-b border-orange-100/20 dark:border-slate-800/50 shadow-[0_2px_15px_-3px_rgba(255,241,230,0.6)] dark:shadow-none transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between relative">
        {/* 移动端菜单按钮 */}
        {showMenuButton && (
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors text-gray-700 dark:text-gray-300"
            title="打开菜单"
          >
            <FaBars size={20} />
          </button>
        )}

        {/* Center Content - Hidden on mobile, shown on md+ */}
        <div className="hidden md:block absolute left-1/2 transform -translate-x-1/2">
          {centerContent || defaultCenterContent}
        </div>

        {/* Logo and Title - Full on desktop, compact on mobile */}
        {showLogo && (
          <Link href="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity md:flex-1 group">
            <Image
              src="/deepvki_logo_new.svg"
              alt="DeepV-Ki Logo"
              width={40}
              height={40}
              className="w-10 h-10 flex-shrink-0 group-hover:scale-105 transition-transform duration-300"
            />
            {/* Title - Hidden on mobile */}
            <div className="hidden md:block">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
                DeepV-<span className="font-light text-blue-600 dark:text-blue-400">Ki</span>
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">AI-Powered Documentation</p>
            </div>
          </Link>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 md:flex-1 justify-end">
          <ThemeToggle />

          {!authLoading && (
            <UserMenu
              authenticated={authenticated}
              user={user}
              onLogin={login}
              onLogout={logout}
            />
          )}
        </div>
      </div>
    </header>
  );
}
