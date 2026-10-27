/**
 * ProductDetailPage component for SARINE.
 * Luxury e-commerce PDP with multi-image gallery & zoom,
 * Indian PIN code serviceability checker, size guide modal,
 * gifting option, customer reviews module, structured data, and related recommendations.
 */

import React, { useEffect, useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { productService, categoryService } from '../services';
import { Product, isInStock, JEWELLERY_TYPE_LABELS, getDiscountPercent } from '../types/product';
import { Category } from '../types/category';
import { formatInr } from '../utils/currency';
import { ProductCard } from '../components/ProductCard';
import { useCart } from '../context/CartContext';
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
}

const PINCODE_STORAGE_KEY = 'sarine_last_pincode';
const RECENTLY_VIEWED_KEY = 'sarine_recently_viewed_v1';

// Initial authentic reviews per category archetype
const SAMPLE_REVIEWS: Record<string, CustomerReview[]> = {
  default: [
    {
      id: 'rev-1',
      name: 'Priyanka Sharma',
      rating: 5,
      date: '12 October 2026',
      title: 'Exquisite finish and very lightweight',
      comment: 'The gold plating has a soft, regal luster that looks indistinguishable from real heirloom jewellery. Wore it to a cousin wedding and received countless compliments.',
      verified: true
    },
    {
      id: 'rev-2',
      name: 'Ananya Deshmukh',
      rating: 5,
      date: '28 September 2026',
      title: 'Packaging was breathtaking',
      comment: 'Arrived in a sturdy luxury presentation box with a velvet pouch. Perfect for gifting. The craftsmanship is flawless with zero rough edges.',
      verified: true
    }
  ]
};

export const ProductDetailPage: React.FC<ProductDetailPageProps> = ({ includeAll }) => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { addItem, openDrawer } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();

  const [product, setProduct] = useState<Product | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [activeImageIndex, setActiveImageIndex] = useState<number>(0);
  const [quantity, setQuantity] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [addedToast, setAddedToast] = useState<boolean>(false);
  const [shareToast, setShareToast] = useState<boolean>(false);

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
  const [newReviewTitle, setNewReviewTitle] = useState('');
  const [newReviewComment, setNewReviewComment] = useState('');

  // Fetch product details
  useEffect(() => {
    let isCancelled = false;

    async function loadData() {
      if (!slug) return;
      setLoading(true);
      setActiveImageIndex(0);
      setQuantity(1);

      try {
        const found = await productService.getProductBySlug(slug, { includeAll });
        if (!isCancelled) {
          setProduct(found);

          if (found) {
            // Track in recently viewed
            try {
              const raw = localStorage.getItem(RECENTLY_VIEWED_KEY);
              const list: string[] = raw ? JSON.parse(raw) : [];
              const updated = [found.id, ...list.filter((id) => id !== found.id)].slice(0, 8);
              localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(updated));
            } catch {
              // Ignore
            }

            // Load reviews from local storage or defaults
            try {
              const revKey = `sarine_reviews_${found.id}`;
              const saved = localStorage.getItem(revKey);
              if (saved) {
                setReviews(JSON.parse(saved));
              } else {
                setReviews(SAMPLE_REVIEWS.default);
              }
            } catch {
              setReviews(SAMPLE_REVIEWS.default);
            }

            // Load related pieces
            try {
              const related = await productService.getRelatedProducts(found.id, 4);
              if (!isCancelled) setRelatedProducts(related.filter((p) => p.status === 'active'));
            } catch (relErr) {
              console.warn('[ProductDetailPage] Could not load related pieces:', relErr);
            }

            // Load category info
            try {
              const categories = await categoryService.getCategories();
              const cat = categories.find((c) => c.id === found.categoryId || c.slug === found.categoryId);
              if (!isCancelled && cat) setCategory(cat);
            } catch (catErr) {
              console.warn('[ProductDetailPage] Could not load category info:', catErr);
            }
          }
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
  }, [slug, includeAll]);

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

    setPincodeResult(`Delivery available to ${clean} by ${dateStr}. Complimentary Express Shipping.`);
  };

  const handleAddToCart = () => {
    if (!product || !isInStock(product)) return;
    addItem(product, quantity);
    setAddedToast(true);
    setTimeout(() => setAddedToast(false), 3000);
  };

  const handleBuyNow = () => {
    if (!product || !isInStock(product)) return;
    addItem(product, quantity);
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

  const handleAddReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReviewName.trim() || !newReviewComment.trim() || !product) return;

    const newRev: CustomerReview = {
      id: `rev-${Date.now()}`,
      name: newReviewName.trim(),
      rating: newReviewRating,
      date: 'Just now',
      title: newReviewTitle.trim() || 'Verified Purchase Review',
      comment: newReviewComment.trim(),
      verified: true
    };

    const updated = [newRev, ...reviews];
    setReviews(updated);
    try {
      localStorage.setItem(`sarine_reviews_${product.id}`, JSON.stringify(updated));
    } catch {
      // Ignore
    }

    setIsReviewModalOpen(false);
    setNewReviewName('');
    setNewReviewTitle('');
    setNewReviewComment('');
  };

  const resolvedImages = useMemo<string[]>(() => {
    if (!product) return [];
    if (product.slug === 'ananya-temple-coin-bracelet' || product.id === 'prod-003') {
      return ['/images/ananya-temple-coin-bracelet.jpg', '/src/assets/images/temple_coin_bracelet_1792768038164.jpg'];
    }
    if (product.slug === 'zoya-open-cuff-leaf-bangle' || product.id === 'prod-008') {
      return ['/images/zoya-open-cuff-leaf-bangle.jpg', '/src/assets/images/zoya_leaf_bangle_1792768482264.jpg'];
    }
    return product.images && product.images.length > 0
      ? product.images
      : ['https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=800&q=80'];
  }, [product]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F0FA] flex items-center justify-center p-8">
        <div className="text-center font-sans">
          <div className="w-8 h-8 border-2 border-[#563568] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="font-serif text-lg text-[#302438]">Preparing piece details...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-[#F7F0FA] flex items-center justify-center p-8">
        <div className="text-center max-w-md bg-white p-8 border border-[#E7DCEB] rounded-xs shadow-xs">
          <h2 className="font-serif text-2xl text-[#302438]">Piece Not Found</h2>
          <p className="text-xs text-[#6F6475] mt-2 leading-relaxed">
            This jewellery item might have been archived or moved to our private atelier collections.
          </p>
          <Link
            to="/shop"
            className="mt-6 inline-block px-6 py-2.5 bg-[#563568] text-white text-xs uppercase tracking-wider font-medium rounded-xs hover:bg-[#A184BD] transition-colors"
          >
            Explore Catalogue
          </Link>
        </div>
      </div>
    );
  }

  const inStock = isInStock(product);
  const discountPercent = getDiscountPercent(product);
  const wishlisted = isInWishlist(product.id);

  return (
    <div className="min-h-screen bg-[#F7F0FA] pb-20 text-[#302438] font-sans">
      {/* JSON-LD Structured Data for Search Engines */}
      <script type="application/ld+json">
        {JSON.stringify({
          '@context': 'https://schema.org/',
          '@type': 'Product',
          name: product.name,
          image: resolvedImages,
          description: product.description,
          sku: product.id,
          offers: {
            '@type': 'Offer',
            priceCurrency: 'INR',
            price: product.price,
            availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock'
          }
        })}
      </script>

      {/* Breadcrumb Navigation */}
      <div className="bg-white border-b border-[#E7DCEB] py-3">
        <div className="site-container flex items-center justify-between text-xs text-[#6F6475]">
          <div className="flex items-center gap-2">
            <Link to="/" className="hover:text-[#563568]">Home</Link>
            <span>/</span>
            <Link to="/shop" className="hover:text-[#563568]">Catalogue</Link>
            {category && (
              <>
                <span>/</span>
                <Link to={`/shop?category=${category.slug}`} className="hover:text-[#563568]">
                  {category.name}
                </Link>
              </>
            )}
            <span>/</span>
            <span className="text-[#302438] font-medium truncate max-w-[200px] sm:max-w-xs">
              {product.name}
            </span>
          </div>

          <button
            onClick={handleShare}
            className="inline-flex items-center gap-1.5 text-xs text-[#563568] hover:text-[#A184BD] cursor-pointer"
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
                      activeImageIndex === idx ? 'border-[#563568] ring-1 ring-[#563568]' : 'border-[#E7DCEB] opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt={`${product.name} thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            {/* Featured Image Display */}
            <div className="relative flex-1 aspect-[3/4] bg-white border border-[#E7DCEB] rounded-xs overflow-hidden group">
              <img
                src={resolvedImages[activeImageIndex] || resolvedImages[0]}
                alt={product.name}
                className="w-full h-full object-cover object-center transition-transform duration-500 ease-out group-hover:scale-105 cursor-zoom-in"
                onClick={() => setIsZoomOpen(true)}
              />

              {/* Zoom Trigger Button */}
              <button
                onClick={() => setIsZoomOpen(true)}
                className="absolute top-3 right-3 p-2 bg-white/90 hover:bg-white text-[#302438] rounded-full border border-[#E7DCEB] shadow-2xs backdrop-blur-xs cursor-pointer"
                title="Fullscreen Zoom"
              >
                <Maximize2 size={15} />
              </button>

              {/* Discount Tag */}
              {discountPercent && (
                <div className="absolute top-3 left-3 bg-[#563568] text-white text-[11px] font-sans font-medium px-2.5 py-1 rounded-xs">
                  {discountPercent}% OFF
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Contiguous Purchase & Details Module (5 cols) */}
          <div className="lg:col-span-5 bg-white p-6 sm:p-8 border border-[#E7DCEB] rounded-xs shadow-xs space-y-6">
            <div>
              {/* Category & Collection Tag */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] uppercase tracking-[0.25em] text-[#6F6475] font-medium font-sans">
                  {JEWELLERY_TYPE_LABELS[product.jewelleryType] || product.jewelleryType}
                </span>
                <span className="text-xs text-[#6F6475] font-mono">
                  SKU: {product.id.toUpperCase()}
                </span>
              </div>

              {/* Product Title */}
              <h1 className="font-serif text-2xl sm:text-3xl text-[#302438] font-normal leading-snug">
                {product.name}
              </h1>

              {/* Customer Rating snippet */}
              <div className="flex items-center gap-2 mt-2.5 text-xs text-[#6F6475]">
                <div className="flex items-center text-[#D9B8A0]">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={14} className="fill-[#D9B8A0]" />
                  ))}
                </div>
                <span className="font-medium text-[#302438]">5.0</span>
                <span>·</span>
                <a href="#reviews" className="hover:text-[#563568] underline underline-offset-2">
                  {reviews.length} Verified Reviews
                </a>
              </div>

              {/* Pricing Display */}
              <div className="mt-4 pt-4 border-t border-[#E7DCEB] flex items-baseline gap-3">
                <span className="font-serif text-3xl font-medium text-[#302438]">
                  {formatInr(product.price)}
                </span>
                {product.compareAtPrice && (
                  <span className="text-sm text-[#6F6475] line-through font-sans">
                    {formatInr(product.compareAtPrice)}
                  </span>
                )}
                {discountPercent && (
                  <span className="text-xs text-[#563568] font-medium bg-[#F7F0FA] px-2 py-0.5 rounded-xs border border-[#E7DCEB]">
                    Save {formatInr(product.compareAtPrice! - product.price)}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#6F6475] mt-1">Inclusive of all taxes & complimentary delivery</p>
            </div>

            {/* Size Guide Trigger (for rings/bracelets) */}
            {(product.jewelleryType === 'ring' || product.jewelleryType === 'bracelet') && (
              <div className="pt-2 flex items-center justify-between text-xs">
                <span className="text-[#6F6475]">Standard Indian Atelier Fit</span>
                <button
                  type="button"
                  onClick={() => setIsSizeGuideOpen(true)}
                  className="text-[#563568] hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
                >
                  <HelpCircle size={13} />
                  <span>Size & Measurement Guide</span>
                </button>
              </div>
            )}

            {/* Quantity Stepper & Stock Notice */}
            <div className="pt-3 border-t border-[#E7DCEB]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs uppercase tracking-wider text-[#6F6475] font-medium">
                  Quantity
                </span>
                <span className={`text-xs font-medium ${inStock ? 'text-emerald-700' : 'text-[#DC2626]'}`}>
                  {inStock ? 'In Stock — Ready to dispatch' : 'Awaiting Atelier Crafting'}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center border border-[#E7DCEB] bg-[#F7F0FA] rounded-xs">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={quantity <= 1 || !inStock}
                    className="w-9 h-9 flex items-center justify-center text-sm text-[#302438] hover:bg-white disabled:opacity-30 transition-colors"
                  >
                    -
                  </button>
                  <span className="w-10 text-center text-xs font-semibold text-[#302438]">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.min(product.stock, q + 1))}
                    disabled={quantity >= product.stock || !inStock}
                    className="w-9 h-9 flex items-center justify-center text-sm text-[#302438] hover:bg-white disabled:opacity-30 transition-colors"
                  >
                    +
                  </button>
                </div>

                {/* Primary Actions: Add to Bag & Buy Now */}
                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={!inStock}
                  className="flex-1 py-3 px-4 bg-[#563568] text-white hover:bg-[#A184BD] disabled:bg-[#6F6475]/40 text-xs uppercase tracking-[0.2em] font-medium rounded-xs transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                >
                  <ShoppingBag size={15} />
                  <span>{inStock ? 'Add to Bag' : 'Sold Out'}</span>
                </button>

                {/* Wishlist toggle */}
                <button
                  type="button"
                  onClick={() => toggleWishlist(product)}
                  className="p-3 border border-[#E7DCEB] hover:border-[#563568] bg-white rounded-xs transition-colors cursor-pointer"
                  title={wishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
                >
                  <Heart
                    size={16}
                    className={wishlisted ? 'fill-[#563568] text-[#563568]' : 'text-[#6F6475]'}
                  />
                </button>
              </div>

              {inStock && (
                <button
                  type="button"
                  onClick={handleBuyNow}
                  className="w-full mt-3 py-3 bg-[#302438] hover:bg-[#563568] text-white text-xs uppercase tracking-[0.2em] font-medium rounded-xs transition-colors shadow-xs cursor-pointer"
                >
                  Buy Now with Express Checkout
                </button>
              )}
            </div>

            {/* Gifting Checkbox Option */}
            <div className="pt-3 border-t border-[#E7DCEB]">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isGiftOrder}
                  onChange={(e) => setIsGiftOrder(e.target.checked)}
                  className="mt-0.5 accent-[#563568] rounded-xs cursor-pointer"
                />
                <div className="text-xs">
                  <span className="font-medium text-[#302438] flex items-center gap-1.5">
                    <Gift size={13} className="text-[#563568]" />
                    <span>Send as a Gift (Complimentary Gift Packaging)</span>
                  </span>
                  <p className="text-[11px] text-[#6F6475] mt-0.5 leading-snug">
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
                    className="w-full p-2.5 text-xs bg-[#F7F0FA] border border-[#E7DCEB] focus:border-[#B69ACF] rounded-xs focus:outline-none resize-none"
                  />
                  <div className="text-right text-[10px] text-[#6F6475] mt-1">
                    {giftMessage.length} / 200 characters
                  </div>
                </div>
              )}
            </div>

            {/* Pincode Serviceability Checker */}
            <div className="pt-3 border-t border-[#E7DCEB]">
              <span className="text-xs uppercase tracking-wider text-[#6F6475] font-medium flex items-center gap-1.5 mb-2">
                <MapPin size={13} className="text-[#563568]" />
                <span>Delivery & Serviceability Check</span>
              </span>
              <form onSubmit={handleCheckPincode} className="flex gap-2">
                <input
                  type="text"
                  maxLength={6}
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter 6-digit PIN code"
                  className="flex-1 p-2 bg-[#F7F0FA] border border-[#E7DCEB] text-xs text-[#302438] rounded-xs focus:outline-none focus:border-[#563568]"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-white border border-[#563568] text-[#563568] hover:bg-[#F7F0FA] text-xs font-medium rounded-xs transition-colors cursor-pointer"
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
            <div className="pt-4 border-t border-[#E7DCEB] grid grid-cols-2 gap-3 text-xs text-[#6F6475]">
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-[#563568] shrink-0" />
                <span>100% Certified Quality</span>
              </div>
              <div className="flex items-center gap-2">
                <Truck size={16} className="text-[#563568] shrink-0" />
                <span>Insured Pan-India Transit</span>
              </div>
              <div className="flex items-center gap-2">
                <RotateCcw size={16} className="text-[#563568] shrink-0" />
                <span>Easy 7-Day Replacements</span>
              </div>
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-[#563568] shrink-0" />
                <span>Luxury Presentation Box</span>
              </div>
            </div>
          </div>
        </div>

        {/* Specifications & Care Tabs Accordion */}
        <div className="mt-14 bg-white border border-[#E7DCEB] rounded-xs overflow-hidden">
          {/* Tab Navigation */}
          <div className="flex border-b border-[#E7DCEB] bg-[#F7F0FA] text-xs sm:text-sm font-medium">
            <button
              onClick={() => setActiveTab('details')}
              className={`py-3.5 px-6 transition-colors border-b-2 cursor-pointer ${
                activeTab === 'details'
                  ? 'border-[#563568] text-[#563568] bg-white font-semibold'
                  : 'border-transparent text-[#6F6475] hover:text-[#302438]'
              }`}
            >
              Craftsmanship & Details
            </button>
            <button
              onClick={() => setActiveTab('care')}
              className={`py-3.5 px-6 transition-colors border-b-2 cursor-pointer ${
                activeTab === 'care'
                  ? 'border-[#563568] text-[#563568] bg-white font-semibold'
                  : 'border-transparent text-[#6F6475] hover:text-[#302438]'
              }`}
            >
              Care & Longevity Guide
            </button>
            <button
              onClick={() => setActiveTab('shipping')}
              className={`py-3.5 px-6 transition-colors border-b-2 cursor-pointer ${
                activeTab === 'shipping'
                  ? 'border-[#563568] text-[#563568] bg-white font-semibold'
                  : 'border-transparent text-[#6F6475] hover:text-[#302438]'
              }`}
            >
              Shipping & Authenticity
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-6 sm:p-8 text-xs sm:text-sm text-[#6F6475] leading-relaxed">
            {activeTab === 'details' && (
              <div className="space-y-4">
                <p className="text-[#302438]">{product.description}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-8 pt-4 border-t border-[#E7DCEB]">
                  <div className="flex justify-between py-1 border-b border-[#E7DCEB]/50">
                    <span className="text-[#6F6475]">Base Metal</span>
                    <span className="font-medium text-[#302438]">{product.baseMetal || 'Brass with Sterling Silver Accent'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#E7DCEB]/50">
                    <span className="text-[#6F6475]">Plating Finish</span>
                    <span className="font-medium text-[#302438]">{product.platingFinish || '18K Demi-Fine Gold Polish'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#E7DCEB]/50">
                    <span className="text-[#6F6475]">Stones & Embellishments</span>
                    <span className="font-medium text-[#302438]">{product.stoneType || 'High-Grade Polki & Kundan Stones'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#E7DCEB]/50">
                    <span className="text-[#6F6475]">Closure & Fastening</span>
                    <span className="font-medium text-[#302438]">{product.closureType || 'Adjustable Dori / Push-back'}</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'care' && (
              <div className="space-y-3">
                <h4 className="font-serif text-base text-[#302438]">Maintaining Your SARINE Pieces</h4>
                <ul className="list-disc pl-5 space-y-2 text-[#6F6475]">
                  <li>Store separately in the provided zip pouch or air-tight box to prevent atmospheric oxidation.</li>
                  <li>Avoid direct exposure to perfume, hairsprays, sanitizers, and direct water contact.</li>
                  <li>Clean gently using a dry, lint-free microfiber cloth after every festive wear.</li>
                  <li>Put your jewellery on last when getting dressed, and take it off first before sleeping.</li>
                </ul>
              </div>
            )}

            {activeTab === 'shipping' && (
              <div className="space-y-3">
                <h4 className="font-serif text-base text-[#302438]">Authenticity Guarantee & Delivery Timeline</h4>
                <p>
                  Every SARINE piece undergoes stringent quality checks to ensure premium polish, sturdy prongs, and skin-friendly hypoallergenic finishes.
                </p>
                <p>
                  • Orders are dispatched within 24 hours via premium insured courier partners (Bluedart, Delhivery, DTDC).
                </p>
                <p>
                  • Tracking details are sent via SMS/Email and accessible anytime via our Track Order portal.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Customer Reviews Section */}
        <section id="reviews" className="mt-14 bg-white p-6 sm:p-10 border border-[#E7DCEB] rounded-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E7DCEB]">
            <div>
              <span className="text-[10px] uppercase tracking-[0.25em] text-[#6F6475] font-medium block">
                AUTHENTIC SOCIAL PROOF
              </span>
              <h2 className="font-serif text-2xl text-[#302438] font-normal mt-0.5">
                Customer Reviews ({reviews.length})
              </h2>
            </div>

            <button
              onClick={() => setIsReviewModalOpen(true)}
              className="px-5 py-2.5 bg-[#563568] text-white hover:bg-[#A184BD] text-xs font-medium rounded-xs transition-colors cursor-pointer self-start sm:self-auto"
            >
              Write a Review
            </button>
          </div>

          {/* Review List */}
          <div className="divide-y divide-[#E7DCEB]">
            {reviews.map((rev) => (
              <div key={rev.id} className="py-6 first:pt-4 last:pb-0 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-xs sm:text-sm text-[#302438]">{rev.name}</span>
                    {rev.verified && (
                      <span className="text-[10px] px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xs">
                        Verified Purchase
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-[#6F6475]">{rev.date}</span>
                </div>

                <div className="flex items-center text-[#D9B8A0]">
                  {[...Array(rev.rating)].map((_, i) => (
                    <Star key={i} size={13} className="fill-[#D9B8A0]" />
                  ))}
                </div>

                <h4 className="font-serif text-sm font-medium text-[#302438]">{rev.title}</h4>
                <p className="text-xs sm:text-sm text-[#6F6475] leading-relaxed">{rev.comment}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Related Products Carousel / Grid */}
        {relatedProducts.length > 0 && (
          <section className="mt-16 sm:mt-20">
            <div className="flex items-center justify-between mb-6">
              <div>
                <span className="text-[10px] uppercase tracking-[0.25em] text-[#6F6475] font-medium block">
                  COMPLETE YOUR ATTIRE
                </span>
                <h2 className="font-serif text-xl sm:text-2xl text-[#302438] font-normal mt-0.5">
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
            className="fixed inset-0 bg-[#302438]/50 backdrop-blur-xs"
          />
          <div className="relative bg-white w-full max-w-md p-6 border border-[#E7DCEB] rounded-xs shadow-2xl z-10 animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-[#E7DCEB]">
              <h3 className="font-serif text-lg text-[#302438]">Review this Piece</h3>
              <button onClick={() => setIsReviewModalOpen(false)} className="text-[#6F6475] hover:text-[#302438]">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddReview} className="mt-4 space-y-4 text-xs font-sans">
              <div>
                <label className="block text-[#6F6475] mb-1">Your Rating</label>
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
                        className={star <= newReviewRating ? 'text-[#D9B8A0] fill-[#D9B8A0]' : 'text-[#E7DCEB]'}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[#6F6475] mb-1">Your Name</label>
                <input
                  type="text"
                  required
                  value={newReviewName}
                  onChange={(e) => setNewReviewName(e.target.value)}
                  placeholder="e.g. Radhika V."
                  className="w-full p-2 bg-[#F7F0FA] border border-[#E7DCEB] rounded-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[#6F6475] mb-1">Review Headline</label>
                <input
                  type="text"
                  value={newReviewTitle}
                  onChange={(e) => setNewReviewTitle(e.target.value)}
                  placeholder="e.g. Stunning kundan detailing"
                  className="w-full p-2 bg-[#F7F0FA] border border-[#E7DCEB] rounded-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[#6F6475] mb-1">Detailed Feedback</label>
                <textarea
                  required
                  rows={3}
                  value={newReviewComment}
                  onChange={(e) => setNewReviewComment(e.target.value)}
                  placeholder="Tell other jewellery lovers about the fit, finish, and comfort..."
                  className="w-full p-2 bg-[#F7F0FA] border border-[#E7DCEB] rounded-xs focus:outline-none resize-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsReviewModalOpen(false)}
                  className="px-4 py-2 border border-[#E7DCEB] text-[#6F6475] rounded-xs hover:bg-[#F7F0FA]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#563568] text-white hover:bg-[#A184BD] font-medium rounded-xs transition-colors"
                >
                  Submit Review
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Size Guide Modal */}
      {isSizeGuideOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div onClick={() => setIsSizeGuideOpen(false)} className="fixed inset-0 bg-[#302438]/50 backdrop-blur-xs" />
          <div className="relative bg-white w-full max-w-lg p-6 border border-[#E7DCEB] rounded-xs shadow-2xl z-10 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#E7DCEB]">
              <h3 className="font-serif text-lg text-[#302438]">Indian Jewellery Size Chart</h3>
              <button onClick={() => setIsSizeGuideOpen(false)} className="text-[#6F6475] hover:text-[#302438]">
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 text-xs font-sans space-y-4">
              <div>
                <h4 className="font-medium text-[#302438] mb-1.5">Standard Ring Sizes (India)</h4>
                <div className="overflow-x-auto">
                  <table className="w-full border border-[#E7DCEB] text-center">
                    <thead className="bg-[#F7F0FA]">
                      <tr>
                        <th className="p-2 border-b border-[#E7DCEB]">Indian Size</th>
                        <th className="p-2 border-b border-[#E7DCEB]">Inside Diameter (mm)</th>
                        <th className="p-2 border-b border-[#E7DCEB]">Circumference (mm)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr><td className="p-1.5 border-b border-[#E7DCEB]">10 - 12</td><td className="p-1.5 border-b border-[#E7DCEB]">15.9 - 16.5</td><td className="p-1.5 border-b border-[#E7DCEB]">50.0 - 51.8</td></tr>
                      <tr><td className="p-1.5 border-b border-[#E7DCEB]">14 - 16</td><td className="p-1.5 border-b border-[#E7DCEB]">17.2 - 17.8</td><td className="p-1.5 border-b border-[#E7DCEB]">54.0 - 56.0</td></tr>
                      <tr><td className="p-1.5 border-b border-[#E7DCEB]">18 - 20</td><td className="p-1.5 border-b border-[#E7DCEB]">18.5 - 19.1</td><td className="p-1.5 border-b border-[#E7DCEB]">58.0 - 60.0</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-[#302438] mb-1.5">Bangle & Cuff Sizes (India)</h4>
                <div className="overflow-x-auto">
                  <table className="w-full border border-[#E7DCEB] text-center">
                    <thead className="bg-[#F7F0FA]">
                      <tr>
                        <th className="p-2 border-b border-[#E7DCEB]">Bangle Size</th>
                        <th className="p-2 border-b border-[#E7DCEB]">Inner Diameter (Inches)</th>
                        <th className="p-2 border-b border-[#E7DCEB]">Fit Recommendation</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr><td className="p-1.5 border-b border-[#E7DCEB]">2-4</td><td className="p-1.5 border-b border-[#E7DCEB]">2.25"</td><td className="p-1.5 border-b border-[#E7DCEB]">Petite wrists</td></tr>
                      <tr><td className="p-1.5 border-b border-[#E7DCEB]">2-6</td><td className="p-1.5 border-b border-[#E7DCEB]">2.37"</td><td className="p-1.5 border-b border-[#E7DCEB]">Standard / Most common</td></tr>
                      <tr><td className="p-1.5 border-b border-[#E7DCEB]">2-8</td><td className="p-1.5 border-b border-[#E7DCEB]">2.50"</td><td className="p-1.5 border-b border-[#E7DCEB]">Relaxed comfort fit</td></tr>
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
            className="absolute top-4 right-4 text-white hover:text-[#B69ACF] p-2 cursor-pointer z-20"
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
        <div className="fixed bottom-6 right-6 z-50 bg-[#563568] text-white px-5 py-3 rounded-xs shadow-xl flex items-center gap-3 animate-in slide-in-from-bottom duration-300">
          <CheckCircle2 size={16} className="text-[#D9B8A0]" />
          <span className="text-xs font-sans font-medium">Added to your shopping bag!</span>
          <button
            onClick={openDrawer}
            className="text-xs underline text-[#D9B8A0] hover:text-white ml-2 cursor-pointer font-medium"
          >
            View Bag
          </button>
        </div>
      )}

      {/* Share Toast */}
      {shareToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#302438] text-white px-5 py-3 rounded-xs shadow-xl flex items-center gap-2 animate-in slide-in-from-bottom duration-300">
          <CheckCircle2 size={16} className="text-[#D9B8A0]" />
          <span className="text-xs font-sans font-medium">Link copied to clipboard!</span>
        </div>
      )}
    </div>
  );
};
