/**
 * CompareModal - Product Comparison UI
 * UI สำหรับเปรียบเทียบสินค้า
 *
 * Features:
 * - Same values: Gray background (相同点)
 * - Different values: Colored background to highlight differences (不同点)
 * - Best value highlighting
 */

import React, { useState, useMemo } from 'react';
import { Product, formatPrice, getStockStatus, formatWarranty } from '../data';

interface CompareModalProps {
  products: Product[];
  onClose: () => void;
  onSelectProduct: (product: Product) => void;
}

// =============== Types ===============

type CompareStatus = 'same' | 'different' | 'best' | 'worst';

interface CompareValue {
  display: React.ReactNode;
  rawValue: string | number | boolean;
  status: CompareStatus;
}

// =============== Helper Functions ===============

/**
 * Check if all values are the same
 */
function areAllSame(values: (string | number | boolean)[]): boolean {
  if (values.length < 2) return true;
  const first = String(values[0]);
  return values.every(v => String(v) === first);
}

/**
 * Find best/worst index for numeric values
 */
function findBestWorst(
  values: number[],
  type: 'lowest' | 'highest'
): { bestIdx: number; worstIdx: number } {
  if (type === 'lowest') {
    const min = Math.min(...values);
    const max = Math.max(...values);
    return {
      bestIdx: values.indexOf(min),
      worstIdx: values.indexOf(max),
    };
  } else {
    const max = Math.max(...values);
    const min = Math.min(...values);
    return {
      bestIdx: values.indexOf(max),
      worstIdx: values.indexOf(min),
    };
  }
}

// =============== Styled Comparison Row ===============

const CompareRowStyled: React.FC<{
  label: string;
  icon?: string;
  values: CompareValue[];
  showDiffIndicator?: boolean;
}> = ({ label, icon, values, showDiffIndicator = true }) => {
  const isSame = values.every(v => v.status === 'same');
  const hasDifference = values.some(v => v.status === 'different' || v.status === 'best' || v.status === 'worst');

  return (
    <div
      className={`grid gap-3 rounded-lg transition-all ${
        isSame ? 'bg-slate-700/30' : 'bg-transparent'
      }`}
      style={{ gridTemplateColumns: `140px repeat(${values.length}, 1fr)` }}
    >
      {/* Label */}
      <div className="text-slate-400 text-sm font-medium py-3 px-2 flex items-center gap-2">
        {icon && <span>{icon}</span>}
        <span>{label}</span>
        {showDiffIndicator && (
          <span className={`text-xs px-1.5 py-0.5 rounded ${
            isSame
              ? 'bg-slate-600 text-slate-300'
              : 'bg-orange-500/20 text-orange-300'
          }`}>
            {isSame ? '=' : '≠'}
          </span>
        )}
      </div>

      {/* Values */}
      {values.map((v, i) => (
        <div
          key={i}
          className={`py-3 px-3 rounded-lg text-sm transition-all ${getValueStyle(v.status, hasDifference)}`}
        >
          {v.display}
        </div>
      ))}
    </div>
  );
};

/**
 * Get CSS classes based on value status
 */
function getValueStyle(status: CompareStatus, hasDifference: boolean): string {
  if (!hasDifference) {
    // All same - subtle gray
    return 'bg-slate-700/40 text-slate-300';
  }

  switch (status) {
    case 'same':
      return 'bg-slate-700/40 text-slate-300';
    case 'best':
      return 'bg-green-500/25 text-green-300 font-bold ring-1 ring-green-500/50';
    case 'worst':
      return 'bg-red-500/15 text-red-300/80';
    case 'different':
    default:
      return 'bg-blue-500/20 text-blue-200';
  }
}

// =============== Product Header Card ===============

const ProductHeader: React.FC<{
  product: Product;
  onSelect: () => void;
  isWinner?: boolean;
  columnIndex: number;
}> = ({ product, onSelect, isWinner, columnIndex }) => {
  const [imgError, setImgError] = useState(false);

  // Alternate colors for products
  const borderColors = ['border-blue-500/50', 'border-purple-500/50', 'border-cyan-500/50', 'border-pink-500/50'];
  const borderColor = borderColors[columnIndex % borderColors.length];

  return (
    <div
      onClick={onSelect}
      className={`relative bg-slate-700/50 rounded-xl p-4 cursor-pointer transition-all hover:bg-slate-700 hover:scale-[1.02] border-2 ${
        isWinner ? 'border-yellow-400' : borderColor
      }`}
    >
      {/* Winner Badge */}
      {isWinner && (
        <div className="absolute -top-2 -right-2 bg-yellow-500 text-black text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-lg">
          👑 Best
        </div>
      )}

      {/* Column indicator */}
      <div className={`absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
        columnIndex === 0 ? 'bg-blue-500 text-white' :
        columnIndex === 1 ? 'bg-purple-500 text-white' :
        columnIndex === 2 ? 'bg-cyan-500 text-white' :
        'bg-pink-500 text-white'
      }`}>
        {String.fromCharCode(65 + columnIndex)}
      </div>

      {/* Product Image */}
      <div className="aspect-square bg-white rounded-lg p-2 mb-3 mt-4">
        {!imgError ? (
          <img
            src={product.picUrl}
            alt={product.name}
            className="w-full h-full object-contain"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl bg-slate-100 rounded-lg">
            📦
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="space-y-1">
        <p className="text-blue-400 text-xs font-medium">{product.brand}</p>
        <p className="text-white text-sm font-medium line-clamp-2 min-h-[2.5rem]">
          {product.name}
        </p>
        <p className="text-slate-400 text-xs">{product.code}</p>
      </div>
    </div>
  );
};

// =============== Main Compare Modal ===============

export const CompareModal: React.FC<CompareModalProps> = ({
  products,
  onClose,
  onSelectProduct,
}) => {
  // State for showing/hiding same items
  const [showSameItems, setShowSameItems] = useState(true);

  // Memoized comparison data - must be before any conditional returns
  const comparisonData = useMemo(() => {
    if (products.length < 2) {
      return {
        prices: [],
        priceResult: { bestIdx: 0, worstIdx: 0 },
        pricesSame: true,
        discounts: [],
        discountResult: { bestIdx: 0, worstIdx: 0 },
        discountsSame: true,
        warranties: [],
        warrantiesSame: true,
        stocks: [],
        stocksSame: true,
        fastDeliveries: [],
        fastDeliveriesSame: true,
        brands: [],
        brandsSame: true,
        categories: [],
        categoriesSame: true,
        bestValueIdx: 0,
      };
    }

    const prices = products.map(p => p.priceSale);
    const discounts = products.map(p => p.discount);
    const warranties = products.map(p => p.warranty);
    const stocks = products.map(p => p.type);
    const fastDeliveries = products.map(p => p.fastDelivery);
    const brands = products.map(p => p.brand);
    const categories = products.map(p => p.menuListName);

    // Price comparison (lowest is best)
    const priceResult = findBestWorst(prices, 'lowest');
    const pricesSame = areAllSame(prices);

    // Discount comparison (highest is best)
    const discountResult = findBestWorst(discounts, 'highest');
    const discountsSame = areAllSame(discounts);

    // Calculate best value score
    const valueScores = products.map(p =>
      p.discount > 0 ? (p.discount / p.priceSale) * 1000 : 0
    );
    const bestValueIdx = valueScores.indexOf(Math.max(...valueScores));

    return {
      prices,
      priceResult,
      pricesSame,
      discounts,
      discountResult,
      discountsSame,
      warranties,
      warrantiesSame: areAllSame(warranties),
      stocks,
      stocksSame: areAllSame(stocks),
      fastDeliveries,
      fastDeliveriesSame: areAllSame(fastDeliveries),
      brands,
      brandsSame: areAllSame(brands),
      categories,
      categoriesSame: areAllSame(categories),
      bestValueIdx,
    };
  }, [products]);

  // Parse specs for comparison
  const specsData = useMemo(() => {
    if (products.length < 2) {
      return [];
    }

    const parseSpecs = (spec: string): string[] => {
      return spec.split(' / ').map(s => s.trim());
    };

    const allSpecs = products.map(p => parseSpecs(p.spec));
    const maxSpecCount = Math.max(...allSpecs.map(s => s.length));

    // For each spec position, check if all are same
    const specComparisons: { values: string[]; same: boolean }[] = [];
    for (let i = 0; i < maxSpecCount; i++) {
      const values = allSpecs.map(specs => specs[i] || '-');
      specComparisons.push({
        values,
        same: areAllSame(values),
      });
    }

    return specComparisons;
  }, [products]);

  // Early return after all hooks
  if (products.length < 2) return null;

  // Build comparison values with status
  const buildPriceValues = (): CompareValue[] => {
    return products.map((p, i) => ({
      display: (
        <div>
          <span className="text-lg font-bold">{formatPrice(p.priceSale)}</span>
          {p.discount > 0 && (
            <span className="text-slate-500 text-xs ml-2 line-through">
              {formatPrice(p.priceSrp)}
            </span>
          )}
        </div>
      ),
      rawValue: p.priceSale,
      status: comparisonData.pricesSame
        ? 'same'
        : i === comparisonData.priceResult.bestIdx
          ? 'best'
          : i === comparisonData.priceResult.worstIdx
            ? 'worst'
            : 'different',
    }));
  };

  const buildDiscountValues = (): CompareValue[] => {
    return products.map((p, i) => ({
      display: p.discount > 0 ? (
        <span>-{p.discount}% (Save {formatPrice(p.priceSrp - p.priceSale)})</span>
      ) : (
        <span className="text-slate-500">-</span>
      ),
      rawValue: p.discount,
      status: comparisonData.discountsSame
        ? 'same'
        : i === comparisonData.discountResult.bestIdx && p.discount > 0
          ? 'best'
          : i === comparisonData.discountResult.worstIdx
            ? 'worst'
            : 'different',
    }));
  };

  const buildStockValues = (): CompareValue[] => {
    const stockStatuses = products.map(p => getStockStatus(p.type));
    return products.map((p, i) => ({
      display: (
        <span className={p.type === 'instock' ? 'text-green-400' : 'text-yellow-400'}>
          {stockStatuses[i].en}
        </span>
      ),
      rawValue: p.type,
      status: comparisonData.stocksSame ? 'same' : p.type === 'instock' ? 'best' : 'worst',
    }));
  };

  const buildFastDeliveryValues = (): CompareValue[] => {
    return products.map(p => ({
      display: p.fastDelivery ? (
        <span className="text-green-400">✓ Yes</span>
      ) : (
        <span className="text-slate-500">✗ No</span>
      ),
      rawValue: p.fastDelivery,
      status: comparisonData.fastDeliveriesSame ? 'same' : p.fastDelivery ? 'best' : 'worst',
    }));
  };

  const buildWarrantyValues = (): CompareValue[] => {
    return products.map(p => ({
      display: formatWarranty(p.warranty),
      rawValue: p.warranty,
      status: comparisonData.warrantiesSame ? 'same' : 'different',
    }));
  };

  const buildBrandValues = (): CompareValue[] => {
    return products.map(p => ({
      display: <span className="font-medium">{p.brand}</span>,
      rawValue: p.brand,
      status: comparisonData.brandsSame ? 'same' : 'different',
    }));
  };

  const buildCategoryValues = (): CompareValue[] => {
    return products.map(p => ({
      display: <span>{p.menuListName}</span>,
      rawValue: p.menuListName,
      status: comparisonData.categoriesSame ? 'same' : 'different',
    }));
  };

  const buildInstallmentValues = (): CompareValue[] => {
    const installments = products.map(p => p.installmentMonths?.join('/') || '');
    const same = areAllSame(installments);
    return products.map(p => ({
      display: p.installmentMonths && p.installmentMonths.length > 0 ? (
        <span>{p.installmentMonths.join('/')} months 0%</span>
      ) : (
        <span className="text-slate-500">-</span>
      ),
      rawValue: p.installmentMonths?.join('/') || '',
      status: same ? 'same' : 'different',
    }));
  };

  const buildSpecValues = (specIdx: number): CompareValue[] => {
    const specData = specsData[specIdx];
    return specData.values.map(val => ({
      display: val,
      rawValue: val,
      status: specData.same ? 'same' : 'different',
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 rounded-2xl border border-slate-700 w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header - Combined with Toggle */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 bg-slate-800/50">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚖️</span>
            <h2 className="text-xl font-bold text-white">
              Product Comparison
              <span className="text-slate-400 text-sm font-normal ml-2">({products.length} products)</span>
            </h2>
          </div>
          <div className="flex items-center gap-3">
            {/* Toggle Same Items Button */}
            <button
              onClick={() => setShowSameItems(prev => !prev)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                showSameItems
                  ? 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                  : 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 ring-1 ring-blue-500/50'
              }`}
            >
              {showSameItems ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  <span>Hide Same</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                  <span>Show All</span>
                </>
              )}
            </button>
            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-700 transition-colors text-slate-400 hover:text-white"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Product Headers */}
          <div className="grid gap-3 mb-6" style={{ gridTemplateColumns: `140px repeat(${products.length}, 1fr)` }}>
            <div /> {/* Empty cell for row labels */}
            {products.map((product, i) => (
              <ProductHeader
                key={product.code}
                product={product}
                onSelect={() => onSelectProduct(product)}
                isWinner={i === comparisonData.bestValueIdx}
                columnIndex={i}
              />
            ))}
          </div>

          {/* Comparison Table */}
          <div className="space-y-2 bg-slate-800/30 rounded-xl p-4">
            {/* Brand */}
            {(showSameItems || !comparisonData.brandsSame) && (
              <CompareRowStyled
                label="Brand"
                icon="🏷️"
                values={buildBrandValues()}
              />
            )}

            {/* Price */}
            {(showSameItems || !comparisonData.pricesSame) && (
              <CompareRowStyled
                label="Price / ราคา"
                icon="💰"
                values={buildPriceValues()}
              />
            )}

            {/* Discount */}
            {(showSameItems || !comparisonData.discountsSame) && (
              <CompareRowStyled
                label="Discount / ส่วนลด"
                icon="🏷️"
                values={buildDiscountValues()}
              />
            )}

            {/* Stock Status */}
            {(showSameItems || !comparisonData.stocksSame) && (
              <CompareRowStyled
                label="Stock / สต็อก"
                icon="📦"
                values={buildStockValues()}
              />
            )}

            {/* Fast Delivery */}
            {(showSameItems || !comparisonData.fastDeliveriesSame) && (
              <CompareRowStyled
                label="Fast Delivery"
                icon="⚡"
                values={buildFastDeliveryValues()}
              />
            )}

            {/* Warranty */}
            {(showSameItems || !comparisonData.warrantiesSame) && (
              <CompareRowStyled
                label="Warranty / ประกัน"
                icon="🛡️"
                values={buildWarrantyValues()}
              />
            )}

            {/* Installment */}
            {(showSameItems || !areAllSame(products.map(p => p.installmentMonths?.join('/') || ''))) && (
              <CompareRowStyled
                label="Installment / ผ่อน"
                icon="💳"
                values={buildInstallmentValues()}
              />
            )}

            {/* Category */}
            {(showSameItems || !comparisonData.categoriesSame) && (
              <CompareRowStyled
                label="Category"
                icon="📂"
                values={buildCategoryValues()}
              />
            )}

            {/* Specifications */}
            {specsData.length > 0 && (
              <div className="border-t border-slate-700 mt-4 pt-4">
                <p className="text-slate-300 font-medium mb-3 flex items-center gap-2">
                  <span>📋</span>
                  <span>Specifications / สเปค</span>
                </p>
                {specsData.map((specData, specIdx) => (
                  (showSameItems || !specData.same) && (
                    <CompareRowStyled
                      key={specIdx}
                      label={`Spec ${specIdx + 1}`}
                      icon=""
                      values={buildSpecValues(specIdx)}
                      showDiffIndicator={true}
                    />
                  )
                ))}
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="mt-6 bg-gradient-to-r from-blue-900/30 to-purple-900/30 rounded-xl p-4 border border-blue-500/20">
            <h3 className="text-white font-bold mb-2 flex items-center gap-2">
              <span>💡</span>
              <span>AI Recommendation / คำแนะนำ</span>
            </h3>
            <p className="text-slate-300 text-sm">
              {products[comparisonData.bestValueIdx] && (
                <>
                  <span className="text-yellow-400 font-medium">
                    {products[comparisonData.bestValueIdx].name}
                  </span>
                  {' '}offers the best value
                  {products[comparisonData.bestValueIdx].discount > 0 && (
                    <>
                      {' '}with{' '}
                      <span className="text-green-400">
                        {products[comparisonData.bestValueIdx].discount}% discount
                      </span>
                    </>
                  )}
                  {' '}at{' '}
                  <span className="text-blue-400">
                    {formatPrice(products[comparisonData.bestValueIdx].priceSale)}
                  </span>.
                  {products[comparisonData.bestValueIdx].fastDelivery && ' Fast delivery available!'}
                </>
              )}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-700 bg-slate-800/50">
          <p className="text-slate-400 text-sm">
            Click on a product to view full details / คลิกที่สินค้าเพื่อดูรายละเอียด
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            Close / ปิด
          </button>
        </div>
      </div>
    </div>
  );
};

export default CompareModal;