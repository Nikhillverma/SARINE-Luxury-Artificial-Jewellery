/**
 * ProductCard component for SARINE.
 * Presents jewellery pieces with elegant typography, price formatting, and status badges.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { Product, getDiscountPercent, isInStock, JEWELLERY_TYPE_LABELS } from '../types/product';
import { formatInr } from '../utils/currency';

interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const discount = getDiscountPercent(product);
  const inStock = isInStock(product);

  return (
    <article className="group flex flex-col bg-[#FFFFFF] border border-[#E6DFD5] hover:border-[#B89758] transition-all duration-300 shadow-sm hover:shadow-md">
      {/* Image Container with Aspect Ratio */}
      <Link
        to={`/product/${product.slug}`}
        className="relative block w-full overflow-hidden bg-[#F3EEE7] pt-[115%]"
      >
        <img
          src={product.images[0] || 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=800&q=80'}
          alt={product.name}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover object-center group-hover:scale-105 transition-transform duration-500 ease-out"
        />

        {/* Badges Overlay */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
          {discount && (
            <span className="bg-[#B89758] text-[#1C1917] font-semibold text-[11px] px-2 py-0.5 tracking-wider uppercase">
              {discount}% OFF
            </span>
          )}
          {!inStock && (
            <span className="bg-[#1C1917] text-[#FAF8F5] text-[10px] px-2 py-0.5 tracking-wider uppercase font-medium">
              Out of Stock
            </span>
          )}
          {product.status !== 'active' && (
            <span className="bg-[#8C2F2F] text-white text-[10px] px-2 py-0.5 tracking-wider uppercase font-semibold">
              {product.status}
            </span>
          )}
        </div>

        {/* Jewellery Type Pill */}
        <div className="absolute bottom-3 right-3 z-10 opacity-90 group-hover:opacity-100 transition-opacity">
          <span className="bg-[#FAF8F5]/90 backdrop-blur-sm text-[#57534E] text-[10px] px-2 py-1 tracking-widest uppercase font-medium border border-[#E6DFD5]">
            {JEWELLERY_TYPE_LABELS[product.jewelleryType] || product.jewelleryType}
          </span>
        </div>
      </Link>

      {/* Editorial Content */}
      <div className="p-4 sm:p-5 flex flex-col flex-grow justify-between bg-[#FFFFFF]">
        <div>
          {/* Tags preview */}
          {product.collectionSlugs.length > 0 && (
            <span className="text-[11px] uppercase tracking-widest text-[#B89758] font-medium block mb-1">
              {product.collectionSlugs[0]} Collection
            </span>
          )}

          {/* Product Name */}
          <h3 className="font-serif text-lg sm:text-xl text-[#1C1917] font-medium leading-snug line-clamp-1 group-hover:text-[#B89758] transition-colors">
            <Link to={`/product/${product.slug}`}>
              {product.name}
            </Link>
          </h3>

          {/* Short description */}
          <p className="text-xs text-[#6B635D] line-clamp-2 mt-1.5 font-sans leading-relaxed">
            {product.shortDescription || product.description}
          </p>
        </div>

        {/* Price & Action */}
        <div className="mt-4 pt-3 border-t border-[#F0EAE1] flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-[#1C1917] font-semibold text-base sm:text-lg">
              {formatInr(product.price)}
            </span>
            {product.compareAtPrice && (
              <span className="text-[#6B635D] line-through text-xs sm:text-sm">
                {formatInr(product.compareAtPrice)}
              </span>
            )}
          </div>

          <Link
            to={`/product/${product.slug}`}
            className="text-xs uppercase tracking-widest text-[#1C1917] hover:text-[#B89758] font-semibold underline underline-offset-4 transition-colors"
          >
            Explore
          </Link>
        </div>
      </div>
    </article>
  );
};
