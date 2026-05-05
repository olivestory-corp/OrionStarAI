import React from 'react';

interface PermissionModalProps {
  isOpen: boolean;
  onRequest: () => void;
  onClose?: () => void;
  error?: string | null;
  isLoading?: boolean;
}

export function PermissionModal({ isOpen, onRequest, onClose, error, isLoading }: PermissionModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 sm:p-8 animate-in fade-in zoom-in duration-300 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
          aria-label="关闭"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="text-center mb-6">
          <div className="inline-block mb-4 p-3 bg-blue-50 rounded-full">
            <span className="text-5xl block">🎤</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">
            麦克风权限
          </h2>
          <p className="text-slate-600 text-sm">
            为了提供最佳的语音交互体验
          </p>
        </div>

        <p className="text-slate-700 text-center mb-6 leading-relaxed">
          我们需要访问您的麦克风权限。您可以随时在浏览器设置中更改权限。
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-700 text-sm font-medium">{error}</p>
          </div>
        )}

        <button
          onClick={onRequest}
          disabled={isLoading}
          className="w-full bg-transparent border-2 border-black hover:bg-black hover:text-white disabled:opacity-50 disabled:cursor-not-allowed text-black font-medium py-3 px-6 rounded-lg transition-all duration-200 mb-3 flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              <span>正在检查授权...</span>
            </>
          ) : (
            '好，授权麦克风'
          )}
        </button>

        <p className="text-slate-500 text-xs text-center">
          ✓ 我们重视您的隐私，仅在您主动发言时传输数据
        </p>
      </div>
    </div>
  );
}
