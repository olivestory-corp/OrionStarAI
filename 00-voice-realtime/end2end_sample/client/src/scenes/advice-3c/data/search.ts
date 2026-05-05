/**
 * Advice 3C Scene - Search Service
 * บริการค้นหาสินค้า (Fuse.js)
 */

import Fuse from 'fuse.js';
import { Product, getAllProducts, getProductsByCategory, getCategories } from './index';

// =============== Types ===============

export interface SearchOptions {
  keyword?: string;
  brand?: string;
  category?: string;
  subCategory?: string;  // Filter by menuListName (e.g., "iPhone", "iPad", "Mac")
  minPrice?: number;
  maxPrice?: number;
  hasDiscount?: boolean;
  inStock?: boolean;
  sortBy?: 'price_asc' | 'price_desc' | 'discount_desc' | 'views_desc';
  limit?: number;
}

export interface SearchResult {
  success: boolean;
  products: Product[];
  total: number;
  returned: number;
  query?: string;
}

// =============== Fuse.js Setup ===============

let _fuse: Fuse<Product> | null = null;

function getFuse(): Fuse<Product> {
  if (!_fuse) {
    const products = getAllProducts();
    _fuse = new Fuse(products, {
      keys: [
        { name: 'name', weight: 0.35 },
        { name: 'brand', weight: 0.25 },
        { name: 'spec', weight: 0.2 },
        { name: 'menuListName', weight: 0.1 },
        { name: 'menuListDtlName', weight: 0.1 },
      ],
      threshold: 0.4,           // 稍微放宽阈值，允许更多模糊匹配
      includeScore: true,
      minMatchCharLength: 2,
      ignoreLocation: true,     // 忽略匹配位置，允许分散匹配
      findAllMatches: true,     // 查找所有匹配项
    });
    console.log('[Advice3C Search] 🔍 Search engine initialized');
  }
  return _fuse;
}

// =============== Search Functions ===============

/**
 * Search products with multiple filters
 * ค้นหาสินค้าตามเงื่อนไขต่างๆ
 */
export function searchProducts(options: SearchOptions): SearchResult {
  const {
    keyword,
    brand,
    category,
    subCategory,
    minPrice,
    maxPrice,
    hasDiscount,
    inStock,
    sortBy,
    limit,  // undefined = no limit (return all)
  } = options;

  let results: Product[];

  // Step 1: Keyword search or category filter
  if (keyword && keyword.trim()) {
    const keywords = keyword.trim().split(/\s+/).filter(k => k.length >= 2);

    if (keywords.length > 1) {
      // 多词搜索：每个词单独搜索，取交集，确保所有关键词都匹配
      const resultSets = keywords.map(kw => {
        const fuseResults = getFuse().search(kw);
        return new Map(fuseResults.map(r => [r.item.code, r.score ?? 1]));
      });

      // 取交集：只保留所有关键词都匹配到的产品
      const firstSet = resultSets[0];
      const intersectedCodes = Array.from(firstSet.keys()).filter(code =>
        resultSets.every(set => set.has(code))
      );

      // 计算综合得分（所有关键词得分之和），并按得分排序
      const scoredResults = intersectedCodes.map(code => {
        const totalScore = resultSets.reduce((sum, set) => sum + (set.get(code) ?? 1), 0);
        return { code, score: totalScore };
      }).sort((a, b) => a.score - b.score);

      const allProducts = getAllProducts();
      const productMap = new Map(allProducts.map(p => [p.code, p]));
      results = scoredResults.map(r => productMap.get(r.code)!).filter(Boolean);
    } else {
      // 单词搜索：直接使用 Fuse.js 结果
      const fuseResults = getFuse().search(keyword.trim());
      results = fuseResults.map(r => r.item);
    }
  } else if (category) {
    results = getProductsByCategory(category);
  } else {
    results = getAllProducts();
  }

  // Step 2: Apply filters
  if (brand) {
    results = results.filter(p =>
      p.brand.toLowerCase().includes(brand.toLowerCase())
    );
  }

  if (category && keyword) {
    // Also filter by category if both keyword and category provided
    const categoryProducts = getProductsByCategory(category);
    const categoryProductCodes = new Set(categoryProducts.map(p => p.code));
    results = results.filter(p => categoryProductCodes.has(p.code));
  }

  // Filter by sub-category (menuListName) - useful for distinguishing main products from accessories
  if (subCategory) {
    results = results.filter(p =>
      p.menuListName.toLowerCase().includes(subCategory.toLowerCase())
    );
  }

  if (minPrice !== undefined) {
    results = results.filter(p => p.priceSale >= minPrice);
  }

  if (maxPrice !== undefined) {
    results = results.filter(p => p.priceSale <= maxPrice);
  }

  if (hasDiscount) {
    results = results.filter(p => p.discount > 0 && p.hasPromotion);
  }

  if (inStock) {
    results = results.filter(p => p.type === 'instock');
  }

  const total = results.length;

  // Step 3: Sort
  if (sortBy) {
    switch (sortBy) {
      case 'price_asc':
        results.sort((a, b) => a.priceSale - b.priceSale);
        break;
      case 'price_desc':
        results.sort((a, b) => b.priceSale - a.priceSale);
        break;
      case 'discount_desc':
        results.sort((a, b) => b.discount - a.discount);
        break;
      case 'views_desc':
        results.sort((a, b) => parseViewCount(b.views) - parseViewCount(a.views));
        break;
    }
  }

  // Step 4: Limit (only if limit is specified)
  if (limit !== undefined) {
    results = results.slice(0, limit);
  }

  return {
    success: true,
    products: results,
    total,
    returned: results.length,
    query: keyword,
  };
}

/**
 * Quick search for autocomplete
 * ค้นหาเร็วสำหรับ autocomplete
 */
export function quickSearch(query: string, limit: number = 5): Product[] {
  if (!query || query.trim().length < 2) return [];

  const fuseResults = getFuse().search(query.trim());
  return fuseResults.slice(0, limit).map(r => r.item);
}

// =============== Summary Generation ===============

interface ProductSummary {
  priceRange: { min: number; max: number; avg: number };
  brands: { name: string; count: number }[];
  stockStatus: { inStock: number; preOrder: number };
  discounts: { count: number; maxDiscount: number; avgDiscount: number };
  subCategories?: { name: string; count: number }[];
}

/**
 * Generate a summary of products for LLM context
 * สร้างสรุปสินค้าสำหรับ LLM
 */
function generateProductSummary(products: Product[]): ProductSummary {
  if (products.length === 0) {
    return {
      priceRange: { min: 0, max: 0, avg: 0 },
      brands: [],
      stockStatus: { inStock: 0, preOrder: 0 },
      discounts: { count: 0, maxDiscount: 0, avgDiscount: 0 },
    };
  }

  // Price range
  const prices = products.map(p => p.priceSale);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const avgPrice = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);

  // Brand distribution (top 5)
  const brandCounts: Record<string, number> = {};
  products.forEach(p => {
    brandCounts[p.brand] = (brandCounts[p.brand] || 0) + 1;
  });
  const brands = Object.entries(brandCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  // Stock status
  const inStock = products.filter(p => p.type === 'instock').length;
  const preOrder = products.length - inStock;

  // Discounts
  const discountedProducts = products.filter(p => p.discount > 0);
  const discountCount = discountedProducts.length;
  const maxDiscount = discountCount > 0
    ? Math.max(...discountedProducts.map(p => p.discount))
    : 0;
  const avgDiscount = discountCount > 0
    ? Math.round(discountedProducts.reduce((a, p) => a + p.discount, 0) / discountCount * 10) / 10
    : 0;

  // Sub-categories (top 5)
  const subCatCounts: Record<string, number> = {};
  products.forEach(p => {
    if (p.menuListName) {
      subCatCounts[p.menuListName] = (subCatCounts[p.menuListName] || 0) + 1;
    }
  });
  const subCategories = Object.entries(subCatCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  return {
    priceRange: { min: minPrice, max: maxPrice, avg: avgPrice },
    brands,
    stockStatus: { inStock, preOrder },
    discounts: { count: discountCount, maxDiscount, avgDiscount },
    subCategories: subCategories.length > 1 ? subCategories : undefined,
  };
}

// =============== Format for LLM ===============

/**
 * Format products for LLM response (compact format with summary)
 * จัดรูปแบบสินค้าสำหรับ LLM (รูปแบบกระชับพร้อมสรุป)
 * @param products - Products to format (may be truncated)
 * @param allProducts - Optional: all matching products (before truncation) for summary generation
 */
export function formatProductsForLLM(products: Product[], allProducts?: Product[]): string {
  if (products.length === 0) {
    return JSON.stringify({
      success: false,
      message: 'No products found matching your search criteria.',
      action_required: 'YOU may retry the search with different parameters!',
      suggestions: [
        'Try using broader or simpler keywords (e.g., "laptop" instead of specific model names)',
        'Remove or adjust filters like price range, brand, or category',
        'Use English product names or brand names (e.g., "mouse", "keyboard", "ASUS", "Logitech")',
        'Try searching by category only without keyword',
        'Check if the brand name is spelled correctly',
      ],
      example_retry: 'search_products({ keyword: "gaming mouse" }) or search_products({ category: "mouse-pads", brand: "LOGITECH" })',
    });
  }

  // Compact format: only essential info, no pretty-print
  const formatted = products.map((p, i) => ({
    no: i + 1,
    code: p.code,
    name: p.name,
    brand: p.brand,
    price: p.priceSale,
    discount: p.discount > 0 ? p.discount : undefined,
    inStock: p.type === 'instock',
  }));

  // Use allProducts for total count and summary if provided
  const totalProducts = allProducts ?? products;
  const total = totalProducts.length;
  const returned = products.length;

  // Only show summary when results are truncated AND total > 10
  // (no need for summary if LLM already sees all products)
  const needsSummary = total > returned && total > 10;

  // Build result object
  const result: Record<string, unknown> = {
    success: true,
    total,
    returned,
    products: formatted,
  };

  // Add summary only when there are significantly more products than shown
  if (needsSummary) {
    const summary = generateProductSummary(totalProducts);

    // Format summary for LLM in a compact, actionable way
    result.summary = {
      priceRange: `฿${summary.priceRange.min.toLocaleString()} - ฿${summary.priceRange.max.toLocaleString()} (avg: ฿${summary.priceRange.avg.toLocaleString()})`,
      topBrands: summary.brands.map(b => `${b.name}(${b.count})`).join(', '),
      stock: `${summary.stockStatus.inStock} in-stock, ${summary.stockStatus.preOrder} pre-order`,
      deals: summary.discounts.count > 0
        ? `${summary.discounts.count} items on sale (up to ${summary.discounts.maxDiscount}% off)`
        : 'No discounts',
      subCategories: summary.subCategories
        ? summary.subCategories.map(s => `${s.name}(${s.count})`).join(', ')
        : undefined,
    };

    result.hint = `Showing top ${returned} of ${total} results. Use the summary above to help user narrow down: suggest specific brands, price ranges, or sub-categories.`;
  }

  return JSON.stringify(result);
}

/**
 * Format single product detail for LLM (compact format)
 * จัดรูปแบบรายละเอียดสินค้าสำหรับ LLM (รูปแบบกระชับ)
 */
export function formatProductDetailForLLM(product: Product): string {
  // Compact format - essential info only, no pretty-print
  return JSON.stringify({
    success: true,
    product: {
      code: product.code,
      name: product.name,
      brand: product.brand,
      spec: product.spec,
      price: product.priceSale,
      originalPrice: product.priceSrp,
      discount: product.discount > 0 ? product.discount : undefined,
      inStock: product.type === 'instock',
      warranty: product.warranty,
      installment: product.installmentMonths?.join('/') || null,
      fastDelivery: product.fastDelivery,
    },
  });
}

/**
 * Format categories for LLM (compact format)
 * จัดรูปแบบหมวดหมู่สำหรับ LLM (รูปแบบกระชับ)
 */
export function formatCategoriesForLLM(): string {
  const categories = getCategories();
  // Compact: no pretty-print
  return JSON.stringify({
    success: true,
    total: categories.length,
    categories: categories.map(c => ({ name: c.name, slug: c.slug, count: c.productCount })),
  });
}

// =============== Helpers ===============

function parseViewCount(views: string): number {
  const clean = views.replace(/,/g, '').trim();
  if (clean.includes('K')) {
    return parseFloat(clean.replace('K', '').trim()) * 1000;
  }
  if (clean.includes('M')) {
    return parseFloat(clean.replace('M', '').trim()) * 1000000;
  }
  return parseFloat(clean) || 0;
}
