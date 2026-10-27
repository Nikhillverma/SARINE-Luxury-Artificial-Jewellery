/**
 * SearchOverlay component for SARINE.
 * Luxury search experience with autocomplete, recent search history,
 * category shortcuts, and live thumbnail product discovery.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { productService } from '../services';
import { Product } from '../types/product';
import { formatInr } from '../utils/currency';
import { Search, X, Clock, ArrowRight, Sparkles, Tag } from 'lucide-react';

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

const RECENT_SEARCHES_KEY = 'sarine_recent_searches_v1';
const TRENDING_SEARCHES = ['Temple Jewellery', 'Choker', 'Rose Gold', 'Daily Wear Cuffs', 'Kundan', 'Bridal Set'];

export const SearchOverlay: React.FC<SearchOverlayProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [results, setResults] = useState<Product[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setRecentSearches(parsed.slice(0, 6));
      }
    } catch {
      // Ignore
    }
  }, [isOpen]);

  // Load catalogue for instant autocomplete
  useEffect(() => {
    let isCancelled = false;
    async function loadCatalogue() {
      try {
        const products = await productService.getProducts({ sortBy: 'newest', inStockOnly: false });
        if (!isCancelled) {
          setAllProducts(products.filter((p) => p.status === 'active'));
        }
      } catch (err) {
        console.warn('[SearchOverlay] Could not pre-fetch catalogue:', err);
      }
    }
    if (isOpen) {
      loadCatalogue();
      setTimeout(() => inputRef.current?.focus(), 100);
    }
    return () => {
      isCancelled = true;
    };
  }, [isOpen]);

  // Lock scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      setQuery('');
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Filter products as user types
  useEffect(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      setResults([]);
      return;
    }
    setLoading(true);
    const matched = allProducts.filter((p) => {
      return (
        p.name.toLowerCase().includes(q) ||
        p.jewelleryType.toLowerCase().includes(q) ||
        (p.shortDescription && p.shortDescription.toLowerCase().includes(q)) ||
        (p.tags && p.tags.some((t) => t.toLowerCase().includes(q))) ||
        (p.collectionSlugs && p.collectionSlugs.some((c) => c.toLowerCase().includes(q))) ||
        (p.baseMetal && p.baseMetal.toLowerCase().includes(q)) ||
        (p.platingFinish && p.platingFinish.toLowerCase().includes(q))
      );
    });
    setResults(matched.slice(0, 6));
    setLoading(false);
  }, [query, allProducts]);

  const saveRecentSearch = (term: string) => {
    try {
      const clean = term.trim();
      if (!clean) return;
      const updated = [clean, ...recentSearches.filter((s) => s.toLowerCase() !== clean.toLowerCase())].slice(0, 6);
      setRecentSearches(updated);
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    } catch {
      // Ignore
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      saveRecentSearch(query.trim());
      onClose();
      navigate(`/shop?search=${encodeURIComponent(query.trim())}`);
    }
  };

  const handleSelectTerm = (term: string) => {
    saveRecentSearch(term);
    onClose();
    navigate(`/shop?search=${encodeURIComponent(term)}`);
  };

  const handleClearRecents = () => {
    setRecentSearches([]);
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col font-sans">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-[#302438]/50 backdrop-blur-xs transition-opacity duration-200"
      />

      {/* Main Container */}
      <div className="relative w-full bg-white border-b border-[#E7DCEB] shadow-2xl z-10 max-h-[85vh] flex flex-col animate-in slide-in-from-top duration-300">
        {/* Search Input Bar */}
        <div className="border-b border-[#E7DCEB] bg-white">
          <div className="site-container py-4 sm:py-5">
            <form onSubmit={handleSearchSubmit} className="flex items-center gap-3">
              <Search size={22} className="text-[#563568] shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search jewellery by piece, design, material, or occasion..."
                className="w-full text-base sm:text-xl font-serif text-[#302438] placeholder-[#6F6475]/50 focus:outline-none bg-transparent"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="p-1.5 text-[#6F6475] hover:text-[#302438] transition-colors cursor-pointer"
                  title="Clear input"
                >
                  <X size={18} />
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs text-[#6F6475] hover:text-[#563568] font-medium border border-[#E7DCEB] hover:border-[#B69ACF] rounded-xs transition-colors cursor-pointer"
              >
                ESC
              </button>
            </form>
          </div>
        </div>

        {/* Dynamic Search Body */}
        <div className="site-container py-6 overflow-y-auto flex-1">
          {query.trim() ? (
            /* Autocomplete Results */
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs uppercase tracking-wider text-[#6F6475] font-medium">
                  {results.length > 0 ? `Matching Pieces (${results.length})` : 'No direct matches found'}
                </span>
                {results.length > 0 && (
                  <button
                    onClick={handleSearchSubmit}
                    className="text-xs text-[#563568] hover:text-[#A184BD] font-medium inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>View all results for "{query}"</span>
                    <ArrowRight size={13} />
                  </button>
                )}
              </div>

              {results.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {results.map((product) => (
                    <Link
                      key={product.id}
                      to={`/product/${product.slug}`}
                      onClick={() => {
                        saveRecentSearch(product.name);
                        onClose();
                      }}
                      className="group flex items-center gap-3.5 p-2.5 bg-[#FAF5FC] hover:bg-[#F0E6F4] border border-[#E7DCEB] hover:border-[#B69ACF] rounded-xs transition-all"
                    >
                      <div className="w-16 h-20 bg-white border border-[#E7DCEB] shrink-0 overflow-hidden rounded-xs">
                        <img
                          src={product.images[0]}
                          alt={product.name}
                          className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] uppercase tracking-wider text-[#6F6475] font-medium block">
                          {product.jewelleryType}
                        </span>
                        <h4 className="font-serif text-sm text-[#302438] group-hover:text-[#563568] truncate transition-colors">
                          {product.name}
                        </h4>
                        <div className="flex items-baseline gap-2 mt-1">
                          <span className="text-xs font-semibold text-[#302438]">
                            {formatInr(product.price)}
                          </span>
                          {product.compareAtPrice && (
                            <span className="text-[10px] text-[#6F6475] line-through">
                              {formatInr(product.compareAtPrice)}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center max-w-md mx-auto">
                  <p className="font-serif text-lg text-[#302438]">We couldn't find matches for "{query}"</p>
                  <p className="text-xs text-[#6F6475] mt-1.5 leading-relaxed">
                    Try browsing our curated collections below or searching for keywords like "earrings", "choker", or "bangle".
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* Default: Recent Searches, Trending, and Category Shortcuts */
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Column 1: Recent Searches */}
              {recentSearches.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs uppercase tracking-wider text-[#6F6475] font-medium flex items-center gap-1.5">
                      <Clock size={13} />
                      <span>Recent Searches</span>
                    </span>
                    <button
                      onClick={handleClearRecents}
                      className="text-[11px] text-[#6F6475] hover:text-[#DC2626] cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {recentSearches.map((term) => (
                      <button
                        key={term}
                        onClick={() => handleSelectTerm(term)}
                        className="px-3 py-1.5 bg-[#F7F0FA] hover:bg-[#F0E6F4] text-xs text-[#302438] hover:text-[#563568] border border-[#E7DCEB] hover:border-[#B69ACF] rounded-xs transition-colors cursor-pointer"
                      >
                        {term}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Column 2: Popular Searches */}
              <div>
                <span className="text-xs uppercase tracking-wider text-[#6F6475] font-medium flex items-center gap-1.5 mb-3">
                  <Sparkles size={13} className="text-[#563568]" />
                  <span>Trending Collections</span>
                </span>
                <div className="flex flex-wrap gap-2">
                  {TRENDING_SEARCHES.map((term) => (
                    <button
                      key={term}
                      onClick={() => handleSelectTerm(term)}
                      className="px-3 py-1.5 bg-[#FAF5FC] hover:bg-[#F0E6F4] text-xs text-[#563568] border border-[#E7DCEB] hover:border-[#B69ACF] rounded-xs transition-colors cursor-pointer"
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </div>

              {/* Column 3: Category Shortcuts */}
              <div>
                <span className="text-xs uppercase tracking-wider text-[#6F6475] font-medium flex items-center gap-1.5 mb-3">
                  <Tag size={13} />
                  <span>Explore by Category</span>
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs font-sans">
                  <Link
                    to="/shop?category=earrings"
                    onClick={onClose}
                    className="p-2.5 bg-[#F7F0FA] hover:bg-[#F0E6F4] text-[#302438] hover:text-[#563568] border border-[#E7DCEB] rounded-xs transition-colors block text-center"
                  >
                    Earrings & Jhumkas
                  </Link>
                  <Link
                    to="/shop?category=necklaces"
                    onClick={onClose}
                    className="p-2.5 bg-[#F7F0FA] hover:bg-[#F0E6F4] text-[#302438] hover:text-[#563568] border border-[#E7DCEB] rounded-xs transition-colors block text-center"
                  >
                    Necklaces & Chokers
                  </Link>
                  <Link
                    to="/shop?category=bracelets"
                    onClick={onClose}
                    className="p-2.5 bg-[#F7F0FA] hover:bg-[#F0E6F4] text-[#302438] hover:text-[#563568] border border-[#E7DCEB] rounded-xs transition-colors block text-center"
                  >
                    Bangles & Cuffs
                  </Link>
                  <Link
                    to="/shop?category=rings"
                    onClick={onClose}
                    className="p-2.5 bg-[#F7F0FA] hover:bg-[#F0E6F4] text-[#302438] hover:text-[#563568] border border-[#E7DCEB] rounded-xs transition-colors block text-center"
                  >
                    Cocktail Rings
                  </Link>
                  <Link
                    to="/shop?category=sets"
                    onClick={onClose}
                    className="col-span-2 p-2.5 bg-[#563568] text-white hover:bg-[#A184BD] rounded-xs transition-colors text-center font-medium"
                  >
                    Curated Jewellery Sets
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
