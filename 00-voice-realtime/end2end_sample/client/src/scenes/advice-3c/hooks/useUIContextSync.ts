/**
 * useUIContextSync - Sync UI context to LLM
 * ส่งข้อมูล UI context ไปยัง LLM
 *
 * Only sends when context changes, with debounce to prevent spam.
 */

import { useEffect, useRef, useCallback } from 'react';

// =============== Types ===============

export interface UIContext {
  /** Current page view */
  page: 'home' | 'category' | 'search' | 'compare';
  /** Category slug when viewing category */
  category?: string;
  /** Category name for display */
  categoryName?: string;
  /** Search query */
  searchQuery?: string;
  /** Currently selected/viewing product */
  selectedProduct?: {
    code: string;
    name: string;
    price: number;
    brand: string;
  };
  /** Active brand filter */
  filterBrand?: string;
  /** Active sub-category filter */
  filterSubCategory?: string;
  /** Number of products displayed */
  productCount?: number;
  /** Products being compared */
  compareProducts?: Array<{ code: string; name: string }>;
}

interface UseUIContextSyncOptions {
  /** Debounce delay in ms (default: 500) */
  debounceMs?: number;
  /** Enable/disable sync (default: true) */
  enabled?: boolean;
}

// =============== Format Functions ===============

/**
 * Format UI context to a compact string for LLM
 * Keep it SHORT to minimize token usage
 */
function formatUIContext(ctx: UIContext): string {
  const parts: string[] = [];

  switch (ctx.page) {
    case 'home':
      parts.push('Browsing categories');
      break;

    case 'category':
      parts.push(`Category: ${ctx.categoryName || ctx.category}`);
      if (ctx.productCount) parts.push(`${ctx.productCount} items`);
      if (ctx.filterBrand) parts.push(`brand=${ctx.filterBrand}`);
      if (ctx.filterSubCategory) parts.push(`type=${ctx.filterSubCategory}`);
      break;

    case 'search':
      parts.push(`Search: "${ctx.searchQuery}"`);
      if (ctx.productCount) parts.push(`${ctx.productCount} results`);
      if (ctx.filterBrand) parts.push(`brand=${ctx.filterBrand}`);
      break;

    case 'compare':
      if (ctx.compareProducts && ctx.compareProducts.length >= 2) {
        const names = ctx.compareProducts.map(p => p.name.split(' ').slice(0, 3).join(' ')).join(' vs ');
        parts.push(`Comparing: ${names}`);
      } else {
        parts.push('Compare mode');
      }
      break;
  }

  // Add selected product info (compact format)
  if (ctx.selectedProduct && ctx.page !== 'compare') {
    const p = ctx.selectedProduct;
    // Truncate name to first 4 words
    const shortName = p.name.split(' ').slice(0, 4).join(' ');
    parts.push(`Viewing: ${shortName} ฿${p.price.toLocaleString()} [${p.code}]`);
  }

  return parts.join(' | ');
}

/**
 * Generate a hash for quick comparison
 */
function hashContext(ctx: UIContext): string {
  return JSON.stringify({
    p: ctx.page,
    c: ctx.category,
    q: ctx.searchQuery,
    s: ctx.selectedProduct?.code,
    fb: ctx.filterBrand,
    fs: ctx.filterSubCategory,
    cp: ctx.compareProducts?.map(p => p.code).join(','),
  });
}

// =============== Hook ===============

export function useUIContextSync(
  context: UIContext,
  sendMessage: (text: string) => void,
  options: UseUIContextSyncOptions = {}
) {
  const { debounceMs = 500, enabled = true } = options;

  const lastHashRef = useRef<string>('');
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  // Sync context when it changes
  useEffect(() => {
    if (!enabled) return;

    // Generate hash for comparison
    const currentHash = hashContext(context);

    // Skip if no change
    if (currentHash === lastHashRef.current) return;

    // Clear pending timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // Debounce: wait before sending
    timerRef.current = setTimeout(() => {
      // Double-check hash hasn't changed during debounce
      const newHash = hashContext(context);
      if (newHash === lastHashRef.current) return;

      lastHashRef.current = newHash;

      // Format and send
      const message = formatUIContext(context);
      if (message) {
        console.log('[UIContextSync] 📤 Sending:', message);
        sendMessage(`(UI) ${message}`);
      }
    }, debounceMs);

  }, [context, sendMessage, debounceMs, enabled]);

  // Manual sync function (for immediate sync if needed)
  const syncNow = useCallback(() => {
    if (!enabled) return;

    const message = formatUIContext(context);
    if (message) {
      lastHashRef.current = hashContext(context);
      console.log('[UIContextSync] 📤 Immediate sync:', message);
      sendMessage(`(UI) ${message}`);
    }
  }, [context, sendMessage, enabled]);

  return { syncNow };
}

export default useUIContextSync;
