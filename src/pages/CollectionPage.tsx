/**
 * CollectionPage component for SARINE.
 * Luxury catalog page with category filtering, search, sort options, price range,
 * and stock filters powered by the swappable IProductService and ICategoryService.
 */

import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { productService, categoryService } from '../services';
import { Product } from '../types/product';
import { Category } from '../types/category';
import { ProductCard } from '../components/ProductCard';
import { Search, SlidersHorizontal, RotateCcw } from 'lucide-react';

interface CollectionPageProps {
  includeAll: boolean;
}

export const CollectionPage: React.FC<CollectionPageProps> = ({ includeAll }) => {
  const [searchParams, setSearchParams] = useSearchParams();

  // State
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const selectedCategorySlug = searchParams.get('category') || '';
  const searchParamQuery = searchParams.get('search') || '';
  const searchParamPrice = searchParams.get('price') || 'all';
  const searchParamSort = searchParams.get('sort') || 'newest';

  const [searchQuery, setSearchQuery] = useState<string>(searchParamQuery);
  const [sortBy, setSortBy] = useState<'newest' | 'price-asc' | 'price-desc'>(
    searchParamSort === 'price-asc' || searchParamSort === 'price-desc' ? searchParamSort : 'newest'
  );
  const [pricePreset, setPricePreset] = useState<string>(searchParamPrice);
  const [inStockOnly, setInStockOnly] = useState<boolean>(false);

  // Synchronize searchQuery, price, and sort with searchParams if URL changes
  useEffect(() => {
    if (searchParamQuery !== searchQuery) {
      setSearchQuery(searchParamQuery);
    }
  }, [searchParamQuery]);

  useEffect(() => {
    if (searchParamPrice && searchParamPrice !== pricePreset) {
      setPricePreset(searchParamPrice);
    }
  }, [searchParamPrice]);

  useEffect(() => {
    if (searchParamSort === 'price-asc' || searchParamSort === 'price-desc' || searchParamSort === 'newest') {
      setSortBy(searchParamSort);
    }
  }, [searchParamSort]);

  // Load categories once
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

  // Compute min/max from price preset
  const priceRange = useMemo(() => {
    switch (pricePreset) {
      case 'under-999':
        return { minPrice: 0, maxPrice: 999 };
      case 'under-500':
        return { minPrice: 0, maxPrice: 500 };
      case '500-1000':
        return { minPrice: 500, maxPrice: 1000 };
      case '1000-2000':
      case '1000-1999':
        return { minPrice: 1000, maxPrice: 1999 };
      case 'above-2000':
        return { minPrice: 2000, maxPrice: 99999 };
      default:
        return { minPrice: undefined, maxPrice: undefined };
    }
  }, [pricePreset]);

  // Load products whenever filters change
  useEffect(() => {
    let isCancelled = false;

    async function loadProducts() {
      setLoading(true);
      try {
        let fetched: Product[] = [];

        if (searchQuery.trim()) {
          fetched = await productService.searchProducts(searchQuery, { includeAll });
          // Apply client-side category/price/stock filters on search results if any
          if (selectedCategorySlug) {
            const cat = categories.find((c) => c.slug === selectedCategorySlug);
            if (cat) fetched = fetched.filter((p) => p.categoryId === cat.id);
          }
          if (inStockOnly) {
            fetched = fetched.filter((p) => p.stock > 0);
          }
          if (priceRange.minPrice !== undefined) {
            fetched = fetched.filter((p) => p.price >= priceRange.minPrice!);
          }
          if (priceRange.maxPrice !== undefined) {
            fetched = fetched.filter((p) => p.price <= priceRange.maxPrice!);
          }
        } else {
          fetched = await productService.getProducts({
            categorySlug: selectedCategorySlug || undefined,
            minPrice: priceRange.minPrice,
            maxPrice: priceRange.maxPrice,
            sortBy,
            inStockOnly,
            includeAll
          });
        }

        if (!isCancelled) {
          setProducts(fetched);
        }
      } catch (err) {
        console.error('Failed to fetch products', err);
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    loadProducts();

    return () => {
      isCancelled = true;
    };
  }, [selectedCategorySlug, priceRange, sortBy, inStockOnly, searchQuery, includeAll, categories]);

  // Category select handler
  const handleCategorySelect = (slug: string) => {
    if (slug) {
      setSearchParams({ category: slug });
    } else {
      setSearchParams({});
    }
  };

  // Reset all filters
  const handleResetFilters = () => {
    setSearchParams({});
    setSearchQuery('');
    setSortBy('newest');
    setPricePreset('all');
    setInStockOnly(false);
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#242321]">
      {/* Editorial Page Header */}
      <section className="border-b border-[#E8E0D6] bg-[#FAF8F5] py-12 sm:py-16 text-center">
        <div className="site-container">
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className="h-[1px] w-6 bg-[#B79A68]"></span>
            <span className="text-[10px] uppercase tracking-[0.25em] text-[#B79A68] font-sans font-medium">
              Curated Collection
            </span>
            <span className="h-[1px] w-6 bg-[#B79A68]"></span>
          </div>
          <h1 className="font-serif text-3xl sm:text-5xl text-[#242321] tracking-tight font-normal">
            {selectedCategorySlug
              ? categories.find((c) => c.slug === selectedCategorySlug)?.name || 'Curated Collection'
              : 'The SARINE Collection'}
          </h1>
          <p className="mt-3 text-xs sm:text-sm text-[#81776D] max-w-xl mx-auto font-sans leading-relaxed">
            Meticulously detailed festive chokers, temple motifs, polki bells, and everyday minimalist adornments.
          </p>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="site-container py-8 sm:py-12">
        {/* Category Navigation Bar (Understated text tabs instead of loud pill clusters) */}
        <div className="flex items-center gap-6 overflow-x-auto pb-4 scrollbar-none border-b border-[#E8E0D6]">
          <button
            onClick={() => handleCategorySelect('')}
            className={`text-xs uppercase tracking-[0.18em] whitespace-nowrap transition-colors pb-1 ${
              !selectedCategorySlug
                ? 'text-[#242321] font-medium border-b border-[#B89758]'
                : 'text-[#81776D] hover:text-[#B89758]'
            }`}
          >
            All Pieces
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleCategorySelect(cat.slug)}
              className={`text-xs uppercase tracking-[0.18em] whitespace-nowrap transition-colors pb-1 ${
                selectedCategorySlug === cat.slug
                  ? 'text-[#242321] font-medium border-b border-[#B89758]'
                  : 'text-[#81776D] hover:text-[#B89758]'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Filter Controls Bar */}
        <div className="mt-6 p-4 sm:p-5 bg-[#FAF8F5] border border-[#E8E0D6] flex flex-wrap items-center justify-between gap-4">
          {/* Search Field */}
          <div className="relative flex-1 min-w-[220px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#81776D]" />
            <input
              type="text"
              placeholder="Search motif, stone, or style..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-white border border-[#E8E0D6] text-[#242321] placeholder-[#81776D] focus:border-[#242321] transition-colors font-sans focus:outline-none"
            />
          </div>

          {/* Price Range Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-[#81776D] font-sans font-medium hidden sm:inline">Price:</span>
            <select
              value={pricePreset}
              onChange={(e) => setPricePreset(e.target.value)}
              className="px-3 py-2 text-xs sm:text-sm bg-white border border-[#E8E0D6] text-[#242321] font-sans cursor-pointer focus:outline-none"
            >
              <option value="all">All Prices (₹299 - ₹2,499)</option>
              <option value="under-999">Under ₹999</option>
              <option value="under-500">Under ₹500</option>
              <option value="500-1000">₹500 to ₹1,000</option>
              <option value="1000-2000">₹1,000 to ₹1,999</option>
              <option value="above-2000">₹2,000 and above</option>
            </select>
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-[#81776D] font-sans font-medium hidden sm:inline">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 text-xs sm:text-sm bg-white border border-[#E8E0D6] text-[#242321] font-sans cursor-pointer focus:outline-none"
            >
              <option value="newest">Newest First</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
            </select>
          </div>

          {/* In Stock Toggle */}
          <label className="flex items-center gap-2 text-xs uppercase tracking-wider text-[#242321] cursor-pointer select-none font-sans">
            <input
              type="checkbox"
              checked={inStockOnly}
              onChange={(e) => setInStockOnly(e.target.checked)}
              className="w-4 h-4 accent-[#B79A68] cursor-pointer"
            />
            <span>In Stock Only</span>
          </label>

          {/* Reset Action */}
          {(selectedCategorySlug || searchQuery || pricePreset !== 'all' || inStockOnly) && (
            <button
              onClick={handleResetFilters}
              className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-[#8C2F2F] hover:underline font-sans font-medium ml-auto"
            >
              <RotateCcw size={12} />
              <span>Reset</span>
            </button>
          )}
        </div>

        {/* Status / Count Bar */}
        <div className="mt-4 flex items-center justify-between text-xs text-[#81776D] font-sans px-1">
          <span>
            Showing <strong className="text-[#242321] font-medium">{products.length}</strong>{' '}
            {products.length === 1 ? 'piece' : 'pieces'}
            {includeAll && <span className="ml-2 text-[#B79A68]">(includeAll enabled)</span>}
          </span>
          {loading && <span className="text-[#B79A68] animate-pulse">Loading catalogue...</span>}
        </div>

        {/* Product Grid using plain CSS .product-grid */}
        {loading ? (
          <div className="product-grid mt-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="animate-pulse w-full">
                <div className="bg-[#F2EADF] aspect-[3/4] w-full border border-[#E8E0D6]"></div>
                <div className="h-4 bg-[#F2EADF] w-2/3 mt-3"></div>
                <div className="h-3 bg-[#F2EADF] w-1/3 mt-2"></div>
              </div>
            ))}
          </div>
        ) : products.length > 0 ? (
          <div className="product-grid mt-6">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          /* Empty State */
          <div className="bg-[#FAF8F5] border border-[#E8E0D6] p-12 text-center max-w-lg mx-auto my-12">
            <SlidersHorizontal size={32} className="mx-auto text-[#B79A68] mb-3" />
            <h3 className="font-serif text-2xl text-[#242321] font-normal">No pieces match your selection</h3>
            <p className="text-xs text-[#81776D] mt-2 font-sans">
              Try adjusting your price range, clearing the search term, or browsing all jewellery silhouettes.
            </p>
            <button
              onClick={handleResetFilters}
              className="mt-6 px-7 py-3 bg-[#1C1917] text-[#FAF8F5] text-xs uppercase tracking-[0.2em] font-sans hover:bg-[#B89758] hover:text-[#FAF8F5] transition-colors"
            >
              Reset Filters
            </button>
          </div>
        )}
      </main>
    </div>
  );
};
