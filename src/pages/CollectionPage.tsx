/**
 * CollectionPage component for SARINE.
 * Demonstrates product listing with live category filtering, sort options, price range,
 * and stock filters powered by the swappable IProductService and ICategoryService.
 */

import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { productService, categoryService } from '../services';
import { Product } from '../types/product';
import { Category } from '../types/category';
import { ProductCard } from '../components/ProductCard';
import { Search, SlidersHorizontal, RotateCcw, Sparkles } from 'lucide-react';

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
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'newest' | 'price-asc' | 'price-desc'>('newest');
  const [pricePreset, setPricePreset] = useState<string>('all');
  const [inStockOnly, setInStockOnly] = useState<boolean>(false);

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
      case 'under-500':
        return { minPrice: 0, maxPrice: 500 };
      case '500-1000':
        return { minPrice: 500, maxPrice: 1000 };
      case '1000-2000':
        return { minPrice: 1000, maxPrice: 2000 };
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
    <div className="min-h-screen bg-[#FAF8F5]">
      {/* Editorial Page Header */}
      <section className="border-b border-[#E6DFD5] bg-[#F3EEE7]/50 py-10 sm:py-14 text-center px-4">
        <div className="max-w-[860px] mx-auto">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="h-[1px] w-8 bg-[#B89758]"></span>
            <span className="text-xs uppercase tracking-[0.25em] text-[#B89758] font-medium font-sans">
              Indian Fashion Jewellery
            </span>
            <span className="h-[1px] w-8 bg-[#B89758]"></span>
          </div>
          <h1 className="font-serif text-3xl sm:text-5xl text-[#1C1917] tracking-tight font-normal">
            {selectedCategorySlug
              ? categories.find((c) => c.slug === selectedCategorySlug)?.name || 'Curated Collection'
              : 'The SARINE Collection'}
          </h1>
          <p className="mt-3 text-sm sm:text-base text-[#6B635D] max-w-xl mx-auto font-sans">
            Meticulously detailed festive chokers, temple motifs, polki bells, and everyday minimalist adornments.
          </p>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="max-w-[1280px] mx-auto px-4 sm:px-8 py-8">
        {/* Category Pills Navigation */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 scrollbar-none border-b border-[#E6DFD5]">
          <button
            onClick={() => handleCategorySelect('')}
            className={`px-4 py-2 text-xs uppercase tracking-widest whitespace-nowrap transition-all border ${
              !selectedCategorySlug
                ? 'bg-[#1C1917] text-[#FAF8F5] border-[#1C1917] font-semibold'
                : 'bg-white text-[#57534E] border-[#E6DFD5] hover:border-[#B89758]'
            }`}
          >
            All Pieces
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleCategorySelect(cat.slug)}
              className={`px-4 py-2 text-xs uppercase tracking-widest whitespace-nowrap transition-all border ${
                selectedCategorySlug === cat.slug
                  ? 'bg-[#1C1917] text-[#FAF8F5] border-[#1C1917] font-semibold'
                  : 'bg-white text-[#57534E] border-[#E6DFD5] hover:border-[#B89758]'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Filter Controls Bar */}
        <div className="mt-6 p-4 sm:p-5 bg-white border border-[#E6DFD5] shadow-xs flex flex-wrap items-center justify-between gap-4">
          {/* Search Field */}
          <div className="relative flex-1 min-w-[220px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8C847C]" />
            <input
              type="text"
              placeholder="Search motif, stone, or style..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-[#FAF8F5] border border-[#8C847C] rounded-sm text-[#1C1917] placeholder-[#8C847C] focus:bg-white focus:border-[#1C1917] transition-colors"
            />
          </div>

          {/* Price Range Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-[#6B635D] font-medium hidden sm:inline">Price:</span>
            <select
              value={pricePreset}
              onChange={(e) => setPricePreset(e.target.value)}
              className="px-3 py-2 text-xs sm:text-sm bg-[#FAF8F5] border border-[#8C847C] rounded-sm text-[#1C1917] cursor-pointer"
            >
              <option value="all">All Prices (₹299 - ₹2,499)</option>
              <option value="under-500">Under ₹500</option>
              <option value="500-1000">₹500 to ₹1,000</option>
              <option value="1000-2000">₹1,000 to ₹2,000</option>
              <option value="above-2000">Above ₹2,000</option>
            </select>
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-[#6B635D] font-medium hidden sm:inline">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 text-xs sm:text-sm bg-[#FAF8F5] border border-[#8C847C] rounded-sm text-[#1C1917] cursor-pointer"
            >
              <option value="newest">Newest First</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
            </select>
          </div>

          {/* In Stock Toggle */}
          <label className="flex items-center gap-2 text-xs uppercase tracking-wider text-[#1C1917] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={inStockOnly}
              onChange={(e) => setInStockOnly(e.target.checked)}
              className="w-4 h-4 accent-[#B89758] rounded-xs cursor-pointer"
            />
            <span>In Stock Only</span>
          </label>

          {/* Reset Action */}
          {(selectedCategorySlug || searchQuery || pricePreset !== 'all' || inStockOnly) && (
            <button
              onClick={handleResetFilters}
              className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-[#8C2F2F] hover:underline font-medium ml-auto"
            >
              <RotateCcw size={12} />
              <span>Clear Filters</span>
            </button>
          )}
        </div>

        {/* Status / Count Bar */}
        <div className="mt-4 flex items-center justify-between text-xs text-[#6B635D] px-1">
          <span>
            Showing <strong className="text-[#1C1917]">{products.length}</strong>{' '}
            {products.length === 1 ? 'piece' : 'pieces'}
            {includeAll && <span className="ml-2 text-[#B89758]">(includeAll enabled: includes draft & archived)</span>}
          </span>
          {loading && <span className="text-[#B89758] animate-pulse">Loading catalogue from mock layer...</span>}
        </div>

        {/* Product Grid */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 mt-6">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="bg-white border border-[#E6DFD5] h-[360px] animate-pulse flex flex-col p-4 justify-between"
              >
                <div className="bg-[#EFE9E0] h-[65%] w-full"></div>
                <div className="h-4 bg-[#EFE9E0] w-3/4 mt-4"></div>
                <div className="h-3 bg-[#EFE9E0] w-1/2 mt-2"></div>
                <div className="h-4 bg-[#EFE9E0] w-1/3 mt-2"></div>
              </div>
            ))}
          </div>
        ) : products.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 mt-6">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          /* Empty State */
          <div className="bg-white border border-[#E6DFD5] p-12 text-center max-w-lg mx-auto my-12">
            <SlidersHorizontal size={36} className="mx-auto text-[#B89758] mb-3" />
            <h3 className="font-serif text-2xl text-[#1C1917] font-medium">No pieces match your selection</h3>
            <p className="text-xs text-[#6B635D] mt-2 font-sans">
              Try adjusting your price range, clearing the search term, or browsing all jewellery categories.
            </p>
            <button
              onClick={handleResetFilters}
              className="mt-5 px-6 py-2.5 bg-[#1C1917] text-[#FAF8F5] text-xs uppercase tracking-widest hover:bg-[#B89758] transition-colors"
            >
              Reset All Filters
            </button>
          </div>
        )}
      </main>
    </div>
  );
};
