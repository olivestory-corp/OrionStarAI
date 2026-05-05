/**
 * Advice3CScreen - Main Shopping UI
 * หน้าจอหลักสำหรับช้อปปิ้ง IT / Electronics
 *
 * Structure:
 * 1. Category Grid View (首页) - 显示所有分类
 * 2. Category Detail View (分类详情) - 品牌筛选 + 产品列表
 */

import React, { useState, useMemo, useEffect, memo, CSSProperties } from 'react';
import { FixedSizeGrid as Grid, GridChildComponentProps } from 'react-window';
// @ts-ignore - AutoSizer types issue with React 18
import AutoSizer from 'react-virtualized-auto-sizer';
import { Product, getCategories, getSubCategoriesFromProducts, formatPrice, getStockStatus, formatWarranty } from '../data';

// =============== 购买二维码 URL 前缀 ===============
const PURCHASE_QR_URL_PREFIX = 'https://shop.advice.co.th/product/';

// =============== 二维码生成辅助函数 (使用 Google Chart API) ===============
const generateQRCodeUrl = (data: string, size: number = 200): string => {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`
};

// =============== Types ===============

interface SearchParams {
  keyword?: string;
  brand?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  hasDiscount?: boolean;
  inStock?: boolean;
  sortBy?: string;
  limit?: number;
}

interface Advice3CScreenProps {
  // Data
  displayProducts: Product[];
  selectedProduct: Product | null;
  selectedCategory: string | null;

  // State
  searchQuery?: string;
  searchParams?: SearchParams;
  searchTotal?: number;

  // Compare
  compareProducts?: Product[];
  maxCompareProducts?: number;

  // Callbacks
  onSelectProduct: (product: Product) => void;
  onSelectCategory: (slug: string | null) => void;
  onFilterChange?: (brand: string | null, subCategory: string | null) => void;
  onAddToCompare?: (product: Product) => void;
  onRemoveFromCompare?: (productCode: string) => void;
  onSearch?: (keyword: string, category?: string | null) => void;
  onExit?: () => void;

  }

// =============== Navigation Confirm Modal ===============

const NavigationConfirmModal: React.FC<{
  isOpen: boolean;
  productName: string;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ isOpen, productName, onConfirm, onCancel }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-800 rounded-2xl p-6 max-w-md w-full mx-4 border border-slate-700 shadow-2xl">
        <div className="text-center">
          <div className="text-5xl mb-4">🗺️</div>
          <h3 className="text-xl font-bold text-white mb-2">Take Me There</h3>
          <p className="text-slate-400 mb-6">
            Navigate to view <span className="text-blue-400 font-medium">{productName}</span>?
          </p>
          <p className="text-slate-500 text-sm mb-6">
            The robot will guide you to the product display area
          </p>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 py-3 bg-blue-500 hover:bg-blue-400 text-white rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
            >
              <span>🚀</span>
              <span>Confirm</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// =============== Purchase QR Code Modal ===============

const PurchaseQRModal: React.FC<{
  isOpen: boolean;
  productCode: string;
  productName: string;
  onClose: () => void;
}> = ({ isOpen, productCode, productName, onClose }) => {
  const [qrLoading, setQrLoading] = useState(true);
  const [qrError, setQrError] = useState(false);

  // Reset state when modal reopens
  useEffect(() => {
    if (isOpen) {
      setQrLoading(true);
      setQrError(false);
    }
  }, [isOpen, productCode]);

  if (!isOpen) return null;

  const purchaseUrl = `${PURCHASE_QR_URL_PREFIX}${productCode}`;
  const qrCodeImageUrl = generateQRCodeUrl(purchaseUrl, 200);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-800 rounded-2xl p-6 max-w-md w-full mx-4 border border-slate-700 shadow-2xl">
        <div className="text-center">
          <div className="flex justify-between items-start mb-4">
            <div className="text-4xl">🛒</div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors p-1"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Scan to Purchase</h3>
          <p className="text-slate-400 text-sm mb-4 line-clamp-2">
            {productName}
          </p>

          {/* QR Code */}
          <div className="bg-white rounded-xl p-4 inline-flex items-center justify-center mb-4" style={{ minHeight: 232, minWidth: 232 }}>
            {qrLoading && !qrError && (
              <div className="text-slate-400 text-sm">Loading...</div>
            )}
            {qrError ? (
              <div className="text-red-500 text-sm">Failed to load QR code</div>
            ) : (
              <img
                src={qrCodeImageUrl}
                alt="Purchase QR Code"
                className={qrLoading ? 'hidden' : 'block'}
                style={{ width: 200, height: 200 }}
                onLoad={() => setQrLoading(false)}
                onError={() => { setQrLoading(false); setQrError(true); }}
              />
            )}
          </div>

          <p className="text-slate-500 text-sm mb-2">
            Scan with your phone to purchase
          </p>
          <p className="text-slate-600 text-xs break-all">
            {purchaseUrl}
          </p>

          <button
            onClick={onClose}
            className="mt-6 w-full py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// =============== Category Card ===============

const CategoryCard: React.FC<{
  name: string;
  slug: string;
  productCount: number;
  onClick: () => void;
}> = ({ name, slug, productCount, onClick }) => {
  // Category icons mapping
  const getCategoryIcon = (slug: string): string => {
    const iconMap: Record<string, string> = {
      'notebooks': '💻',
      'apple-product': '🍎',
      'monitor-จอคอม': '🖥️',
      'computer-hardware': '🔧',
      'headset-microphone': '🎧',
      'mouse-pads': '🖱️',
      'keyboard': '⌨️',
      'printer-เครื่องพิมพ์': '🖨️',
      'networking': '🌐',
      'storage': '💾',
      'gaming': '🎮',
      'camera': '📷',
      'mobile': '📱',
      'tablet': '📲',
      'speaker': '🔊',
      'accessories': '🎒',
      'software': '💿',
      'ups-stabilizer': '🔋',
      'tv': '📺',
      'projector': '📽️',
    };
    // Try to match by partial slug
    for (const [key, icon] of Object.entries(iconMap)) {
      if (slug.toLowerCase().includes(key.toLowerCase())) return icon;
    }
    return '📦';
  };

  return (
    <div
      onClick={onClick}
      className="bg-slate-800/60 hover:bg-slate-700/80 border border-slate-700/50 hover:border-blue-500/50 rounded-2xl p-6 cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:shadow-xl hover:shadow-blue-500/10 group"
    >
      <div className="text-5xl mb-4 group-hover:scale-110 transition-transform">
        {getCategoryIcon(slug)}
      </div>
      <h3 className="text-white font-bold text-lg mb-1 line-clamp-2">{name}</h3>
      <p className="text-slate-400 text-sm">{productCount.toLocaleString()} products</p>
    </div>
  );
};

// =============== Brand Filter Chips ===============

const BrandFilter: React.FC<{
  brands: string[];
  selectedBrand: string | null;
  onSelectBrand: (brand: string | null) => void;
}> = ({ brands, selectedBrand, onSelectBrand }) => {
  return (
    <div className="flex gap-1.5 overflow-x-auto scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
      <button
        onClick={() => onSelectBrand(null)}
        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap flex-shrink-0 ${
          !selectedBrand
            ? 'bg-blue-500 text-white'
            : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
        }`}
      >
        All
      </button>
      {brands.map(brand => (
        <button
          key={brand}
          onClick={() => onSelectBrand(brand)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap flex-shrink-0 ${
            selectedBrand === brand
              ? 'bg-blue-500 text-white'
              : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
          }`}
        >
          {brand}
        </button>
      ))}
    </div>
  );
};

// =============== Sort & Filter Bar ===============

const SortFilterBar: React.FC<{
  sortBy: string | null;
  onSortChange: (sort: string | null) => void;
  totalCount: number;
  filteredCount: number;
}> = ({ sortBy, onSortChange, totalCount, filteredCount }) => {
  const sortOptions = [
    { value: null, label: 'Default' },
    { value: 'price_asc', label: 'Price: Low → High' },
    { value: 'price_desc', label: 'Price: High → Low' },
    { value: 'discount', label: 'Biggest Discount' },
  ];

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="text-slate-400 text-sm">
        Showing <span className="text-white font-medium">{filteredCount}</span>
        {filteredCount !== totalCount && (
          <span> of {totalCount}</span>
        )} products
      </div>

      <div className="flex items-center gap-2">
        <span className="text-slate-500 text-xs">Sort:</span>
        <div className="flex gap-1">
          {sortOptions.map(opt => (
            <button
              key={opt.value ?? 'default'}
              onClick={() => onSortChange(opt.value)}
              className={`px-2.5 py-1 rounded text-xs transition-all ${
                sortBy === opt.value
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// =============== Search Input ===============

const SearchInput: React.FC<{
  onSearch: (keyword: string) => void;
  placeholder?: string;
  initialValue?: string;
}> = ({ onSearch, placeholder = 'Search products...', initialValue = '' }) => {
  const [inputValue, setInputValue] = useState(initialValue);
  const [isFocused, setIsFocused] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (trimmed) {
      onSearch(trimmed);
    }
  };

  const handleClear = () => {
    setInputValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setInputValue('');
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative flex-1 max-w-md">
      <div className={`relative flex items-center transition-all ${
        isFocused ? 'ring-2 ring-sky-400 bg-sky-600' : 'ring-1 ring-sky-500/70'
      } bg-sky-700 hover:bg-sky-600 rounded-lg shadow-md`}>
        {/* Search Icon */}
        <span className="pl-3 text-sky-200">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </span>

        {/* Input */}
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 bg-transparent px-3 py-2.5 text-white text-sm placeholder-sky-200/70 outline-none"
        />

        {/* Clear Button */}
        {inputValue && (
          <button
            type="button"
            onClick={handleClear}
            className="px-2 text-sky-200 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        {/* Search Button */}
        <button
          type="submit"
          disabled={!inputValue.trim()}
          className={`px-4 py-2 m-1 rounded-md text-sm font-medium transition-all ${
            inputValue.trim()
              ? 'bg-white hover:bg-sky-100 text-sky-700'
              : 'bg-sky-800/50 text-sky-300/50 cursor-not-allowed'
          }`}
        >
          Search
        </button>
      </div>

    </form>
  );
};

// =============== Search Params Display (Active Filters) ===============

const SearchParamsDisplay: React.FC<{
  params: SearchParams;
  total: number;
}> = ({ params, total }) => {
  const chips: { label: string; value: string }[] = [];

  if (params.keyword) chips.push({ label: 'Keyword', value: params.keyword });
  if (params.brand) chips.push({ label: 'Brand', value: params.brand });
  if (params.category) chips.push({ label: 'Category', value: params.category });
  if (params.minPrice) chips.push({ label: 'Min', value: `฿${params.minPrice.toLocaleString()}` });
  if (params.maxPrice) chips.push({ label: 'Max', value: `฿${params.maxPrice.toLocaleString()}` });
  if (params.hasDiscount) chips.push({ label: 'Filter', value: 'Discounted' });
  if (params.inStock) chips.push({ label: 'Filter', value: 'In Stock' });
  if (params.sortBy) chips.push({ label: 'Sort', value: params.sortBy.replace('_', ' ') });

  if (chips.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-slate-500 text-[10px]">Filters:</span>
      {chips.map((chip, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-700/60 rounded text-[10px]"
        >
          <span className="text-slate-400">{chip.label}:</span>
          <span className="text-slate-200">{chip.value}</span>
        </span>
      ))}
      <span className="text-green-400/80 text-[10px] ml-1">
        ({total} found)
      </span>
    </div>
  );
};

// =============== SubCategory Filter ===============

const SubCategoryFilter: React.FC<{
  subCategories: string[];
  selected: string | null;
  onSelect: (sub: string | null) => void;
}> = ({ subCategories, selected, onSelect }) => {
  if (subCategories.length === 0) return null;

  return (
    <div className="flex gap-1.5 overflow-x-auto scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
      <button
        onClick={() => onSelect(null)}
        className={`px-2.5 py-1 rounded text-xs transition-all whitespace-nowrap flex-shrink-0 ${
          !selected
            ? 'bg-green-500 text-white'
            : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
        }`}
      >
        All Types
      </button>
      {subCategories.map(sub => (
        <button
          key={sub}
          onClick={() => onSelect(sub)}
          className={`px-2.5 py-1 rounded text-xs transition-all whitespace-nowrap flex-shrink-0 ${
            selected === sub
              ? 'bg-green-500 text-white'
              : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
          }`}
          title={sub}
        >
          {sub}
        </button>
      ))}
    </div>
  );
};

// =============== Product Card ===============

const ProductCard: React.FC<{
  product: Product;
  isSelected: boolean;
  isInCompare: boolean;
  canAddToCompare: boolean;
  onClick: () => void;
  onAddToCompare?: () => void;
  onRemoveFromCompare?: () => void;
}> = ({ product, isSelected, isInCompare, canAddToCompare, onClick, onAddToCompare, onRemoveFromCompare }) => {
  const [imgError, setImgError] = useState(false);
  const stockStatus = getStockStatus(product.type);

  const handleCompareClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isInCompare) {
      onRemoveFromCompare?.();
    } else if (canAddToCompare) {
      onAddToCompare?.();
    }
  };

  return (
    <div
      onClick={onClick}
      className={`
        relative rounded-xl overflow-hidden cursor-pointer transition-all duration-200 group
        ${isSelected
          ? 'ring-2 ring-blue-500 bg-blue-500/10 scale-[1.02]'
          : 'bg-slate-800/50 hover:bg-slate-700/50 hover:scale-[1.01]'}
        ${isInCompare ? 'ring-2 ring-orange-500' : ''}
      `}
    >
      {/* Product Image */}
      <div className="aspect-square bg-white relative p-2">
        {!imgError ? (
          <img
            src={product.picUrl}
            alt={product.name}
            className="w-full h-full object-contain"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl bg-slate-100">
            📦
          </div>
        )}

        {/* Discount Badge */}
        {product.discount > 0 && (
          <span className="absolute top-1 right-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded font-bold">
            -{product.discount}%
          </span>
        )}

        {/* Fast Delivery Badge */}
        {product.fastDelivery && (
          <span className="absolute top-1 left-1 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded flex items-center gap-0.5">
            ⚡ Fast
          </span>
        )}

        {/* Compare Button - Show on hover or when in compare */}
        {(onAddToCompare || onRemoveFromCompare) && (
          <button
            onClick={handleCompareClick}
            disabled={!isInCompare && !canAddToCompare}
            className={`absolute bottom-1 right-1 px-2 py-1 rounded text-[10px] font-medium transition-all
              ${isInCompare
                ? 'bg-orange-500 text-white opacity-100'
                : canAddToCompare
                  ? 'bg-slate-800/90 text-white opacity-0 group-hover:opacity-100 hover:bg-blue-500'
                  : 'bg-slate-800/50 text-slate-400 opacity-0 group-hover:opacity-70 cursor-not-allowed'
              }
            `}
            title={isInCompare ? 'Remove from compare' : canAddToCompare ? 'Add to compare' : 'Compare list full'}
          >
            {isInCompare ? '✓ Compare' : '+ Compare'}
          </button>
        )}

        {/* Compare Badge */}
        {isInCompare && (
          <div className="absolute top-1 left-1 w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-md">
            ⚖️
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="p-2">
        <p className="text-slate-400 text-xs mb-0.5">{product.brand}</p>
        <p className="text-white text-xs line-clamp-2 mb-1 min-h-[2rem]">{product.name}</p>

        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-blue-400 font-bold text-sm">{formatPrice(product.priceSale)}</span>
          {product.discount > 0 && (
            <span className="text-slate-500 text-xs line-through">{formatPrice(product.priceSrp)}</span>
          )}
        </div>

        {/* Stock Status */}
        <p className={`text-xs mt-1 ${product.type === 'instock' ? 'text-green-400' : 'text-yellow-400'}`}>
          {stockStatus.en}
        </p>
      </div>

      {/* Selected Indicator */}
      {isSelected && !isInCompare && (
        <div className="absolute inset-0 border-2 border-blue-500 rounded-xl pointer-events-none" />
      )}
    </div>
  );
};

// =============== Virtual Grid Cell ===============

interface VirtualGridItemData {
  products: Product[];
  columnCount: number;
  gap: number;
  selectedProductCode: string | null;
  compareProductCodes: Set<string>;
  canAddMoreToCompare: boolean;
  onSelectProduct: (product: Product) => void;
  onAddToCompare?: (product: Product) => void;
  onRemoveFromCompare?: (productCode: string) => void;
}

const VirtualGridCell = memo(({ columnIndex, rowIndex, style, data }: GridChildComponentProps<VirtualGridItemData>) => {
  const {
    products,
    columnCount,
    gap,
    selectedProductCode,
    compareProductCodes,
    canAddMoreToCompare,
    onSelectProduct,
    onAddToCompare,
    onRemoveFromCompare,
  } = data;

  const index = rowIndex * columnCount + columnIndex;
  const product = products[index];

  // Cell style - add padding inside to create gap effect
  const cellStyle: CSSProperties = {
    ...style,
    paddingRight: gap,
    paddingBottom: gap,
    boxSizing: 'border-box',
  };

  // Empty cell for out of bounds
  if (!product) {
    return <div style={cellStyle} />;
  }

  const isInCompare = compareProductCodes.has(product.code);

  return (
    <div style={cellStyle}>
      <ProductCard
        product={product}
        isSelected={product.code === selectedProductCode}
        isInCompare={isInCompare}
        canAddToCompare={canAddMoreToCompare}
        onClick={() => onSelectProduct(product)}
        onAddToCompare={onAddToCompare ? () => onAddToCompare(product) : undefined}
        onRemoveFromCompare={onRemoveFromCompare ? () => onRemoveFromCompare(product.code) : undefined}
      />
    </div>
  );
});

VirtualGridCell.displayName = 'VirtualGridCell';

// =============== Product Detail Panel ===============

const ProductDetail: React.FC<{
  product: Product | null;
  isInCompare?: boolean;
  canAddToCompare?: boolean;
  onAddToCompare?: () => void;
  onRemoveFromCompare?: () => void;
  onNavigateToProduct?: (productCode: string) => void;
}> = ({ product, isInCompare = false, canAddToCompare = true, onAddToCompare, onRemoveFromCompare, onNavigateToProduct }) => {
  const [imgError, setImgError] = useState(false);
  const [showNavConfirm, setShowNavConfirm] = useState(false);
  const [showPurchaseQR, setShowPurchaseQR] = useState(false);

  if (!product) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🛒</div>
          <p className="text-slate-400 text-lg">Select a product to view details</p>
          <p className="text-slate-500 text-sm mt-1">เลือกสินค้าเพื่อดูรายละเอียด</p>
        </div>
      </div>
    );
  }

  const stockStatus = getStockStatus(product.type);
  const monthlyPayment = product.installmentMonths && product.installmentMonths.length > 0
    ? Math.ceil(product.priceSale / product.installmentMonths[product.installmentMonths.length - 1])
    : null;

  const handleCompareClick = () => {
    if (isInCompare) {
      onRemoveFromCompare?.();
    } else if (canAddToCompare) {
      onAddToCompare?.();
    }
  };

  const handleNavigateConfirm = () => {
    setShowNavConfirm(false);
    // Call navigation callback to navigate to first map point (test)
    if (onNavigateToProduct) {
      onNavigateToProduct(product.code);
    } else {
      // Default behavior: dispatch custom event for navigation
      window.dispatchEvent(new CustomEvent('advice3c_navigate_to_product', {
        detail: {
          productCode: product.code,
          productName: product.name,
          // Test: navigate to first point on map
          targetPoint: { x: 0, y: 0, name: 'Test Point' },
        },
      }));
    }
  };

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      {/* Navigation Confirm Modal */}
      <NavigationConfirmModal
        isOpen={showNavConfirm}
        productName={product.name}
        onConfirm={handleNavigateConfirm}
        onCancel={() => setShowNavConfirm(false)}
      />

      {/* Purchase QR Code Modal */}
      <PurchaseQRModal
        isOpen={showPurchaseQR}
        productCode={product.code}
        productName={product.name}
        onClose={() => setShowPurchaseQR(false)}
      />

      {/* Product Image */}
      <div className="flex-shrink-0 bg-white rounded-2xl p-4 flex items-center justify-center relative">
        {!imgError ? (
          <img
            src={product.picUrl}
            alt={product.name}
            className="max-w-full max-h-[280px] object-contain"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="text-8xl">📦</div>
        )}

        {/* Badges */}
        <div className="absolute top-4 left-4 flex flex-col gap-2">
          {product.discount > 0 && (
            <span className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold">
              SALE -{product.discount}%
            </span>
          )}
          {product.hasPromotion && (
            <span className="bg-orange-500 text-white px-3 py-1 rounded-full text-sm">
              🎁 Promotion
            </span>
          )}
          {isInCompare && (
            <span className="bg-orange-500 text-white px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1">
              ⚖️ In Compare
            </span>
          )}
        </div>
      </div>

      {/* Product Info */}
      <div className="mt-4 space-y-3 flex-1">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-blue-400 font-medium">{product.brand}</span>
          <span className="text-slate-500">|</span>
          <span className="text-slate-400">{product.menuListName}</span>
        </div>

        <h2 className="text-white text-xl font-bold leading-tight">{product.name}</h2>
        <p className="text-slate-400 text-sm">{product.spec}</p>

        {/* Price */}
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="text-blue-400 text-3xl font-bold">{formatPrice(product.priceSale)}</span>
          {product.discount > 0 && (
            <>
              <span className="text-slate-500 text-lg line-through">{formatPrice(product.priceSrp)}</span>
              <span className="text-green-400 text-sm">
                Save ฿{(product.priceSrp - product.priceSale).toLocaleString()}
              </span>
            </>
          )}
        </div>

        {/* Installment */}
        {monthlyPayment && (
          <div className="bg-blue-500/20 rounded-lg p-3 border border-blue-500/30">
            <p className="text-blue-300 text-sm font-medium">💳 0% Installment</p>
            <p className="text-white text-lg font-bold">
              {formatPrice(monthlyPayment)}/month × {product.installmentMonths![product.installmentMonths!.length - 1]} months
            </p>
          </div>
        )}

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-slate-700/50 rounded-lg p-3">
            <p className="text-slate-400">Stock</p>
            <p className={`font-medium ${product.type === 'instock' ? 'text-green-400' : 'text-yellow-400'}`}>
              {stockStatus.en}
            </p>
          </div>
          <div className="bg-slate-700/50 rounded-lg p-3">
            <p className="text-slate-400">Warranty</p>
            <p className="text-white font-medium">{formatWarranty(product.warranty)}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          {/* Add/Remove Compare Button */}
          {(onAddToCompare || onRemoveFromCompare) && (
            <button
              onClick={handleCompareClick}
              disabled={!isInCompare && !canAddToCompare}
              className={`flex-1 py-3 rounded-lg font-bold transition-all flex items-center justify-center gap-2 ${
                isInCompare
                  ? 'bg-orange-500 hover:bg-orange-400 text-white'
                  : canAddToCompare
                    ? 'bg-slate-700 hover:bg-slate-600 text-white'
                    : 'bg-slate-700/50 text-slate-500 cursor-not-allowed'
              }`}
            >
              <span>{isInCompare ? '✓' : '⚖️'}</span>
              <span>{isInCompare ? 'Remove from Compare' : canAddToCompare ? 'Add to Compare' : 'Compare Full'}</span>
            </button>
          )}
        </div>

        {/* Take Me There & Purchase Link Buttons */}
        <div className="flex gap-3">
          {/* Take Me There Button */}
          <button
            onClick={() => setShowNavConfirm(true)}
            className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
          >
            <span>🗺️</span>
            <span>Take Me There</span>
          </button>

          {/* Purchase Link Button */}
          <button
            onClick={() => setShowPurchaseQR(true)}
            className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
          >
            <span>📱</span>
            <span>Purchase</span>
          </button>
        </div>
      </div>
    </div>
  );
};


// =============== Main Screen ===============

export const Advice3CScreen: React.FC<Advice3CScreenProps> = ({
  displayProducts,
  selectedProduct,
  selectedCategory,
  searchQuery,
  searchParams,
  searchTotal = 0,
  compareProducts = [],
  maxCompareProducts = 4,
  onSelectProduct,
  onSelectCategory,
  onFilterChange,
  onAddToCompare,
  onRemoveFromCompare,
  onSearch,
  onExit,
}) => {
  // Helper to check if product is in compare list
  const isProductInCompare = (code: string) => compareProducts.some(p => p.code === code);
  const canAddMoreToCompare = compareProducts.length < maxCompareProducts;
  const categories = useMemo(() => getCategories(), []);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [selectedSubCategory, setSelectedSubCategory] = useState<string | null>(null);
  const [priceRange, setPriceRange] = useState<{ min?: number; max?: number }>({});
  const [sortBy, setSortBy] = useState<string | null>(null);

  // Notify parent when filters change
  useEffect(() => {
    onFilterChange?.(selectedBrand, selectedSubCategory);
  }, [selectedBrand, selectedSubCategory, onFilterChange]);

  // All categories sorted by product count
  const allCategories = useMemo(() => {
    return categories
      .filter(c => c.productCount > 0)
      .sort((a, b) => b.productCount - a.productCount);
  }, [categories]);

  // Get current category info
  const currentCategory = useMemo(() => {
    if (!selectedCategory) return null;
    return allCategories.find(c => c.slug === selectedCategory);
  }, [selectedCategory, allCategories]);

  // Get unique brands from current display products (filtered by sub-category if selected)
  const availableBrands = useMemo(() => {
    // First, determine the base product list to extract brands from
    let productsToCheck = displayProducts;

    // If a sub-category (Type) is selected, filter products by that sub-category first
    // This ensures we only show brands that have products in the selected sub-category
    if (selectedSubCategory) {
      productsToCheck = displayProducts.filter(p => p.menuListName === selectedSubCategory);
    }

    // Extract unique brands from the filtered products
    const brands = new Set<string>();
    productsToCheck.forEach(p => brands.add(p.brand));
    return Array.from(brands).sort();
  }, [displayProducts, selectedSubCategory]);

  // Get sub-categories from display products
  const availableSubCategories = useMemo(() => {
    return getSubCategoriesFromProducts(displayProducts);
  }, [displayProducts]);

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let results = [...displayProducts];

    // Brand filter
    if (selectedBrand) {
      results = results.filter(p => p.brand === selectedBrand);
    }

    // SubCategory filter (uses menuListName)
    if (selectedSubCategory) {
      results = results.filter(p => p.menuListName === selectedSubCategory);
    }

    // Price range filter
    if (priceRange.min !== undefined) {
      results = results.filter(p => p.priceSale >= priceRange.min!);
    }
    if (priceRange.max !== undefined) {
      results = results.filter(p => p.priceSale <= priceRange.max!);
    }

    // Sort
    if (sortBy) {
      switch (sortBy) {
        case 'price_asc':
          results.sort((a, b) => a.priceSale - b.priceSale);
          break;
        case 'price_desc':
          results.sort((a, b) => b.priceSale - a.priceSale);
          break;
        case 'discount':
          results.sort((a, b) => b.discount - a.discount);
          break;
      }
    }

    return results;
  }, [displayProducts, selectedBrand, selectedSubCategory, priceRange, sortBy]);

  // Reset filters when category or search changes
  useEffect(() => {
    setSelectedBrand(null);
    setSelectedSubCategory(null);
    setPriceRange({});
    setSortBy(null);
  }, [selectedCategory, searchQuery]);

  // Reset brand if it's no longer available after sub-category change
  useEffect(() => {
    if (selectedBrand && !availableBrands.includes(selectedBrand)) {
      setSelectedBrand(null);
    }
  }, [selectedSubCategory, availableBrands, selectedBrand]);

  // Handle back navigation
  const handleBack = () => {
    if (searchQuery || selectedCategory) {
      // Return to category grid (home)
      setSelectedBrand(null);
      setSelectedSubCategory(null);
      setPriceRange({});
      setSortBy(null);
      onSelectCategory(null);
    } else if (onExit) {
      // Exit scene
      onExit();
    }
  };

  // ============ Category Grid View (首页) ============
  if (!selectedCategory && !searchQuery) {
    return (
      <div className="fixed inset-0 z-40 bg-gradient-to-br from-blue-900/20 via-slate-900 to-slate-900 flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 bg-slate-800/80 backdrop-blur border-b border-slate-700 px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Back & Title */}
            <div className="flex items-center gap-4">
              {onExit && (
                <button
                  onClick={onExit}
                  className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-slate-700/50"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  <span className="text-sm">Exit</span>
                </button>
              )}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">🛒</span>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">Advice Shopping</h1>
                  <p className="text-slate-400 text-sm">
                    {allCategories.length} Categories • 9,500+ Products
                  </p>
                </div>
              </div>
            </div>

            {/* Search Box */}
            {onSearch && (
              <div className="flex-1 max-w-lg mx-4">
                <SearchInput
                  onSearch={onSearch}
                  placeholder="Search products, brands, categories..."
                />
              </div>
            )}

            </div>
        </div>

        {/* Category Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          <h2 className="text-white text-lg font-bold mb-4">Browse Categories</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {allCategories.map(cat => (
              <CategoryCard
                key={cat.slug}
                name={cat.name}
                slug={cat.slug}
                productCount={cat.productCount}
                onClick={() => onSelectCategory(cat.slug)}
              />
            ))}
          </div>
        </div>

        </div>
    );
  }

  // ============ Search/Category Results View ============
  return (
    <div className="fixed inset-0 z-40 bg-gradient-to-br from-blue-900/20 via-slate-900 to-slate-900 flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 bg-slate-800/80 backdrop-blur border-b border-slate-700 px-6 py-3">
        <div className="flex items-center justify-between">
          {/* Back & Title */}
          <div className="flex items-center gap-4">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-slate-700/50"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="text-sm">Home</span>
            </button>
            <div>
              {searchQuery ? (
                <div className="flex items-center gap-2">
                  <span className="text-blue-400">🔍</span>
                  <h1 className="text-xl font-bold text-white">{searchQuery}</h1>
                </div>
              ) : (
                <h1 className="text-xl font-bold text-white">{currentCategory?.name || 'Products'}</h1>
              )}
            </div>
          </div>

          {/* Search Box + Active Filters */}
          <div className="flex-1 flex items-center gap-3 mx-4 min-w-0">
            {onSearch && (
              <div className="w-96 flex-shrink-0">
                <SearchInput
                  onSearch={(keyword) => onSearch(keyword, selectedCategory)}
                  placeholder={selectedCategory ? `Search in ${currentCategory?.name || 'category'}...` : "Search all products..."}
                  initialValue=""
                />
              </div>
            )}
            {/* Active Search Filters inline */}
            {searchParams && Object.keys(searchParams).some(k => searchParams[k as keyof SearchParams]) && (
              <div className="flex-1 min-w-0 overflow-hidden">
                <SearchParamsDisplay params={searchParams} total={searchTotal} />
              </div>
            )}
          </div>

          </div>

        {/* Filter Bar */}
        <div className="mt-3 space-y-2">

          {/* SubCategory Filter (product types) */}
          {availableSubCategories.length > 1 && (
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-slate-500 text-xs shrink-0">Type:</span>
              <div className="flex-1 min-w-0 overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                <SubCategoryFilter
                  subCategories={availableSubCategories}
                  selected={selectedSubCategory}
                  onSelect={setSelectedSubCategory}
                />
              </div>
            </div>
          )}

          {/* Brands */}
          {availableBrands.length > 1 && (
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-slate-500 text-xs shrink-0">Brand:</span>
              <div className="flex-1 min-w-0 overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                <BrandFilter
                  brands={availableBrands}
                  selectedBrand={selectedBrand}
                  onSelectBrand={setSelectedBrand}
                />
              </div>
            </div>
          )}

          {/* Sort & Count */}
          <SortFilterBar
            sortBy={sortBy}
            onSortChange={setSortBy}
            totalCount={displayProducts.length}
            filteredCount={filteredProducts.length}
          />
        </div>
      </div>

      {/* Main Content: Left/Right Layout */}
      <div className="flex-1 flex overflow-hidden p-4 gap-4" style={{ minHeight: 0 }}>
        {/* Left: Product Grid - Virtualized */}
        <div className="w-1/2 flex flex-col h-full" style={{ minHeight: 0 }}>
          {filteredProducts.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center py-12">
                <div className="text-5xl mb-4">🔍</div>
                <p className="text-slate-400 text-lg">No products found</p>
                <p className="text-slate-500 text-sm mt-2">
                  {selectedBrand
                    ? `Try removing "${selectedBrand}" filter`
                    : 'Try a different search term'}
                </p>
                {selectedBrand && (
                  <button
                    onClick={() => setSelectedBrand(null)}
                    className="mt-4 px-4 py-2 bg-blue-500 hover:bg-blue-400 text-white rounded-lg text-sm transition-colors"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 h-full" style={{ minHeight: 0 }}>
              {/* @ts-ignore - AutoSizer type compatibility with React 18 */}
              <AutoSizer>
                {({ height, width }: { height: number; width: number }) => {
                  // If no dimensions yet, don't render
                  if (!height || !width) {
                    return <div className="flex items-center justify-center h-full text-slate-400">Loading...</div>;
                  }

                  // Calculate columns based on width (responsive)
                  const gap = 16; // Gap between cards
                  const minCardWidth = 180;
                  const columnCount = Math.max(2, Math.min(4, Math.floor((width + gap) / (minCardWidth + gap))));
                  const cardWidth = Math.floor((width - gap * (columnCount - 1)) / columnCount);
                  // Card height calculation:
                  // - Image: aspect-square = cardWidth
                  // - Info section: p-2(16) + brand(16) + name(32) + price(20) + stock(20) = ~104px
                  // - Add extra padding for safety
                  const infoSectionHeight = 120; // Info section with safety margin
                  const cardHeight = cardWidth + infoSectionHeight;
                  const rowCount = Math.ceil(filteredProducts.length / columnCount);

                  // Memoized item data for virtual grid
                  const itemData: VirtualGridItemData = {
                    products: filteredProducts,
                    columnCount,
                    gap,
                    selectedProductCode: selectedProduct?.code ?? null,
                    compareProductCodes: new Set(compareProducts.map(p => p.code)),
                    canAddMoreToCompare,
                    onSelectProduct,
                    onAddToCompare,
                    onRemoveFromCompare,
                  };

                  return (
                    <Grid
                      columnCount={columnCount}
                      columnWidth={cardWidth + gap}
                      height={height}
                      rowCount={rowCount}
                      rowHeight={cardHeight + gap}
                      width={width}
                      itemData={itemData}
                      overscanRowCount={2}
                      style={{ overflowX: 'hidden' }}
                    >
                      {VirtualGridCell}
                    </Grid>
                  );
                }}
              </AutoSizer>
            </div>
          )}
        </div>

        {/* Right: Product Detail */}
        <div className="w-1/2 bg-slate-800/30 rounded-2xl p-5 border border-slate-700/50">
          <ProductDetail
            product={selectedProduct}
            isInCompare={selectedProduct ? isProductInCompare(selectedProduct.code) : false}
            canAddToCompare={canAddMoreToCompare}
            onAddToCompare={onAddToCompare && selectedProduct ? () => onAddToCompare(selectedProduct) : undefined}
            onRemoveFromCompare={onRemoveFromCompare && selectedProduct ? () => onRemoveFromCompare(selectedProduct.code) : undefined}
          />
        </div>
      </div>

      </div>
  );
};

export default Advice3CScreen;