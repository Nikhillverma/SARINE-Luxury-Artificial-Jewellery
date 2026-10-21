/**
 * CartDrawer component for SARINE.
 * Luxury slide-in drawer displaying bag lines, quantity steppers bounded by physical stock,
 * subtotal in INR, and seamless checkout progression.
 */

import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { formatInr } from '../utils/currency';
import { X, ShoppingBag, Trash2, ArrowRight, AlertCircle } from 'lucide-react';

export const CartDrawer: React.FC = () => {
  const navigate = useNavigate();
  const {
    items,
    itemCount,
    subtotal,
    isDrawerOpen,
    closeDrawer,
    updateQuantity,
    removeItem,
    availabilityNotice,
    dismissNotice
  } = useCart();

  // Close drawer on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDrawerOpen) {
        closeDrawer();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDrawerOpen, closeDrawer]);

  // Lock background scroll when drawer is open
  useEffect(() => {
    if (isDrawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isDrawerOpen]);

  if (!isDrawerOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end font-sans">
      {/* Dimmed backdrop */}
      <div
        onClick={closeDrawer}
        className="fixed inset-0 bg-[#242321]/50 backdrop-blur-xs transition-opacity duration-300"
        aria-hidden="true"
      />

      {/* Slide-over panel */}
      <aside
        className="relative w-full max-w-md bg-[#FAF8F5] text-[#242321] h-full shadow-2xl flex flex-col z-10 border-l border-[#E8E0D6] animate-in slide-in-from-right duration-300"
        role="dialog"
        aria-label="Shopping Bag"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#E8E0D6] flex items-center justify-between bg-[#FAF8F5]">
          <div className="flex items-baseline gap-2">
            <h2 className="font-serif text-xl sm:text-2xl font-normal tracking-tight text-[#242321]">
              Shopping Bag
            </h2>
            <span className="text-[11px] uppercase tracking-widest text-[#81776D]">
              ({itemCount} {itemCount === 1 ? 'piece' : 'pieces'})
            </span>
          </div>
          <button
            onClick={closeDrawer}
            className="p-1.5 text-[#81776D] hover:text-[#242321] transition-colors"
            aria-label="Close Shopping Bag"
          >
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>

        {/* Availability Notification Banner */}
        {availabilityNotice && (
          <div className="bg-[#F2EADF] border-b border-[#E8E0D6] p-3 text-xs text-[#81776D] flex items-start justify-between gap-2">
            <div className="flex items-start gap-2">
              <AlertCircle size={15} className="text-[#B79A68] shrink-0 mt-0.5" />
              <span>{availabilityNotice}</span>
            </div>
            <button
              onClick={dismissNotice}
              className="text-[#81776D] hover:text-[#242321] text-xs font-medium"
            >
              ✕
            </button>
          </div>
        )}

        {/* Bag Items List or Empty State */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 divide-y divide-[#E8E0D6]">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6">
              <ShoppingBag size={40} strokeWidth={1.2} className="text-[#81776D] mb-3" />
              <h3 className="font-serif text-xl text-[#242321] font-normal">Your bag is empty</h3>
              <p className="text-xs text-[#81776D] mt-2 max-w-xs leading-relaxed">
                Explore our curated handcrafted collections to discover chokers, jhumkas, rings, and bangles.
              </p>
              <button
                onClick={() => {
                  closeDrawer();
                  navigate('/shop');
                }}
                className="mt-6 px-7 py-3 bg-[#242321] text-[#FAF8F5] text-xs uppercase tracking-[0.2em] font-medium hover:bg-[#B79A68] transition-colors"
              >
                Explore Pieces
              </button>
            </div>
          ) : (
            items.map((item) => {
              const maxStock = item.product.stock;
              const isAtMax = item.quantity >= maxStock;

              return (
                <div key={item.productId} className="py-4 first:pt-0 last:pb-0 flex gap-4">
                  {/* Image */}
                  <Link
                    to={`/product/${item.product.slug}`}
                    onClick={closeDrawer}
                    className="w-20 h-24 bg-[#F2EADF] border border-[#E8E0D6] shrink-0 overflow-hidden"
                  >
                    <img
                      src={item.product.images[0]}
                      alt={item.product.name}
                      className="w-full h-full object-cover object-center"
                    />
                  </Link>

                  {/* Details */}
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          to={`/product/${item.product.slug}`}
                          onClick={closeDrawer}
                          className="font-serif text-base text-[#242321] hover:text-[#B79A68] font-normal line-clamp-1 transition-colors"
                        >
                          {item.product.name}
                        </Link>
                        <button
                          onClick={() => removeItem(item.productId)}
                          className="text-[#81776D] hover:text-[#8C2F2F] transition-colors p-1"
                          title="Remove item"
                          aria-label={`Remove ${item.product.name}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <p className="text-xs text-[#81776D] mt-0.5">
                        {formatInr(item.unitPrice)} each
                      </p>
                    </div>

                    {/* Quantity Stepper & Line Total */}
                    <div className="flex items-end justify-between mt-3">
                      <div>
                        <div className="flex items-center border border-[#E8E0D6] bg-white">
                          <button
                            onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                            disabled={item.quantity <= 1}
                            className="w-7 h-7 flex items-center justify-center text-xs text-[#242321] hover:bg-[#F2EADF] disabled:opacity-30 transition-colors"
                            aria-label="Decrease quantity"
                          >
                            -
                          </button>
                          <span className="w-8 text-center text-xs font-medium text-[#242321]">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                            disabled={isAtMax}
                            className="w-7 h-7 flex items-center justify-center text-xs text-[#242321] hover:bg-[#F2EADF] disabled:opacity-30 transition-colors"
                            aria-label="Increase quantity"
                          >
                            +
                          </button>
                        </div>
                        {isAtMax && (
                          <span className="text-[10px] text-[#81776D] block mt-1">
                            Max stock: {maxStock}
                          </span>
                        )}
                      </div>

                      <div className="text-right">
                        <span className="text-sm font-medium text-[#242321]">
                          {formatInr(item.lineTotal)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Summary */}
        {items.length > 0 && (
          <div className="p-4 sm:p-5 border-t border-[#E8E0D6] bg-[#FAF8F5] space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="text-xs uppercase tracking-widest text-[#81776D] font-medium">
                Subtotal
              </span>
              <span className="text-lg font-medium text-[#242321]">
                {formatInr(subtotal)}
              </span>
            </div>

            <p className="text-[11px] text-[#81776D]">
              Complimentary pan-India delivery included at checkout.
            </p>

            <div className="pt-2 flex flex-col gap-2">
              <button
                onClick={() => {
                  closeDrawer();
                  navigate('/checkout');
                }}
                className="w-full py-3 bg-[#242321] text-[#FAF8F5] text-xs uppercase tracking-[0.2em] font-medium hover:bg-[#B79A68] transition-colors flex items-center justify-center gap-2"
              >
                <span>Proceed to Checkout</span>
                <ArrowRight size={13} />
              </button>

              <button
                onClick={() => {
                  closeDrawer();
                  navigate('/bag');
                }}
                className="w-full py-2 text-center text-xs uppercase tracking-[0.18em] text-[#81776D] hover:text-[#242321] transition-colors underline underline-offset-4"
              >
                View Full Bag
              </button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
};
