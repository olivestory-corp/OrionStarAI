/**
 * SessionInitToast - Session initialization status toast
 * Pure UI component, no Context dependency
 */

import React from 'react';

interface SessionInitToastProps {
  /** Whether connected */
  isConnected: boolean;
  /** Whether initialized */
  isInitialized: boolean;
  /** Whether VAD is ready */
  isVADReady: boolean;
}

export function SessionInitToast({ isConnected, isInitialized, isVADReady }: SessionInitToastProps) {
  const isFullyReady = isConnected && isInitialized && isVADReady;

  if (isFullyReady) {
    return null;
  }

  const getStatusText = () => {
    if (!isConnected) return 'Connecting to server...';
    if (!isInitialized) return 'Initializing AI...';
    if (!isVADReady) return 'Loading voice module...';
    return 'Preparing...';
  };

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] animate-pulse">
      <div className="flex items-center gap-3 px-5 py-3 bg-slate-800/95 backdrop-blur-md rounded-full border border-slate-600/50 shadow-lg shadow-black/20">
        <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-medium text-slate-200">
          {getStatusText()}
        </span>
      </div>
    </div>
  );
}

export default SessionInitToast;
