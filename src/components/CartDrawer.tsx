/**
 * CartDrawer component for SARINE.
 * Slide-in drawer displaying bag lines, quantity steppers bounded by physical stock,
 * subtotal in INR, and checkout progression.
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
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Dimmed backdrop */}
      <div
        onClick={closeDrawer}
        className="fixed inset-0 bg-[#1C1917]/50 backdrop-blur-xs transition-opacity duration-300"
        aria-hidden="true"
      />

      {/* Slide-over panel */}
      <aside
        className="relative w-full max-w-md bg-[#FAF8F5] text-[#1C1917] h-full shadow-2xl flex flex-col z-10 border-l border-[#E6DFD5] animate-in slide-in-from-right duration-300"
        role="dialog"
        aria-label="Shopping Bag"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#E6DFD5] flex items-center justify-between bg-white">
          <div className="flex items-baseline gap-2">
            <h2 className="font-serif text-xl sm:text-2xl font-medium tracking-tight text-[#1C1917]">
              Shopping Bag
            </h2>
            <span className="text-xs uppercase tracking-widest text-[#6B635D] font-sans">
              ({itemCount} {itemCount === 1 ? 'piece' : 'pieces'})
            </span>
          </div>
          <button
            onClick={closeDrawer}
            className="p-1.5 text-[#57534E] hover:text-[#1C1917] transition-colors"
            aria-label="Close Shopping Bag"
          >
            <X size={20} />
          </button>
        </div>

        {/* Availability Notification Banner */}
        {availabilityNotice && (
          <div className="bg-[#F3EEE7] border-b border-[#E6DFD5] p-3 text-xs text-[#57534E] flex items-start justify-between gap-2">
            <div className="flex items-start gap-2">
              <AlertCircle size={15} className="text-[#B89758] shrink-0 mt-0.5" />
              <span>{availabilityNotice}</span>
            </div>
            <button
              onClick={dismissNotice}
              className="text-[#6B635D] hover:text-[#1C1917] font-bold text-xs"
            >
              ✕
            </button>
          </div>
        )}

        {/* Bag Items List or Empty State */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 divide-y divide-[#F0EAE1]">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6">
              <ShoppingBag size={44} strokeWidth={1.2} className="text-[#8C847C] mb-3" />
              <h3 className="font-serif text-xl text-[#1C1917] font-medium">Your bag is empty</h3>
              <p className="text-xs text-[#6B635D] mt-1.5 font-sans max-w-xs leading-relaxed">
                Explore our curated handcrafted collections to discover necklaces, jhumkas, rings, and bangles.
              </p>
              <button
                onClick={() => {
                  closeDrawer();
                  navigate('/shop');
                }}
                className="mt-6 px-6 py-2.5 bg-[#1C1917] text-[#FAF8F5] text-xs uppercase tracking-widest font-semibold hover:bg-[#B89758] transition-colors"
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
                    className="w-20 h-24 bg-[#F3EEE7] border border-[#E6DFD5] shrink-0 overflow-hidden"
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
                          className="font-serif text-base text-[#1C1917] hover:text-[#B89758] font-medium line-clamp-1 transition-colors"
                        >
                          {item.product.name}
                        </Link>
                        <button
                          onClick={() => removeItem(item.productId)}
                          className="text-[#8C847C] hover:text-[#8C2F2F] transition-colors p-1"
                          title="Remove item"
                          aria-label={`Remove ${item.product.name}`}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>

                      <p className="text-xs text-[#6B635D] mt-0.5 font-sans">
                        {formatInr(item.unitPrice)} each
                      </p>
                    </div>

                    {/* Quantity Stepper & Line Total */}
                    <div className="flex items-end justify-between mt-3">
                      <div>
                        <div className="flex items-center border border-[#8C847C] bg-white">
                          <button
                            onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                            disabled={item.quantity <= 1}
                            className="w-7 h-7 flex items-center justify-center text-xs text-[#1C1917] hover:bg-[#F3EEE7] disabled:opacity-30 transition-colors"
                            aria-label="Decrease quantity"
                          >
                            -
                          </button>
                          <span className="w-8 text-center text-xs font-semibold text-[#1C1917]">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                            disabled={isAtMax}
                            className="w-7 h-7 flex items-center justify-center text-xs text-[#1C1917] hover:bg-[#F3EEE7] disabled:opacity-30 transition-colors"
                            aria-label="Increase quantity"
                          >
                            +
                          </button>
                        </div>
                        {isAtMax && (
                          <span className="text-[10px] text-[#6B635D] block mt-1">
                            Max stock: {maxStock}
                          </span>
                        )}
                      </div>

                      <div className="text-right">
                        <span className="text-sm font-semibold text-[#1C1917]">
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

        {/* Footer Summary (subtotal only, strictly adhering to rules) */}
        {items.length > 0 && (
          <div className="p-4 sm:p-5 border-t border-[#E6DFD5] bg-white space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="text-xs uppercase tracking-widest text-[#57534E] font-medium font-sans">
                Subtotal
              </span>
              <span className="font-serif text-xl font-semibold text-[#1C1917]">
                {formatInr(subtotal)}
              </span>
            </div>

            <p className="text-[11px] text-[#6B635D] font-sans">
              Shipping and taxes calculated at checkout.
            </p>

            <div className="pt-2 flex flex-col gap-2">
              <button
                onClick={() => {
                  closeDrawer();
                  navigate('/checkout');
                }}
                className="w-full py-3 bg-[#1C1917] text-[#FAF8F5] text-xs uppercase tracking-[0.2em] font-semibold hover:bg-[#B89758] transition-colors flex items-center justify-center gap-2"
              >
                <span>Proceed to Checkout</span>
                <ArrowRight size={14} />
              </button>

              <button
                onClick={() => {
                  closeDrawer();
                  navigate('/bag');
                }}
                className="w-full py-2 text-center text-xs uppercase tracking-widest text-[#57534E] hover:text-[#1C1917] transition-colors underline underline-offset-4"
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
