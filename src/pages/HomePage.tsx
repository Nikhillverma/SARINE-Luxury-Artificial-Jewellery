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
  Gem,
  CheckCircle2
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
  const [loading, setLoading] = useState<boolean>(true);

  // Hero Slider State
  const [activeSlide, setActiveSlide] = useState<number>(0);
  const slideCount = 3;

  // Best Sellers Carousel Scroll Reference
  const carouselRef = useRef<HTMLDivElement>(null);

  // Wishlist State (Local interactive set)
  const [wishlist, setWishlist] = useState<Set<string>>(new Set());

  // Newsletter State
  const [newsletterEmail, setNewsletterEmail] = useState<string>('');
  const [newsletterSubmitted, setNewsletterSubmitted] = useState<boolean>(false);
  const [newsletterError, setNewsletterError] = useState<string>('');

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

  // 4. Newsletter Submit Handler
  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = newsletterEmail.trim();

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setNewsletterError('Please enter a valid email address.');
      return;
    }

    setNewsletterError('');
    setNewsletterSubmitted(true);
  };

  const currentHero = heroSlides[activeSlide];

  return (
    <div className="w-full bg-[#F8F6F2] text-[#222222] font-sans selection:bg-[#B79A68]/20 selection:text-[#222222]">
      {/* =========================================================================
          3. HERO SLIDER
          Fixed responsive height: h-[420px] md:h-[520px] lg:h-[600px]
          Stacked absolute slides with opacity transitions
          Every image: object-cover object-[70%_center] on #EDE3D8
          Text in centered container (max-w-[1280px]) with soft beige gradient overlay
          Slide indicators bottom-left, arrow buttons bottom-right inside container
          ========================================================================= */}
      <section className="relative w-full h-[420px] md:h-[520px] lg:h-[600px] overflow-hidden bg-[#EDE3D8] border-b border-[#E4DACF]">
        {/* Stacked background slide images */}
        {heroSlides.map((slide, idx) => (
          <div
            key={slide.id}
            className={`absolute inset-0 w-full h-full bg-[#EDE3D8] transition-opacity duration-700 ease-in-out ${
              activeSlide === idx ? 'opacity-100 z-0' : 'opacity-0 z-0 pointer-events-none'
            }`}
          >
            <img
              src={slide.image}
              alt={slide.heading}
              className="absolute inset-0 w-full h-full object-cover object-[70%_center]"
            />
            {/* Soft left-to-right beige gradient overlay for text readability */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#EDE3D8] via-[#EDE3D8]/85 to-[#EDE3D8]/30 md:from-[#EDE3D8]/95 md:via-[#EDE3D8]/70 md:to-transparent pointer-events-none"></div>
          </div>
        ))}

        {/* Centered content overlay container */}
        <div className="site-container h-full flex flex-col justify-between py-8 md:py-12 pointer-events-none relative z-10">
          {/* Slide text in left half vertically centered */}
          <div className="my-auto max-w-xl md:max-w-lg lg:max-w-xl pointer-events-auto">
            <span className="text-[11px] sm:text-xs uppercase tracking-[0.25em] text-[#81776D] font-medium block mb-2 sm:mb-3">
              {currentHero.eyebrow}
            </span>
            <h1 className="font-serif text-3xl sm:text-4xl lg:text-[46px] leading-[1.16] text-[#222222] font-normal tracking-tight">
              {currentHero.heading}
            </h1>
            <p className="mt-3 sm:mt-4 text-xs sm:text-sm text-[#555555] leading-relaxed max-w-md font-sans">
              {currentHero.paragraph}
            </p>
            <div className="mt-6 sm:mt-8 flex flex-wrap items-center gap-3">
              <Link
                to={currentHero.shopLink}
                className="px-6 sm:px-7 py-3 bg-[#1C1917] text-[#FAF8F5] text-xs sm:text-[13px] font-sans font-medium hover:bg-[#B89758] hover:text-[#FAF8F5] transition-colors rounded-xs inline-flex items-center gap-2"
              >
                <span>Shop the Collection</span>
                <ArrowRight size={13} />
              </Link>
              <a
                href="#categories"
                className="px-6 sm:px-7 py-3 bg-transparent border border-[#1C1917] text-[#1C1917] text-xs sm:text-[13px] font-sans font-medium hover:bg-[#F3EEE7] hover:text-[#1C1917] transition-colors rounded-xs"
              >
                Explore Categories
              </a>
            </div>
          </div>

          {/* Bottom row inside container: 01 02 03 left, arrows right */}
          <div className="flex items-center justify-between w-full pointer-events-auto pt-4">
            {/* 01 02 03 indicators */}
            <div className="flex items-center space-x-6 text-xs font-sans tracking-widest text-[#81776D]">
              {heroSlides.map((slide, idx) => (
                <button
                  key={slide.id}
                  onClick={() => setActiveSlide(idx)}
                  className={`pb-1 transition-all cursor-pointer ${
                    activeSlide === idx
                      ? 'text-[#1C1917] font-semibold border-b-2 border-[#B89758]'
                      : 'hover:text-[#B89758]'
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
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-[#E8E0D6] bg-white/90 hover:bg-[#F3EEE7] hover:border-[#B89758] text-[#1C1917] hover:text-[#B89758] flex items-center justify-center transition-all cursor-pointer shadow-xs backdrop-blur-xs"
                aria-label="Previous slide"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={nextSlide}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-[#E8E0D6] bg-white/90 hover:bg-[#F3EEE7] hover:border-[#B89758] text-[#1C1917] hover:text-[#B89758] flex items-center justify-center transition-all cursor-pointer shadow-xs backdrop-blur-xs"
                aria-label="Next slide"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          4. SHOP BY CATEGORY
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
            <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl text-[#222222] font-normal">
              Shop by Category
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-[#666666] font-sans leading-relaxed max-w-xl mx-auto">
              Explore our handcrafted collections curated for celebrations and everyday elegance.
            </p>
            <div className="mt-3">
              <Link
                to="/shop"
                className="text-xs sm:text-[13px] text-[#222222] hover:text-[#B89758] font-sans font-medium inline-flex items-center gap-1.5 transition-colors"
              >
                <span>View All Categories</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>

          {/* 5 Category Cards using plain CSS .category-grid */}
          <div className="category-grid">
            {categories.slice(0, 5).map((cat) => (
              <Link
                key={cat.id}
                to={`/shop?category=${cat.slug}`}
                className="group flex flex-col items-center text-center w-full"
              >
                {/* Landscape image wrapper: aspect-[3/2] */}
                <div className="aspect-[3/2] w-full overflow-hidden bg-[#EDE3D8] border border-[#E8E0D6] rounded-xs relative group-hover:border-[#B89758]/60 transition-colors">
                  <img
                    src={cat.image}
                    alt={cat.name}
                    className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500 ease-out"
                  />
                </div>

                {/* Title & Link */}
                <div className="pt-3 text-center flex flex-col items-center">
                  <h3 className="text-sm sm:text-base font-normal text-[#222222] font-sans text-center group-hover:text-[#B89758] transition-colors">
                    {cat.name}
                  </h3>
                  <span className="text-xs text-[#666666] group-hover:text-[#B89758] transition-colors inline-flex items-center justify-center gap-1 mt-0.5 font-sans">
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
          5. BEST SELLERS CAROUSEL
          Shared container: mx-auto w-full max-w-[1280px] px-4 sm:px-6 lg:px-10
          Heading row: flex items-end justify-between mb-6
          Scrolling track INSIDE container: gap-4 lg:gap-6 snap-x snap-mandatory
          Card widths: w-[calc((100%-1rem)/2)] md:w-[calc((100%-3rem)/3)] lg:w-[calc((100%-6rem)/5)]
          Arrows: absolute inside relative wrapper, never pushing or overflowing
          Consistent vertical spacing: py-12 sm:py-16 lg:py-20
          ========================================================================= */}
      <section className="py-12 sm:py-16 lg:py-20 border-t border-[#E8E0D6]">
        <div className="site-container">
          {/* Centered Full-Width Section Header Block */}
          <div className="w-full text-center mb-8 sm:mb-10">
            <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl text-[#222222] font-normal">
              Best Sellers
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-[#666666] font-sans leading-relaxed max-w-xl mx-auto">
              Our most cherished pieces, loved for their enduring finish and timeless beauty.
            </p>
            <div className="mt-3">
              <Link
                to="/shop?sort=bestseller"
                className="text-xs sm:text-[13px] text-[#222222] hover:text-[#B89758] font-sans font-medium inline-flex items-center gap-1.5 transition-colors"
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
                  <div className="bg-[#F2EADF] aspect-[3/4] w-full border border-[#E8E0D6]"></div>
                  <div className="h-4 bg-[#F2EADF] w-2/3 mt-3"></div>
                  <div className="h-3 bg-[#F2EADF] w-1/3 mt-2"></div>
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
          6. OUR STORY
          Background #F3EDE5 edge-to-edge
          Centered container mx-auto w-full max-w-[1280px] px-4 sm:px-6 lg:px-10
          Consistent vertical spacing: py-12 sm:py-16 lg:py-20
          ========================================================================= */}
      <section className="bg-[#F3EDE5] border-y border-[#E8E0D6] py-12 sm:py-16 lg:py-20">
        <div className="site-container">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
            {/* Left: Large Jewellery Photo */}
            <div className="lg:col-span-5">
              <div className="aspect-[4/3] sm:aspect-[1/1] bg-[#E8DDD1] overflow-hidden rounded-xs border border-[#E0D6CA]">
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
                <span className="text-[10px] uppercase tracking-[0.25em] text-[#81776D] font-medium block mb-2 font-sans">
                  OUR STORY
                </span>

                <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl text-[#222222] font-normal leading-tight">
                  More Than Just Jewellery
                </h2>

                <p className="mt-4 text-xs sm:text-sm text-[#555555] leading-relaxed font-sans">
                  At SARINE, we believe jewellery is more than an accessory — it's a reflection of your story,
                  your style and your everyday moments. Our collections are designed to help you feel confident,
                  beautiful and effortlessly you.
                </p>

                <div className="mt-7">
                  <Link
                    to="/about"
                    className="px-6 py-3 bg-[#1C1917] text-[#FAF8F5] text-xs font-sans font-medium hover:bg-[#B89758] hover:text-[#FAF8F5] transition-colors rounded-xs inline-flex items-center gap-2"
                  >
                    <span>Discover SARINE</span>
                    <ArrowRight size={13} />
                  </Link>
                </div>
              </div>

              {/* Thin Vertical Divider (Desktop) */}
              <div className="hidden md:block w-[1px] bg-[#DDD5CB] self-stretch"></div>

              {/* 3 Icon Rows */}
              <div className="w-full md:w-64 space-y-5 pt-2">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xs text-[#222222] shrink-0">
                    <Gem size={18} strokeWidth={1.5} />
                  </div>
                  <div>
                    <h3 className="text-xs font-medium text-[#222222] leading-snug">
                      Thoughtfully Designed
                    </h3>
                    <p className="text-[11px] text-[#666666] leading-tight mt-0.5">
                      for Everyday Elegance
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xs text-[#222222] shrink-0">
                    <Sparkles size={18} strokeWidth={1.5} />
                  </div>
                  <div>
                    <h3 className="text-xs font-medium text-[#222222] leading-snug">
                      Skin Friendly
                    </h3>
                    <p className="text-[11px] text-[#666666] leading-tight mt-0.5">
                      & Comfortable
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xs text-[#222222] shrink-0">
                    <ShieldCheck size={18} strokeWidth={1.5} />
                  </div>
                  <div>
                    <h3 className="text-xs font-medium text-[#222222] leading-snug">
                      Accessible Luxury
                    </h3>
                    <p className="text-[11px] text-[#666666] leading-tight mt-0.5">
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
      <section className="relative overflow-hidden bg-[#E8DDD1] border-b border-[#E8E0D6]">
        {/* Full-bleed background image */}
        <img
          src={HOMEPAGE_IMAGES.editorialBanner}
          alt="The Art of Everyday Elegance"
          className="absolute inset-0 w-full h-full object-cover object-center"
        />

        {/* Gradient Overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#EDE3D8]/65 to-[#EDE3D8]/95 sm:via-[#EDE3D8]/75 sm:to-[#EDE3D8]/95"></div>

        {/* Centered container with right-aligned content */}
        <div className="site-container min-h-[320px] sm:min-h-[380px] lg:min-h-[420px] flex items-center justify-end relative z-10">
          <div className="w-full sm:w-2/3 lg:w-1/2 py-10 sm:py-14 text-left">
            <span className="text-[10px] uppercase tracking-[0.25em] text-[#81776D] font-medium block mb-2 font-sans">
              EDITORIAL COLLECTION
            </span>

            <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl text-[#222222] font-normal leading-tight">
              The Art of Everyday Elegance
            </h2>

            <p className="mt-3 text-xs sm:text-sm text-[#555555] leading-relaxed max-w-md font-sans">
              A curated collection that blends classic beauty with modern sensibilities.
            </p>

            <div className="mt-6">
              <Link
                to="/shop"
                className="px-6 py-3 bg-[#1C1917] text-[#FAF8F5] text-xs font-sans font-medium hover:bg-[#B89758] hover:text-[#FAF8F5] transition-colors rounded-xs inline-flex items-center gap-2"
              >
                <span>Explore the Collection</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          8. NEWSLETTER
          ========================================================================= */}
      <section className="py-14 sm:py-20 lg:py-24 bg-[#F8F6F2]">
        <div className="site-container">
          <div className="max-w-[620px] mx-auto text-center">
            <span className="text-[10px] uppercase tracking-[0.25em] text-[#81776D] font-medium block mb-2 font-sans">
              STAY IN TOUCH
            </span>

            <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl text-[#222222] font-normal">
              Be the First to Know
            </h2>

            <p className="mt-2.5 text-xs sm:text-sm text-[#666666] font-sans">
              Get the latest collections, style updates and exclusive offers.
            </p>

            {newsletterSubmitted ? (
              <div className="mt-7 p-5 bg-[#EDE3D8] border border-[#DDD5CB] rounded-xs text-center animate-fadeIn">
                <CheckCircle2 size={20} className="mx-auto text-[#222222] mb-1.5" />
                <h3 className="font-serif text-base text-[#222222] font-normal">
                  Thank you for subscribing!
                </h3>
                <p className="text-xs text-[#555555] mt-1">
                  You will be the first to receive updates on new arrivals and private previews.
                </p>
              </div>
            ) : (
              <form onSubmit={handleNewsletterSubmit} className="mt-6 max-w-md mx-auto">
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="email"
                    value={newsletterEmail}
                    onChange={(e) => setNewsletterEmail(e.target.value)}
                    placeholder="Enter your email address"
                    className="flex-1 px-4 py-2.5 bg-white border border-[#DDD5CB] text-xs sm:text-sm text-[#222222] placeholder-[#888888] focus:outline-none focus:border-[#B89758] rounded-xs transition-colors font-sans"
                    aria-label="Email Address for newsletter"
                  />
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-[#1C1917] text-[#FAF8F5] text-xs sm:text-[13px] font-sans font-medium hover:bg-[#B89758] hover:text-[#FAF8F5] transition-colors rounded-xs shrink-0"
                  >
                    Subscribe
                  </button>
                </div>

                {newsletterError && (
                  <p className="mt-2 text-xs text-[#8C2F2F] text-left font-sans">
                    {newsletterError}
                  </p>
                )}
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
