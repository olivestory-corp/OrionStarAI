/**
 * Advice3CScene - IT & Electronics Shopping Assistant
 * ผู้ช่วยช้อปปิ้ง IT และอิเล็กทรอนิกส์
 */

import { useCallback, useState, useEffect, useMemo, useRef } from 'react';
import { useAgentSDKContext } from '../../sdk/react';
import { SubtitleDisplay, NavigationOverlay, SessionInitToast, ToolStatusBar } from '../../sdk-react-ui';
import { SceneProps } from '../types';

import { Advice3CScreen, CompareModal, CompareBar, MAX_COMPARE_PRODUCTS, VoiceGlowBorder, VoiceStatusButton } from './components';
import { Product, getHotProducts, getProductsByCategory, getCategories } from './data';
import { searchProducts } from './data/search';
import { useUIContextSync, UIContext } from './hooks';

// 3分钟无语音输入自动刷新的超时时间（毫秒）
const IDLE_TIMEOUT_MS = 3 * 60 * 1000;

// localStorage key for mute state
const MUTE_STATE_KEY = 'advice3c_muted';

export function Advice3CScene({ onExit }: SceneProps) {
  const {
    isConnected,
    isInitialized,
    isPlaying,
    subtitleText,
    subtitleProgress,
    userSpeaking,
    sendContext,
    sendTextWithInterrupt,
    isVADReady,
    stopNavigation,
    state,
    isMuted,
    toggleMute,
    startPTT,
    stopPTT,
    pauseVAD,
    resumeVAD,
  } = useAgentSDKContext();

  // Track if we've applied the initial mute state from localStorage
  const hasAppliedInitialMute = useRef(false);
  // Track if we've paused VAD for PTT mode
  const hasEnteredPTTMode = useRef(false);

  const robotEnvState = state.robotState;

  // 3分钟无语音输入自动刷新
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);

  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }
    idleTimerRef.current = setTimeout(() => {
      console.log('[Advice3C] 3分钟无语音输入，刷新页面');
      window.location.reload();
    }, IDLE_TIMEOUT_MS);
  }, []);

  // 监听用户说话状态，重置计时器
  useEffect(() => {
    if (userSpeaking) {
      resetIdleTimer();
    }
  }, [userSpeaking, resetIdleTimer]);

  // 组件挂载时启动计时器，卸载时清理
  useEffect(() => {
    resetIdleTimer();
    return () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
    };
  }, [resetIdleTimer]);

  // PTT 模式：VAD 就绪后暂停自动语音检测，改用按住说话
  useEffect(() => {
    if (isVADReady && !hasEnteredPTTMode.current) {
      hasEnteredPTTMode.current = true;
      pauseVAD();
      console.log('[Advice3C] 🎤 进入 PTT 模式，已暂停 VAD 自动检测');
    }
  }, [isVADReady, pauseVAD]);

  // 组件卸载时恢复 VAD
  useEffect(() => {
    return () => {
      if (hasEnteredPTTMode.current) {
        resumeVAD();
        console.log('[Advice3C] 🎤 退出 PTT 模式，已恢复 VAD');
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Read mute state from localStorage on init and apply it
  useEffect(() => {
    if (isInitialized && !hasAppliedInitialMute.current) {
      hasAppliedInitialMute.current = true;
      const savedMuteState = localStorage.getItem(MUTE_STATE_KEY);
      const shouldBeMuted = savedMuteState === 'true';

      console.log('[Advice3C] 🔇 Initial mute state from localStorage:', shouldBeMuted, 'current:', isMuted);

      // If saved state differs from current state, toggle
      if (shouldBeMuted !== isMuted) {
        console.log('[Advice3C] 🔇 Applying saved mute state:', shouldBeMuted);
        toggleMute();
      }
    }
  }, [isInitialized, isMuted, toggleMute]);

  // Wrapped toggleMute that also saves to localStorage
  const handleToggleMute = useCallback(() => {
    const newMutedState = !isMuted;
    console.log('[Advice3C] 🔇 Toggling mute, new state:', newMutedState);
    localStorage.setItem(MUTE_STATE_KEY, String(newMutedState));
    toggleMute();
  }, [isMuted, toggleMute]);

  // Search parameters type
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

  // Scene state
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [displayProducts, setDisplayProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState<string | undefined>();
  const [searchParams, setSearchParams] = useState<SearchParams | undefined>();
  const [searchTotal, setSearchTotal] = useState<number>(0);

  // Compare state
  const [compareProducts, setCompareProducts] = useState<Product[]>([]);
  const [showCompareModal, setShowCompareModal] = useState(false);

  // UI filter state (synced from Advice3CScreen)
  const [filterBrand, setFilterBrand] = useState<string | null>(null);
  const [filterSubCategory, setFilterSubCategory] = useState<string | null>(null);

  // Get category name for context
  const categoryName = useMemo(() => {
    if (!selectedCategory) return undefined;
    const cat = getCategories().find(c => c.slug === selectedCategory);
    return cat?.name;
  }, [selectedCategory]);

  // Build UI context for LLM sync
  const uiContext = useMemo((): UIContext => {
    // Determine current page
    let page: UIContext['page'] = 'home';
    if (showCompareModal && compareProducts.length >= 2) {
      page = 'compare';
    } else if (searchQuery) {
      page = 'search';
    } else if (selectedCategory) {
      page = 'category';
    }

    return {
      page,
      category: selectedCategory || undefined,
      categoryName,
      searchQuery,
      selectedProduct: selectedProduct ? {
        code: selectedProduct.code,
        name: selectedProduct.name,
        price: selectedProduct.priceSale,
        brand: selectedProduct.brand,
      } : undefined,
      filterBrand: filterBrand || undefined,
      filterSubCategory: filterSubCategory || undefined,
      productCount: displayProducts.length,
      compareProducts: showCompareModal ? compareProducts.map(p => ({
        code: p.code,
        name: p.name,
      })) : undefined,
    };
  }, [
    showCompareModal,
    compareProducts,
    searchQuery,
    selectedCategory,
    categoryName,
    selectedProduct,
    filterBrand,
    filterSubCategory,
    displayProducts.length,
  ]);

  // Sync UI context to LLM (with debounce + diff, silent mode - no response triggered)
  useUIContextSync(
    uiContext,
    sendContext,
    { debounceMs: 600, enabled: isInitialized }
  );

  // Initialize: Load all hot products (no limit for UI)
  useEffect(() => {
    const initial = getHotProducts(); // No limit - show all
    setDisplayProducts(initial);
  }, []);

  // Select category handler (also used as "back to home")
  const handleSelectCategory = useCallback((slug: string | null) => {
    setSelectedCategory(slug);
    setSearchQuery(undefined);   // Clear search when navigating
    setSearchParams(undefined);  // Clear search params
    setSearchTotal(0);
    setSelectedProduct(null);    // Clear selected product

    if (slug) {
      const products = getProductsByCategory(slug);
      setDisplayProducts(products);
      if (products.length > 0) {
        setSelectedProduct(products[0]);
      }
    } else {
      // Return to home - show hot products
      const products = getHotProducts();
      setDisplayProducts(products);
    }
  }, []);

  // Select product handler - only update UI, no AI interruption
  const handleSelectProduct = useCallback((product: Product) => {
    console.log('[Advice3C] 🛒 Selected product:', product.name, 'Code:', product.code);
    setSelectedProduct(product);
    // Note: Product details are already displayed in the UI panel.
    // User can ask AI about the product if they want more info.
  }, []);

  // Listen for tool execution UI events
  useEffect(() => {
    const handleSearchResult = (event: CustomEvent) => {
      const { products, query, searchParams: params, total } = event.detail;
      console.log('[Advice3C] 📦 Search result update:', products.length, 'items, params:', params);
      setDisplayProducts(products);
      setSearchQuery(query);
      setSearchParams(params);
      setSearchTotal(total || products.length);
      setSelectedCategory(null); // Clear category when searching
      if (products.length > 0) {
        setSelectedProduct(products[0]);
      }
    };

    const handleSelectProductEvent = (event: CustomEvent) => {
      const { product } = event.detail;
      console.log('[Advice3C] 🎯 Product selected:', product.name);
      setSelectedProduct(product);
    };

    const handleCompareProducts = (event: CustomEvent) => {
      const { products } = event.detail;
      console.log('[Advice3C] ⚖️ Compare products:', products.length, 'items');
      setCompareProducts(products);
      setShowCompareModal(true);
    };

    window.addEventListener('advice3c_search_result', handleSearchResult as EventListener);
    window.addEventListener('advice3c_select_product', handleSelectProductEvent as EventListener);
    window.addEventListener('advice3c_compare_products', handleCompareProducts as EventListener);

    return () => {
      window.removeEventListener('advice3c_search_result', handleSearchResult as EventListener);
      window.removeEventListener('advice3c_select_product', handleSelectProductEvent as EventListener);
      window.removeEventListener('advice3c_compare_products', handleCompareProducts as EventListener);
    };
  }, []);

  // Handle stop navigation
  const handleStopNavigation = useCallback(async () => {
    const destination = robotEnvState?.navigation?.destination || 'destination';
    console.log('[Advice3C] 🛑 Stopping navigation to:', destination);
    await stopNavigation();
    sendTextWithInterrupt(`(System Notification) User manually stopped the navigation to "${destination}".`);
  }, [robotEnvState?.navigation?.destination, sendTextWithInterrupt, stopNavigation]);

  // Handle close compare modal
  const handleCloseCompare = useCallback(() => {
    setShowCompareModal(false);
  }, []);

  // Handle select product from compare modal
  const handleSelectFromCompare = useCallback((product: Product) => {
    setSelectedProduct(product);
    setShowCompareModal(false);
  }, []);

  // Handle filter changes from Advice3CScreen
  const handleFilterChange = useCallback((brand: string | null, subCategory: string | null) => {
    setFilterBrand(brand);
    setFilterSubCategory(subCategory);
  }, []);

  // ======= Compare List Management =======

  // Add product to compare list
  const handleAddToCompare = useCallback((product: Product) => {
    setCompareProducts(prev => {
      // Check if already in list
      if (prev.some(p => p.code === product.code)) {
        return prev;
      }
      // Check max limit
      if (prev.length >= MAX_COMPARE_PRODUCTS) {
        return prev;
      }
      console.log('[Advice3C] ➕ Added to compare:', product.name);
      return [...prev, product];
    });
  }, []);

  // Remove product from compare list
  const handleRemoveFromCompare = useCallback((productCode: string) => {
    setCompareProducts(prev => {
      console.log('[Advice3C] ➖ Removed from compare:', productCode);
      return prev.filter(p => p.code !== productCode);
    });
  }, []);

  // Clear all compare products
  const handleClearCompare = useCallback(() => {
    console.log('[Advice3C] 🗑️ Cleared compare list');
    setCompareProducts([]);
  }, []);

  // Open compare modal (from CompareBar)
  const handleOpenCompare = useCallback(() => {
    if (compareProducts.length >= 2) {
      setShowCompareModal(true);
    }
  }, [compareProducts.length]);

  // ======= User Search Handler =======
  const handleUserSearch = useCallback((keyword: string, category?: string | null) => {
    console.log('[Advice3C] 🔍 User search:', keyword, 'in category:', category || 'all');

    // 1. 本地即时搜索（带分类筛选）
    const searchOptions = category
      ? { keyword, category }
      : { keyword };
    const result = searchProducts(searchOptions);

    // Update state with search results
    setDisplayProducts(result.products);
    setSearchQuery(keyword);
    setSearchParams(searchOptions);
    setSearchTotal(result.total);

    // 保留分类（如果有）
    if (category) {
      setSelectedCategory(category);
    }

    // Select first product if available
    if (result.products.length > 0) {
      setSelectedProduct(result.products[0]);
    } else {
      setSelectedProduct(null);
    }

    // 2. 静默通知 AI（不触发语音回复，仅更新上下文）
    const contextMsg = category
      ? `用户在分类"${category}"中搜索了"${keyword}"，找到 ${result.total} 个商品`
      : `用户手动搜索了"${keyword}"，找到 ${result.total} 个商品`;
    sendContext(contextMsg);
  }, [sendContext]);

  return (
    <>
      {/* 用户说话时四周呼吸灯效果 */}
      <VoiceGlowBorder isActive={userSpeaking} color="cyan" intensity={2} />

      <SessionInitToast
        isConnected={isConnected}
        isInitialized={isInitialized}
        isVADReady={isVADReady}
      />

      <Advice3CScreen
        displayProducts={displayProducts}
        selectedProduct={selectedProduct}
        selectedCategory={selectedCategory}
        searchQuery={searchQuery}
        searchParams={searchParams}
        searchTotal={searchTotal}
        compareProducts={compareProducts}
        maxCompareProducts={MAX_COMPARE_PRODUCTS}
        onSelectProduct={handleSelectProduct}
        onSelectCategory={handleSelectCategory}
        onFilterChange={handleFilterChange}
        onAddToCompare={handleAddToCompare}
        onRemoveFromCompare={handleRemoveFromCompare}
        onSearch={handleUserSearch}
        onExit={onExit}
      />

      <NavigationOverlay
        isNavigating={robotEnvState?.navigation?.status === 'navigating'}
        destination={robotEnvState?.navigation?.destination}
        onStopNavigation={handleStopNavigation}
      />

      {/* Compare Modal */}
      {showCompareModal && compareProducts.length >= 2 && (
        <CompareModal
          products={compareProducts}
          onClose={handleCloseCompare}
          onSelectProduct={handleSelectFromCompare}
        />
      )}

      {/* Floating Compare Bar */}
      {!showCompareModal && (
        <CompareBar
          products={compareProducts}
          onRemove={handleRemoveFromCompare}
          onClear={handleClearCompare}
          onCompare={handleOpenCompare}
        />
      )}

      <ToolStatusBar />
      <SubtitleDisplay
        text={subtitleText}
        progress={subtitleProgress}
        isPlaying={isPlaying}
      />

      {/* Voice Status Button - PTT 模式，放在最后确保 z-index 最高 */}
      <VoiceStatusButton
        isListening={userSpeaking}
        isSpeaking={isPlaying}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
        onPTTStart={startPTT}
        onPTTEnd={stopPTT}
      />

      {/* Danmaku tips - disabled for now */}
      {/* <DanmakuOverlay
        enabled={isInitialized}
        isPaused={isPlaying || userSpeaking}
        interval={4000}
      /> */}
    </>
  );
}

export default Advice3CScene;
