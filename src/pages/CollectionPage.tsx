/**
 * CollectionPage component for SARINE.
 * Advanced jewellery catalog discovery with multi-faceted filtering,
 * active filter chips, custom price bounds, sorting, empty recovery,
 * and recently viewed products rail.
 */

import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { productService, categoryService } from '../services';
import { Product, isInStock, JewelleryType, JEWELLERY_TYPE_LABELS } from '../types/product';
import { Category } from '../types/category';
import { ProductCard } from '../components/ProductCard';
import { Search, SlidersHorizontal, RotateCcw, X, Sparkles, Check, ChevronDown } from 'lucide-react';

interface CollectionPageProps {
  includeAll: boolean;
}

const OCCASIONS = [
  { id: 'everyday', label: 'Everyday Wear' },
  { id: 'festive', label: 'Festive & Celebration' },
  { id: 'wedding', label: 'Regal Wedding' },
  { id: 'gifting', label: 'Gifting Edition' }
];

const RECENTLY_VIEWED_KEY = 'sarine_recently_viewed_v1';

export const CollectionPage: React.FC<CollectionPageProps> = ({ includeAll }) => {
  const [searchParams, setSearchParams] = useSearchParams();

  // State
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showMobileFilters, setShowMobileFilters] = useState<boolean>(false);

  // URL Query Parameters
  const selectedCategorySlug = searchParams.get('category') || '';
  const searchParamQuery = searchParams.get('search') || '';
  const searchParamPrice = searchParams.get('price') || 'all';
  const searchParamSort = searchParams.get('sort') || 'newest';
  const searchParamType = searchParams.get('type') || '';
  const searchParamOccasion = searchParams.get('occasion') || '';
  const searchParamMetal = searchParams.get('metal') || '';
  const searchParamPlating = searchParams.get('plating') || '';
  const searchParamStone = searchParams.get('stone') || '';

  // Local filter states
  const [searchQuery, setSearchQuery] = useState<string>(searchParamQuery);
  const [sortBy, setSortBy] = useState<string>(searchParamSort);
  const [pricePreset, setPricePreset] = useState<string>(searchParamPrice);
  const [customMin, setCustomMin] = useState<string>('');
  const [customMax, setCustomMax] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>(searchParamType);
  const [selectedOccasion, setSelectedOccasion] = useState<string>(searchParamOccasion);
  const [selectedMetal, setSelectedMetal] = useState<string>(searchParamMetal);
  const [selectedPlating, setSelectedPlating] = useState<string>(searchParamPlating);
  const [selectedStone, setSelectedStone] = useState<string>(searchParamStone);
  const [inStockOnly, setInStockOnly] = useState<boolean>(false);

  // Sync with URL params
  useEffect(() => {
    setSearchQuery(searchParamQuery);
  }, [searchParamQuery]);

  useEffect(() => {
    setSortBy(searchParamSort);
  }, [searchParamSort]);

  useEffect(() => {
    setPricePreset(searchParamPrice);
  }, [searchParamPrice]);

  useEffect(() => {
    setSelectedType(searchParamType);
  }, [searchParamType]);

  useEffect(() => {
    setSelectedOccasion(searchParamOccasion);
  }, [searchParamOccasion]);

  useEffect(() => { setSelectedMetal(searchParamMetal); }, [searchParamMetal]);
  useEffect(() => { setSelectedPlating(searchParamPlating); }, [searchParamPlating]);
  useEffect(() => { setSelectedStone(searchParamStone); }, [searchParamStone]);

  // Load categories
  useEffect(() => {
    async function loadCategories() {
      try {
        const fetched = await categoryService.getCategories({ activeOnly: true });
        setCategories(fetched);
      } catch (err) {
        console.error('Failed to load categories', err);
      }
    }
    loadCategories();
  }, []);

  // Load all products
  useEffect(() => {
    let isCancelled = false;
    async function loadProducts() {
      setLoading(true);
      try {
        const fetched = await productService.getProducts({
          sortBy: 'newest',
          inStockOnly: false,
          includeAll
        });
        if (!isCancelled) {
          setAllProducts(fetched);
        }
      } catch (err) {
        console.error('Failed to load catalogue products', err);
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }
    loadProducts();
    return () => {
      isCancelled = true;
    };
  }, [includeAll]);

  // Load recently viewed
  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENTLY_VIEWED_KEY);
      if (raw) {
        const ids: string[] = JSON.parse(raw);
        if (Array.isArray(ids) && ids.length > 0) {
          productService.getProductsByIds(ids.slice(0, 4), { includeAll }).then((prods) => {
            setRecentlyViewed(prods.filter((p) => p.status === 'active'));
          });
        }
      }
    } catch {
      // Ignore
    }
  }, [includeAll]);

  // Category mapping
  const categoryMap = useMemo(() => {
    const map: Record<string, Category> = {};
    for (const c of categories) {
      map[c.slug] = c;
      map[c.id] = c;
    }
    return map;
  }, [categories]);

  const availableMetals = useMemo(() => Array.from(new Set(allProducts.map(product => product.baseMetal?.trim()).filter((value): value is string => Boolean(value)))).sort(), [allProducts]);
  const availablePlatings = useMemo(() => Array.from(new Set(allProducts.map(product => product.platingFinish?.trim()).filter((value): value is string => Boolean(value)))).sort(), [allProducts]);
  const availableStones = useMemo(() => Array.from(new Set(allProducts.map(product => product.stoneType?.trim()).filter((value): value is string => Boolean(value)))).sort(), [allProducts]);

  // Update query params helper
  const updateFilter = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, val] of Object.entries(updates)) {
      if (val === null || val === '' || val === 'all') {
        next.delete(key);
      } else {
        next.set(key, val);
      }
    }
    setSearchParams(next);
  };

  const handleClearAll = () => {
    setSearchQuery('');
    setPricePreset('all');
    setCustomMin('');
    setCustomMax('');
    setSelectedType('');
    setSelectedOccasion('');
    setSelectedMetal('');
    setSelectedPlating('');
    setSelectedStone('');
    setInStockOnly(false);
    setSearchParams({});
  };

  // Filter & Sort Pipeline
  const filteredProducts = useMemo(() => {
    return allProducts.filter((product) => {
      // Must be active (or includeAll)
      if (!includeAll && product.status !== 'active') return false;

      // In stock filter
      if (inStockOnly && !isInStock(product)) return false;

      // Category filter
      if (selectedCategorySlug) {
        const targetCategory = categoryMap[selectedCategorySlug];
        if (targetCategory && product.categoryId !== targetCategory.id && product.categoryId !== targetCategory.slug) {
          return false;
        }
      }

      // Jewellery Type filter
      if (selectedType && product.jewelleryType !== selectedType) {
        return false;
      }

      // Occasion filter (matches tags or collectionSlugs)
      if (selectedOccasion) {
        const hasOccasion =
          (product.collectionSlugs && product.collectionSlugs.includes(selectedOccasion)) ||
          (product.tags && product.tags.includes(selectedOccasion));
        if (!hasOccasion) return false;
      }

      if (selectedMetal && product.baseMetal !== selectedMetal) return false;
      if (selectedPlating && product.platingFinish !== selectedPlating) return false;
      if (selectedStone && product.stoneType !== selectedStone) return false;

      // Search Query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = product.name.toLowerCase().includes(q);
        const matchesType = product.jewelleryType.toLowerCase().includes(q);
        const matchesTag = product.tags && product.tags.some((t) => t.toLowerCase().includes(q));
        const matchesDesc = product.description.toLowerCase().includes(q) || (product.shortDescription || '').toLowerCase().includes(q);
        const matchesCraft = [product.baseMetal, product.platingFinish, product.stoneType, product.closureType].some(value => (value || '').toLowerCase().includes(q));
        const matchesSku = product.id.toLowerCase().includes(q);
        if (!matchesName && !matchesType && !matchesTag && !matchesDesc && !matchesCraft && !matchesSku) {
          return false;
        }
      }

      // Price Filter
      if (customMin || customMax) {
        const min = customMin ? parseInt(customMin, 10) : 0;
        const max = customMax ? parseInt(customMax, 10) : Infinity;
        if (product.price < min || product.price > max) return false;
      } else if (pricePreset !== 'all') {
        if (pricePreset === 'under-999' && product.price >= 1000) return false;
        if (pricePreset === '1000-2000' && (product.price < 1000 || product.price > 1999)) return false;
        if (pricePreset === 'above-2000' && product.price <= 2000) return false;
      }

      return true;
    });
  }, [
    allProducts,
    includeAll,
    inStockOnly,
    selectedCategorySlug,
    selectedType,
    selectedOccasion,
    selectedMetal,
    selectedPlating,
    selectedStone,
    searchQuery,
    pricePreset,
    customMin,
    customMax,
    categoryMap
  ]);

  // Sorting
  const sortedProducts = useMemo(() => {
    const list = [...filteredProducts];
    switch (sortBy) {
      case 'price-asc':
        return list.sort((a, b) => a.price - b.price);
      case 'price-desc':
        return list.sort((a, b) => b.price - a.price);
      case 'bestseller':
        return list.sort((a, b) => (b.stock || 0) - (a.stock || 0));
      case 'newest':
      default:
        return list.sort((a, b) => {
          const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return tB - tA;
        });
    }
  }, [filteredProducts, sortBy]);

  // Active filter count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedCategorySlug) count++;
    if (searchQuery.trim()) count++;
    if (pricePreset !== 'all' || customMin || customMax) count++;
    if (selectedType) count++;
    if (selectedOccasion) count++;
    if (selectedMetal) count++;
    if (selectedPlating) count++;
    if (selectedStone) count++;
    if (inStockOnly) count++;
    return count;
  }, [selectedCategorySlug, searchQuery, pricePreset, customMin, customMax, selectedType, selectedOccasion, selectedMetal, selectedPlating, selectedStone, inStockOnly]);

  const currentCategory = selectedCategorySlug ? categoryMap[selectedCategorySlug] : null;

  return (
    <div className="min-h-screen bg-[var(--white)] pb-20 text-[color:var(--body)] font-sans">
      {/* Category Hero / Header */}
      <section className="bg-white border-b border-[var(--border)] py-8 sm:py-12">
        <div className="site-container">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-[color:var(--body)] mb-2">
              <Link to="/" className="hover:text-[color:var(--plum)]">Home</Link>
              <span className="text-[color:var(--border)]">/</span>
              <span className="text-[color:var(--heading)] font-medium">Catalogue</span>
              {currentCategory && (
                <>
                  <span className="text-[color:var(--border)]">/</span>
                  <span className="text-[color:var(--body)]">{currentCategory.name}</span>
                </>
              )}
            </div>

            <h1 className="font-serif text-3xl sm:text-4xl lg:text-[40px] text-[color:var(--body)] font-normal leading-tight">
              {currentCategory ? currentCategory.name : 'Handcrafted Jewellery Collections'}
            </h1>

            <p className="mt-2.5 text-xs sm:text-sm text-[color:var(--body)] leading-relaxed font-sans max-w-2xl">
              {currentCategory?.description ||
                'Explore our full range of artisanal jewellery, designed for modern festivities and everyday elegance.'}
            </p>
          </div>
        </div>
      </section>

      {/* Main Discover Layout */}
      <div className="site-container pt-8">
        {/* Controls Bar: Search, Filter Toggle, Sort */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 bg-white p-3.5 sm:p-4 border border-[var(--border)] rounded-xs shadow-2xs">
          {/* Search within collection */}
          <div className="relative flex-1 max-w-md">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--body)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                updateFilter({ search: e.target.value });
              }}
              placeholder="Filter by title, style, or tag..."
              className="w-full pl-9 pr-8 py-2 text-xs text-[color:var(--body)] placeholder-[color:var(--body)] bg-[var(--white)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xs focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  updateFilter({ search: null });
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[color:var(--body)] hover:text-[color:var(--body)]"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Mobile Filter Button */}
            <button
              onClick={() => setShowMobileFilters(!showMobileFilters)}
              className="lg:hidden flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-[color:var(--plum)] bg-[var(--white)] border border-[var(--border)] hover:border-[var(--gold)] rounded-xs cursor-pointer"
            >
              <SlidersHorizontal size={14} />
              <span>Filters {activeFiltersCount > 0 && `(${activeFiltersCount})`}</span>
            </button>

            {/* In-Stock Toggle */}
            <label className="hidden sm:flex items-center gap-2 text-xs text-[color:var(--body)] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(e) => setInStockOnly(e.target.checked)}
                className="accent-[#563568] rounded-xs cursor-pointer"
              />
              <span>In Stock Only</span>
            </label>

            {/* Sort Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-[color:var(--body)] hidden sm:inline">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  updateFilter({ sort: e.target.value });
                }}
                className="text-xs bg-[var(--white)] border border-[var(--border)] text-[color:var(--body)] py-2 px-3 rounded-xs focus:outline-none cursor-pointer"
              >
                <option value="newest">Newest Additions</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="bestseller">Popular Pieces</option>
              </select>
            </div>
          </div>
        </div>

        {/* Active Filter Chips */}
        {activeFiltersCount > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-6 p-3 bg-white border border-[var(--border)] rounded-xs text-xs font-sans">
            <span className="text-[color:var(--body)] font-medium mr-1">Active Filters:</span>

            {selectedCategorySlug && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[var(--pill)] text-[color:var(--plum)] border border-[var(--border)] rounded-xs">
                <span>Category: {currentCategory?.name || selectedCategorySlug}</span>
                <button
                  onClick={() => updateFilter({ category: null })}
                  className="hover:text-[#DC2626] cursor-pointer"
                >
                  <X size={11} />
                </button>
              </span>
            )}

            {searchQuery && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[var(--pill)] text-[color:var(--plum)] border border-[var(--border)] rounded-xs">
                <span>Keyword: "{searchQuery}"</span>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    updateFilter({ search: null });
                  }}
                  className="hover:text-[#DC2626] cursor-pointer"
                >
                  <X size={11} />
                </button>
              </span>
            )}

            {selectedType && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[var(--pill)] text-[color:var(--plum)] border border-[var(--border)] rounded-xs">
                <span>Type: {JEWELLERY_TYPE_LABELS[selectedType as JewelleryType] || selectedType}</span>
                <button
                  onClick={() => {
                    setSelectedType('');
                    updateFilter({ type: null });
                  }}
                  className="hover:text-[#DC2626] cursor-pointer"
                >
                  <X size={11} />
                </button>
              </span>
            )}

            {selectedOccasion && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[var(--pill)] text-[color:var(--plum)] border border-[var(--border)] rounded-xs">
                <span>Occasion: {OCCASIONS.find((o) => o.id === selectedOccasion)?.label || selectedOccasion}</span>
                <button
                  onClick={() => {
                    setSelectedOccasion('');
                    updateFilter({ occasion: null });
                  }}
                  className="hover:text-[#DC2626] cursor-pointer"
                >
                  <X size={11} />
                </button>
              </span>
            )}

            {selectedMetal && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[var(--pill)] text-[color:var(--plum)] border border-[var(--border)] rounded-xs">Metal: {selectedMetal}<button onClick={() => { setSelectedMetal(''); updateFilter({ metal: null }); }}><X size={11}/></button></span>}
            {selectedPlating && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[var(--pill)] text-[color:var(--plum)] border border-[var(--border)] rounded-xs">Finish: {selectedPlating}<button onClick={() => { setSelectedPlating(''); updateFilter({ plating: null }); }}><X size={11}/></button></span>}
            {selectedStone && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[var(--pill)] text-[color:var(--plum)] border border-[var(--border)] rounded-xs">Stone: {selectedStone}<button onClick={() => { setSelectedStone(''); updateFilter({ stone: null }); }}><X size={11}/></button></span>}

            {pricePreset !== 'all' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[var(--pill)] text-[color:var(--plum)] border border-[var(--border)] rounded-xs">
                <span>Price: {pricePreset.replace('-', ' to ')}</span>
                <button
                  onClick={() => {
                    setPricePreset('all');
                    updateFilter({ price: null });
                  }}
                  className="hover:text-[#DC2626] cursor-pointer"
                >
                  <X size={11} />
                </button>
              </span>
            )}

            {inStockOnly && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[var(--pill)] text-[color:var(--plum)] border border-[var(--border)] rounded-xs">
                <span>In Stock Only</span>
                <button
                  onClick={() => setInStockOnly(false)}
                  className="hover:text-[#DC2626] cursor-pointer"
                >
                  <X size={11} />
                </button>
              </span>
            )}

            <button
              onClick={handleClearAll}
              className="ml-auto text-xs text-[color:var(--plum)] hover:underline font-medium cursor-pointer"
            >
              Clear All ({activeFiltersCount})
            </button>
          </div>
        )}

        {/* 2-Column Desktop Grid: Filters Sidebar (3 cols) + Products (9 cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Desktop Filter Sidebar */}
          <aside className={`lg:col-span-3 space-y-6 ${showMobileFilters ? 'block' : 'hidden lg:block'}`}>
            <div className="bg-white p-5 border border-[var(--border)] rounded-xs space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
                <h3 className="font-serif text-base text-[color:var(--body)] font-normal flex items-center gap-2">
                  <SlidersHorizontal size={14} className="text-[color:var(--plum)]" />
                  <span>Refine Catalogue</span>
                </h3>
                {activeFiltersCount > 0 && (
                  <button
                    onClick={handleClearAll}
                    className="text-[11px] text-[color:var(--body)] hover:text-[#DC2626] cursor-pointer"
                  >
                    Reset
                  </button>
                )}
              </div>

              {/* 1. Category Filter */}
              <div>
                <span className="text-xs uppercase tracking-wider text-[color:var(--body)] font-medium block mb-2.5">
                  Category
                </span>
                <div className="space-y-1.5 text-xs font-sans">
                  <button
                    onClick={() => updateFilter({ category: null })}
                    className={`w-full text-left py-1 px-2 rounded-xs transition-colors flex items-center justify-between ${
                      !selectedCategorySlug ? 'bg-[var(--plum)] text-[color:var(--white)] font-medium' : 'text-[color:var(--body)] hover:text-[color:var(--body)]'
                    }`}
                  >
                    <span>All Categories</span>
                    <span>{allProducts.length}</span>
                  </button>
                  {categories.map((cat) => {
                    const count = allProducts.filter((p) => p.categoryId === cat.id || p.categoryId === cat.slug).length;
                    const active = selectedCategorySlug === cat.slug || selectedCategorySlug === cat.id;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => updateFilter({ category: cat.slug })}
                        className={`w-full text-left py-1 px-2 rounded-xs transition-colors flex items-center justify-between ${
                          active ? 'bg-[var(--plum)] text-[color:var(--white)] font-medium' : 'text-[color:var(--body)] hover:text-[color:var(--body)]'
                        }`}
                      >
                        <span>{cat.name}</span>
                        <span className="text-[11px] opacity-70">{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Price Filter */}
              <div className="pt-4 border-t border-[var(--border)]">
                <span className="text-xs uppercase tracking-wider text-[color:var(--body)] font-medium block mb-2.5">
                  Price
                </span>
                <div className="space-y-1.5 text-xs">
                  {[
                    { id: 'all', label: 'All Prices' },
                    { id: 'under-999', label: 'Under ₹999' },
                    { id: '1000-2000', label: '₹1,000 to ₹1,999' },
                    { id: 'above-2000', label: '₹2,000 and above' }
                  ].map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => {
                        setPricePreset(preset.id);
                        setCustomMin('');
                        setCustomMax('');
                        updateFilter({ price: preset.id === 'all' ? null : preset.id });
                      }}
                      className={`w-full text-left py-1 px-2 rounded-xs transition-colors ${
                        pricePreset === preset.id && !customMin && !customMax
                          ? 'bg-[var(--plum)] text-[color:var(--white)] font-medium'
                          : 'text-[color:var(--body)] hover:text-[color:var(--body)]'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {/* Custom Price Inputs */}
                <div className="mt-3 pt-3 border-t border-[var(--border)] flex items-center gap-2 text-xs">
                  <input
                    type="number"
                    placeholder="Min ₹"
                    value={customMin}
                    onChange={(e) => setCustomMin(e.target.value)}
                    className="w-1/2 p-1.5 bg-[var(--white)] border border-[var(--border)] rounded-xs text-xs focus:outline-none focus:border-[var(--gold)]"
                  />
                  <span className="text-[color:var(--body)]">-</span>
                  <input
                    type="number"
                    placeholder="Max ₹"
                    value={customMax}
                    onChange={(e) => setCustomMax(e.target.value)}
                    className="w-1/2 p-1.5 bg-[var(--white)] border border-[var(--border)] rounded-xs text-xs focus:outline-none focus:border-[var(--gold)]"
                  />
                </div>
              </div>

              {/* 3. Occasions Filter */}
              <div className="pt-4 border-t border-[var(--border)]">
                <span className="text-xs uppercase tracking-wider text-[color:var(--body)] font-medium block mb-2.5">
                  Curated Occasion
                </span>
                <div className="space-y-1.5 text-xs">
                  <button
                    onClick={() => {
                      setSelectedOccasion('');
                      updateFilter({ occasion: null });
                    }}
                    className={`w-full text-left py-1 px-2 rounded-xs transition-colors ${
                      !selectedOccasion ? 'bg-[var(--plum)] text-[color:var(--white)] font-medium' : 'text-[color:var(--body)] hover:text-[color:var(--body)]'
                    }`}
                  >
                    All Occasions
                  </button>
                  {OCCASIONS.map((occ) => (
                    <button
                      key={occ.id}
                      onClick={() => {
                        setSelectedOccasion(occ.id);
                        updateFilter({ occasion: occ.id });
                      }}
                      className={`w-full text-left py-1 px-2 rounded-xs transition-colors ${
                        selectedOccasion === occ.id
                          ? 'bg-[var(--plum)] text-[color:var(--white)] font-medium'
                          : 'text-[color:var(--body)] hover:text-[color:var(--body)]'
                      }`}
                    >
                      {occ.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 4. Craftsmanship Filters */}
              {(availableMetals.length > 0 || availablePlatings.length > 0 || availableStones.length > 0) && (
                <div className="pt-4 border-t border-[var(--border)] space-y-4">
                  <span className="text-xs uppercase tracking-wider text-[color:var(--body)] font-medium block">Craftsmanship</span>
                  {availableMetals.length > 0 && <label className="block text-xs text-[color:var(--body)]">Base metal<select value={selectedMetal} onChange={event => { setSelectedMetal(event.target.value); updateFilter({ metal: event.target.value || null }); }} className="mt-1.5 w-full min-h-10 rounded-lg border border-[var(--border)] bg-[var(--white)] px-3 text-xs text-[color:var(--body)]"><option value="">All metals</option>{availableMetals.map(value => <option key={value} value={value}>{value}</option>)}</select></label>}
                  {availablePlatings.length > 0 && <label className="block text-xs text-[color:var(--body)]">Plating / finish<select value={selectedPlating} onChange={event => { setSelectedPlating(event.target.value); updateFilter({ plating: event.target.value || null }); }} className="mt-1.5 w-full min-h-10 rounded-lg border border-[var(--border)] bg-[var(--white)] px-3 text-xs text-[color:var(--body)]"><option value="">All finishes</option>{availablePlatings.map(value => <option key={value} value={value}>{value}</option>)}</select></label>}
                  {availableStones.length > 0 && <label className="block text-xs text-[color:var(--body)]">Stones & embellishments<select value={selectedStone} onChange={event => { setSelectedStone(event.target.value); updateFilter({ stone: event.target.value || null }); }} className="mt-1.5 w-full min-h-10 rounded-lg border border-[var(--border)] bg-[var(--white)] px-3 text-xs text-[color:var(--body)]"><option value="">All stones</option>{availableStones.map(value => <option key={value} value={value}>{value}</option>)}</select></label>}
                </div>
              )}
            </div>
          </aside>

          {/* Product Grid Area (9 cols) */}
          <main className="lg:col-span-9">
            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 lg:gap-6">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="animate-pulse bg-white p-2.5 border border-[var(--border)] rounded-xs">
                    <div className="aspect-[3/4] bg-[var(--pill)] rounded-xs w-full"></div>
                    <div className="h-4 bg-[var(--pill)] w-3/4 mt-3"></div>
                    <div className="h-3 bg-[var(--pill)] w-1/3 mt-2"></div>
                  </div>
                ))}
              </div>
            ) : sortedProducts.length > 0 ? (
              <div>
                <div className="flex items-center justify-between mb-4 text-xs text-[color:var(--body)]">
                  <span>Showing {sortedProducts.length} handcrafted pieces</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
                  {sortedProducts.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              </div>
            ) : (
              /* Empty Search / Filter State with Recovery */
              <div className="bg-white border border-[var(--border)] p-10 sm:p-14 text-center rounded-xs shadow-2xs">
                <Sparkles size={36} className="mx-auto text-[#B69ACF] mb-3" />
                <h3 className="font-serif text-xl sm:text-2xl text-[color:var(--body)] font-normal">
                  No matching jewellery found
                </h3>
                <p className="text-xs text-[color:var(--body)] mt-2 max-w-md mx-auto leading-relaxed">
                  We couldn't find any pieces matching your current filters. Try resetting your search or exploring our recommended bestsellers below.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <button
                    onClick={handleClearAll}
                    className="px-6 py-2.5 bg-[var(--plum)] text-[color:var(--white)] hover:bg-[var(--gold)] active:bg-[var(--plum-dark)] text-xs font-medium rounded-xs transition-colors cursor-pointer"
                  >
                    Reset All Filters
                  </button>
                  <Link
                    to="/shop"
                    className="px-6 py-2.5 bg-transparent border border-[var(--plum)] text-[color:var(--plum)] hover:bg-[var(--gold)] hover:text-[color:var(--white)] text-xs font-medium rounded-xs transition-colors"
                  >
                    Browse All Catalogue
                  </Link>
                </div>
              </div>
            )}
          </main>
        </div>

        {/* Recently Viewed Products Shelf */}
        {recentlyViewed.length > 0 && (
          <section className="mt-16 sm:mt-24 pt-10 border-t border-[var(--border)]">
            <div className="flex items-center justify-between mb-6">
              <div>
                <span className="text-[10px] uppercase tracking-[0.25em] text-[color:var(--body)] font-medium block">
                  YOUR RECENT EXPLORATIONS
                </span>
                <h2 className="font-serif text-xl sm:text-2xl text-[color:var(--body)] font-normal mt-0.5">
                  Recently Viewed Pieces
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
              {recentlyViewed.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};
