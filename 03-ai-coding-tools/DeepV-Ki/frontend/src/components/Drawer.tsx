'use client';

import React from 'react';
import { FaTimes } from 'react-icons/fa';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  width?: string;
}

export default function Drawer({ isOpen, onClose, title, children, width = 'w-80' }: DrawerProps) {
  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed left-0 top-0 h-screen bg-[var(--card-bg)] border-r border-[var(--border-color)] z-50 transform transition-transform duration-300 ease-in-out overflow-y-auto lg:hidden ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } ${width}`}
      >
        {/* Header */}
        {title && (
          <div className="sticky top-0 bg-[var(--card-bg)] border-b border-[var(--border-color)] p-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-[var(--foreground)]">{title}</h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-[var(--background)] transition-colors text-[var(--foreground)]"
              aria-label="Close drawer"
            >
              <FaTimes className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="p-4 text-[var(--foreground)]">
          {children}
        </div>
      </div>
    </>
  );
}
