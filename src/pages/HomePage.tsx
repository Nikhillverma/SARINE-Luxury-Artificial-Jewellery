/**
 * Premium Homepage for SARINE.
 * Matches the reference design with exact section order, layout, and styling.
 * 
 * Layout Discipline:
 * - Desktop centered container: `mx-auto w-full max-w-[1280px] px-4 sm:px-6 lg:px-10`
 * - Consistent vertical rhythm: 64-96px desktop, 40-56px mobile
 * - Hero banner: fixed responsive height h-[360px] sm:h-[420px] lg:h-[520px],
 *   stacked absolute slides with opacity transitions, object-[70%_center],
 *   centered container controls, no blank space underneath.
 */

import React, { useEffect, useState, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { productService, categoryService } from '../services';
import { Product, type ProductCollection } from '../types/product';
import { Category } from '../types/category';
import { ProductCard } from '../components/ProductCard';
import { formatInr } from '../utils/currency';
import { festivalCampaignService, type FestivalCampaign } from '../services/hostinger/festivalCampaignService';
import { hostingerStorefrontService, DEFAULT_HOMEPAGE_CONTENT, type EditorialContent, type HomepageContent, type HomepageLayout, type ShopByGenderSettings } from '../services/hostinger/hostingerStorefrontService';
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
  heroSlide1: '/images/optimized/hero-model-1.webp',
  heroSlide2: '/images/optimized/hero-model-2.webp',
  heroSlide3: '/images/optimized/hero-model-3.webp',
  ourStory: '/images/optimized/our-story.webp',
  editorialBanner: '/images/optimized/editorial-banner.webp',
};

/* ==========================================================================
   SHARED IMAGE HELPER
   Returns primary image, falls back to other fields, then placeholder.
   Logs console.warn if product lacks an image.
   ========================================================================== */
export function hasUsableProductImage(product?: Partial<Product> | null): boolean {
  return Boolean(product?.images?.some(image => typeof image === 'string' && image.trim().length > 0 && !/(product-image-unavailable|placeholder|no[-_]?image)/i.test(image)));
}

export function getProductImage(product?: Partial<Product> | null): string {
  const fallback = 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=800&q=80';
  if (!product) return fallback;

  if (product.images && product.images.length > 0 && product.images[0]) {
    return product.images[0];
  }

  console.warn(`[getProductImage] Product ${product.id || 'unknown'} has no valid image, using placeholder.`);
  return fallback;
}

function CampaignDestinationLink({ to, className, ariaLabel, children }: { to: string; className?: string; ariaLabel?: string; children: React.ReactNode }) {
  if (/^https:\/\//i.test(to)) {
    return <a href={to} className={className} aria-label={ariaLabel}>{children}</a>;
  }
  return <Link to={to} className={className} aria-label={ariaLabel}>{children}</Link>;
}

function CampaignCountdownStrip({ campaign }: { campaign: FestivalCampaign }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const remaining = Math.max(0, new Date(campaign.endsAt || "").getTime() - now);
  const days = Math.floor(remaining / 86400000);
  const hours = Math.floor((remaining % 86400000) / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  const label = campaign.countdownLabel?.trim() || campaign.offerLabel?.trim() || campaign.title;
  const background = "var(--countdown-background)";
  const textColor = "var(--countdown-text)";
  const timerColor = "var(--countdown-text)";
  if (remaining <= 0) return null;
  return (
    <div className="sarine-countdown inline-flex max-w-[calc(100vw-2rem)] items-center justify-center gap-2.5 sm:gap-3 rounded-full border border-[var(--countdown-border)] px-3.5 sm:px-5 py-1.5 sm:py-2 text-[10px] sm:text-xs shadow-md backdrop-blur-md"
      style={{ backgroundColor: background, color: textColor }}>
      <span className="max-w-[42vw] truncate font-semibold uppercase tracking-[0.08em]">{label}</span>
      <span aria-hidden="true" className="opacity-60">|</span>
      <span className="whitespace-nowrap font-mono font-semibold tabular-nums" style={{ color: timerColor }}>
        {String(days).padStart(2, "0")}d : {String(hours).padStart(2, "0")}h : {String(minutes).padStart(2, "0")}m : {String(seconds).padStart(2, "0")}s
      </span>
    </div>
  );
}

interface HomePageProps {
  includeAll: boolean;
}

const defaultHomepageLayout: HomepageLayout = {
  version: 1,
  sections: ["hero", "categories", "shop-by-gender", "new-arrivals", "best-sellers", "curated-favourites", "occasions", "explore-now", "price", "our-story", "editorial", "care-guide", "stay-in-touch"]
    .map((id, sortOrder) => ({ id, enabled: true, sortOrder }))
};

export const HomePage: React.FC<HomePageProps> = ({ includeAll }) => {
  const [rangeParams, setRangeParams] = useSearchParams();
  const rangeFromUrl = rangeParams.get('range');
  const [selectedProductCollection, setSelectedProductCollection] = useState<ProductCollection | undefined>(() => {
    if (rangeFromUrl === 'artificial' || rangeFromUrl === 'demi-fine') return rangeFromUrl;
    const storedRange = window.sessionStorage.getItem('sarine_product_range');
    return storedRange === 'artificial' || storedRange === 'demi-fine' ? storedRange : undefined;
  });
  const selectProductCollection = (collection?: ProductCollection) => {
    setSelectedProductCollection(collection);
    if (collection) window.sessionStorage.setItem('sarine_product_range', collection);
    else window.sessionStorage.removeItem('sarine_product_range');
    const next = new URLSearchParams(rangeParams);
    if (collection) next.set('range', collection);
    else next.delete('range');
    setRangeParams(next, { replace: false });
  };

  useEffect(() => {
    if (rangeFromUrl === "artificial" || rangeFromUrl === "demi-fine") {
      window.sessionStorage.setItem("sarine_product_range", rangeFromUrl);
      setSelectedProductCollection(rangeFromUrl);
      return;
    }
    const storedRange = window.sessionStorage.getItem("sarine_product_range");
    setSelectedProductCollection(storedRange === "artificial" || storedRange === "demi-fine" ? storedRange : undefined);
  }, [rangeFromUrl]);
  const [homepageLayout, setHomepageLayout] = useState<HomepageLayout>(defaultHomepageLayout);
  const [festivalCampaigns, setFestivalCampaigns] = useState<FestivalCampaign[]>([]);
  const sectionConfig = (id: string) => homepageLayout.sections.find(section => section.id === id);
  const sectionVisible = (id: string) => sectionConfig(id)?.enabled ?? true;
  const sectionOrder = (id: string) => ((sectionConfig(id)?.sortOrder ?? defaultHomepageLayout.sections.find(section => section.id === id)?.sortOrder ?? 0) + 1) * 2;

  useEffect(() => {
    let cancelled = false;
    const refreshCampaigns = () => {
      festivalCampaignService.getActiveCampaigns()
        .then(campaigns => { if (!cancelled) setFestivalCampaigns(campaigns); })
        .catch(error => console.warn('[HomePage] Festival campaigns unavailable.', error));
    };
    refreshCampaigns();
    const timer = window.setInterval(refreshCampaigns, 60000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    hostingerStorefrontService.getPublicHomepageLayout()
      .then(result => { if (!cancelled && result.layout?.sections?.length) setHomepageLayout(result.layout); })
      .catch(error => console.warn('[HomePage] Published section layout unavailable; using the default order.', error));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setManualCuratedFavourites([]);
    setHasPublishedCuratedFavourites(false);
    hostingerStorefrontService.getPublicCuratedFavourites()
      .then(result => {
        if (!cancelled) {
          setManualCuratedFavourites(result.products.filter(hasUsableProductImage));
          setHasPublishedCuratedFavourites(result.configured);
        }
      })
      .catch(error => console.warn("[HomePage] Curated Favourites unavailable; using the existing automatic fallback.", error));
    return () => { cancelled = true; };
  }, [selectedProductCollection]);

  useEffect(() => {
    let cancelled = false;
    setExploreProducts([]);
    setHasPublishedExploreNow(false);
    hostingerStorefrontService.getPublicExploreNow()
      .then(result => {
        if (!cancelled) {
          setExploreProducts((result.products || []).filter(hasUsableProductImage));
          setExploreDisplayCount(result.displayCount || 8);
          setHasPublishedExploreNow(result.configured === true);
        }
      })
      .catch(error => console.warn("[HomePage] Explore Now unavailable.", error));
    return () => { cancelled = true; };
  }, [selectedProductCollection]);

  // Storefront Data
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryImageOverrides, setCategoryImageOverrides] = useState<Record<string, string>>({});
  const [bestsellers, setBestsellers] = useState<Product[]>([]);
  const [curatedFavourites, setCuratedFavourites] = useState<Product[]>([]);
  const [manualCuratedFavourites, setManualCuratedFavourites] = useState<Product[]>([]);
  const [hasPublishedCuratedFavourites, setHasPublishedCuratedFavourites] = useState(false);
  const [exploreProducts, setExploreProducts] = useState<Product[]>([]);
  const [exploreDisplayCount, setExploreDisplayCount] = useState(8);
  const [hasPublishedExploreNow, setHasPublishedExploreNow] = useState(false);
  const [newArrivals, setNewArrivals] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<boolean>(false);

  const [shopByGender, setShopByGender] = useState<ShopByGenderSettings>({ version: 1, forHerImageUrl: "", forHimImageUrl: "" });

  useEffect(() => {
    let cancelled = false;
    setCategoryImageOverrides({});
    hostingerStorefrontService.getPublicHomepageCategoryImages()
      .then(result => { if (!cancelled) setCategoryImageOverrides(result.images || {}); })
      .catch(error => console.warn("[HomePage] Category image overrides unavailable; using category defaults.", error));
    return () => { cancelled = true; };
  }, [selectedProductCollection]);

  const [occasions, setOccasions] = useState([
    { id: "daily-wear", title: "Daily Wear", subtitle: "Effortless everyday minimalism", image: "/images/optimized/ananya-temple-coin-bracelet.webp", link: "/shop?search=everyday", active: true, sortOrder: 0 },
    { id: "festive", title: "Festive", subtitle: "Celebratory sparkle and classic motifs", image: "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=1000&q=80", link: "/shop?search=festive", active: true, sortOrder: 1 },
    { id: "wedding", title: "Wedding", subtitle: "Regal bridal sets & heritage chokers", image: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=1000&q=80", link: "/shop?search=wedding", active: true, sortOrder: 2 },
    { id: "gifting", title: "Gifting", subtitle: "Precious tokens of affection", image: "/images/optimized/zoya-open-cuff-leaf-bangle.webp", link: "/shop", active: true, sortOrder: 3 }
  ]);

  useEffect(() => {
    let cancelled = false;
    setShopByGender({ version: 1, forHerImageUrl: "", forHimImageUrl: "" });
    hostingerStorefrontService.getPublicShopByGender()
      .then(result => { if (!cancelled && result.settings) setShopByGender(result.settings); })
      .catch(error => console.warn("[HomePage] Shop by Gender settings unavailable; using empty image placeholders.", error));
    return () => { cancelled = true; };
  }, [selectedProductCollection]);

  useEffect(() => {
    let cancelled = false;
    setOccasions([]);
    hostingerStorefrontService.getPublicOccasions()
      .then(result => { if (!cancelled && Array.isArray(result.occasions)) setOccasions(result.occasions); })
      .catch(error => console.warn("[HomePage] Published occasion cards unavailable; using defaults.", error));
    return () => { cancelled = true; };
  }, [selectedProductCollection]);

  // Hero Slider State
  const [activeSlide, setActiveSlide] = useState<number>(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    const handlePreferenceChange = (event: MediaQueryListEvent) => setPrefersReducedMotion(event.matches);
    mediaQuery.addEventListener('change', handlePreferenceChange);
    return () => mediaQuery.removeEventListener('change', handlePreferenceChange);
  }, []);

  const [managedHeroSlides, setManagedHeroSlides] = useState<Array<{id:string; tagline:string; title:string; subtitle:string; ctaText:string; ctaLink:string; imageUrl:string}>>([]);
  const [editorial, setEditorial] = useState<EditorialContent>({ eyebrow: 'EDITORIAL COLLECTION', title: 'The Art of Everyday Elegance', description: 'A curated collection that blends classic beauty with modern sensibilities.', ctaText: 'Explore the Collection', ctaLink: '/shop', imageUrl: HOMEPAGE_IMAGES.editorialBanner, active: true });
  const [homepageContent, setHomepageContent] = useState<HomepageContent>(DEFAULT_HOMEPAGE_CONTENT);

  // Independent, touch-friendly horizontal tracks for homepage carousels.
  const heroTouchStartX = useRef<number | null>(null);
  const categoryCarouselRef = useRef<HTMLDivElement>(null);
  const newArrivalsCarouselRef = useRef<HTMLDivElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const curatedCarouselRef = useRef<HTMLDivElement>(null);
  const occasionsCarouselRef = useRef<HTMLDivElement>(null);

  const sectionCarouselEnabled = (id: string) => sectionConfig(id)?.carouselEnabled !== false;
  const cardsPerView = (id: string, fallback = 4) => {
    const value = sectionConfig(id)?.cardsPerView;
    return Number.isInteger(value) ? Math.min(8, Math.max(2, value as number)) : fallback;
  };
  const desktopCardStyle = (id: string, gap = 20, fallback = 5): React.CSSProperties => ({
    ["--desktop-card-basis" as string]: `calc((100% - ${gap * (cardsPerView(id, fallback) - 1)}px) / ${cardsPerView(id, fallback)})`
  } as React.CSSProperties);

  // Wishlist State (Local interactive set)
  const [wishlist, setWishlist] = useState<Set<string>>(new Set());

  // Hero Slides Definition (published MariaDB content takes precedence over safe defaults)
  const defaultHeroSlides = [
    {
      id: 0,
      eyebrow: 'ELEGANCE IN EVERY DETAIL',
      heading: 'Modern Jewellery for Everyday You',
      paragraph: 'Thoughtfully designed artificial jewellery that brings timeless elegance to your everyday moments.',
      image: HOMEPAGE_IMAGES.heroSlide1,
      shopLink: '/shop',
      categoriesLink: '#categories',
      ctaText: 'Shop the Collection'
    },
    {
      id: 1,
      eyebrow: 'THE HERITAGE CHAPTER',
      heading: 'Classical Kundan & Polki Motifs',
      paragraph: 'Opulent festive adornments crafted with lightweight modern comfort for wedding celebrations and milestones.',
      image: HOMEPAGE_IMAGES.heroSlide2,
      shopLink: '/shop?category=necklaces',
      categoriesLink: '#categories',
      ctaText: 'Explore Collection'
    },
    {
      id: 2,
      eyebrow: 'CONTEMPORARY DEMI-FINE',
      heading: 'Subtle Radiance for Every Occasion',
      paragraph: 'Layered gold chains, floral studs, and delicate cuffs tailored for seamless daily refinement.',
      image: HOMEPAGE_IMAGES.heroSlide3,
      shopLink: '/shop?category=earrings',
      categoriesLink: '#categories',
      ctaText: 'Discover Jewellery'
    }
  ];

  const baseHeroSlides = managedHeroSlides.length > 0 ? managedHeroSlides.map((banner, index) => ({
    id: banner.id || index,
    eyebrow: banner.tagline,
    heading: banner.title,
    paragraph: banner.subtitle,
    image: banner.imageUrl,
    shopLink: banner.ctaLink,
    categoriesLink: '#categories',
    ctaText: banner.ctaText
  })) : defaultHeroSlides;
  // Campaigns with a storewide offer are automatically featured first.
  // Admins can also force a campaign to the first slide or keep it in normal rotation.
  const orderedCampaigns = [...festivalCampaigns].sort((a, b) => {
    const rank = (campaign: FestivalCampaign) => campaign.heroPlacement === "first" ? 0
      : campaign.heroPlacement === "normal" ? 2
      : campaign.storewideDiscountPercent > 0 ? 0 : 1;
    return rank(a) - rank(b) || (a.sortOrder - b.sortOrder);
  });
  const campaignSlides = orderedCampaigns.map(campaign => ({
    id: `campaign-${campaign.id}`,
    eyebrow: campaign.eyebrow || campaign.offerLabel || campaign.festival,
    heading: campaign.title,
    paragraph: campaign.subtitle,
    image: campaign.imageUrl,
    shopLink: campaign.ctaLink,
    categoriesLink: '#categories',
    ctaText: campaign.ctaText,
    campaign
  }));
  const firstCampaignIndex = campaignSlides.findIndex(slide =>
    slide.campaign.heroPlacement === "first" ||
    (slide.campaign.heroPlacement !== "normal" && slide.campaign.storewideDiscountPercent > 0)
  );
  const heroSlides = [
    ...baseHeroSlides.map(slide => ({ ...slide, campaign: undefined as FestivalCampaign | undefined })),
    ...campaignSlides
  ];
  if (firstCampaignIndex >= 0) {
    const [featuredCampaign] = heroSlides.splice(baseHeroSlides.length + firstCampaignIndex, 1);
    heroSlides.unshift(featuredCampaign);
  }
  const slideCount = heroSlides.length;
  const activeSlideDuration = heroSlides[activeSlide]?.campaign
    ? Math.max(5, Math.min(20, Number(heroSlides[activeSlide].campaign?.heroDurationSeconds) || 9)) * 1000
    : 5000;

  useEffect(() => {
    setActiveSlide(current => Math.min(current, Math.max(slideCount - 1, 0)));
  }, [slideCount]);

  useEffect(() => {
    let cancelled = false;
    setEditorial(current => ({ ...current, active: false }));
    hostingerStorefrontService.getPublicEditorial()
      .then(result => { if (!cancelled && result.editorial) setEditorial(result.editorial); else if (!cancelled && result.editorial === null) setEditorial(current => ({ ...current, active: false })); })
      .catch(error => console.warn('[HomePage] Editorial content unavailable; using default content.', error));
    return () => { cancelled = true; };
  }, [selectedProductCollection]);

  useEffect(() => {
    let cancelled = false;
    setHomepageContent(DEFAULT_HOMEPAGE_CONTENT);
    hostingerStorefrontService.getPublicHomepageContent()
      .then(result => { if (!cancelled && result.content) setHomepageContent(result.content); })
      .catch(error => console.warn('[HomePage] Editable homepage content unavailable; using the built-in defaults.', error));
    return () => { cancelled = true; };
  }, [selectedProductCollection]);

  useEffect(() => {
    let cancelled = false;
    setManagedHeroSlides([]);
    hostingerStorefrontService.getPublicBanners()
      .then(result => { if (!cancelled && result.banners.length) { setManagedHeroSlides(result.banners); setActiveSlide(0); } else if (!cancelled) setManagedHeroSlides([]); })
      .catch(error => console.warn('[HomePage] Published hero banners unavailable; using defaults.', error));
    return () => { cancelled = true; };
  }, [selectedProductCollection]);

  // 1. Fetch Hostinger storefront data
  useEffect(() => {
    let isCancelled = false;

    async function loadData() {
      setLoading(true);
      setLoadError(false);
      setCategories([]);
      setBestsellers([]);
      setCuratedFavourites([]);
      setNewArrivals([]);
      try {
        // Keep each homepage collection independent: one unavailable endpoint must
        // not prevent the other sections from rendering their successfully loaded data.
        const [catsResult, bestSellingResult, curatedResult, newestResult] = await Promise.allSettled([
          categoryService.getCategories({ activeOnly: true }),
          productService.getBestSellingProducts(10),
          productService.getFeaturedProducts(8),
          productService.getProducts({ sortBy: 'newest', inStockOnly: true, includeAll })
        ]);

        if (!isCancelled) {
          const failures = [catsResult, bestSellingResult, curatedResult, newestResult]
            .filter(result => result.status === 'rejected');
          if (failures.length) {
            console.warn('[HomePage] One or more storefront collections could not be loaded.', failures);
          }

          if (catsResult.status === 'fulfilled') {
            const sortPriority: Record<string, number> = {
              earrings: 1,
              necklaces: 2,
              rings: 3,
              bracelets: 4,
              sets: 5
            };
            const sortedCats = [...catsResult.value].sort((a, b) => {
              const prioA = sortPriority[a.slug] || 99;
              const prioB = sortPriority[b.slug] || 99;
              return prioA - prioB;
            });
            setCategories(sortedCats);
          }

          if (bestSellingResult.status === 'fulfilled') {
            setBestsellers(bestSellingResult.value.filter(hasUsableProductImage));
          }
          if (curatedResult.status === 'fulfilled') {
            setCuratedFavourites(curatedResult.value.filter(hasUsableProductImage));
          }

          if (newestResult.status === 'fulfilled') {
            // 4 newest products sorted by createdAt descending.
            const newest = newestResult.value;
            const arrivalList = newest
              .filter(hasUsableProductImage)
              .sort((a, b) => {
                const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return (Number.isFinite(dateB) ? dateB : 0) - (Number.isFinite(dateA) ? dateA : 0);
              })
              .slice(0, 4);
            setNewArrivals(arrivalList);
          }

          // Show the full error state only when every independent collection failed.
          setLoadError(failures.length === 4);
        }
      } catch (err) {
        console.error('[HomePage] Unexpected error loading storefront collections:', err);
        if (!isCancelled) setLoadError(true);
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
  }, [includeAll, selectedProductCollection]);

  // Regular slides use 5 seconds; campaign slides use their admin-configured hold time.
  // The timer restarts on every slide change so a featured offer gets its full viewing time.
  useEffect(() => {
    if (slideCount <= 1 || prefersReducedMotion) return;
    const timer = window.setTimeout(() => {
      setActiveSlide(prev => (prev + 1) % slideCount);
    }, activeSlideDuration);
    return () => window.clearTimeout(timer);
  }, [activeSlide, activeSlideDuration, prefersReducedMotion, slideCount]);

  const prevSlide = () => {
    setActiveSlide((prev) => (prev - 1 + slideCount) % slideCount);
  };

  const nextSlide = () => {
    setActiveSlide((prev) => (prev + 1) % Math.max(slideCount, 1));
  };

  // Category carousel controls: move almost one full viewport per click.
  const scrollCategories = (direction: 'left' | 'right') => {
    const track = categoryCarouselRef.current;
    if (!track) return;
    track.scrollBy({
      left: direction === 'left' ? -Math.max(track.clientWidth * 0.85, 260) : Math.max(track.clientWidth * 0.85, 260),
      behavior: 'smooth'
    });
  };

  // Tap controls complement native finger/mouse horizontal scrolling.
  const scrollProductTrack = (track: HTMLDivElement | null, direction: 'left' | 'right') => {
    if (!track) return;
    const amount = Math.max(track.clientWidth * 0.82, 260);
    track.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
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

  const currentHero = heroSlides[activeSlide] || heroSlides[0];

  return (
    <div className="sarine-home w-full bg-[#FBF8F5] text-[#302438] font-sans selection:bg-[var(--pill)] selection:text-[#302438]" style={{ display: "flex", flexDirection: "column" }}>
      <nav aria-label="Shop by jewellery range" style={{ order: sectionOrder("hero") - 1 }} className="w-full border-b border-[#E7DCEB] bg-white">
        <div className="mx-auto flex min-h-11 w-full max-w-[1280px] items-center justify-center gap-5 px-4 text-xs sm:gap-8 sm:text-sm">
          <button type="button" onClick={() => selectProductCollection(undefined)} aria-current={!selectedProductCollection ? "page" : undefined} className={`min-h-11 border-b-2 px-1 font-medium transition-colors ${!selectedProductCollection ? "border-[#563568] text-[#563568]" : "border-transparent text-[#705E7B] hover:text-[#563568]"}`}>Home</button>
          <button type="button" onClick={() => selectProductCollection("artificial")} aria-current={selectedProductCollection === "artificial" ? "page" : undefined} className={`min-h-11 border-b-2 px-1 font-medium transition-colors ${selectedProductCollection === "artificial" ? "border-[#563568] text-[#563568]" : "border-transparent text-[#705E7B] hover:text-[#563568]"}`}>Artificial</button>
          <button type="button" onClick={() => selectProductCollection("demi-fine")} aria-current={selectedProductCollection === "demi-fine" ? "page" : undefined} className={`min-h-11 border-b-2 px-1 font-medium transition-colors ${selectedProductCollection === "demi-fine" ? "border-[#563568] text-[#563568]" : "border-transparent text-[#705E7B] hover:text-[#563568]"}`}>Demi-Fine</button>
        </div>
      </nav>

      {/* =========================================================================
          3. HERO SLIDER
          Fixed responsive height: h-[420px] md:h-[520px] lg:h-[600px]
          Stacked absolute slides with opacity transitions
          Every image: object-cover object-[70%_center] on #F0E6F4
          Text in centered container (max-w-[1280px]) directly over the hero image
          Slide indicators bottom-left, arrow buttons bottom-right inside container
          ========================================================================= */}
      <section
        style={{ order: sectionOrder("hero"), display: sectionVisible("hero") ? undefined : "none" }}
        onTouchStart={event => { heroTouchStartX.current = event.touches[0]?.clientX ?? null; }}
        onTouchEnd={event => {
          const startX = heroTouchStartX.current;
          const endX = event.changedTouches[0]?.clientX;
          heroTouchStartX.current = null;
          if (startX === null || endX === undefined) return;
          const deltaX = endX - startX;
          if (Math.abs(deltaX) > 48) deltaX < 0 ? nextSlide() : prevSlide();
        }}
        className="sarine-home-hero relative w-full h-[420px] md:h-[520px] lg:h-[600px] overflow-hidden bg-[var(--tint)] border-b border-[var(--border)] touch-pan-y"
      >
        {/* Stacked background slide images */}
        {heroSlides.map((slide, idx) => (
          <div
            key={slide.id}
            className={`absolute inset-0 w-full h-full bg-[var(--tint)] transition-opacity duration-700 ease-in-out ${
              activeSlide === idx ? 'opacity-100 z-0' : 'opacity-0 z-0 pointer-events-none'
            }`}
          >
            {slide.campaign?.artworkOnly ? (
              <CampaignDestinationLink to={slide.shopLink} ariaLabel={`${slide.campaign.title} — ${slide.campaign.ctaText || "Shop now"}`} className="absolute inset-0 block">
                <img
                  src={slide.image}
                  alt={`${slide.campaign.festival}: ${slide.campaign.title}`}
                  loading={activeSlide === idx ? "eager" : "lazy"}
                  fetchPriority={activeSlide === idx ? "high" : "low"}
                  decoding="async"
                  className="sarine-home-hero-image absolute inset-0 w-full h-full object-cover object-center shadow-none"
                />
              </CampaignDestinationLink>
            ) : (
              <img
                src={slide.image}
                alt={slide.heading}
                loading={activeSlide === idx ? "eager" : "lazy"}
                fetchPriority={activeSlide === idx ? "high" : "low"}
                decoding="async"
                className="sarine-home-hero-image absolute inset-0 w-full h-full object-cover object-center shadow-none"
              />
            )}
          </div>
        ))}


        {/* Hero text overlays, offer badge, and pause control removed; preserve image-only slides. */}
      </section>

      {/* Compact campaign countdown: a small centred pill immediately below the hero. */}
      {(() => {
        const countdownCampaign = orderedCampaigns.find(campaign =>
          campaign.showCountdown && campaign.endsAt && new Date(campaign.endsAt).getTime() > Date.now()
        );
        return countdownCampaign && sectionVisible("hero") ? (
          <div style={{ order: sectionOrder("hero") }} className="flex w-full justify-center px-4 py-1.5 sm:py-2" aria-label="Current campaign countdown">
            <CampaignCountdownStrip campaign={countdownCampaign} />
          </div>
        ) : null;
      })()}

      {/* =========================================================================
          SHOP BY CATEGORY — RESPONSIVE HORIZONTAL CAROUSEL
          ========================================================================= */}
      <section id="categories" style={{ order: sectionOrder("categories"), display: sectionVisible("categories") ? undefined : "none" }} className="w-full py-6 sm:py-7 lg:py-10">
        <div className="site-container">
          <div className="relative mb-5 flex items-center justify-center gap-4">
            <h2 className="w-full text-center font-serif text-2xl font-normal !text-[color:var(--heading)] sm:text-3xl lg:text-4xl">Shop by Category</h2>

          </div>

          {categories.length > 0 ? (
            <div
              ref={categoryCarouselRef}
              className={sectionCarouselEnabled("categories") ? "sarine-category-track flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain scroll-smooth pb-3 touch-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-4 lg:gap-5" : "sarine-category-track grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 lg:gap-5"}
              aria-label="Jewellery categories"
            >
              {categories.map((cat) => (
                <Link
                  key={cat.id}
                  to={`/shop?category=${encodeURIComponent(cat.slug)}`}
                  className={sectionCarouselEnabled("categories") ? "sarine-category-card group w-[26%] shrink-0 snap-start sm:w-[42%] md:w-[30%] lg:w-auto lg:[flex-basis:var(--desktop-card-basis)]" : "sarine-category-card group min-w-0"} style={sectionCarouselEnabled("categories") ? desktopCardStyle("categories", 20, 5) : undefined}
                >
                  <div className="sarine-category-card__media relative aspect-square overflow-hidden rounded-sm border border-[var(--border)] bg-[var(--pill)] transition-colors group-hover:border-[var(--gold)]">
                    <img
                      src={categoryImageOverrides[cat.slug] || cat.image}
                      alt={cat.name}
                      loading="lazy"
                      decoding="async"
                      fetchPriority="low"
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                    />
                  </div>
                  <div className="sarine-category-card__caption flex min-h-0 items-center justify-center px-1 pt-3 pb-1 text-center">
                    <h3 className="w-full min-w-0 text-center font-serif text-base font-medium !text-black sm:text-lg">{cat.name}</h3>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm !text-[color:var(--body)]">
              {loading ? "Loading categories…" : "Our jewellery collections will appear here soon."}
            </p>
          )}
          <div className="mt-1 text-center sm:hidden">
            <Link to="/shop" className="inline-flex items-center gap-1 text-xs font-medium !text-[color:var(--plum)]">
              View all categories <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SHOP BY GENDER — two independently managed landscape image tiles
          ========================================================================= */}
      <section style={{ order: sectionOrder("shop-by-gender"), display: sectionVisible("shop-by-gender") ? undefined : "none" }} className="w-full border-t border-[var(--border)] bg-white py-5 sm:py-6 lg:py-7" aria-label="Shop by gender">
        <div className="site-container">
          <div className="grid grid-cols-2 gap-3 sm:gap-5">
            <Link to="/shop" className="group block min-w-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--plum)]" aria-label="Shop for her">
              <div className="aspect-[1.6/1] min-[380px]:aspect-[1.8/1] min-[440px]:aspect-[2/1] sm:aspect-[2.5/1] md:aspect-[2.75/1] lg:aspect-[3/1] w-full overflow-hidden rounded-[10px] bg-[var(--pill)]">
                {shopByGender.forHerImageUrl && <img src={shopByGender.forHerImageUrl} alt="" aria-hidden="true" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />}
              </div>
              <p className="pt-2 text-center font-sans text-xs font-semibold tracking-[0.12em] text-black sm:pt-3 sm:text-sm">FOR HER</p>
            </Link>
            <Link to="/men" className="group block min-w-0 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--plum)]" aria-label="Explore the For Him collection — coming soon">
              <div className="aspect-[1.6/1] min-[380px]:aspect-[1.8/1] min-[440px]:aspect-[2/1] sm:aspect-[2.5/1] md:aspect-[2.75/1] lg:aspect-[3/1] w-full overflow-hidden rounded-[10px] bg-[var(--pill)]">
                {shopByGender.forHimImageUrl && <img src={shopByGender.forHimImageUrl} alt="" aria-hidden="true" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />}
              </div>
              <p className="pt-2 text-center font-sans text-xs font-semibold tracking-[0.12em] text-black sm:pt-3 sm:text-sm">FOR HIM</p>
            </Link>
          </div>
        </div>
      </section>

      {/* =========================================================================
          NEW ARRIVALS
          4 newest products (sorted by createdAt descending, else the last 4 in the list),
          same product card as Best Sellers, "View All" linking to /shop?sort=newest
          ========================================================================= */}
      <section style={{ order: sectionOrder("new-arrivals"), display: sectionVisible("new-arrivals") ? undefined : "none", backgroundColor: "var(--white)" }} className="sarine-product-section sarine-section-new-arrivals py-6 sm:py-8 lg:py-10 border-t border-[var(--border)] bg-white">
        <div className="site-container">
          <div className="sarine-section-heading sarine-section-heading--new w-full mb-3 sm:mb-4">
            <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl !text-[color:var(--heading)] font-normal">
              New Arrivals
            </h2>
            <Link
              to="/shop?sort=newest"
              className="text-xs sm:text-[13px] !text-[color:var(--plum)] hover:!text-[color:var(--plum)] font-sans font-medium inline-flex items-center gap-1.5 transition-colors"
            >
              <span>View All</span>
              <ArrowRight size={13} />
            </Link>
          </div>


          {loading ? (
            <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="w-[37%] shrink-0 snap-start sm:w-[42%] md:w-[30%] lg:w-[23%] xl:w-[19%] animate-pulse">
                  <div className="bg-[var(--pill)] aspect-[3/4] w-full border border-[var(--border)]" />
                  <div className="h-4 bg-[var(--pill)] w-2/3 mt-3" />
                  <div className="h-3 bg-[var(--pill)] w-1/3 mt-2" />
                </div>
              ))}
            </div>
          ) : newArrivals.length > 0 ? (
            <div ref={newArrivalsCarouselRef} className={`sarine-product-grid ${sectionCarouselEnabled("new-arrivals") ? "flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain scroll-smooth pb-3 touch-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-5 lg:gap-6" : "grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"}`} aria-label="New Arrivals products">
              {newArrivals.slice(0, 8).map((product) => (
                <div key={product.id} className={sectionCarouselEnabled("new-arrivals") ? "w-[37%] shrink-0 snap-start sm:w-[42%] md:w-[30%] lg:w-auto lg:[flex-basis:var(--desktop-card-basis)]" : "min-w-0"} style={sectionCarouselEnabled("new-arrivals") ? desktopCardStyle("new-arrivals", 24, 5) : undefined}>
                  <ProductCard product={product} homepageWishlist />
                </div>
              ))}
            </div>
          ) : (
            <p className="col-span-full py-8 text-center text-xs !text-[color:var(--body)]">
              {loadError ? 'We could not load new arrivals right now. Please try again shortly.' : 'New arrivals are on their way. Please explore the full collection.'}
            </p>
          )}
        </div>
      </section>

      {/* =========================================================================
          BEST SELLERS
          Shared container: mx-auto w-full max-w-[1280px] px-4 sm:px-6 lg:px-10
          Heading row: flex items-end justify-between mb-6
          Scrolling track INSIDE container: gap-4 lg:gap-6 snap-x snap-mandatory
          Card widths: w-[calc((100%-1rem)/2)] md:w-[calc((100%-3rem)/3)] lg:w-[calc((100%-6rem)/5)]
          Arrows: absolute inside relative wrapper, never pushing or overflowing
          Consistent vertical spacing: py-6 sm:py-8 lg:py-10
          ========================================================================= */}
      <section style={{ order: sectionOrder("best-sellers"), display: sectionVisible("best-sellers") && (loading || bestsellers.length > 0) ? undefined : "none", backgroundColor: "var(--white)" }} className="sarine-product-section sarine-section-best-sellers py-6 sm:py-8 lg:py-10 border-t border-[var(--border)] bg-white">
        <div className="site-container">
          {/* Centered Full-Width Section Header Block */}
          <div className="sarine-section-heading sarine-section-heading--best w-full text-center mb-4 sm:mb-4">
            <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl !text-[color:var(--heading)] font-normal">
              Best Sellers
            </h2>
            <div className="mt-3">
              <Link
                to='/shop?sort=bestseller'
                className="text-xs sm:text-[13px] !text-[color:var(--plum)] hover:!text-[color:var(--plum)] font-sans font-medium inline-flex items-center gap-1.5 transition-colors"
              >
                <span>View All</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>

{sectionCarouselEnabled("best-sellers") && (
          <div className="mb-3 flex items-center justify-end gap-2" aria-label="Best Sellers carousel controls">
            <button type="button" onClick={() => scrollProductTrack(carouselRef.current, 'left')} aria-label="Scroll Best Sellers left" className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-white !text-[color:var(--plum)] shadow-sm transition hover:border-[var(--gold)] hover:bg-[var(--gold)] hover:!text-white">
              <ChevronLeft size={17} />
            </button>
            <button type="button" onClick={() => scrollProductTrack(carouselRef.current, 'right')} aria-label="Scroll Best Sellers right" className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-white !text-[color:var(--plum)] shadow-sm transition hover:border-[var(--gold)] hover:bg-[var(--gold)] hover:!text-white">
              <ChevronRight size={17} />
            </button>
          </div>
          )}
          {loading ? (
            <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="w-[68%] shrink-0 snap-start sm:w-[42%] md:w-[30%] lg:w-[23%] xl:w-[19%] animate-pulse">
                  <div className="bg-[var(--pill)] aspect-[3/4] w-full border border-[var(--border)]" />
                  <div className="h-4 bg-[var(--pill)] w-2/3 mt-3" />
                  <div className="h-3 bg-[var(--pill)] w-1/3 mt-2" />
                </div>
              ))}
            </div>
          ) : bestsellers.length > 0 ? (
            <div ref={carouselRef} className={`sarine-product-grid ${sectionCarouselEnabled("best-sellers") ? "flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain scroll-smooth pb-3 touch-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-5 lg:gap-6" : "grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"}`} aria-label="Best Sellers products">
              {bestsellers.slice(0, 12).map((product) => (
                <div key={product.id} className={sectionCarouselEnabled("best-sellers") ? "w-[68%] shrink-0 snap-start sm:w-[42%] md:w-[30%] lg:w-auto lg:[flex-basis:var(--desktop-card-basis)]" : "min-w-0"} style={sectionCarouselEnabled("best-sellers") ? desktopCardStyle("best-sellers", 24, 5) : undefined}>
                  <ProductCard product={product} homepageWishlist />
                </div>
              ))}
            </div>
          ) : (
            <p className="col-span-full py-8 text-center text-xs !text-[color:var(--body)]">
              {loadError ? 'We could not load Best Sellers right now. Please try again shortly.' : 'Our Best Sellers will appear here as qualifying customer orders are completed.'}
            </p>
          )}
        </div>
      </section>

      {/* =========================================================================
          CURATED FAVOURITES
          Manually selected and ordered in Storefront Studio. Automatic newest-product
          fallback remains in place until a manual collection has been published.
          ========================================================================= */}
      <section style={{ order: sectionOrder("curated-favourites"), display: sectionVisible("curated-favourites") && (loading || (hasPublishedCuratedFavourites ? manualCuratedFavourites : curatedFavourites).length > 0) ? undefined : "none", backgroundColor: "var(--tint)" }} className="sarine-product-section sarine-section-curated-favourites py-6 sm:py-8 lg:py-10 border-t border-[var(--border)] bg-[var(--tint)]">
        <div className="site-container">
          <div className="sarine-section-heading sarine-section-heading--curated w-full mb-3 sm:mb-4">
            <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl !text-[color:var(--heading)] font-normal">Curated Favourites</h2>
            <Link to="/shop" className="text-xs sm:text-[13px] !text-[color:var(--plum)] hover:!text-[color:var(--plum)] font-sans font-medium inline-flex items-center gap-1.5 transition-colors">
              <span>View All</span><ArrowRight size={13} />
            </Link>
          </div>
          {loading ? (
            <div className="flex gap-4 overflow-hidden pb-3">
              {[...Array(4)].map((_, i) => <div key={i} className="w-[37%] shrink-0 sm:w-[42%] md:w-[30%] lg:w-1/4 animate-pulse"><div className="bg-[var(--pill)] aspect-[3/4] w-full border border-[var(--border)]" /><div className="h-4 bg-[var(--pill)] w-2/3 mt-3" /><div className="h-3 bg-[var(--pill)] w-1/3 mt-2" /></div>)}
            </div>
          ) : (hasPublishedCuratedFavourites ? manualCuratedFavourites : curatedFavourites).length > 0 ? (
            <div ref={curatedCarouselRef} className={`sarine-product-grid ${sectionCarouselEnabled("curated-favourites") ? "flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain scroll-smooth pb-3 touch-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-5" : "grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"}`} aria-label="Curated Favourites products">
              {(hasPublishedCuratedFavourites ? manualCuratedFavourites : curatedFavourites).slice(0, 12).map(product => <div key={product.id} className={sectionCarouselEnabled("curated-favourites") ? "w-[37%] shrink-0 snap-start sm:w-[42%] md:w-[30%] lg:w-auto lg:[flex-basis:var(--desktop-card-basis)]" : "min-w-0"} style={sectionCarouselEnabled("curated-favourites") ? desktopCardStyle("curated-favourites", 20, 5) : undefined}><ProductCard product={product} homepageWishlist /></div>)}
            </div>
          ) : (
            <p className="col-span-full py-8 text-center text-xs !text-[color:var(--body)]">
              {hasPublishedCuratedFavourites ? "Our selected favourites are temporarily unavailable. Please check back soon." : "New collection pieces will be available soon. Please explore the full collection."}
            </p>
          )}
        </div>
      </section>

      {/* =========================================================================
          SHOP BY OCCASION
          4 cards: Daily Wear, Festive, Wedding, Gifting
          Using existing product images, linking to /shop with filter queries
          ========================================================================= */}
      <section style={{ order: sectionOrder("occasions"), display: sectionVisible("occasions") && occasions.some(item => item.active) ? undefined : "none" }} className="sarine-section-occasions py-4 sm:py-6 lg:py-7 border-t border-[var(--border)] !bg-white">
        <div className="site-container">
          <div className="w-full text-center mb-4 sm:mb-4">
            <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl !text-[color:var(--heading)] font-normal">
              Shop by Occasion
            </h2>
          </div>

          <div ref={occasionsCarouselRef} className={sectionCarouselEnabled("occasions") ? "flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain scroll-smooth pb-2 touch-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-4" : "grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"} aria-label="Shop by Occasion cards">
            {occasions.filter(item => item.active).map((item) => (
              <Link key={item.id} to={item.link} className={sectionCarouselEnabled("occasions") ? "group flex w-[72%] shrink-0 snap-start flex-col items-center text-center sm:w-[42%] md:w-[30%] lg:w-auto lg:[flex-basis:var(--desktop-card-basis)]" : "group flex min-w-0 flex-col items-center text-center"} style={sectionCarouselEnabled("occasions") ? desktopCardStyle("occasions", 20, 5) : undefined}>
                <div className="aspect-[4/5] w-full overflow-hidden bg-[#2B1A33] border border-[var(--border)] rounded-xs relative group-hover:border-[var(--gold)] transition-colors">
                  <img src={item.image} alt={item.title} loading="lazy" decoding="async" fetchPriority="low" referrerPolicy="no-referrer" className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500 ease-out" />
                </div>
                <div className="pt-3 text-center flex flex-col items-center">
                  <h3 className="text-sm sm:text-base font-normal !text-[color:var(--heading)] font-sans group-hover:!text-[color:var(--plum)] transition-colors">{item.title}</h3>
                  <p className="text-[11px] sm:text-xs !text-[color:var(--body)] font-sans mt-0.5">{item.subtitle}</p>
                  <span className="text-xs !text-[color:var(--plum)] group-hover:!text-[color:var(--plum)] transition-colors inline-flex items-center justify-center gap-1 mt-1 font-sans"><span>Shop Now</span><ArrowRight size={11} className="text-[color:var(--gold)]" /></span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>


      {/* Explore Now is intentionally a regular grid, separate from Curated Favourites. */}
      <section style={{ order: sectionOrder("explore-now"), display: sectionVisible("explore-now") && hasPublishedExploreNow && exploreProducts.length ? undefined : "none", backgroundColor: "var(--white)" }} className="sarine-product-section sarine-section-explore-now border-t border-[var(--border)] bg-white py-7 sm:py-9 lg:py-11">
        <div className="site-container">
          <div className="mb-5 text-center sm:mb-6">
            <h2 className="font-serif text-2xl font-normal !text-[color:var(--heading)] sm:text-3xl lg:text-4xl">Explore Now</h2>
          </div>
          <div className="sarine-product-grid grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 lg:gap-5">
            {exploreProducts.slice(0, exploreDisplayCount).map(product => (
              <ProductCard key={product.id} product={product} homepageWishlist />
            ))}
          </div>

        </div>
      </section>


      {/* =========================================================================
          SHOP BY PRICE — content managed in Storefront Studio
          ========================================================================= */}
      <section style={{ order: sectionOrder("price"), display: sectionVisible("price") ? undefined : "none", backgroundColor: "#FFFFFF" }} className="py-6 sm:py-8 border-t border-[var(--border)] !bg-white">
        <div className="site-container">
          <div className="w-full text-center mb-4">
            <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl !text-[color:var(--heading)] font-normal">{homepageContent.price.title}</h2>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 max-w-2xl mx-auto">
            {homepageContent.price.links.map((item, index) => (
              <Link key={index} to={item.href} className="px-6 sm:px-8 py-3 bg-white border border-[var(--gold)] hover:border-[var(--plum)] hover:!text-white hover:bg-[var(--plum)] !text-[color:var(--heading)] text-xs sm:text-sm font-sans font-medium rounded-full transition-all duration-200 shadow-2xs whitespace-nowrap">
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* =========================================================================
          OUR STORY
          Background #F0E6F4 edge-to-edge
          Centered container mx-auto w-full max-w-[1280px] px-4 sm:px-6 lg:px-10
          Consistent vertical spacing: py-6 sm:py-8 lg:py-10
          ========================================================================= */}
      <section style={{ order: sectionOrder("our-story"), display: sectionVisible("our-story") ? undefined : "none" }} className="sarine-story-section !bg-white border-y border-[var(--border)] py-6 sm:py-8 lg:py-10">
        <div className="site-container">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-8 items-center">
            {/* Left: Large Jewellery Photo */}
            <div className="lg:col-span-5">
              <div className="aspect-[4/3] sm:aspect-[1/1] bg-white overflow-hidden rounded-xs border border-[var(--border)]">
                <img
                  src={homepageContent.story.imageUrl || HOMEPAGE_IMAGES.ourStory}
                  alt="SARINE Craftsmanship and Jewellery Details"
                  loading="lazy"
                  decoding="async"
                  fetchPriority="low"
                  className="w-full h-full object-cover object-center"
                />
              </div>
            </div>

            {/* Right: Story Copy & 3 Pillars */}
            <div className="lg:col-span-7 flex flex-col md:flex-row items-start gap-8 lg:gap-12">
              {/* Story Narrative */}
              <div className="flex-1">
                <span className="text-[10px] uppercase tracking-[0.25em] !text-[color:var(--gold-text)] font-medium block mb-2 font-sans">
                  {homepageContent.story.eyebrow}
                </span>

                <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl !text-[color:var(--heading)] font-normal leading-tight">
                  {homepageContent.story.title}
                </h2>

                {homepageContent.story.paragraphs.map((paragraph, index) => (
                  <p key={index} className={index === 0 ? "mt-4 text-xs sm:text-sm !text-[color:var(--body)] leading-relaxed font-sans" : "mt-3 text-xs sm:text-sm !text-[color:var(--body)] leading-relaxed font-sans"}>
                    {paragraph}
                  </p>
                ))}

                <div className="mt-7">
                  <Link
                    to={homepageContent.story.ctaLink}
                    className="px-6 py-3 min-h-11 bg-[var(--plum)] text-white text-xs font-sans font-medium hover:bg-[var(--gold)] hover:text-white transition-colors rounded-[6px] inline-flex items-center gap-2 shadow-xs"
                  >
                    <span>{homepageContent.story.ctaText}</span>
                    <ArrowRight size={13} />
                  </Link>
                </div>
              </div>

              {/* Thin Vertical Divider (Desktop) */}
              <div className="hidden md:block w-[1px] bg-[var(--border)] self-stretch"></div>

              {/* Three editable brand pillars */}
              <div className="w-full md:w-64 space-y-5 pt-2">
                {homepageContent.story.pillars.map((pillar, index) => {
                  const PillarIcon = [Gem, Sparkles, ShieldCheck][index] || Gem;
                  return <div key={index} className="flex items-start gap-3">
                    <div className="p-2 rounded-xs !text-[color:var(--gold)] shrink-0 bg-white border border-[var(--border)]">
                      <PillarIcon size={18} strokeWidth={1.5} />
                    </div>
                    <div>
                      <h3 className="text-xs font-medium !text-[color:var(--heading)] leading-snug">{pillar.title}</h3>
                      <p className="text-[11px] !text-[color:var(--body)] leading-tight mt-0.5">{pillar.description}</p>
                    </div>
                  </div>;
                })}
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          7. EDITORIAL BANNER
          ========================================================================= */}
      {editorial.active && (
        <section style={{ order: sectionOrder("editorial"), display: sectionVisible("editorial") ? undefined : "none" }} className="sarine-editorial-banner relative overflow-hidden border-b border-[var(--border)]">
          <img src={editorial.imageUrl || HOMEPAGE_IMAGES.editorialBanner} alt={editorial.title} loading="lazy" decoding="async" fetchPriority="low" className="absolute inset-0 w-full h-full object-cover object-center" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, transparent 35%, rgba(0, 0, 0, 0.42) 100%)" }} aria-hidden="true" />
          <div className="site-container min-h-[200px] sm:min-h-[235px] lg:min-h-[270px] flex items-center justify-end relative z-10">
            <div className="w-full sm:w-2/3 lg:w-1/2 text-left">
              <span className="text-[12px] sm:text-[13px] uppercase tracking-[0.2em] !text-white font-medium block mb-2 font-sans [text-shadow:0_1px_8px_rgba(0,0,0,0.5)]">{editorial.eyebrow}</span>
              <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl !text-white font-normal leading-tight [text-shadow:0_2px_10px_rgba(0,0,0,0.5)]">{editorial.title}</h2>
              <p className="mt-3 text-[13px] sm:text-sm !text-white leading-relaxed max-w-md font-sans [text-shadow:0_1px_8px_rgba(0,0,0,0.5)]">{editorial.description}</p>
              <div className="mt-6"><Link to={editorial.ctaLink} className="px-6 py-3 bg-white !text-[color:var(--plum)] text-xs font-sans font-medium hover:bg-[var(--gold)] hover:!text-white transition-colors rounded-xs inline-flex items-center gap-2 shadow-xs"><span>{editorial.ctaText}</span><ArrowRight size={13} /></Link></div>
            </div>
          </div>
        </section>
      )}


      {/* =========================================================================
          JEWELLERY CARE GUIDE — editable in Storefront Studio
          ========================================================================= */}
      <section style={{ order: sectionOrder("care-guide"), display: sectionVisible("care-guide") ? undefined : "none" }} className="py-7 sm:py-9 border-t border-[var(--border)] !bg-[var(--surface)]">
        <div className="site-container">
          <div className="max-w-[720px] mx-auto text-center mb-6">
            <span className="text-[10px] uppercase tracking-[0.25em] !text-[color:var(--gold-text)] font-medium block mb-2 font-sans">{homepageContent.care.eyebrow}</span>
            <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl !text-[color:var(--heading)] font-normal">{homepageContent.care.title}</h2>
            <p className="mt-2 text-xs sm:text-sm !text-[color:var(--body)] font-sans leading-relaxed">{homepageContent.care.description}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {homepageContent.care.steps.map((step, index) => (
              <div key={index} className="p-4 bg-white border border-[var(--border)] rounded-xs text-center space-y-2">
                <span className="w-8 h-8 rounded-full bg-[var(--plum)] !text-white text-xs font-serif flex items-center justify-center mx-auto mb-3">{index + 1}</span>
                <h3 className="font-serif text-base !text-[color:var(--heading)]">{step.title}</h3>
                <p className="text-xs !text-[color:var(--body)] leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* =========================================================================
          STAY IN TOUCH — editable in Storefront Studio
          ========================================================================= */}
      <section style={{ order: sectionOrder("stay-in-touch"), display: sectionVisible("stay-in-touch") ? undefined : "none" }} id="stay-in-touch" className="py-7 sm:py-9 lg:py-11 !bg-white">
        <div className="site-container">
          <div className="max-w-[620px] mx-auto text-center">
            <span className="text-[10px] uppercase tracking-[0.25em] !text-[color:var(--gold-text)] font-medium block mb-2 font-sans">{homepageContent.contact.eyebrow}</span>
            <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl !text-[color:var(--heading)] font-normal">{homepageContent.contact.title}</h2>
            <p className="mt-3 text-xs sm:text-sm !text-[color:var(--body)] font-sans leading-relaxed">
              {homepageContent.contact.description}{" "}
              <Link to={homepageContent.contact.linkHref} className="!text-[color:var(--plum)] font-medium underline underline-offset-4 hover:!text-[color:var(--gold)] transition-colors">
                {homepageContent.contact.linkText}
              </Link>.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};