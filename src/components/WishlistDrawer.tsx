/**
 * WishlistDrawer component for SARINE.
 * Luxury slide-in drawer displaying saved wishlist pieces with direct "Move to Bag" actions.
 */

import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useWishlist } from '../context/WishlistContext';
import { useCart } from '../context/CartContext';
import { formatInr } from '../utils/currency';
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

  const handleMoveToBag = (product: any) => {
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
        className="fixed inset-0 bg-[#302438]/40 backdrop-blur-xs transition-opacity duration-300"
        aria-hidden="true"
      />

      {/* Slide-over panel */}
      <aside
        className="relative w-full max-w-md bg-white text-[#302438] h-full shadow-2xl flex flex-col z-10 border-l border-[#E7DCEB] animate-in slide-in-from-right duration-300"
        role="dialog"
        aria-label="Your Saved Pieces"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#E7DCEB] flex items-center justify-between bg-white">
          <div className="flex items-baseline gap-2">
            <h2 className="font-serif text-xl sm:text-2xl font-normal tracking-tight text-[#302438]">
              Saved Pieces
            </h2>
            <span className="text-[11px] uppercase tracking-widest text-[#6F6475]">
              ({count} {count === 1 ? 'piece' : 'pieces'})
            </span>
          </div>
          <button
            onClick={closeWishlist}
            className="p-1.5 text-[#6F6475] hover:text-[#563568] transition-colors cursor-pointer"
            aria-label="Close Wishlist"
          >
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>

        {/* Content list or Empty State */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 divide-y divide-[#E7DCEB]">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center p-8">
              <div className="w-6 h-6 border-2 border-[#563568] border-t-transparent rounded-full animate-spin mb-3"></div>
              <p className="text-xs text-[#6F6475]">Loading your saved pieces...</p>
            </div>
          ) : count === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6">
              <Heart size={40} strokeWidth={1.2} className="text-[#B69ACF] mb-3" />
              <h3 className="font-serif text-xl text-[#302438] font-normal">Your wishlist is empty</h3>
              <p className="text-xs text-[#6F6475] mt-2 max-w-xs leading-relaxed">
                Save your favourite handcrafted jewellery pieces to revisit them anytime or move them directly into your shopping bag.
              </p>
              <button
                onClick={() => {
                  closeWishlist();
                  navigate('/shop');
                }}
                className="mt-6 px-7 py-3 bg-[#563568] text-white text-xs uppercase tracking-[0.2em] font-medium hover:bg-[#A184BD] rounded-xs transition-colors shadow-xs cursor-pointer"
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
                    to={`/product/${product.slug}`}
                    onClick={closeWishlist}
                    className="w-20 h-24 bg-[#F7F0FA] border border-[#E7DCEB] shrink-0 overflow-hidden rounded-xs"
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
                          to={`/product/${product.slug}`}
                          onClick={closeWishlist}
                          className="font-serif text-base text-[#302438] hover:text-[#563568] font-normal line-clamp-1 transition-colors"
                        >
                          {product.name}
                        </Link>
                        <button
                          onClick={() => removeFromWishlist(product.id)}
                          className="text-[#6F6475] hover:text-[#DC2626] transition-colors p-1 cursor-pointer"
                          title="Remove from wishlist"
                          aria-label={`Remove ${product.name}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-sm font-medium text-[#302438]">
                          {formatInr(product.price)}
                        </span>
                        {product.compareAtPrice && (
                          <span className="text-xs text-[#6F6475] line-through">
                            {formatInr(product.compareAtPrice)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 flex items-center justify-between">
                      {inStock ? (
                        <button
                          onClick={() => handleMoveToBag(product)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#563568] text-white hover:bg-[#A184BD] text-xs font-medium rounded-xs transition-colors shadow-2xs cursor-pointer"
                        >
                          <ShoppingBag size={13} />
                          <span>Move to Bag</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-[#6F6475] font-medium bg-[#F7F0FA] px-2.5 py-1 rounded-xs border border-[#E7DCEB]">
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
          <div className="p-4 sm:p-5 border-t border-[#E7DCEB] bg-[#F7F0FA] flex items-center justify-between">
            <button
              onClick={() => {
                closeWishlist();
                navigate('/shop');
              }}
              className="text-xs text-[#563568] font-medium hover:underline cursor-pointer"
            >
              Continue Exploring
            </button>
            <span className="text-xs text-[#6F6475]">
              Items remain saved on this device
            </span>
          </div>
        )}
      </aside>
    </div>
  );
};
