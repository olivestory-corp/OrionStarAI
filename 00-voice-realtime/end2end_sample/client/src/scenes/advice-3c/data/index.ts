/**
 * Advice 3C Scene - Data Exports
 * ข้อมูลสินค้า IT / Electronics
 */

import adviceData from '../advice_lite.json';

// =============== Types / ประเภทข้อมูล ===============

export interface Product {
  code: string;
  name: string;
  brand: string;
  spec: string;
  priceSrp: number;
  priceSale: number;
  discount: number;
  type: 'instock' | 'order_center' | 'plan';
  warranty: string;
  menuListName: string;      // 子分类 (e.g., "iPad", "Notebook Gaming")
  menuListDtlName: string;   // 详细子分类 (e.g., "iPad Wifi", "Gaming 15.6")
  installmentMonths: number[] | null;
  installmentBanks: string[] | null;
  hasPromotion: boolean;
  fastDelivery: boolean;
  views: string;
  picUrl: string;
  productUrl: string;
}

export interface Category {
  name: string;
  slug: string;
  productCount: number;
  products: Product[];
}

export interface AdviceData {
  fetchTime: string;
  totalCategories: number;
  totalProducts: number;
  categories: Category[];
}

// =============== Data Loading / โหลดข้อมูล ===============

const data = adviceData as AdviceData;

/**
 * Get all categories
 * ดึงหมวดหมู่ทั้งหมด
 */
export function getCategories(): Omit<Category, 'products'>[] {
  return data.categories.map(c => ({
    name: c.name,
    slug: c.slug,
    productCount: c.productCount,
  }));
}

/**
 * Get category by slug
 * ดึงหมวดหมู่ตาม slug
 */
export function getCategoryBySlug(slug: string): Category | undefined {
  return data.categories.find(c => c.slug === slug);
}

/**
 * Get all products (flattened)
 * ดึงสินค้าทั้งหมด
 */
let _allProducts: Product[] | null = null;
export function getAllProducts(): Product[] {
  if (!_allProducts) {
    _allProducts = data.categories.flatMap(c => c.products);
    console.log(`[Advice3C] ✅ Loaded ${_allProducts.length} products`);
  }
  return _allProducts;
}

/**
 * Get product by code
 * ดึงสินค้าตามรหัส
 */
export function getProductByCode(code: string): Product | undefined {
  return getAllProducts().find(p => p.code === code);
}

/**
 * Get products by category slug
 * ดึงสินค้าตามหมวดหมู่
 */
export function getProductsByCategory(slug: string): Product[] {
  const category = getCategoryBySlug(slug);
  return category?.products ?? [];
}

/**
 * Get products with promotions
 * ดึงสินค้าโปรโมชั่น
 * @param limit - Optional limit. If undefined, returns all promotion products.
 */
export function getPromotionProducts(limit?: number): Product[] {
  const sorted = getAllProducts()
    .filter(p => p.hasPromotion && p.discount > 0)
    .sort((a, b) => b.discount - a.discount);
  return limit !== undefined ? sorted.slice(0, limit) : sorted;
}

/**
 * Get hot products (by views)
 * ดึงสินค้ายอดนิยม
 * @param limit - Optional limit. If undefined, returns all products sorted by views.
 */
export function getHotProducts(limit?: number): Product[] {
  const sorted = getAllProducts().sort((a, b) => parseViews(b.views) - parseViews(a.views));
  return limit ? sorted.slice(0, limit) : sorted;
}

/**
 * Get in-stock products
 * ดึงสินค้าที่มีในสต็อก
 */
export function getInStockProducts(): Product[] {
  return getAllProducts().filter(p => p.type === 'instock');
}

/**
 * Get unique brands
 * ดึงแบรนด์ทั้งหมด
 */
export function getAllBrands(): string[] {
  const brands = new Set<string>();
  getAllProducts().forEach(p => brands.add(p.brand));
  return Array.from(brands).sort();
}

/**
 * Get brands by category
 * ดึงแบรนด์ตามหมวดหมู่
 */
export function getBrandsByCategory(categorySlug: string): string[] {
  const products = getProductsByCategory(categorySlug);
  const brands = new Set<string>();
  products.forEach(p => brands.add(p.brand));
  return Array.from(brands).sort();
}

/**
 * Get sub-categories by category (uses menuListName)
 * ดึง subCategory ตามหมวดหมู่
 */
export function getSubCategoriesByCategory(categorySlug: string): string[] {
  const products = getProductsByCategory(categorySlug);
  const subCategories = new Set<string>();
  products.forEach(p => {
    if (p.menuListName) {
      subCategories.add(p.menuListName);
    }
  });
  return Array.from(subCategories).sort();
}

/**
 * Get sub-categories from product list (uses menuListName)
 * ดึง subCategory จากรายการสินค้า
 */
export function getSubCategoriesFromProducts(products: Product[]): string[] {
  const subCategories = new Set<string>();
  products.forEach(p => {
    if (p.menuListName) {
      subCategories.add(p.menuListName);
    }
  });
  return Array.from(subCategories).sort();
}

// =============== Helpers ===============

/**
 * Parse view count string to number
 * แปลงยอดวิวเป็นตัวเลข
 */
function parseViews(views: string): number {
  const cleanViews = views.replace(/,/g, '').trim();
  if (cleanViews.includes('K')) {
    return parseFloat(cleanViews.replace('K', '').trim()) * 1000;
  }
  if (cleanViews.includes('M')) {
    return parseFloat(cleanViews.replace('M', '').trim()) * 1000000;
  }
  return parseFloat(cleanViews) || 0;
}

/**
 * Format price in Thai Baht
 * จัดรูปแบบราคาเป็นบาท
 */
export function formatPrice(price: number): string {
  return `฿${price.toLocaleString()}`;
}

/**
 * Get stock status text (English + Thai)
 * สถานะสต็อก
 */
export function getStockStatus(type: string): { en: string; th: string } {
  switch (type) {
    case 'instock':
      return { en: 'In Stock', th: 'มีสินค้า' };
    case 'order_center':
      return { en: 'Pre-order', th: 'สั่งจอง' };
    case 'plan':
      return { en: 'Coming Soon', th: 'เร็วๆ นี้' };
    default:
      return { en: 'Unknown', th: 'ไม่ทราบ' };
  }
}

/**
 * Format warranty text
 * จัดรูปแบบประกัน
 */
export function formatWarranty(warranty: string): string {
  if (warranty.includes('*')) {
    return warranty; // Special format like "3*3*0"
  }
  const years = parseInt(warranty.replace('Y', ''));
  if (isNaN(years)) return warranty;
  return `${years} Year${years > 1 ? 's' : ''} / ${years} ปี`;
}

// =============== Stats / สถิติ ===============

export function getDataStats() {
  return {
    totalProducts: data.totalProducts,
    totalCategories: data.totalCategories,
    fetchTime: data.fetchTime,
  };
}
