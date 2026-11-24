/**
 * ProductCard component for SARINE.
 * Luxury art-directed jewellery card following zero-pill discipline,
 * 3:4 editorial portrait presentation, interactive wishlist toggle,
 * and elegant typography.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { Product, isInStock, JEWELLERY_TYPE_LABELS, getDiscountPercent } from '../types/product';
import { formatInr } from '../utils/currency';
import { useWishlist } from '../context/WishlistContext';
import { Gem, Heart, Star } from 'lucide-react';
import { hostingerStorefrontService } from '../services/hostinger/hostingerStorefrontService';
import { useCart } from '../context/CartContext';

interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const inStock = isInStock(product);
  const { isInWishlist, toggleWishlist } = useWishlist();
  const { storewideDiscountPercent } = useCart();
  const wishlisted = isInWishlist(product.id);
  const discountPercent = getDiscountPercent(product);
  const campaignDiscount = Math.max(0, Math.min(75, storewideDiscountPercent));
  const campaignPrice = Math.max(0, product.price - Math.floor(product.price * campaignDiscount / 100));

  const usableImages = (product.images || []).filter((image): image is string =>
    typeof image === 'string' && image.trim().length > 0 && !/(product-image-unavailable|placeholder|no[-_]?image)/i.test(image)
  );
  const primaryImage = usableImages[0] || '';
  const secondaryImage = usableImages[1];
  const [primaryImageFailed, setPrimaryImageFailed] = React.useState(false);

  const [reviewSummary, setReviewSummary] = React.useState<{ count: number; average: number } | null>(null);

  React.useEffect(() => {
    let isCurrent = true;
    setReviewSummary(null);
    hostingerStorefrontService.getPublicProductReviewSummary(product.id)
      .then(summary => { if (isCurrent) setReviewSummary(summary); })
      .catch(() => { if (isCurrent) setReviewSummary(null); });
    return () => { isCurrent = false; };
  }, [product.id]);


  const handleWishlistClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist(product);
  };

  return (
    <article className="sarine-product-card group flex flex-col w-full bg-[var(--white)] p-2 sm:p-2.5 border border-[var(--border)] rounded-md transition-all duration-300 hover:border-[var(--border)] hover:shadow-xs relative" style={{ "--tw-shadow-color": "var(--border)" } as React.CSSProperties}>
      {/* 3:4 Portrait Image Container */}
      <div className="relative block w-full overflow-hidden bg-[var(--white)] aspect-[4/5] border border-[var(--border)] rounded-xs group-hover:border-[var(--gold)] transition-colors">
        <Link to={`/product/${product.slug}`} className="block w-full h-full">
          {primaryImage && !primaryImageFailed ? (
            <img
              src={primaryImage}
              onError={() => setPrimaryImageFailed(true)}
              alt={product.name}
              loading="lazy"
              decoding="async"
              fetchPriority="low"
              referrerPolicy="no-referrer"
              className={`absolute inset-0 h-full w-full object-cover object-center transition-all duration-500 ease-out ${
                secondaryImage ? 'group-hover:opacity-0' : 'group-hover:scale-105'
              }`}
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#F7F0FA] via-white to-[#EEE5F2] !text-[color:var(--plum)]" role="img" aria-label={`Image unavailable for ${product.name}`}>
              <Gem size={30} strokeWidth={1.25} aria-hidden="true" />
              <span className="px-3 text-center text-[10px] uppercase tracking-[0.18em]">SARINE</span>
            </div>
          )}

          {/* Secondary editorial image reveal on hover if available */}
          {secondaryImage && !primaryImageFailed && (
            <img
              src={secondaryImage}
              onError={(event) => { event.currentTarget.style.display = "none"; }}
              alt={`${product.name} detail`}
              loading="lazy"
              decoding="async"
              fetchPriority="low"
              referrerPolicy="no-referrer"
              className="absolute inset-0 h-full w-full object-cover object-center opacity-0 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500 ease-out"
            />
          )}
        </Link>

        {/* Wishlist Heart Button (Top Right) */}
        <button
          onClick={handleWishlistClick}
          aria-label={wishlisted ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
          className="absolute top-1.5 right-1.5 z-20 relative inline-flex min-h-11 min-w-11 items-center justify-center !text-[color:var(--plum)] transition-all cursor-pointer touch-manipulation"
        >
          <span aria-hidden="true" className="absolute h-8 w-8 rounded-full bg-[var(--white)] border border-[var(--border)] shadow-2xs backdrop-blur-xs" />
          <Heart
            size={16}
            className={`relative z-10 transition-colors ${
              wishlisted ? 'fill-[var(--rose)] !text-[color:var(--rose)]' : '!text-[color:var(--plum)]'
            }`}
          />
        </button>

        {/* Understated Status Tag */}
        {!inStock && (
          <div className="absolute top-2.5 left-2.5 z-10">
            <span className="text-[10px] uppercase tracking-[0.2em] px-2 py-0.5 bg-[var(--white)] !text-[color:var(--body)] border border-[var(--border)] font-sans font-medium rounded-xs">
              Awaiting Atelier
            </span>
          </div>
        )}

        {(campaignDiscount > 0 || discountPercent) && inStock && (
          <div className="absolute top-2.5 left-2.5 z-10 flex flex-col items-start gap-1">
            {campaignDiscount > 0 && <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 bg-[var(--sale-badge-background)] !text-[color:var(--sale-badge-text)] font-sans font-semibold rounded-xs">{campaignDiscount}% SALE OFF</span>}
            {discountPercent && <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 bg-[var(--sale-badge-background)] !text-[color:var(--sale-badge-text)] font-sans font-medium rounded-xs">{discountPercent}% OFF</span>}
          </div>
        )}

        {/* Quick View / Detail Link Indicator */}
        <Link
          to={`/product/${product.slug}`}
          className="absolute inset-x-0 bottom-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex justify-center"
        >
          <span className="text-[10px] uppercase tracking-[0.2em] !text-white bg-[var(--plum)] group-hover:bg-[var(--gold)] border border-[var(--border)] shadow-xs px-3 py-1 font-sans font-medium rounded-xs">
            View Piece
          </span>
        </Link>
      </div>

      {/* Editorial Content */}
      <div className="pt-3 pb-1 flex flex-col flex-grow">
        {/* Category / Type Label */}
        <div className="flex items-center justify-between mb-1">
          <span className="sarine-product-card__type text-[12px] uppercase tracking-[0.16em] !text-[color:var(--gold-text)] font-sans font-medium">
            {JEWELLERY_TYPE_LABELS[product.jewelleryType] || product.jewelleryType}
          </span>
          {product.collectionSlugs.length > 0 && (
            <span className="text-[11px] tracking-wider bg-[var(--pill)] !text-[color:var(--plum)] px-2 py-1 rounded-xs font-sans">
              {product.collectionSlugs[0]}
            </span>
          )}
        </div>

        {/* Product Title */}
        <h3 className="sarine-product-card__title min-h-[2.6em] font-serif text-[15px] sm:text-base !text-[color:var(--heading)] font-normal leading-snug line-clamp-2 group-hover:!text-[color:var(--plum)] transition-colors">
          <Link to={`/product/${product.slug}`}>
            {product.name}
          </Link>
        </h3>

        {reviewSummary && reviewSummary.count > 0 && (
          <div className="sarine-product-card__reviews mt-1.5 flex items-center gap-1.5 text-[10px] font-sans" role="img" aria-label={`Rated ${reviewSummary.average.toFixed(1)} out of 5 from ${reviewSummary.count} approved customer ${reviewSummary.count === 1 ? 'review' : 'reviews'}`}>
            <span className="inline-flex items-center gap-0.5 !text-[color:var(--gold)]" aria-hidden="true">
              {Array.from({ length: 5 }, (_, index) => (
                <Star key={index} size={11} strokeWidth={1.8} fill={index < Math.round(reviewSummary.average) ? 'currentColor' : 'none'} />
              ))}
            </span>
            <span className="!text-[color:var(--body)]">{reviewSummary.average.toFixed(1)} ({reviewSummary.count})</span>
          </div>
        )}

        {/* Price Row */}
        <div className="sarine-product-card__price mt-1.5 flex items-baseline gap-2.5">
          {campaignDiscount > 0 ? (
            <>
              <span className="!text-[color:var(--plum)] font-semibold text-sm font-sans tracking-tight">{formatInr(campaignPrice)}</span>
              <span className="!text-[color:var(--muted)] line-through text-xs font-sans">{formatInr(product.price)}</span>
            </>
          ) : (
            <>
              <span className="!text-[color:var(--plum)] font-medium text-sm font-sans tracking-tight">{formatInr(product.price)}</span>
              {product.compareAtPrice && <span className="!text-[color:var(--muted)] line-through text-xs font-sans">{formatInr(product.compareAtPrice)}</span>}
            </>
          )}
        </div>
      </div>
    </article>
  );
};
