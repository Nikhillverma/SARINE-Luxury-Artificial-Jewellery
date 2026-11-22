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
import { Heart, Star } from 'lucide-react';
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

  const primaryImage = product.images[0] || '/images/product-image-unavailable.svg';
  const secondaryImage = product.images[1];

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
    <article className="group flex flex-col w-full bg-white p-2 sm:p-2.5 border border-[#E7DCEB] rounded-md transition-all duration-300 hover:border-[#B69ACF] hover:shadow-xs relative">
      {/* 3:4 Portrait Image Container */}
      <div className="relative block w-full overflow-hidden bg-[#F7F0FA] aspect-[3/4] border border-[#E7DCEB] rounded-xs group-hover:border-[#B69ACF]/60 transition-colors">
        <Link to={`/product/${product.slug}`} className="block w-full h-full">
          <img
            src={primaryImage}
            onError={(event) => { if (!event.currentTarget.src.endsWith("/images/product-image-unavailable.svg")) event.currentTarget.src = "/images/product-image-unavailable.svg"; }}
            alt={product.name}
            loading="lazy"
            decoding="async"
            fetchPriority="low"
            referrerPolicy="no-referrer"
            className={`absolute inset-0 h-full w-full object-cover object-center transition-all duration-500 ease-out ${
              secondaryImage ? 'group-hover:opacity-0' : 'group-hover:scale-105'
            }`}
          />

          {/* Secondary editorial image reveal on hover if available */}
          {secondaryImage && (
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
          className="absolute top-1.5 right-1.5 z-20 inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-white/95 hover:bg-white text-[#302438] flex items-center border border-[#E7DCEB] transition-all cursor-pointer shadow-2xs backdrop-blur-xs touch-manipulation"
        >
          <Heart
            size={16}
            className={`transition-colors ${
              wishlisted ? 'fill-[#563568] text-[#563568]' : 'text-[#6F6475] hover:text-[#563568]'
            }`}
          />
        </button>

        {/* Understated Status Tag */}
        {!inStock && (
          <div className="absolute top-2.5 left-2.5 z-10">
            <span className="text-[10px] uppercase tracking-[0.2em] px-2 py-0.5 bg-white/95 text-[#6F6475] border border-[#E7DCEB] font-sans font-medium rounded-xs">
              Awaiting Atelier
            </span>
          </div>
        )}

        {(campaignDiscount > 0 || discountPercent) && inStock && (
          <div className="absolute top-2.5 left-2.5 z-10">
            {campaignDiscount > 0 ? (
              <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 bg-[#A43E55] text-white font-sans font-semibold rounded-xs">
                {campaignDiscount}% SALE OFF
              </span>
            ) : discountPercent ? (
              <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 bg-[#563568] text-white font-sans font-medium rounded-xs">
                {discountPercent}% OFF
              </span>
            ) : null}
          </div>
        )}

        {/* Quick View / Detail Link Indicator */}
        <Link
          to={`/product/${product.slug}`}
          className="absolute inset-x-0 bottom-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex justify-center"
        >
          <span className="text-[10px] uppercase tracking-[0.2em] text-[#563568] bg-white/95 border border-[#B69ACF] shadow-xs px-3 py-1 font-sans font-medium rounded-xs">
            View Piece
          </span>
        </Link>
      </div>

      {/* Editorial Content */}
      <div className="pt-3 pb-1 flex flex-col flex-grow">
        {/* Category / Type Label */}
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] uppercase tracking-[0.2em] text-[#6F6475] font-sans font-medium">
            {JEWELLERY_TYPE_LABELS[product.jewelleryType] || product.jewelleryType}
          </span>
          {product.collectionSlugs.length > 0 && (
            <span className="text-[10px] tracking-wider text-[#563568] font-sans">
              {product.collectionSlugs[0]}
            </span>
          )}
        </div>

        {/* Product Title */}
        <h3 className="min-h-[2.6em] font-serif text-[15px] sm:text-base text-[#302438] font-normal leading-snug line-clamp-2 group-hover:text-[#563568] transition-colors">
          <Link to={`/product/${product.slug}`}>
            {product.name}
          </Link>
        </h3>

        {reviewSummary && reviewSummary.count > 0 && (
          <div className="mt-1.5 flex items-center gap-1.5 text-[10px] font-sans" role="img" aria-label={`Rated ${reviewSummary.average.toFixed(1)} out of 5 from ${reviewSummary.count} approved customer ${reviewSummary.count === 1 ? 'review' : 'reviews'}`}>
            <span className="inline-flex items-center gap-0.5 text-[#563568]" aria-hidden="true">
              {Array.from({ length: 5 }, (_, index) => (
                <Star key={index} size={11} strokeWidth={1.8} fill={index < Math.round(reviewSummary.average) ? 'currentColor' : 'none'} />
              ))}
            </span>
            <span className="text-[#6F6475]">{reviewSummary.average.toFixed(1)} ({reviewSummary.count})</span>
          </div>
        )}

        {/* Price Row */}
        <div className="mt-1.5 flex items-baseline gap-2.5">
          {campaignDiscount > 0 ? (
            <>
              <span className="text-[#A43E55] font-semibold text-sm font-sans tracking-tight">{formatInr(campaignPrice)}</span>
              <span className="text-[#6F6475] line-through text-xs font-sans">{formatInr(product.price)}</span>
            </>
          ) : (
            <>
              <span className="text-[#302438] font-medium text-sm font-sans tracking-tight">{formatInr(product.price)}</span>
              {product.compareAtPrice && <span className="text-[#6F6475] line-through text-xs font-sans">{formatInr(product.compareAtPrice)}</span>}
            </>
          )}
        </div>
      </div>
    </article>
  );
};
