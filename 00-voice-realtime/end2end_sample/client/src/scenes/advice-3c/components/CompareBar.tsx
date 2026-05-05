/**
 * CompareBar - Floating Compare Bar
 * 悬浮对比栏 - 显示已选对比商品，支持添加/删除/打开对比
 *
 * Features:
 * - Fixed at bottom of screen
 * - Shows up to 4 products as thumbnails
 * - Remove individual products or clear all
 * - Open compare modal when 2+ products selected
 */

import React, { useState } from 'react';
import { Product, formatPrice } from '../data';

// =============== Constants ===============

export const MAX_COMPARE_PRODUCTS = 4;

// =============== Types ===============

interface CompareBarProps {
  products: Product[];
  onRemove: (productCode: string) => void;
  onClear: () => void;
  onCompare: () => void;
}

// =============== Thumbnail Card ===============

const CompareThumbnail: React.FC<{
  product: Product;
  index: number;
  onRemove: () => void;
}> = ({ product, index, onRemove }) => {
  const [imgError, setImgError] = useState(false);

  // Different border colors for each slot
  const borderColors = [
    'border-blue-500',
    'border-purple-500',
    'border-cyan-500',
    'border-pink-500',
  ];
  const bgColors = [
    'bg-blue-500',
    'bg-purple-500',
    'bg-cyan-500',
    'bg-pink-500',
  ];

  return (
    <div className={`relative group flex-shrink-0 w-20 bg-slate-700/80 rounded-lg overflow-hidden border-2 ${borderColors[index % 4]} transition-all hover:scale-105`}>
      {/* Index Badge */}
      <div className={`absolute top-0.5 left-0.5 w-4 h-4 ${bgColors[index % 4]} rounded text-[10px] font-bold text-white flex items-center justify-center z-10`}>
        {String.fromCharCode(65 + index)}
      </div>

      {/* Remove Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 hover:bg-red-400 rounded-full text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
        title="Remove from compare"
      >
        ✕
      </button>

      {/* Product Image */}
      <div className="aspect-square bg-white p-1">
        {!imgError ? (
          <img
            src={product.picUrl}
            alt={product.name}
            className="w-full h-full object-contain"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xl bg-slate-100">
            📦
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="p-1">
        <p className="text-[9px] text-slate-300 line-clamp-1">{product.brand}</p>
        <p className="text-[10px] text-blue-400 font-bold">{formatPrice(product.priceSale)}</p>
      </div>
    </div>
  );
};

// =============== Empty Slot ===============

const EmptySlot: React.FC<{ index: number }> = ({ index }) => {
  const borderColors = [
    'border-blue-500/30',
    'border-purple-500/30',
    'border-cyan-500/30',
    'border-pink-500/30',
  ];

  return (
    <div className={`flex-shrink-0 w-20 h-24 rounded-lg border-2 border-dashed ${borderColors[index % 4]} flex items-center justify-center`}>
      <div className="text-center">
        <span className="text-slate-500 text-xl">+</span>
        <p className="text-[9px] text-slate-500">Add</p>
      </div>
    </div>
  );
};

// =============== Main CompareBar ===============

export const CompareBar: React.FC<CompareBarProps> = ({
  products,
  onRemove,
  onClear,
  onCompare,
}) => {
  // Don't show if no products
  if (products.length === 0) {
    return null;
  }

  const canCompare = products.length >= 2;
  const isFull = products.length >= MAX_COMPARE_PRODUCTS;
  const emptySlots = Math.max(0, 2 - products.length); // Show empty slots only when less than 2 products

  return (
    <div
      className="fixed top-4 right-4 z-50"
      style={{ animation: 'fadeSlideIn 0.3s ease-out' }}
    >
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
      <div className="bg-slate-800/95 backdrop-blur-sm rounded-2xl border border-slate-600 shadow-2xl shadow-black/50 px-4 py-3 flex items-center gap-4">
        {/* Compare Icon & Label */}
        <div className="flex items-center gap-2 pr-3 border-r border-slate-600">
          <span className="text-2xl">⚖️</span>
          <div>
            <p className="text-white text-sm font-bold">Compare</p>
            <p className="text-slate-400 text-[10px]">
              {products.length}/{MAX_COMPARE_PRODUCTS} selected
            </p>
          </div>
        </div>

        {/* Product Thumbnails */}
        <div className="flex items-center gap-2">
          {products.map((product, index) => (
            <CompareThumbnail
              key={product.code}
              product={product}
              index={index}
              onRemove={() => onRemove(product.code)}
            />
          ))}

          {/* Empty Slots (show when less than 2) */}
          {Array.from({ length: emptySlots }).map((_, i) => (
            <EmptySlot key={`empty-${i}`} index={products.length + i} />
          ))}

          {/* Full Indicator */}
          {isFull && (
            <div className="text-xs text-yellow-400 px-2">
              Max {MAX_COMPARE_PRODUCTS}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pl-3 border-l border-slate-600">
          {/* Clear Button */}
          <button
            onClick={onClear}
            className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition-colors flex items-center gap-1"
            title="Clear all"
          >
            <span>🗑️</span>
            <span className="hidden sm:inline">Clear</span>
          </button>

          {/* Compare Button */}
          <button
            onClick={onCompare}
            disabled={!canCompare}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
              canCompare
                ? 'bg-blue-500 hover:bg-blue-400 text-white hover:scale-105'
                : 'bg-slate-700 text-slate-500 cursor-not-allowed'
            }`}
          >
            <span>📊</span>
            <span>Compare {canCompare ? `(${products.length})` : ''}</span>
          </button>
        </div>
      </div>

      {/* Hint when only 1 product */}
      {products.length === 1 && (
        <div className="text-center mt-2">
          <p className="text-slate-400 text-xs bg-slate-800/80 rounded-full px-3 py-1 inline-block">
            Add 1 more product to compare
          </p>
        </div>
      )}
    </div>
  );
};

// =============== Animation Styles ===============
// Add this to your global CSS or tailwind config:
// @keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
// .animate-slideUp { animation: slideUp 0.3s ease-out; }

export default CompareBar;
