/**
 * ProductDetailPage component for SARINE.
 * Luxury e-commerce PDP with multi-image gallery & zoom,
 * Indian PIN code serviceability checker, size guide modal,
 * gifting option, customer reviews module, structured data, and related recommendations.
 */

import React, { useEffect, useState, useMemo } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { productService, categoryService } from '../services';
import { Product, isInStock, JEWELLERY_TYPE_LABELS } from '../types/product';
import { Category } from '../types/category';
import { formatInr } from '../utils/currency';
import { setPageMetadata } from '../utils/seo';
import { ProductCard } from '../components/ProductCard';
import { hostingerStorefrontService } from '../services/hostinger/hostingerStorefrontService';
import { useCart } from '../context/CartContext';
import { useCheckoutConfig } from '../hooks/useCheckoutConfig';
import { useWishlist } from '../context/WishlistContext';
import {
  ArrowLeft,
  ShoppingBag,
  Heart,
  CheckCircle2,
  Truck,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  Share2,
  Gift,
  HelpCircle,
  Star,
  MapPin,
  X,
  Maximize2
} from 'lucide-react';

interface ProductDetailPageProps {
  includeAll: boolean;
}

interface CustomerReview {
  id: string;
  name: string;
  rating: number;
  date: string;
  title: string;
  comment: string;
  verified: boolean;
  imageUrls: string[];
}

const PINCODE_STORAGE_KEY = 'sarine_last_pincode';
const RECENTLY_VIEWED_KEY = 'sarine_recently_viewed_v1';

export const ProductDetailPage: React.FC<ProductDetailPageProps> = ({ includeAll }) => {
  const location = useLocation();
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { addItem, openDrawer, storewideDiscountPercent } = useCart();
  const { config: checkoutConfig } = useCheckoutConfig();
  const { isInWishlist, toggleWishlist } = useWishlist();

  const [product, setProduct] = useState<Product | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [activeImageIndex, setActiveImageIndex] = useState<number>(0);
  const [quantity, setQuantity] = useState<number>(1);
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [addedToast, setAddedToast] = useState<boolean>(false);
  const [shareToast, setShareToast] = useState<boolean>(false);

  useEffect(() => {
    if (!product) return;

    const rawDescription = product.shortDescription || product.description || '';
    const description = rawDescription.replace(/\s+/g, ' ').trim().slice(0, 160)
      || 'Discover this jewellery piece from SARINE.';
    const image = product.images?.find((url) => url.startsWith('https://') || url.startsWith('http://'));

    setPageMetadata({
      title: `${product.name} | SARINE`,
      description,
      image,
      robots: product.status === 'active' ? 'index, follow' : 'noindex, nofollow',
    });
  }, [product]);

  // Gallery Zoom Lightbox
  const [isZoomOpen, setIsZoomOpen] = useState(false);

  // Size Guide Modal
  const [isSizeGuideOpen, setIsSizeGuideOpen] = useState(false);

  // Pincode Checker
  const [pincode, setPincode] = useState<string>(() => localStorage.getItem(PINCODE_STORAGE_KEY) || '');
  const [pincodeResult, setPincodeResult] = useState<string | null>(null);
  const [pincodeError, setPincodeError] = useState<string | null>(null);

  // Gifting Option
  const [isGiftOrder, setIsGiftOrder] = useState(false);
  const [giftMessage, setGiftMessage] = useState('');

  // Active Specifications Tab
  const [activeTab, setActiveTab] = useState<'details' | 'care' | 'shipping'>('details');

  // Customer Reviews
  const [reviews, setReviews] = useState<CustomerReview[]>([]);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [newReviewRating, setNewReviewRating] = useState(5);
  const [newReviewName, setNewReviewName] = useState('');
  const [newReviewEmail, setNewReviewEmail] = useState('');
  const [newReviewOrderNumber, setNewReviewOrderNumber] = useState('');
  const [reviewMessage, setReviewMessage] = useState('');
  const [reviewError, setReviewError] = useState('');
  const [reviewCount, setReviewCount] = useState(0);
  const [reviewAverage, setReviewAverage] = useState(0);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [newReviewTitle, setNewReviewTitle] = useState('');
  const [newReviewComment, setNewReviewComment] = useState('');
  const [newReviewImages, setNewReviewImages] = useState<File[]>([]);
  const [newReviewImagePreviews, setNewReviewImagePreviews] = useState<string[]>([]);

  // Fetch the primary product first. Reviews, recommendations and category
  // breadcrumbs are secondary and must never hold the product page behind a
  // chain of sequential network requests.
  useEffect(() => {
    let isCancelled = false;

    async function loadData() {
      if (!slug) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setActiveImageIndex(0);
      setQuantity(1);
      setSelectedVariantId('');

      try {
        const found = await productService.getProductBySlug(slug, { includeAll });
        if (isCancelled) return;

        setProduct(found);
        setLoading(false);

        if (!found) return;

        // Track recently viewed without delaying the product page.
        try {
          const raw = localStorage.getItem(RECENTLY_VIEWED_KEY);
          const list: string[] = raw ? JSON.parse(raw) : [];
          const updated = [found.id, ...list.filter((id) => id !== found.id)].slice(0, 8);
          localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(updated));
        } catch {
          // Ignore unavailable browser storage.
        }

        // Load non-critical product extras concurrently after the main product
        // is already renderable. A slow reviews/recommendations endpoint can no
        // longer delay the first product view.
        const [reviewsResult, relatedResult, categoriesResult] = await Promise.allSettled([
          hostingerStorefrontService.getReviews(found.id),
          productService.getRelatedProducts(found.id, 4),
          categoryService.getCategories()
        ]);

        if (isCancelled) return;

        if (reviewsResult.status === 'fulfilled') {
          const result = reviewsResult.value;
          setReviews(result.reviews.map(review => ({
            ...review,
            date: new Date(review.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
          })));
          setReviewCount(result.count);
          setReviewAverage(result.average);
        } else {
          console.warn('[ProductDetailPage] Customer reviews are temporarily unavailable.', reviewsResult.reason);
          setReviews([]);
          setReviewCount(0);
          setReviewAverage(0);
        }

        if (relatedResult.status === 'fulfilled') {
          setRelatedProducts(relatedResult.value.filter((item) => item.status === 'active'));
        } else {
          console.warn('[ProductDetailPage] Could not load related pieces:', relatedResult.reason);
        }

        if (categoriesResult.status === 'fulfilled') {
          const cat = categoriesResult.value.find((item) => item.id === found.categoryId || item.slug === found.categoryId);
          if (cat) setCategory(cat);
        } else {
          console.warn('[ProductDetailPage] Could not load category info:', categoriesResult.reason);
        }
      } catch (err) {
        console.error('Failed to load product detail', err);
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }

    loadData();

    return () => {
      isCancelled = true;
    };
  }, [slug, includeAll, location.search]);

  // Handle Pincode check
  const handleCheckPincode = (e: React.FormEvent) => {
    e.preventDefault();
    setPincodeError(null);
    setPincodeResult(null);

    const clean = pincode.trim();
    if (!/^[1-9][0-9]{5}$/.test(clean)) {
      setPincodeError('Please enter a valid 6-digit Indian PIN code.');
      return;
    }

    localStorage.setItem(PINCODE_STORAGE_KEY, clean);

    // Calculate delivery date (3-5 days out)
    const now = new Date();
    const minDays = 3;
    const maxDays = 5;
    const minDate = new Date(now.setDate(now.getDate() + minDays));
    const maxDate = new Date(now.setDate(now.getDate() + (maxDays - minDays)));

    const dateOptions: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    const dateStr = `${minDate.toLocaleDateString('en-IN', dateOptions)} - ${maxDate.toLocaleDateString('en-IN', dateOptions)}`;

    setPincodeResult(`Estimated delivery window for PIN code ${clean}: ${dateStr}. Courier serviceability and final delivery promise are confirmed at checkout.`);
  };

  const handleAddToCart = () => {
    if (!product || !inStock || (hasVariants && !selectedVariant)) return;
    addItem(product, quantity, selectedVariant);
    setAddedToast(true);
    setTimeout(() => setAddedToast(false), 3000);
  };

  const handleBuyNow = () => {
    if (!product || !inStock || (hasVariants && !selectedVariant)) return;
    addItem(product, quantity, selectedVariant);
    navigate('/checkout');
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: product?.name || 'SARINE Jewellery',
        url: window.location.href
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      setShareToast(true);
      setTimeout(() => setShareToast(false), 3000);
    }
  };

  const handleReviewImageSelection = (files: FileList | null) => {
    const selected = Array.from(files || []);
    if (!selected.length) return;
    if (selected.some(file => !["image/jpeg", "image/png", "image/webp"].includes(file.type))) {
      setReviewError("Product photos must be JPEG, PNG or WebP images.");
      return;
    }

    // Add newly selected photos instead of replacing the previous selection.
    // Customers can choose photos in multiple passes, up to the three-photo limit.
    const additions = selected.filter(file =>
      !newReviewImages.some(existing =>
        existing.name === file.name && existing.size === file.size && existing.lastModified === file.lastModified
      )
    );
    if (newReviewImages.length + additions.length > 3) {
      setReviewError("You can attach up to 3 product photos. Remove a photo before adding another.");
      return;
    }
    setNewReviewImages(current => [...current, ...additions]);
    setNewReviewImagePreviews(current => [...current, ...additions.map(file => URL.createObjectURL(file))]);
    setReviewError("");
  };

  const handleAddReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    setReviewSubmitting(true); setReviewError(""); setReviewMessage("");
    try {
      const imageIds = await Promise.all(newReviewImages.map(file => hostingerStorefrontService.uploadReviewImage(file)));
      const result = await hostingerStorefrontService.submitReview(product.id, {
        name: newReviewName.trim(), email: newReviewEmail.trim(), orderNumber: newReviewOrderNumber.trim(),
        rating: newReviewRating, title: newReviewTitle.trim(), comment: newReviewComment.trim(), imageIds
      });
      setReviewMessage(result.message);
      setNewReviewName(''); setNewReviewEmail(''); setNewReviewOrderNumber('');
      setNewReviewTitle(''); setNewReviewComment('');
      newReviewImagePreviews.forEach(url => URL.revokeObjectURL(url));
      setNewReviewImages([]); setNewReviewImagePreviews([]);
      setIsReviewModalOpen(false);
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : "Your review could not be submitted.");
    } finally { setReviewSubmitting(false); }
  };

  const resolvedImages = useMemo<string[]>(() => {
    if (!product) return [];
    if (product.slug === 'ananya-temple-coin-bracelet' || product.id === 'prod-003') {
      return ['/images/optimized/ananya-temple-coin-bracelet.webp', '/src/assets/images/temple_coin_bracelet_1792768038164.jpg'];
    }
    if (product.slug === 'zoya-open-cuff-leaf-bangle' || product.id === 'prod-008') {
      return ['/images/optimized/zoya-open-cuff-leaf-bangle.webp', '/src/assets/images/zoya_leaf_bangle_1792768482264.jpg'];
    }
    return product.images && product.images.length > 0
      ? product.images
      : ['https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=800&q=80'];
  }, [product]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--white)] flex items-center justify-center p-8">
        <div className="text-center font-sans">
          <div className="w-8 h-8 border-2 border-[var(--plum)] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="font-serif text-lg text-[color:var(--body)]">Preparing piece details...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-[var(--white)] flex items-center justify-center p-8">
        <div className="text-center max-w-md bg-white p-8 border border-[var(--border)] rounded-xs shadow-xs">
          <h2 className="font-serif text-2xl text-[color:var(--body)]">Piece Not Found</h2>
          <p className="text-xs text-[color:var(--body)] mt-2 leading-relaxed">
            This jewellery item might have been archived or moved to our private atelier collections.
          </p>
          <Link
            to="/shop"
            className="mt-6 inline-block px-6 py-2.5 bg-[var(--plum)] text-[color:var(--white)] text-xs uppercase tracking-wider font-medium rounded-xs hover:bg-[var(--gold)] transition-colors"
          >
            Explore Catalogue
          </Link>
        </div>
      </div>
    );
  }

  const hasVariants = Boolean(product.variants?.length);
  const selectedVariant = product.variants?.find((variant) => variant.id === selectedVariantId);
  const currentPrice = selectedVariant?.price ?? product.price;
  const currentCompareAtPrice = selectedVariant
    ? (selectedVariant.compareAtPrice ?? (selectedVariant.price == null ? product.compareAtPrice : undefined))
    : product.compareAtPrice;
  const maxStock = selectedVariant?.stock ?? product.stock;
  const inStock = hasVariants ? Boolean(selectedVariant && selectedVariant.stock > 0) : isInStock(product);
  const discountPercent = currentCompareAtPrice && currentCompareAtPrice > currentPrice
    ? Math.floor(((currentCompareAtPrice - currentPrice) / currentCompareAtPrice) * 100)
    : null;
  const campaignDiscount = Math.max(0, Math.min(75, storewideDiscountPercent));
  const campaignPrice = Math.max(0, currentPrice - Math.floor(currentPrice * campaignDiscount / 100));
  const wishlisted = isInWishlist(product.id);

  return (
    <div className="min-h-screen bg-[var(--white)] pb-20 text-[color:var(--body)] font-sans">
      {/* JSON-LD Structured Data for Search Engines */}
      <script type="application/ld+json">
        {JSON.stringify({
          '@context': 'https://schema.org/',
          '@type': 'Product',
          name: product.name,
          image: resolvedImages,
          description: product.shortDescription || product.description,
          sku: selectedVariant?.sku || product.id,
          offers: {
            '@type': 'Offer',
            priceCurrency: 'INR',
            price: campaignPrice,
            availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock'
          }
        })}
      </script>

      {/* Breadcrumb Navigation */}
      <div className="bg-white border-b border-[var(--border)] py-3">
        <div className="site-container flex items-center justify-between text-xs text-[color:var(--body)]">
          <div className="flex items-center gap-2">
            <Link to="/" className="hover:text-[color:var(--plum)]">Home</Link>
            <span className="text-[color:var(--border)]">/</span>
            <Link to="/shop" className="hover:text-[color:var(--plum)]">Catalogue</Link>
            {category && (
              <>
                <span className="text-[color:var(--border)]">/</span>
                <Link to={`/shop?category=${category.slug}`} className="hover:text-[color:var(--plum)]">
                  {category.name}
                </Link>
              </>
            )}
            <span className="text-[color:var(--border)]">/</span>
            <span className="text-[color:var(--heading)] font-medium truncate max-w-[200px] sm:max-w-xs">
              {product.name}
            </span>
          </div>

          <button
            onClick={handleShare}
            className="inline-flex items-center gap-1.5 text-xs text-[color:var(--plum)] hover:text-[color:var(--gold)] cursor-pointer"
            title="Share piece"
          >
            <Share2 size={13} />
            <span className="hidden sm:inline">Share</span>
          </button>
        </div>
      </div>

      {/* Main PDP Grid */}
      <div className="site-container pt-8 sm:pt-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-start">
          {/* Left Column: Image Gallery (7 cols) */}
          <div className="lg:col-span-7 flex flex-col-reverse sm:flex-row gap-4">
            {/* Vertical Thumbnails */}
            {resolvedImages.length > 1 && (
              <div className="flex sm:flex-col gap-3 overflow-x-auto sm:overflow-y-auto sm:w-20 shrink-0">
                {resolvedImages.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImageIndex(idx)}
                    className={`aspect-[3/4] w-16 sm:w-20 bg-white border rounded-xs overflow-hidden transition-all cursor-pointer ${
                      activeImageIndex === idx ? 'border-[var(--plum)] ring-1 ring-[var(--plum)]' : 'border-[var(--border)] opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt={`${product.name} thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            {/* Featured Image Display */}
            <div className="relative flex-1 aspect-[3/4] bg-white border border-[var(--border)] rounded-xs overflow-hidden group">
              <img
                src={resolvedImages[activeImageIndex] || resolvedImages[0]}
                alt={product.name}
                className="w-full h-full object-cover object-center transition-transform duration-500 ease-out group-hover:scale-105 cursor-zoom-in"
                onClick={() => setIsZoomOpen(true)}
              />

              {/* Zoom Trigger Button */}
              <button
                onClick={() => setIsZoomOpen(true)}
                className="absolute top-3 right-3 p-2 bg-[var(--white)] hover:bg-[var(--gold)] hover:text-[color:var(--white)] text-[color:var(--plum)] rounded-full border border-[var(--border)] shadow-2xs backdrop-blur-xs cursor-pointer"
                title="Fullscreen Zoom"
              >
                <Maximize2 size={15} />
              </button>

              {/* Discount Tag */}
              {campaignDiscount > 0 && <div className="absolute top-3 left-3 bg-[var(--rose)] text-[color:var(--white)] text-[11px] font-sans font-semibold px-2.5 py-1 rounded-xs">{campaignDiscount}% SALE OFF</div>}
              {discountPercent && <div className={campaignDiscount > 0 ? "absolute top-11 left-3 bg-[var(--rose)] text-[color:var(--white)] text-[11px] font-sans font-medium px-2.5 py-1 rounded-xs" : "absolute top-3 left-3 bg-[var(--rose)] text-[color:var(--white)] text-[11px] font-sans font-medium px-2.5 py-1 rounded-xs"}>{discountPercent}% OFF</div>}
            </div>
          </div>

          {product.productVideoUrl && (
            <div className="mt-4 overflow-hidden rounded-xl border border-[var(--border)] bg-white">
              <div className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-[color:var(--plum)]">See the details in motion</div>
              <video controls playsInline preload="metadata" className="max-h-[520px] w-full bg-[var(--tint)] object-contain" aria-label={`Product video for ${product.name}`}>
                <source src={product.productVideoUrl} />
                Your browser does not support this product video.
              </video>
            </div>
          )}

          {/* Right Column: Contiguous Purchase & Details Module (5 cols) */}
          <div className="lg:col-span-5 bg-white p-6 sm:p-8 border border-[var(--border)] rounded-xs shadow-xs space-y-6">
            <div>
              {/* Category & Collection Tag */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] uppercase tracking-[0.25em] text-[color:var(--body)] font-medium font-sans">
                  {JEWELLERY_TYPE_LABELS[product.jewelleryType] || product.jewelleryType}
                </span>
                <span className="text-xs text-[color:var(--body)] font-mono">
                  SKU: {(selectedVariant?.sku || product.id).toUpperCase()}
                </span>
              </div>

              {/* Product Title */}
              <h1 className="font-serif text-2xl sm:text-3xl text-[color:var(--heading)] font-normal leading-snug">
                {product.name}
              </h1>
              {product.shortDescription && <p className="mt-2 text-sm leading-relaxed text-[color:var(--body)]">{product.shortDescription}</p>}
              {product.tags?.length > 0 && <div className="mt-3 flex flex-wrap gap-2" aria-label="Product tags">{product.tags.map(tag => <span key={tag} className="rounded-full border border-[var(--border)] bg-[var(--tint)] px-2.5 py-1 text-[10px] text-[color:var(--plum)]">{tag}</span>)}</div>}

              {hasVariants && (
                <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--tint)] p-3">
                  <label htmlFor="product-variant" className="block text-xs font-semibold text-[color:var(--body)] mb-2">
                    Choose {product.variants?.[0]?.option1Name || 'size / colour'}
                    {product.variants?.some(variant => variant.option2Name) ? ' and other options' : ''}
                  </label>
                  <select
                    id="product-variant"
                    value={selectedVariantId}
                    onChange={(event) => { setSelectedVariantId(event.target.value); setQuantity(1); }}
                    className={`w-full min-h-11 rounded-lg border border-[var(--border)] hover:border-[var(--gold)] px-3 text-sm focus:border-[var(--gold)] focus:outline-none ${selectedVariantId ? "bg-[var(--plum)] text-[color:var(--white)]" : "bg-[var(--white)] text-[color:var(--body)]"}`}
                  >
                    <option value="">Select an available option</option>
                    {product.variants?.map((variant) => (
                      <option key={variant.id} value={variant.id} disabled={variant.stock <= 0}>
                        {variant.label} · {variant.stock > 0 ? `${variant.stock} available` : 'Sold out'}
                      </option>
                    ))}
                  </select>
                  {selectedVariant && (
                    <p className="mt-2 text-[11px] text-[color:var(--body)]">
                      Variant SKU: <span className="font-mono">{selectedVariant.sku}</span>
                      {selectedVariant.price != null ? ' · Variant-specific price' : ' · Standard product price'}
                    </p>
                  )}
                </div>
              )}

              {/* Customer Rating snippet */}
              {reviewCount > 0 && (
                <div className="flex items-center gap-2 mt-2.5 text-xs text-[color:var(--body)]" aria-label={`Customer rating ${reviewAverage.toFixed(1)} out of 5`}>
                  <div className="flex items-center text-[color:var(--gold)]" aria-hidden="true">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} size={14} className="fill-[var(--gold)] text-[color:var(--gold)]" />
                    ))}
                  </div>
                  <span className="font-medium text-[color:var(--body)]">{reviewAverage.toFixed(1)}/5</span>
                </div>
              )}

              {/* Pricing Display */}
              <div className="mt-4 pt-4 border-t border-[var(--border)] flex items-baseline gap-3">
                <span className="font-serif text-3xl font-medium text-[color:var(--plum)]">
                  {formatInr(campaignPrice)}
                </span>
                {campaignDiscount > 0 && <span className="text-sm text-[color:var(--muted)] line-through font-sans">{formatInr(currentPrice)}</span>}
                {currentCompareAtPrice && (
                  <span className="text-sm text-[color:var(--muted)] line-through font-sans">
                    {formatInr(currentCompareAtPrice)}
                  </span>
                )}
                {campaignDiscount > 0 && <span className="text-xs text-[color:var(--white)] font-medium bg-[var(--rose)] px-2 py-0.5 rounded-xs border border-[var(--rose)]">Save {formatInr(currentPrice - campaignPrice)} in sale</span>}
                {discountPercent && <span className="text-xs text-[color:var(--white)] font-medium bg-[var(--rose)] px-2 py-0.5 rounded-xs border border-[var(--rose)]">Save {formatInr(currentCompareAtPrice! - currentPrice)}</span>}
              </div>
              <p className="text-[11px] text-[color:var(--body)] mt-1">Inclusive of all taxes. {checkoutConfig.shippingFlatFee === 0 ? 'Complimentary shipping on all orders.' : `Shipping ${formatInr(checkoutConfig.shippingFlatFee)}; free on orders of ${formatInr(checkoutConfig.freeShippingThreshold)} or more.`}</p>
            </div>

            {/* Size Guide Trigger (for rings/bracelets) */}
            {(product.jewelleryType === 'ring' || product.jewelleryType === 'bracelet' || product.jewelleryType === 'necklace' || product.jewelleryType === 'anklet' || product.jewelleryType === 'earrings' || product.jewelleryType === 'set') && (
              <div className="pt-2 flex items-center justify-between text-xs">
                <span className="text-[color:var(--body)]">Find your best fit</span>
                <button
                  type="button"
                  onClick={() => setIsSizeGuideOpen(true)}
                  className="text-[color:var(--plum)] hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
                >
                  <HelpCircle size={13} />
                  <span>Size & Measurement Guide</span>
                </button>
              </div>
            )}

            {/* Quantity Stepper & Stock Notice */}
            <div className="pt-3 border-t border-[var(--border)]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs uppercase tracking-wider text-[color:var(--body)] font-medium">
                  Quantity
                </span>
                <span className={`text-xs font-medium ${inStock ? 'text-emerald-700' : 'text-[#DC2626]'}`}>
                  {hasVariants && !selectedVariant ? 'Choose your option' : inStock ? 'In Stock — Ready to dispatch' : 'Awaiting Atelier Crafting'}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center border border-[var(--border)] bg-[var(--tint)] rounded-xs">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={quantity <= 1 || !inStock}
                    className="w-9 h-9 flex items-center justify-center text-sm text-[color:var(--body)] hover:bg-white disabled:opacity-30 transition-colors"
                  >
                    -
                  </button>
                  <span className="w-10 text-center text-xs font-semibold text-[color:var(--body)]">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.min(maxStock, q + 1))}
                    disabled={quantity >= maxStock || !inStock}
                    className="w-9 h-9 flex items-center justify-center text-sm text-[color:var(--body)] hover:bg-white disabled:opacity-30 transition-colors"
                  >
                    +
                  </button>
                </div>

                {/* Primary Actions: Add to Bag & Buy Now */}
                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={!inStock}
                  className="flex-1 py-3 px-4 bg-[var(--plum)] text-[color:var(--white)] hover:bg-[var(--gold)] active:bg-[var(--plum-dark)] disabled:bg-[var(--muted)] text-xs uppercase tracking-[0.2em] font-medium rounded-xs transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                >
                  <ShoppingBag size={15} />
                  <span>{hasVariants && !selectedVariant ? 'Choose Option' : inStock ? 'Add to Bag' : 'Sold Out'}</span>
                </button>

                {/* Wishlist toggle */}
                <button
                  type="button"
                  onClick={() => toggleWishlist(product)}
                  className={`p-3 border ${wishlisted ? "border-[var(--rose)] bg-[var(--rose)]" : "border-[var(--plum)] bg-[var(--white)]"} hover:border-[var(--gold)] rounded-xs transition-colors cursor-pointer`}
                  title={wishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
                >
                  <Heart
                    size={16}
                    className={wishlisted ? 'fill-[var(--white)] text-[color:var(--white)]' : 'text-[color:var(--plum)]'}
                  />
                </button>
              </div>

              {inStock && (
                <button
                  type="button"
                  onClick={handleBuyNow}
                  className="w-full mt-3 py-3 bg-[var(--plum)] hover:bg-[var(--gold)] active:bg-[var(--plum-dark)] text-[color:var(--white)] text-xs uppercase tracking-[0.2em] font-medium rounded-xs transition-colors shadow-xs cursor-pointer"
                >
                  Buy Now with Express Checkout
                </button>
              )}
            </div>

            {/* Gifting Checkbox Option */}
            <div className="pt-3 border-t border-[var(--border)]">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isGiftOrder}
                  onChange={(e) => setIsGiftOrder(e.target.checked)}
                  className="mt-0.5 accent-[var(--plum)] rounded-xs cursor-pointer"
                />
                <div className="text-xs">
                  <span className="font-medium text-[color:var(--body)] flex items-center gap-1.5">
                    <Gift size={13} className="text-[color:var(--plum)]" />
                    <span>Send as a Gift (Complimentary Gift Packaging)</span>
                  </span>
                  <p className="text-[11px] text-[color:var(--body)] mt-0.5 leading-snug">
                    Includes our signature hardbound gift box, ribbon tie, and personalised message card.
                  </p>
                </div>
              </label>

              {isGiftOrder && (
                <div className="mt-3 pl-6">
                  <textarea
                    value={giftMessage}
                    onChange={(e) => setGiftMessage(e.target.value.slice(0, 200))}
                    placeholder="Write your heartfelt gift message here (max 200 characters)..."
                    rows={2}
                    className="w-full p-2.5 text-xs bg-[var(--tint)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xs focus:outline-none resize-none"
                  />
                  <div className="text-right text-[10px] text-[color:var(--body)] mt-1">
                    {giftMessage.length} / 200 characters
                  </div>
                </div>
              )}
            </div>

            {/* Pincode Serviceability Checker */}
            <div className="pt-3 border-t border-[var(--border)]">
              <span className="text-xs uppercase tracking-wider text-[color:var(--body)] font-medium flex items-center gap-1.5 mb-2">
                <MapPin size={13} className="text-[color:var(--plum)]" />
                <span>Delivery & Serviceability Check</span>
              </span>
              <form onSubmit={handleCheckPincode} className="flex gap-2">
                <input
                  type="text"
                  maxLength={6}
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter 6-digit PIN code"
                  className="flex-1 p-2 bg-[var(--tint)] border border-[var(--border)] text-xs text-[color:var(--body)] rounded-xs focus:outline-none focus:border-[var(--plum)]"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-white border border-[var(--plum)] text-[color:var(--plum)] hover:bg-[var(--tint)] text-xs font-medium rounded-xs transition-colors cursor-pointer"
                >
                  Verify PIN
                </button>
              </form>

              {pincodeResult && (
                <p className="text-xs text-emerald-700 mt-2 flex items-center gap-1.5">
                  <CheckCircle2 size={13} />
                  <span>{pincodeResult}</span>
                </p>
              )}
              {pincodeError && (
                <p className="text-xs text-[#DC2626] mt-2">
                  {pincodeError}
                </p>
              )}
            </div>

            {/* Reassurance Grid */}
            <div className="pt-4 border-t border-[var(--border)] grid grid-cols-2 gap-3 text-xs text-[color:var(--body)]">
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-[color:var(--plum)] shrink-0" />
                <span>100% Certified Quality</span>
              </div>
              <div className="flex items-center gap-2">
                <Truck size={16} className="text-[color:var(--plum)] shrink-0" />
                <span>Insured Pan-India Transit</span>
              </div>
              <div className="flex items-center gap-2">
                <RotateCcw size={16} className="text-[color:var(--plum)] shrink-0" />
                <span>Easy 7-Day Replacements</span>
              </div>
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-[color:var(--plum)] shrink-0" />
                <span>Luxury Presentation Box</span>
              </div>
            </div>
          </div>
        </div>

        {/* Specifications & Care Tabs Accordion */}
        <div className="mt-14 bg-white border border-[var(--border)] rounded-xs overflow-hidden">
          {/* Tab Navigation */}
          <div className="flex border-b border-[var(--border)] bg-[var(--tint)] text-xs sm:text-sm font-medium">
            <button
              onClick={() => setActiveTab('details')}
              className={`py-3.5 px-6 transition-colors border-b-2 cursor-pointer ${
                activeTab === 'details'
                  ? 'border-[var(--gold)] text-[color:var(--heading)] bg-[var(--white)] font-semibold'
                  : 'border-transparent text-[color:var(--body)] hover:text-[color:var(--body)]'
              }`}
            >
              Craftsmanship & Details
            </button>
            <button
              onClick={() => setActiveTab('care')}
              className={`py-3.5 px-6 transition-colors border-b-2 cursor-pointer ${
                activeTab === 'care'
                  ? 'border-[var(--gold)] text-[color:var(--heading)] bg-[var(--white)] font-semibold'
                  : 'border-transparent text-[color:var(--body)] hover:text-[color:var(--body)]'
              }`}
            >
              Care & Longevity Guide
            </button>
            <button
              onClick={() => setActiveTab('shipping')}
              className={`py-3.5 px-6 transition-colors border-b-2 cursor-pointer ${
                activeTab === 'shipping'
                  ? 'border-[var(--gold)] text-[color:var(--heading)] bg-[var(--white)] font-semibold'
                  : 'border-transparent text-[color:var(--body)] hover:text-[color:var(--body)]'
              }`}
            >
              Shipping & Authenticity
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-6 sm:p-8 text-xs sm:text-sm text-[color:var(--body)] leading-relaxed">
            {activeTab === 'details' && (
              <div className="space-y-4">
                {product.description && <p className="whitespace-pre-line text-[color:var(--body)]">{product.description}</p>}
                {[
                  ['Base Metal', product.baseMetal],
                  ['Plating / Finish', product.platingFinish],
                  ['Stones & Embellishments', product.stoneType],
                  ['Closure / Fastening', product.closureType]
                ].filter(([, value]) => Boolean(value)).length > 0 && (
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-8 pt-4 border-t border-[var(--border)]">
                    {[
                      ['Base Metal', product.baseMetal],
                      ['Plating / Finish', product.platingFinish],
                      ['Stones & Embellishments', product.stoneType],
                      ['Closure / Fastening', product.closureType]
                    ].filter(([, value]) => Boolean(value)).map(([label, value]) => (
                      <div key={label} className="flex justify-between gap-4 py-2 border-b border-[var(--border)]">
                        <dt className="text-[color:var(--body)]">{label}</dt>
                        <dd className="text-right font-medium text-[color:var(--body)]">{value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                {!product.description && !product.baseMetal && !product.platingFinish && !product.stoneType && !product.closureType && <p>Product specifications will be added soon.</p>}
              </div>
            )}

            {activeTab === 'care' && (
              <div className="space-y-3">
                <h4 className="font-serif text-base text-[color:var(--heading)]">Maintaining Your SARINE Pieces</h4>
                {product.careInstructions?.length ? (
                  <ul className="list-disc pl-5 space-y-2 text-[color:var(--body)]">{product.careInstructions.map((instruction, index) => <li key={index}>{instruction}</li>)}</ul>
                ) : (
                  <p className="text-[color:var(--body)]">Care guidance for this piece has not been added yet. As a general precaution, keep jewellery dry, avoid direct contact with perfumes and cosmetics, and store it separately in a soft pouch.</p>
                )}
              </div>
            )}

            {activeTab === 'shipping' && (
              <div className="space-y-3">
                <h4 className="font-serif text-base text-[color:var(--heading)]">Authenticity Guarantee & Delivery Timeline</h4>
                <p>
                  Every SARINE piece undergoes stringent quality checks to ensure premium polish, sturdy prongs, and skin-friendly hypoallergenic finishes.
                </p>
                <p>
                  • Orders are prepared for dispatch after confirmation. Processing and courier transit times may vary by destination and product availability.
                </p>
                <p>
                  • Use the Track Order page to view the latest shipment status once courier tracking details are available.
                </p>
              </div>
            )}
          </div>
        </div>

        {reviewMessage && <p role="status" className="mt-4 text-sm text-emerald-700">{reviewMessage}</p>}
        {/* Customer Reviews Section */}
        <section id="reviews" className="mt-14 bg-white p-6 sm:p-10 border border-[var(--border)] rounded-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[var(--border)]">
            <div>
              <span className="text-[10px] uppercase tracking-[0.25em] text-[color:var(--body)] font-medium block">
                AUTHENTIC SOCIAL PROOF
              </span>
              <h2 className="font-serif text-2xl text-[color:var(--heading)] font-normal mt-0.5">
                Customer Reviews ({reviewCount})
              </h2>
            </div>

            <button
              onClick={() => setIsReviewModalOpen(true)}
              className="px-5 py-2.5 bg-[var(--plum)] text-[color:var(--white)] hover:bg-[var(--gold)] text-xs font-medium rounded-xs transition-colors cursor-pointer self-start sm:self-auto"
            >
              Write a Review
            </button>
          </div>

          {/* Review List */}
          <div className="divide-y divide-[var(--border)]">
            {reviews.length === 0 && <p className="py-6 text-sm text-[color:var(--body)]">No approved reviews yet. If you have received this piece, share your experience after delivery.</p>}
            {reviews.map((rev) => (
              <div key={rev.id} className="py-6 first:pt-4 last:pb-0 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-xs sm:text-sm text-[color:var(--body)]">{rev.name}</span>
                    {rev.verified && (
                      <span className="text-[10px] px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xs">
                        Verified Purchase
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-[color:var(--body)]">{rev.date}</span>
                </div>

                <div className="flex items-center text-[#FFFFFF]">
                  {[...Array(rev.rating)].map((_, i) => (
                    <Star key={i} size={13} className="fill-[var(--gold)] text-[color:var(--gold)]" />
                  ))}
                </div>

                <h4 className="font-serif text-sm font-medium text-[color:var(--heading)]">{rev.title}</h4>
                <p className="text-xs sm:text-sm text-[color:var(--body)] leading-relaxed">{rev.comment}</p>
                {rev.imageUrls?.length > 0 && <div className="flex flex-wrap gap-2 pt-2">{rev.imageUrls.map((url, index) => <a key={url} href={url} target="_blank" rel="noreferrer"><img src={url} alt={`Customer photo ${index + 1} of ${product.name}`} loading="lazy" className="h-20 w-20 sm:h-24 sm:w-24 rounded-md border border-[var(--border)] object-cover" /></a>)}</div>}
              </div>
            ))}
          </div>
        </section>

        {/* Related Products Carousel / Grid */}
        {relatedProducts.length > 0 && (
          <section className="mt-16 sm:mt-20">
            <div className="flex items-center justify-between mb-6">
              <div>
                <span className="text-[10px] uppercase tracking-[0.25em] text-[color:var(--body)] font-medium block">
                  COMPLETE YOUR ATTIRE
                </span>
                <h2 className="font-serif text-xl sm:text-2xl text-[color:var(--heading)] font-normal mt-0.5">
                  Complementary Adornments
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
              {relatedProducts.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Write Review Modal */}
      {isReviewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setIsReviewModalOpen(false)}
            className="fixed inset-0 bg-[var(--heading)] backdrop-blur-xs"
          />
          <div className="relative bg-white w-full max-w-md p-6 border border-[var(--border)] rounded-xs shadow-2xl z-10 animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
              <h3 className="font-serif text-lg text-[color:var(--body)]">Review this Piece</h3>
              <button onClick={() => setIsReviewModalOpen(false)} className="text-[color:var(--body)] hover:text-[color:var(--body)]">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddReview} className="mt-4 space-y-4 text-xs font-sans">
              <div>
                <label className="block text-[color:var(--body)] mb-1">Your Rating</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      type="button"
                      key={star}
                      onClick={() => setNewReviewRating(star)}
                      className="cursor-pointer"
                    >
                      <Star
                        size={20}
                        className={star <= newReviewRating ? 'text-[color:var(--gold)] fill-[var(--gold)]' : 'text-[color:var(--border)]'}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[color:var(--body)] mb-1">Your Name</label>
                <input
                  type="text"
                  required
                  value={newReviewName}
                  onChange={(e) => setNewReviewName(e.target.value)}
                  placeholder="e.g. Radhika V."
                  className="w-full p-2 bg-[var(--tint)] border border-[var(--border)] rounded-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[color:var(--body)] mb-1">Checkout Email</label>
                <input type="email" required value={newReviewEmail} onChange={e=>setNewReviewEmail(e.target.value)} placeholder="Email used for your order" className="w-full p-2 bg-[var(--tint)] border border-[var(--border)] rounded-xs focus:outline-none" />
              </div>
              <div>
                <label className="block text-[color:var(--body)] mb-1">Order Number</label>
                <input required value={newReviewOrderNumber} onChange={e=>setNewReviewOrderNumber(e.target.value)} placeholder="e.g. SAR-000123" className="w-full p-2 bg-[var(--tint)] border border-[var(--border)] rounded-xs focus:outline-none" />
              </div>
              <div>
                <label className="block text-[color:var(--body)] mb-1">Review Headline</label>
                <input
                  type="text"
                  value={newReviewTitle}
                  onChange={(e) => setNewReviewTitle(e.target.value)}
                  placeholder="e.g. Stunning kundan detailing"
                  className="w-full p-2 bg-[var(--tint)] border border-[var(--border)] rounded-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[color:var(--body)] mb-1">Product Photos (optional, up to 3)</label>
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={reviewSubmitting || newReviewImages.length >= 3} onChange={e => { handleReviewImageSelection(e.target.files); e.currentTarget.value = ""; }} className="block w-full text-xs file:mr-3 file:rounded-md file:border-0 file:bg-[var(--tint)] file:px-3 file:py-2 file:text-xs file:text-[color:var(--plum)] disabled:opacity-50" />
                <p className="mt-1 text-[11px] text-[color:var(--body)]">Add up to 3 photos. You can select several together or use Choose Files again to add more. JPEG, PNG or WebP.</p>
                {newReviewImagePreviews.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{newReviewImagePreviews.map((url, index) => <div key={url} className="relative"><img src={url} alt={`Selected customer photo ${index + 1}`} className="h-20 w-20 rounded-md border border-[var(--border)] object-cover" /><button type="button" onClick={() => { const files = newReviewImages.filter((_, i) => i !== index); const urls = newReviewImagePreviews.filter((_, i) => i !== index); URL.revokeObjectURL(url); setNewReviewImages(files); setNewReviewImagePreviews(urls); }} className="absolute -right-2 -top-2 rounded-full bg-white border px-1.5 py-0.5 text-xs" aria-label={`Remove photo ${index + 1}`}>×</button></div>)}</div>}
              </div>

              <div>
                <label className="block text-[color:var(--body)] mb-1">Detailed Feedback</label>
                <textarea
                  required
                  rows={3}
                  value={newReviewComment}
                  onChange={(e) => setNewReviewComment(e.target.value)}
                  placeholder="Tell other jewellery lovers about the fit, finish, and comfort..."
                  className="w-full p-2 bg-[var(--tint)] border border-[var(--border)] rounded-xs focus:outline-none resize-none"
                />
              </div>

              {reviewError && <p role="alert" className="text-xs text-red-700">{reviewError}</p>}
              <p className="text-[11px] text-[color:var(--body)]">Only customers with a delivered order containing this product can submit a verified review. Reviews appear after SARINE moderation.</p>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsReviewModalOpen(false)}
                  className="px-4 py-2 border border-[var(--border)] text-[color:var(--body)] rounded-xs hover:bg-[var(--tint)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reviewSubmitting}
                  className="px-5 py-2 bg-[var(--plum)] text-[color:var(--white)] hover:bg-[var(--gold)] font-medium rounded-xs transition-colors disabled:opacity-50"
                >
                  {reviewSubmitting ? "Submitting…" : "Submit Review"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Size Guide Modal */}
      {isSizeGuideOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div onClick={() => setIsSizeGuideOpen(false)} className="fixed inset-0 bg-[var(--heading)] backdrop-blur-xs" />
          <div className="relative bg-white w-full max-w-lg p-6 border border-[var(--border)] rounded-xs shadow-2xl z-10 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
              <h3 className="font-serif text-lg text-[color:var(--body)]">Indian Jewellery Size Chart</h3>
              <button onClick={() => setIsSizeGuideOpen(false)} className="text-[color:var(--body)] hover:text-[color:var(--body)]">
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 text-xs font-sans space-y-4">
              <div>
                <h4 className="font-medium text-[color:var(--body)] mb-1.5">Standard Ring Sizes (India)</h4>
                <div className="overflow-x-auto">
                  <table className="w-full border border-[var(--border)] text-center">
                    <thead className="bg-[var(--tint)]">
                      <tr>
                        <th className="p-2 border-b border-[var(--border)]">Indian Size</th>
                        <th className="p-2 border-b border-[var(--border)]">Inside Diameter (mm)</th>
                        <th className="p-2 border-b border-[var(--border)]">Circumference (mm)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr><td className="p-1.5 border-b border-[var(--border)]">10 - 12</td><td className="p-1.5 border-b border-[var(--border)]">15.9 - 16.5</td><td className="p-1.5 border-b border-[var(--border)]">50.0 - 51.8</td></tr>
                      <tr><td className="p-1.5 border-b border-[var(--border)]">14 - 16</td><td className="p-1.5 border-b border-[var(--border)]">17.2 - 17.8</td><td className="p-1.5 border-b border-[var(--border)]">54.0 - 56.0</td></tr>
                      <tr><td className="p-1.5 border-b border-[var(--border)]">18 - 20</td><td className="p-1.5 border-b border-[var(--border)]">18.5 - 19.1</td><td className="p-1.5 border-b border-[var(--border)]">58.0 - 60.0</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-[color:var(--body)] mb-1.5">Bangle & Cuff Sizes (India)</h4>
                <div className="overflow-x-auto">
                  <table className="w-full border border-[var(--border)] text-center">
                    <thead className="bg-[var(--tint)]">
                      <tr>
                        <th className="p-2 border-b border-[var(--border)]">Bangle Size</th>
                        <th className="p-2 border-b border-[var(--border)]">Inner Diameter (Inches)</th>
                        <th className="p-2 border-b border-[var(--border)]">Fit Recommendation</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr><td className="p-1.5 border-b border-[var(--border)]">2-4</td><td className="p-1.5 border-b border-[var(--border)]">2.25"</td><td className="p-1.5 border-b border-[var(--border)]">Petite wrists</td></tr>
                      <tr><td className="p-1.5 border-b border-[var(--border)]">2-6</td><td className="p-1.5 border-b border-[var(--border)]">2.37"</td><td className="p-1.5 border-b border-[var(--border)]">Standard / Most common</td></tr>
                      <tr><td className="p-1.5 border-b border-[var(--border)]">2-8</td><td className="p-1.5 border-b border-[var(--border)]">2.50"</td><td className="p-1.5 border-b border-[var(--border)]">Relaxed comfort fit</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Zoom Modal */}
      {isZoomOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <button
            onClick={() => setIsZoomOpen(false)}
            className="absolute top-4 right-4 text-white hover:text-[var(--gold)] p-2 cursor-pointer z-20"
          >
            <X size={28} />
          </button>
          <img
            src={resolvedImages[activeImageIndex]}
            alt={product.name}
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-xs"
          />
        </div>
      )}

      {/* Added to Bag Toast */}
      {addedToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[var(--plum)] text-[color:var(--white)] px-5 py-3 rounded-xs shadow-xl flex items-center gap-3 animate-in slide-in-from-bottom duration-300">
          <CheckCircle2 size={16} className="text-[#FFFFFF]" />
          <span className="text-xs font-sans font-medium">Added to your shopping bag!</span>
          <button
            onClick={openDrawer}
            className="text-xs underline text-[#FFFFFF] hover:text-white ml-2 cursor-pointer font-medium"
          >
            View Bag
          </button>
        </div>
      )}

      {/* Share Toast */}
      {shareToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#302438] text-white px-5 py-3 rounded-xs shadow-xl flex items-center gap-2 animate-in slide-in-from-bottom duration-300">
          <CheckCircle2 size={16} className="text-[#FFFFFF]" />
          <span className="text-xs font-sans font-medium">Link copied to clipboard!</span>
        </div>
      )}
    </div>
  );
};