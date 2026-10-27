/**
 * Premium Homepage for SARINE.
 * Matches the reference design with exact section order, layout, and styling.
 * 
 * Layout Discipline:
 * - Desktop centered container: `mx-auto w-full max-w-[1280px] px-4 sm:px-6 lg:px-10`
 * - Consistent vertical rhythm: 64-96px desktop, 40-56px mobile
 * - Hero banner: fixed responsive height h-[420px] md:h-[520px] lg:h-[600px],
 *   stacked absolute slides with opacity transitions, object-[70%_center],
 *   soft beige gradient overlay, centered container controls, no blank space underneath.
 */

import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { productService, categoryService } from '../services';
import { Product } from '../types/product';
import { Category } from '../types/category';
import { ProductCard } from '../components/ProductCard';
import { formatInr } from '../utils/currency';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Heart,
  Star,
  Sparkles,
  ShieldCheck,
  Gem
} from 'lucide-react';

/* ==========================================================================
   HOMEPAGE IMAGES CONFIG
   Easy to update or replace with new assets in public/images/
   ========================================================================== */
export const HOMEPAGE_IMAGES = {
  heroSlide1: '/images/hero-model-1.jpg',
  heroSlide2: '/images/hero-model-2.jpg',
  heroSlide3: '/images/hero-model-3.jpg',
  ourStory: '/images/our-story.jpg',
  editorialBanner: '/images/editorial-banner.jpg',
  categoryBracelets: '/images/category-bracelets.jpg',
};

/* ==========================================================================
   SHARED IMAGE HELPER
   Returns primary image, falls back to other fields, then placeholder.
   Logs console.warn if product lacks an image.
   ========================================================================== */
export function getProductImage(product?: Partial<Product> | null): string {
  const fallback = 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=800&q=80';
  if (!product) return fallback;

  if (product.images && product.images.length > 0 && product.images[0]) {
    return product.images[0];
  }

  console.warn(`[getProductImage] Product ${product.id || 'unknown'} has no valid image, using placeholder.`);
  return fallback;
}

interface HomePageProps {
  includeAll: boolean;
}

export const HomePage: React.FC<HomePageProps> = ({ includeAll }) => {
  // Storefront Data
  const [categories, setCategories] = useState<Category[]>([]);
  const [bestsellers, setBestsellers] = useState<Product[]>([]);
  const [newArrivals, setNewArrivals] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Occasions curation
  const occasions = [
    {
      title: 'Daily Wear',
      subtitle: 'Effortless everyday minimalism',
      image: '/images/ananya-temple-coin-bracelet.jpg',
      link: '/shop?search=everyday'
    },
    {
      title: 'Festive',
      subtitle: 'Celebratory sparkle and classic motifs',
      image: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=1000&q=80',
      link: '/shop?search=festive'
    },
    {
      title: 'Wedding',
      subtitle: 'Regal bridal sets & heritage chokers',
      image: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=1000&q=80',
      link: '/shop?search=wedding'
    },
    {
      title: 'Gifting',
      subtitle: 'Precious tokens of affection',
      image: '/images/zoya-open-cuff-leaf-bangle.jpg',
      link: '/shop?category=bracelets'
    }
  ];

  // Hero Slider State
  const [activeSlide, setActiveSlide] = useState<number>(0);
  const slideCount = 3;

  // Best Sellers Carousel Scroll Reference
  const carouselRef = useRef<HTMLDivElement>(null);

  // Wishlist State (Local interactive set)
  const [wishlist, setWishlist] = useState<Set<string>>(new Set());

  // Hero Slides Definition
  const heroSlides = [
    {
      id: 0,
      eyebrow: 'ELEGANCE IN EVERY DETAIL',
      heading: 'Modern Jewellery for Everyday You',
      paragraph: 'Thoughtfully designed artificial jewellery that brings timeless elegance to your everyday moments.',
      image: HOMEPAGE_IMAGES.heroSlide1,
      shopLink: '/shop',
      categoriesLink: '#categories'
    },
    {
      id: 1,
      eyebrow: 'THE HERITAGE CHAPTER',
      heading: 'Classical Kundan & Polki Motifs',
      paragraph: 'Opulent festive adornments crafted with lightweight modern comfort for wedding celebrations and milestones.',
      image: HOMEPAGE_IMAGES.heroSlide2,
      shopLink: '/shop?category=necklaces',
      categoriesLink: '#categories'
    },
    {
      id: 2,
      eyebrow: 'CONTEMPORARY DEMI-FINE',
      heading: 'Subtle Radiance for Every Occasion',
      paragraph: 'Layered gold chains, floral studs, and delicate cuffs tailored for seamless daily refinement.',
      image: HOMEPAGE_IMAGES.heroSlide3,
      shopLink: '/shop?category=earrings',
      categoriesLink: '#categories'
    }
  ];

  // 1. Fetch Firestore / Service Data
  useEffect(() => {
    let isCancelled = false;

    async function loadData() {
      setLoading(true);
      try {
        const [cats, featured, newest] = await Promise.all([
          categoryService.getCategories({ activeOnly: true }),
          productService.getFeaturedProducts(10),
          productService.getProducts({ sortBy: 'newest', inStockOnly: true, includeAll })
        ]);

        if (!isCancelled) {
          const sortPriority: Record<string, number> = {
            earrings: 1,
            necklaces: 2,
            rings: 3,
            bracelets: 4,
            sets: 5
          };

          const sortedCats = [...cats].sort((a, b) => {
            const prioA = sortPriority[a.slug] || 99;
            const prioB = sortPriority[b.slug] || 99;
            return prioA - prioB;
          });

          setCategories(sortedCats);

          const bestList = featured.length >= 5 ? featured : (newest.length > 0 ? newest : featured);
          setBestsellers(bestList);

          // 4 newest products sorted by createdAt descending
          const sortedNewest = [...newest].sort((a, b) => {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return dateB - dateA;
          });
          const arrivalList = sortedNewest.slice(0, 4);
          setNewArrivals(arrivalList.length > 0 ? arrivalList : newest.slice(0, 4));
        }
      } catch (err) {
        console.error('[HomePage] Error loading storefront collections:', err);
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isCancelled = true;
    };
  }, [includeAll]);

  // 2. Hero Slider Auto-advance every 5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % slideCount);
    }, 5000);

    return () => clearInterval(timer);
  }, [slideCount]);

  const prevSlide = () => {
    setActiveSlide((prev) => (prev - 1 + slideCount) % slideCount);
  };

  const nextSlide = () => {
    setActiveSlide((prev) => (prev + 1) % slideCount);
  };

  // 3. Best Sellers Carousel Controls
  const scrollCarousel = (direction: 'left' | 'right') => {
    if (carouselRef.current) {
      const scrollAmount = 300;
      carouselRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const toggleWishlist = (productId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setWishlist((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const reviewCounts: number[] = [12, 8, 10, 15, 9, 14, 11, 7];

  const currentHero = heroSlides[activeSlide];

  return (
    <div className="w-full bg-[#F7F0FA] text-[#302438] font-sans selection:bg-[#B69ACF]/30 selection:text-[#302438]">
      {/* =========================================================================
          3. HERO SLIDER
          Fixed responsive height: h-[420px] md:h-[520px] lg:h-[600px]
          Stacked absolute slides with opacity transitions
          Every image: object-cover object-[70%_center] on #F0E6F4
          Text in centered container (max-w-[1280px]) with soft lavender gradient overlay
          Slide indicators bottom-left, arrow buttons bottom-right inside container
          ========================================================================= */}
      <section className="relative w-full h-[420px] md:h-[520px] lg:h-[600px] overflow-hidden bg-[#F0E6F4] border-b border-[#E7DCEB]">
        {/* Stacked background slide images */}
        {heroSlides.map((slide, idx) => (
          <div
            key={slide.id}
            className={`absolute inset-0 w-full h-full bg-[#F0E6F4] transition-opacity duration-700 ease-in-out ${
              activeSlide === idx ? 'opacity-100 z-0' : 'opacity-0 z-0 pointer-events-none'
            }`}
          >
            <img
              src={slide.image}
              alt={slide.heading}
              className="absolute inset-0 w-full h-full object-cover object-[70%_center] shadow-none"
            />
          </div>
        ))}

        {/* Centered content overlay container */}
        <div className="site-container h-full flex flex-col justify-between py-8 md:py-12 pointer-events-none relative z-10">
          {/* Slide text in left half vertically centered */}
          <div className="my-auto max-w-xl md:max-w-lg lg:max-w-xl pointer-events-auto">
            <span className="text-[11px] sm:text-xs uppercase tracking-[0.25em] text-[#6F6475] font-medium block mb-2 sm:mb-3">
              {currentHero.eyebrow}
            </span>
            <h1 className="font-serif text-3xl sm:text-4xl lg:text-[46px] leading-[1.16] text-[#302438] font-normal tracking-tight">
              {currentHero.heading}
            </h1>
            <p className="mt-3 sm:mt-4 text-xs sm:text-sm text-[#6F6475] leading-relaxed max-w-md font-sans">
              {currentHero.paragraph}
            </p>
            <div className="mt-6 sm:mt-8 flex flex-wrap items-center gap-3">
              <Link
                to={currentHero.shopLink}
                className="px-6 sm:px-7 py-3 bg-[#563568] text-white text-xs sm:text-[13px] font-sans font-medium hover:bg-[#A184BD] transition-colors rounded-xs inline-flex items-center gap-2 shadow-xs"
              >
                <span>Shop the Collection</span>
                <ArrowRight size={13} />
              </Link>
              <a
                href="#categories"
                className="px-6 sm:px-7 py-3 bg-transparent border border-[#563568] text-[#563568] text-xs sm:text-[13px] font-sans font-medium hover:bg-[#EBDFF2] hover:text-[#563568] transition-colors rounded-xs"
              >
                Explore Categories
              </a>
            </div>
          </div>

          {/* Bottom row inside container: 01 02 03 left, arrows right */}
          <div className="flex items-center justify-between w-full pointer-events-auto pt-4">
            {/* 01 02 03 indicators */}
            <div className="flex items-center space-x-6 text-xs font-sans tracking-widest text-[#6F6475]">
              {heroSlides.map((slide, idx) => (
                <button
                  key={slide.id}
                  onClick={() => setActiveSlide(idx)}
                  className={`pb-1 transition-all cursor-pointer ${
                    activeSlide === idx
                      ? 'text-[#563568] font-semibold border-b-2 border-[#B69ACF]'
                      : 'hover:text-[#B69ACF]'
                  }`}
                  aria-label={`Go to slide 0${idx + 1}`}
                >
                  0{idx + 1}
                </button>
              ))}
            </div>

            {/* Circular Arrows */}
            <div className="flex items-center space-x-3">
              <button
                onClick={prevSlide}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-[#E7DCEB] bg-white/90 hover:bg-[#F0E6F4] hover:border-[#B69ACF] text-[#302438] hover:text-[#563568] flex items-center justify-center transition-all cursor-pointer shadow-xs backdrop-blur-xs"
                aria-label="Previous slide"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={nextSlide}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-[#E7DCEB] bg-white/90 hover:bg-[#F0E6F4] hover:border-[#B69ACF] text-[#302438] hover:text-[#563568] flex items-center justify-center transition-all cursor-pointer shadow-xs backdrop-blur-xs"
                aria-label="Next slide"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SHOP BY CATEGORY
          Shared container: mx-auto w-full max-w-[1280px] px-4 sm:px-6 lg:px-10
          Heading row: flex items-end justify-between mb-6
          Grid: grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 lg:gap-6
          Category images: aspect-[3/2] object-cover
          Consistent vertical spacing: py-12 sm:py-16 lg:py-20
          ========================================================================= */}
      <section id="categories" className="w-full py-12 sm:py-16 lg:py-20">
        <div className="site-container">
          {/* Centered Full-Width Section Header Block */}
          <div className="w-full text-center mb-8 sm:mb-10">
            <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl text-[#302438] font-normal">
              Shop by Category
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-[#6F6475] font-sans leading-relaxed max-w-xl mx-auto">
              Explore our handcrafted collections curated for celebrations and everyday elegance.
            </p>
            <div className="mt-3">
              <Link
                to="/shop"
                className="text-xs sm:text-[13px] text-[#302438] hover:text-[#563568] font-sans font-medium inline-flex items-center gap-1.5 transition-colors"
              >
                <span>View All Categories</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>

          {/* 5 Category Cards using plain CSS .category-grid */}
          <div className="category-grid">
            {categories.slice(0, 5).map((cat) => {
              const catImage =
                cat.slug === 'bracelets' || cat.id === 'cat-bracelets'
                  ? HOMEPAGE_IMAGES.categoryBracelets || cat.image
                  : cat.image;

              return (
                <Link
                  key={cat.id}
                  to={`/shop?category=${cat.slug}`}
                  className="group flex flex-col items-center text-center w-full"
                >
                  {/* Landscape image wrapper: aspect-[3/2] */}
                  <div className="aspect-[3/2] w-full overflow-hidden bg-[#F0E6F4] border border-[#E7DCEB] rounded-xs relative group-hover:border-[#B69ACF] transition-colors">
                    <img
                      src={catImage}
                      alt={cat.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500 ease-out"
                    />
                  </div>

                {/* Title & Link */}
                <div className="pt-3 text-center flex flex-col items-center">
                  <h3 className="text-sm sm:text-base font-normal text-[#302438] font-sans text-center group-hover:text-[#563568] transition-colors">
                    {cat.name}
                  </h3>
                  <span className="text-xs text-[#6F6475] group-hover:text-[#563568] transition-colors inline-flex items-center justify-center gap-1 mt-0.5 font-sans">
                    <span>Shop Now</span>
                    <ArrowRight size={11} />
                  </span>
                </div>
              </Link>
            );
          })}
          </div>
        </div>
      </section>

      {/* =========================================================================
          NEW ARRIVALS
          4 newest products (sorted by createdAt descending, else the last 4 in the list),
          same product card as Best Sellers, "View All" linking to /shop?sort=newest
          ========================================================================= */}
      <section className="py-12 sm:py-16 lg:py-20 border-t border-[#E7DCEB] bg-white">
        <div className="site-container">
          {/* Centered Full-Width Section Header Block */}
          <div className="w-full text-center mb-8 sm:mb-10">
            <span className="text-[10px] uppercase tracking-[0.25em] text-[#6F6475] font-medium block mb-2 font-sans">
              JUST ARRIVED
            </span>
            <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl text-[#302438] font-normal">
              New Arrivals
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-[#6F6475] font-sans leading-relaxed max-w-xl mx-auto">
              Discover our newest handcrafted pieces, designed with delicate craftsmanship for modern grace.
            </p>
            <div className="mt-3">
              <Link
                to="/shop?sort=newest"
                className="text-xs sm:text-[13px] text-[#302438] hover:text-[#563568] font-sans font-medium inline-flex items-center gap-1.5 transition-colors"
              >
                <span>View All</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>

          {/* Product Grid using plain CSS .product-grid */}
          {loading ? (
            <div className="product-grid">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="animate-pulse w-full">
                  <div className="bg-[#F7F0FA] aspect-[3/4] w-full border border-[#E7DCEB]"></div>
                  <div className="h-4 bg-[#F7F0FA] w-2/3 mt-3"></div>
                  <div className="h-3 bg-[#F7F0FA] w-1/3 mt-2"></div>
                </div>
              ))}
            </div>
          ) : newArrivals.length > 0 ? (
            <div className="product-grid">
              {newArrivals.slice(0, 4).map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {/* =========================================================================
          BEST SELLERS
          Shared container: mx-auto w-full max-w-[1280px] px-4 sm:px-6 lg:px-10
          Heading row: flex items-end justify-between mb-6
          Scrolling track INSIDE container: gap-4 lg:gap-6 snap-x snap-mandatory
          Card widths: w-[calc((100%-1rem)/2)] md:w-[calc((100%-3rem)/3)] lg:w-[calc((100%-6rem)/5)]
          Arrows: absolute inside relative wrapper, never pushing or overflowing
          Consistent vertical spacing: py-12 sm:py-16 lg:py-20
          ========================================================================= */}
      <section className="py-12 sm:py-16 lg:py-20 border-t border-[#E7DCEB] bg-[#F7F0FA]">
        <div className="site-container">
          {/* Centered Full-Width Section Header Block */}
          <div className="w-full text-center mb-8 sm:mb-10">
            <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl text-[#302438] font-normal">
              Best Sellers
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-[#6F6475] font-sans leading-relaxed max-w-xl mx-auto">
              Our most cherished pieces, loved for their enduring finish and timeless beauty.
            </p>
            <div className="mt-3">
              <Link
                to="/shop?sort=bestseller"
                className="text-xs sm:text-[13px] text-[#302438] hover:text-[#563568] font-sans font-medium inline-flex items-center gap-1.5 transition-colors"
              >
                <span>View All</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>

          {/* Product Grid using plain CSS .product-grid */}
          {loading ? (
            <div className="product-grid">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="animate-pulse w-full">
                  <div className="bg-[#F0E6F4] aspect-[3/4] w-full border border-[#E7DCEB]"></div>
                  <div className="h-4 bg-[#F0E6F4] w-2/3 mt-3"></div>
                  <div className="h-3 bg-[#F0E6F4] w-1/3 mt-2"></div>
                </div>
              ))}
            </div>
          ) : bestsellers.length > 0 ? (
            <div className="product-grid">
              {bestsellers.slice(0, 8).map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {/* =========================================================================
          SHOP BY OCCASION
          4 cards: Daily Wear, Festive, Wedding, Gifting
          Using existing product images, linking to /shop with filter queries
          ========================================================================= */}
      <section className="py-12 sm:py-16 lg:py-20 border-t border-[#E7DCEB] bg-white">
        <div className="site-container">
          <div className="w-full text-center mb-8 sm:mb-10">
            <span className="text-[10px] uppercase tracking-[0.25em] text-[#6F6475] font-medium block mb-2 font-sans">
              CURATED OCCASIONS
            </span>
            <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl text-[#302438] font-normal">
              Shop by Occasion
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-[#6F6475] font-sans leading-relaxed max-w-xl mx-auto">
              Adornments thoughtfully curated for festive splendour, sacred vows, and every day in between.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {occasions.map((item) => (
              <Link
                key={item.title}
                to={item.link}
                className="group flex flex-col items-center text-center w-full"
              >
                <div className="aspect-[4/5] w-full overflow-hidden bg-[#F0E6F4] border border-[#E7DCEB] rounded-xs relative group-hover:border-[#B69ACF] transition-colors">
                  <img
                    src={item.image}
                    alt={item.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500 ease-out"
                  />
                </div>
                <div className="pt-3 text-center flex flex-col items-center">
                  <h3 className="text-sm sm:text-base font-normal text-[#302438] font-sans group-hover:text-[#563568] transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-[11px] sm:text-xs text-[#6F6475] font-sans mt-0.5">
                    {item.subtitle}
                  </p>
                  <span className="text-xs text-[#6F6475] group-hover:text-[#563568] transition-colors inline-flex items-center justify-center gap-1 mt-1 font-sans">
                    <span>Shop Now</span>
                    <ArrowRight size={11} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* =========================================================================
          SHOP BY PRICE
          4 pill buttons: Under ₹999, ₹1,000 to ₹1,999, ₹2,000 and above, All pieces
          Linking to /shop with price presets
          ========================================================================= */}
      <section className="py-12 sm:py-16 border-t border-[#E7DCEB] bg-[#F7F0FA]">
        <div className="site-container">
          <div className="w-full text-center mb-8">
            <span className="text-[10px] uppercase tracking-[0.25em] text-[#6F6475] font-medium block mb-2 font-sans">
              PRICE CURATION
            </span>
            <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl text-[#302438] font-normal">
              Shop by Price
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-[#6F6475] font-sans leading-relaxed max-w-xl mx-auto">
              Find stunning handcrafted jewellery suited to your style and budget.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 max-w-2xl mx-auto">
            <Link
              to="/shop?price=under-999"
              className="px-6 sm:px-8 py-3 bg-white border border-[#E7DCEB] hover:border-[#B69ACF] hover:text-[#563568] hover:bg-[#F0E6F4] text-[#302438] text-xs sm:text-sm font-sans font-medium rounded-full transition-all duration-200 shadow-2xs whitespace-nowrap"
            >
              Under ₹999
            </Link>
            <Link
              to="/shop?price=1000-2000"
              className="px-6 sm:px-8 py-3 bg-white border border-[#E7DCEB] hover:border-[#B69ACF] hover:text-[#563568] hover:bg-[#F0E6F4] text-[#302438] text-xs sm:text-sm font-sans font-medium rounded-full transition-all duration-200 shadow-2xs whitespace-nowrap"
            >
              ₹1,000 to ₹1,999
            </Link>
            <Link
              to="/shop?price=above-2000"
              className="px-6 sm:px-8 py-3 bg-white border border-[#E7DCEB] hover:border-[#B69ACF] hover:text-[#563568] hover:bg-[#F0E6F4] text-[#302438] text-xs sm:text-sm font-sans font-medium rounded-full transition-all duration-200 shadow-2xs whitespace-nowrap"
            >
              ₹2,000 and above
            </Link>
            <Link
              to="/shop"
              className="px-6 sm:px-8 py-3 bg-white border border-[#E7DCEB] hover:border-[#B69ACF] hover:text-[#563568] hover:bg-[#F0E6F4] text-[#302438] text-xs sm:text-sm font-sans font-medium rounded-full transition-all duration-200 shadow-2xs whitespace-nowrap"
            >
              All pieces
            </Link>
          </div>
        </div>
      </section>

      {/* =========================================================================
          OUR STORY
          Background #F0E6F4 edge-to-edge
          Centered container mx-auto w-full max-w-[1280px] px-4 sm:px-6 lg:px-10
          Consistent vertical spacing: py-12 sm:py-16 lg:py-20
          ========================================================================= */}
      <section className="bg-[#F0E6F4] border-y border-[#E7DCEB] py-12 sm:py-16 lg:py-20">
        <div className="site-container">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
            {/* Left: Large Jewellery Photo */}
            <div className="lg:col-span-5">
              <div className="aspect-[4/3] sm:aspect-[1/1] bg-[#EBDFF2] overflow-hidden rounded-xs border border-[#E7DCEB]">
                <img
                  src={HOMEPAGE_IMAGES.ourStory}
                  alt="SARINE Craftsmanship and Jewellery Details"
                  className="w-full h-full object-cover object-center"
                />
              </div>
            </div>

            {/* Right: Story Copy & 3 Pillars */}
            <div className="lg:col-span-7 flex flex-col md:flex-row items-start gap-8 lg:gap-12">
              {/* Story Narrative */}
              <div className="flex-1">
                <span className="text-[10px] uppercase tracking-[0.25em] text-[#6F6475] font-medium block mb-2 font-sans">
                  OUR STORY
                </span>

                <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl text-[#302438] font-normal leading-tight">
                  More Than Just Jewellery
                </h2>

                <p className="mt-4 text-xs sm:text-sm text-[#6F6475] leading-relaxed font-sans">
                  SARINE is a premium Indian fashion jewellery brand created to bring timeless elegance to your everyday moments. We celebrate traditional motifs through modern design, curating versatile pieces that seamlessly elevate both celebrations and daily attire.
                </p>
                <p className="mt-3 text-xs sm:text-sm text-[#6F6475] leading-relaxed font-sans">
                  We believe in accessible luxury — exquisite craftsmanship, refined finishes, and enduring beauty at honest, direct prices. Every piece is crafted so you can express your personal grace with confidence and ease.
                </p>

                <div className="mt-7">
                  <Link
                    to="/about"
                    className="px-6 py-3 bg-[#563568] text-white text-xs font-sans font-medium hover:bg-[#A184BD] transition-colors rounded-xs inline-flex items-center gap-2 shadow-xs"
                  >
                    <span>Our Story</span>
                    <ArrowRight size={13} />
                  </Link>
                </div>
              </div>

              {/* Thin Vertical Divider (Desktop) */}
              <div className="hidden md:block w-[1px] bg-[#E7DCEB] self-stretch"></div>

              {/* 3 Icon Rows */}
              <div className="w-full md:w-64 space-y-5 pt-2">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xs text-[#563568] shrink-0 bg-[#FAF5FC] border border-[#E7DCEB]">
                    <Gem size={18} strokeWidth={1.5} />
                  </div>
                  <div>
                    <h3 className="text-xs font-medium text-[#302438] leading-snug">
                      Thoughtfully Designed
                    </h3>
                    <p className="text-[11px] text-[#6F6475] leading-tight mt-0.5">
                      for Everyday Elegance
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xs text-[#563568] shrink-0 bg-[#FAF5FC] border border-[#E7DCEB]">
                    <Sparkles size={18} strokeWidth={1.5} />
                  </div>
                  <div>
                    <h3 className="text-xs font-medium text-[#302438] leading-snug">
                      Artisanal Heritage
                    </h3>
                    <p className="text-[11px] text-[#6F6475] leading-tight mt-0.5">
                      & Modern Craft
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xs text-[#563568] shrink-0 bg-[#FAF5FC] border border-[#E7DCEB]">
                    <ShieldCheck size={18} strokeWidth={1.5} />
                  </div>
                  <div>
                    <h3 className="text-xs font-medium text-[#302438] leading-snug">
                      Accessible Luxury
                    </h3>
                    <p className="text-[11px] text-[#6F6475] leading-tight mt-0.5">
                      for Every You
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          7. EDITORIAL BANNER
          ========================================================================= */}
      <section className="relative overflow-hidden bg-[#EBDFF2] border-b border-[#E7DCEB]">
        {/* Full-bleed background image */}
        <img
          src={HOMEPAGE_IMAGES.editorialBanner}
          alt="The Art of Everyday Elegance"
          className="absolute inset-0 w-full h-full object-cover object-center"
        />

        {/* Gradient Overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#F0E6F4]/75 to-[#F0E6F4]/95 sm:via-[#F0E6F4]/80 sm:to-[#F0E6F4]/95"></div>

        {/* Centered container with right-aligned content */}
        <div className="site-container min-h-[320px] sm:min-h-[380px] lg:min-h-[420px] flex items-center justify-end relative z-10">
          <div className="w-full sm:w-2/3 lg:w-1/2 py-10 sm:py-14 text-left">
            <span className="text-[10px] uppercase tracking-[0.25em] text-[#6F6475] font-medium block mb-2 font-sans">
              EDITORIAL COLLECTION
            </span>

            <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl text-[#302438] font-normal leading-tight">
              The Art of Everyday Elegance
            </h2>

            <p className="mt-3 text-xs sm:text-sm text-[#6F6475] leading-relaxed max-w-md font-sans">
              A curated collection that blends classic beauty with modern sensibilities.
            </p>

            <div className="mt-6">
              <Link
                to="/shop"
                className="px-6 py-3 bg-[#563568] text-white text-xs font-sans font-medium hover:bg-[#A184BD] transition-colors rounded-xs inline-flex items-center gap-2 shadow-xs"
              >
                <span>Explore the Collection</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          8. STAY IN TOUCH
          ========================================================================= */}
      <section className="py-14 sm:py-20 lg:py-24 bg-[#F7F0FA]">
        <div className="site-container">
          <div className="max-w-[620px] mx-auto text-center">
            <span className="text-[10px] uppercase tracking-[0.25em] text-[#6F6475] font-medium block mb-2 font-sans">
              STAY IN TOUCH
            </span>

            <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl text-[#302438] font-normal">
              Connect With SARINE
            </h2>

            <p className="mt-3 text-xs sm:text-sm text-[#6F6475] font-sans leading-relaxed">
              Have questions about styling, care, or your order? Connect with our customer care team on our{' '}
              <Link
                to="/contact"
                className="text-[#563568] font-medium underline underline-offset-4 hover:text-[#B69ACF] transition-colors"
              >
                Contact page
              </Link>
              .
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
