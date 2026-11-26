/**
 * WishlistDrawer component for SARINE.
 * Luxury slide-in drawer displaying saved wishlist pieces with direct "Move to Bag" actions.
 */

import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useWishlist } from '../context/WishlistContext';
import { useCart } from '../context/CartContext';
import type { Product } from '../types/product';
import { formatInr } from '../utils/currency';
import { getProductDetailHref } from '../utils/productLinks';
import { X, Heart, ShoppingBag, Trash2, ArrowRight } from 'lucide-react';

export const WishlistDrawer: React.FC = () => {
  const navigate = useNavigate();
  const { wishlistProducts, count, loading, isWishlistOpen, closeWishlist, removeFromWishlist } = useWishlist();
  const { addItem, openDrawer } = useCart();

  // Close drawer on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isWishlistOpen) {
        closeWishlist();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isWishlistOpen, closeWishlist]);

  // Lock background scroll when drawer is open
  useEffect(() => {
    if (isWishlistOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isWishlistOpen]);

  if (!isWishlistOpen) return null;

  const handleMoveToBag = (product: Product) => {
    addItem(product, 1);
    removeFromWishlist(product.id);
    closeWishlist();
    openDrawer();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end font-sans">
      {/* Dimmed backdrop */}
      <div
        onClick={closeWishlist}
        className="fixed inset-0 bg-[var(--heading)] backdrop-blur-xs transition-opacity duration-300"
        aria-hidden="true"
      />

      {/* Slide-over panel */}
      <aside
        className="relative w-full max-w-md bg-white text-[var(--heading)] h-full shadow-2xl flex flex-col z-10 border-l border-[var(--border)] animate-in slide-in-from-right duration-300"
        role="dialog"
        aria-label="Your Saved Pieces"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[var(--border)] flex items-center justify-between bg-white">
          <div className="flex items-baseline gap-2">
            <h2 className="font-serif text-xl sm:text-2xl font-normal tracking-tight text-[var(--heading)]">
              Saved Pieces
            </h2>
            <span className="text-[11px] uppercase tracking-widest text-[var(--body)]">
              ({count} {count === 1 ? 'piece' : 'pieces'})
            </span>
          </div>
          <button
            onClick={closeWishlist}
            className="p-1.5 text-[var(--body)] hover:text-[var(--plum)] transition-colors cursor-pointer"
            aria-label="Close Wishlist"
          >
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>

        {/* Content list or Empty State */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 divide-y divide-[var(--border)]">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center p-8">
              <div className="w-6 h-6 border-2 border-[var(--plum)] border-t-transparent rounded-full animate-spin mb-3"></div>
              <p className="text-xs text-[var(--body)]">Loading your saved pieces...</p>
            </div>
          ) : count === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6">
              <Heart size={40} strokeWidth={1.2} className="text-[var(--gold)] mb-3" />
              <h3 className="font-serif text-xl text-[var(--heading)] font-normal">Your wishlist is empty</h3>
              <p className="text-xs text-[var(--body)] mt-2 max-w-xs leading-relaxed">
                Save your favourite handcrafted jewellery pieces to revisit them anytime or move them directly into your shopping bag.
              </p>
              <button
                onClick={() => {
                  closeWishlist();
                  navigate('/shop');
                }}
                className="mt-6 px-7 py-3 bg-[var(--plum)] text-white text-xs uppercase tracking-[0.2em] font-medium hover:bg-[var(--gold)] rounded-xs transition-colors shadow-xs cursor-pointer"
              >
                Explore Catalogue
              </button>
            </div>
          ) : (
            wishlistProducts.map((product) => {
              const inStock = product.stock > 0;
              return (
                <div key={product.id} className="py-4 first:pt-0 last:pb-0 flex gap-4">
                  {/* Image */}
                  <Link
                    to={getProductDetailHref(product.slug, product.productCollection, true)}
                    onClick={closeWishlist}
                    className="w-20 h-24 bg-[var(--tint)] border border-[var(--border)] shrink-0 overflow-hidden rounded-xs"
                  >
                    <img
                      src={product.images[0] || 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=800&q=80'}
                      alt={product.name}
                      className="w-full h-full object-cover object-center"
                    />
                  </Link>

                  {/* Details */}
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          to={getProductDetailHref(product.slug, product.productCollection, true)}
                          onClick={closeWishlist}
                          className="font-serif text-base text-[var(--heading)] hover:text-[var(--plum)] font-normal line-clamp-1 transition-colors"
                        >
                          {product.name}
                        </Link>
                        <button
                          onClick={() => removeFromWishlist(product.id)}
                          className="text-[var(--body)] hover:text-[#DC2626] transition-colors p-1 cursor-pointer"
                          title="Remove from wishlist"
                          aria-label={`Remove ${product.name}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-sm font-medium text-[var(--heading)]">
                          {formatInr(product.price)}
                        </span>
                        {product.compareAtPrice && (
                          <span className="text-xs text-[var(--body)] line-through">
                            {formatInr(product.compareAtPrice)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 flex items-center justify-between">
                      {inStock ? (
                        <button
                          onClick={() => handleMoveToBag(product)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[var(--plum)] text-white hover:bg-[var(--gold)] text-xs font-medium rounded-xs transition-colors shadow-2xs cursor-pointer"
                        >
                          <ShoppingBag size={13} />
                          <span>{product.variants?.length ? 'Choose Options' : 'Move to Bag'}</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-[var(--body)] font-medium bg-[var(--tint)] px-2.5 py-1 rounded-xs border border-[var(--border)]">
                          Out of Stock
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        {count > 0 && (
          <div className="p-4 sm:p-5 border-t border-[var(--border)] bg-[var(--tint)] flex items-center justify-between">
            <button
              onClick={() => {
                closeWishlist();
                navigate('/shop');
              }}
              className="text-xs text-[var(--plum)] font-medium hover:underline cursor-pointer"
            >
              Continue Exploring
            </button>
            <span className="text-xs text-[var(--body)]">
              Items remain saved on this device
            </span>
          </div>
        )}
      </aside>
    </div>
  );
};
