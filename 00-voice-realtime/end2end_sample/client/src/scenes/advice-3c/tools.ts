/**
 * Advice 3C Scene - Tool Definitions & Executors
 * คำจำกัดความเครื่องมือสำหรับ LLM
 */

import type { ToolDeclaration } from '../../../../shared/types/protocol';
import { ToolCallContext } from '../types';
import {
  getProductByCode,
  getCategories,
  getCategoryBySlug,
  getHotProducts,
  getPromotionProducts,
  getBrandsByCategory,
} from './data';
import {
  searchProducts,
  formatProductsForLLM,
  formatProductDetailForLLM,
  formatCategoriesForLLM,
} from './data/search';

// =============== Tool Names ===============

export const ADVICE_3C_TOOL_NAMES = [
  'search_products',
  'get_product_detail',
  'get_categories',
  'get_brands',
  'get_hot_products',
  'get_promotions',
  'compare_products',
] as const;

// =============== Tool Declarations ===============

export const getAdvice3CTools = (): ToolDeclaration[] => {
  return [
    {
      name: 'search_products',
      description: `Search products by keyword, brand, category, or price range.
ค้นหาสินค้าตามคำค้น แบรนด์ หมวดหมู่ หรือช่วงราคา

**When to call / เมื่อไหร่ควรเรียก:**
- User asks for recommendations: "Recommend a laptop" / "แนะนำโน้ตบุ๊ค"
- User has specific needs: "Gaming mouse under 2000" / "เมาส์เกมไม่เกิน 2000"
- User wants to compare: "iPhone vs Samsung" / "เปรียบเทียบ iPhone กับ Samsung"

**Don't call / ไม่ควรเรียก:**
- Simple greetings: "สวัสดี" / "Hello"
- General questions: "ขายอะไรบ้าง" → answer directly, don't search`,
      parameters: {
        type: 'object',
        properties: {
          keyword: {
            type: 'string',
            description: 'Search keyword matching product name or spec / คำค้นหา',
          },
          brand: {
            type: 'string',
            description: 'Brand name: APPLE, ASUS, ACER, HP, LENOVO, MSI, NVIDIA, etc.',
          },
          category: {
            type: 'string',
            description: `Category slug. Common values:
- apple-product (iPhone/iPad/MacBook/AirPods)
- notebooks (laptops)
- smartphone-tablet (Android phones/tablets)
- computer-hardware (VGA/GPU/CPU/RAM/Motherboard/PSU/Case)
- monitor (displays)
- mouse-pads, keyboard-comboset
- headset-microphone, speaker
- printer-scanner-fax
- harddisk-storage (SSD/HDD)
- network-wireless (router/AP), network-wire (switch)
- cctv-and-security
- smart-watch, smart-life-and-iot
- ups, desktop-pc-server, comset`,
          },
          subCategory: {
            type: 'string',
            description: `Sub-category filter (menuListName). Use to filter main products vs accessories.
**IMPORTANT for Apple products:**
- "iPhone" = actual iPhones (NOT cases/accessories)
- "iPad" = actual iPads
- "Mac" = MacBook/iMac/Mac mini
- "AirPods" = AirPods devices
- "Apple Watch" = watches
- "อุปกรณ์เสริม Apple" = Apple accessories (cases, cables, chargers)

**Example:** When user asks for "iPhone 16 Pro", use subCategory: "iPhone" to get the actual phone, not cases!`,
          },
          minPrice: {
            type: 'number',
            description: 'Minimum price in Thai Baht (฿)',
          },
          maxPrice: {
            type: 'number',
            description: 'Maximum price in Thai Baht (฿)',
          },
          hasDiscount: {
            type: 'boolean',
            description: 'Only return products with discounts / เฉพาะสินค้าลดราคา',
          },
          inStock: {
            type: 'boolean',
            description: 'Only return in-stock products / เฉพาะสินค้าที่มีในสต็อก',
          },
          sortBy: {
            type: 'string',
            enum: ['price_asc', 'price_desc', 'discount_desc', 'views_desc'],
            description: 'Sort order: price_asc (cheapest), price_desc (expensive), discount_desc (biggest discount), views_desc (most popular)',
          },
          limit: {
            type: 'number',
            description: 'Max results to return (default 10, max 20)',
          },
        },
        required: [],
      },
    },
    {
      name: 'get_product_detail',
      description: `Get detailed information about a specific product by its code.
ดึงข้อมูลรายละเอียดสินค้าตามรหัสสินค้า

**When to call / เมื่อไหร่ควรเรียก:**
- User clicks or selects a product
- User mentions a product code: "A0167534"
- User wants more details: "Tell me more about..."`,
      parameters: {
        type: 'object',
        properties: {
          productCode: {
            type: 'string',
            description: 'Product code like A0167534',
          },
        },
        required: ['productCode'],
      },
    },
    {
      name: 'get_categories',
      description: `Get list of all product categories.
ดึงรายการหมวดหมู่สินค้าทั้งหมด

**When to call / เมื่อไหร่ควรเรียก:**
- User asks: "What categories do you have?" / "มีหมวดหมู่อะไรบ้าง"
- User wants to browse: "What do you sell?" / "ขายอะไรบ้าง"`,
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
    {
      name: 'get_brands',
      description: `Get list of brands, optionally filtered by category.
ดึงรายการแบรนด์ทั้งหมด หรือกรองตามหมวดหมู่`,
      parameters: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            description: 'Optional: category slug to filter brands / หมวดหมู่ที่ต้องการกรอง',
          },
        },
        required: [],
      },
    },
    {
      name: 'get_hot_products',
      description: `Get trending/popular products.
ดึงสินค้ายอดนิยม

**When to call / เมื่อไหร่ควรเรียก:**
- User asks: "What's popular?" / "อะไรฮอตบ้าง"
- User wants recommendations without criteria: "Show me something good"`,
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Number of products to return (default 10)',
          },
        },
        required: [],
      },
    },
    {
      name: 'get_promotions',
      description: `Get products with discounts and promotions.
ดึงสินค้าโปรโมชั่น/ลดราคา

**When to call / เมื่อไหร่ควรเรียก:**
- User asks: "Any promotions?" / "มีโปรโมชั่นอะไรบ้าง"
- User wants deals: "What's on sale?" / "อะไรลดราคาบ้าง"`,
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Number of products to return (default 10)',
          },
        },
        required: [],
      },
    },
    {
      name: 'compare_products',
      description: `Compare multiple products side by side. Shows a visual comparison UI.
เปรียบเทียบสินค้าหลายรายการ แสดง UI เปรียบเทียบ

**When to call / เมื่อไหร่ควรเรียก:**
- User explicitly asks to compare: "Compare A0167534 and A0167536" / "เปรียบเทียบสองตัวนี้"
- User asks about differences: "What's the difference?" / "ต่างกันยังไง" / "มีอะไรต่างกันบ้าง"
- User is deciding between products: "Which one should I buy?" / "ซื้อตัวไหนดี" / "ตัวไหนคุ้มกว่า"
- User mentions multiple products and seems undecided: "ระหว่าง X กับ Y" / "X หรือ Y ดี"
- After showing search results, user asks "เปรียบเทียบให้หน่อย" / "ดูความแตกต่าง"

**IMPORTANT: Use context to infer product codes!**
If user doesn't specify product codes but mentions products from recent conversation/search results,
use the product codes from that context. For example:
- If you just showed 3 products and user says "Compare the first two" → use codes of product 1 and 2
- If user says "Compare iPad and MacBook" after a search → find matching codes from recent results`,
      parameters: {
        type: 'object',
        properties: {
          productCodes: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of product codes to compare (e.g., ["A0167534", "A0167536"]). Infer from conversation context if not explicitly provided.',
          },
        },
        required: ['productCodes'],
      },
    },
  ];
};

// =============== Tool Check ===============

export const isAdvice3CTool = (toolName: string): boolean => {
  return (ADVICE_3C_TOOL_NAMES as readonly string[]).includes(toolName);
};

// =============== Tool Executor ===============

export const executeAdvice3CTool = async (context: ToolCallContext): Promise<string | null> => {
  const { toolCall } = context;
  const { name, arguments: args } = toolCall;

  if (!isAdvice3CTool(name)) {
    return null;
  }

  console.log(`[Advice3C Tools] 🛒 Executing: ${name}`, args);

  try {
    switch (name) {
      case 'search_products': {
        const llmLimit = Math.min(args?.limit || 10, 20);

        // Helper: Check if text contains non-English/non-Thai characters (e.g., Chinese, Japanese, Korean)
        const containsNonSupportedLanguage = (text: string | undefined): boolean => {
          if (!text) return false;
          // Match Chinese, Japanese (Hiragana, Katakana, Kanji), Korean characters
          const nonSupportedPattern = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/;
          return nonSupportedPattern.test(text);
        };

        // Validate category if provided
        if (args?.category) {
          const categoryExists = getCategoryBySlug(args.category);
          if (!categoryExists) {
            // Return available categories to LLM
            const availableCategories = getCategories().map(c => ({
              name: c.name,
              slug: c.slug,
              productCount: c.productCount,
            }));

            return JSON.stringify({
              success: false,
              error: `Category "${args.category}" not found / ไม่พบหมวดหมู่ "${args.category}"`,
              hint: 'Please use one of the available category slugs below',
              availableCategories: availableCategories.slice(0, 20), // Top 20 categories
            }, null, 2);
          }
        }

        // Base search params (without limit for UI)
        const baseSearchParams = {
          keyword: args?.keyword,
          brand: args?.brand,
          category: args?.category,
          subCategory: args?.subCategory,
          minPrice: args?.minPrice,
          maxPrice: args?.maxPrice,
          hasDiscount: args?.hasDiscount,
          inStock: args?.inStock,
          sortBy: args?.sortBy,
        };

        // Search WITHOUT limit to get all matching results
        const fullResult = searchProducts({
          ...baseSearchParams,
          limit: undefined,  // No limit - get all results for total count
        });

        // Get limited products for LLM (fewer results to save tokens)
        const llmProducts = fullResult.products.slice(0, llmLimit);

        // If no results found, check if the search parameters contain non-English/Thai characters
        if (fullResult.products.length === 0) {
          const keywordHasNonSupported = containsNonSupportedLanguage(args?.keyword);
          const brandHasNonSupported = containsNonSupportedLanguage(args?.brand);

          if (keywordHasNonSupported || brandHasNonSupported) {
            return JSON.stringify({
              success: false,
              message: 'No products found / ไม่พบสินค้า',
              hint: 'The product database contains data in English and Thai only. Please translate the search term to English or Thai and call search_products again. / ฐานข้อมูลสินค้ามีข้อมูลเป็นภาษาอังกฤษและภาษาไทยเท่านั้น กรุณาแปลคำค้นหาเป็นภาษาอังกฤษหรือภาษาไทยแล้วเรียก search_products อีกครั้ง',
              action: 'Please translate the keyword/brand to English or Thai and retry the search_products call with the translated terms.',
            });
          }
        }

        // Generate a display query for the UI header
        const displayQuery = args?.keyword
          || args?.brand
          || (args?.category && `Category: ${args.category}`)
          || (args?.hasDiscount && 'Promotions')
          || (args?.maxPrice && `Under ฿${args.maxPrice.toLocaleString()}`)
          || 'Search Results';

        // Dispatch UI update event with ALL results
        window.dispatchEvent(new CustomEvent('advice3c_search_result', {
          detail: {
            products: fullResult.products,  // UI gets ALL results
            query: displayQuery,            // Always has a value for UI to show results view
            searchParams: baseSearchParams,
            total: fullResult.total,
          },
        }));

        // LLM only gets limited results to save tokens
        // Pass all products to generate summary for truncated results
        return formatProductsForLLM(llmProducts, fullResult.products);
      }

      case 'get_product_detail': {
        if (!args?.productCode) {
          return JSON.stringify({
            success: false,
            error: 'productCode is required / ต้องระบุรหัสสินค้า',
            hint: 'Use search_products first to find products, then use the "code" field (e.g., "A0167534")',
          });
        }

        const product = getProductByCode(args.productCode);
        if (!product) {
          return JSON.stringify({
            success: false,
            error: `Product "${args.productCode}" not found / ไม่พบสินค้า "${args.productCode}"`,
            hint: 'Product codes start with "A0" followed by 6 digits (e.g., "A0167534"). Use search_products to find valid product codes.',
            suggestion: `Try: search_products({ keyword: "${args.productCode}" }) to find similar products`,
          });
        }

        // Dispatch UI update event
        window.dispatchEvent(new CustomEvent('advice3c_select_product', {
          detail: { product },
        }));

        return formatProductDetailForLLM(product);
      }

      case 'get_categories': {
        return formatCategoriesForLLM();
      }

      case 'get_brands': {
        const brands = args?.category
          ? getBrandsByCategory(args.category)
          : Array.from(new Set(getCategories().flatMap(() => [])));

        return JSON.stringify({
          success: true,
          brands: brands.length > 0 ? brands : ['APPLE', 'ASUS', 'ACER', 'HP', 'LENOVO', 'MSI', 'DELL', 'SAMSUNG', 'LOGITECH', 'RAZER'],
        });
      }

      case 'get_hot_products': {
        const llmLimit = Math.min(args?.limit || 10, 20);
        const uiLimit = 100;  // Limit UI to prevent performance issues
        const uiProducts = getHotProducts(uiLimit);       // Limited for UI performance
        const llmProducts = getHotProducts(llmLimit);     // Limited for LLM

        window.dispatchEvent(new CustomEvent('advice3c_search_result', {
          detail: {
            products: uiProducts,
            query: 'Hot Products / สินค้ายอดนิยม',
            total: uiProducts.length,
          },
        }));

        // Pass uiProducts for summary generation
        return formatProductsForLLM(llmProducts, uiProducts);
      }

      case 'get_promotions': {
        const llmLimit = Math.min(args?.limit || 10, 20);
        const uiLimit = 100;  // Limit UI to prevent performance issues
        const uiProducts = getPromotionProducts(uiLimit);   // Limited for UI
        const llmProducts = getPromotionProducts(llmLimit); // Limited for LLM

        window.dispatchEvent(new CustomEvent('advice3c_search_result', {
          detail: {
            products: uiProducts,
            query: 'Promotions / โปรโมชั่น',
            total: uiProducts.length,
          },
        }));

        // Pass uiProducts for summary generation
        return formatProductsForLLM(llmProducts, uiProducts);
      }

      case 'compare_products': {
        const codes = args?.productCodes as string[];
        if (!codes || codes.length < 2) {
          return JSON.stringify({
            success: false,
            error: 'Please provide at least 2 product codes to compare / กรุณาระบุรหัสสินค้าอย่างน้อย 2 รายการ',
          });
        }

        const products = codes
          .map(code => getProductByCode(code))
          .filter((p): p is NonNullable<typeof p> => p !== undefined);

        if (products.length < 2) {
          return JSON.stringify({
            success: false,
            error: 'Could not find enough products to compare / ไม่พบสินค้าเพียงพอที่จะเปรียบเทียบ',
          });
        }

        // Dispatch UI event to show compare modal
        window.dispatchEvent(new CustomEvent('advice3c_compare_products', {
          detail: { products },
        }));

        return formatProductsForLLM(products);
      }

      default:
        return null;
    }
  } catch (error) {
    console.error(`[Advice3C Tools] ❌ Error executing ${name}:`, error);
    return JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Tool execution failed',
    });
  }
};
