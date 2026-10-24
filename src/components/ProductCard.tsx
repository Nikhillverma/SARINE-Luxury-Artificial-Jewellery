/**
 * ProductCard component for SARINE.
 * Luxury art-directed jewellery card following zero-pill discipline,
 * 3:4 editorial portrait presentation, subtle hover interaction,
 * and elegant typography aligned with Mejuri and Monica Vinader caliber.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { Product, isInStock, JEWELLERY_TYPE_LABELS } from '../types/product';
import { formatInr } from '../utils/currency';

interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const inStock = isInStock(product);
  const isAnanya = product.slug === 'ananya-temple-coin-bracelet' || product.id === 'prod-003';
  const isZoya = product.slug === 'zoya-open-cuff-leaf-bangle' || product.id === 'prod-008';
  const primaryImage = isAnanya
    ? '/images/ananya-temple-coin-bracelet.jpg'
    : isZoya
    ? '/images/zoya-open-cuff-leaf-bangle.jpg'
    : (product.images[0] || 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=800&q=80');
  const secondaryImage = isAnanya
    ? '/src/assets/images/temple_coin_bracelet_1792768038164.jpg'
    : isZoya
    ? '/src/assets/images/zoya_leaf_bangle_1792768482264.jpg'
    : product.images[1];

  return (
    <article className="group flex flex-col w-full bg-white p-2 sm:p-2.5 border border-[#E7DCEB] rounded-md transition-all duration-300 hover:border-[#B69ACF] hover:shadow-sm">
      {/* 3:4 Portrait Image Container */}
      <Link
        to={`/product/${product.slug}`}
        className="relative block w-full overflow-hidden bg-[#F7F0FA] aspect-[3/4] border border-[#E7DCEB] rounded-xs group-hover:border-[#B69ACF]/60 transition-colors"
      >
        <img
          src={primaryImage}
          alt={product.name}
          loading="lazy"
          referrerPolicy="no-referrer"
          className={`absolute inset-0 h-full w-full object-cover object-center transition-all duration-500 ease-out ${
            secondaryImage
              ? 'group-hover:opacity-0'
              : 'group-hover:scale-105'
          }`}
        />

        {/* Secondary editorial image reveal on hover if available */}
        {secondaryImage && (
          <img
            src={secondaryImage}
            alt={`${product.name} detail`}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="absolute inset-0 h-full w-full object-cover object-center opacity-0 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500 ease-out"
          />
        )}

        {/* Understated Status Tag (Zero-Pill: pure typography with hairline border) */}
        {!inStock && (
          <div className="absolute top-2.5 left-2.5 z-10">
            <span className="text-[10px] uppercase tracking-[0.2em] px-2 py-0.5 bg-white/95 text-[#6F6475] border border-[#E7DCEB] font-sans font-medium rounded-xs">
              Awaiting Atelier
            </span>
          </div>
        )}

        {product.status !== 'active' && (
          <div className="absolute top-2.5 right-2.5 z-10">
            <span className="text-[10px] uppercase tracking-[0.2em] px-2 py-0.5 bg-white/95 text-[#6F6475] border border-[#E7DCEB] font-sans font-medium rounded-xs">
              {product.status}
            </span>
          </div>
        )}

        {/* Quick View / Detail Link Indicator (Lavender border, Deep Plum text) */}
        <div className="absolute inset-x-0 bottom-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex justify-center">
          <span className="text-[10px] uppercase tracking-[0.2em] text-[#563568] bg-white/95 border border-[#B69ACF] shadow-xs px-3 py-1 font-sans font-medium rounded-xs">
            View Piece
          </span>
        </div>
      </Link>

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
        <h3 className="font-serif text-[15px] sm:text-base text-[#302438] font-normal leading-snug line-clamp-1 group-hover:text-[#563568] transition-colors">
          <Link to={`/product/${product.slug}`}>
            {product.name}
          </Link>
        </h3>

        {/* Price Row */}
        <div className="mt-1.5 flex items-baseline gap-2.5">
          <span className="text-[#302438] font-medium text-sm font-sans tracking-tight">
            {formatInr(product.price)}
          </span>
          {product.compareAtPrice && (
            <span className="text-[#6F6475] line-through text-xs font-sans">
              {formatInr(product.compareAtPrice)}
            </span>
          )}
        </div>
      </div>
    </article>
  );
};
