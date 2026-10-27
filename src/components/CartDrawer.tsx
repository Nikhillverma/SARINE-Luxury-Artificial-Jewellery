/**
 * CartDrawer component for SARINE.
 * Luxury slide-in drawer displaying bag lines, free-shipping progress tracker,
 * coupon codes, Move to Wishlist action, subtotal in INR, and seamless checkout progression.
 */

import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { formatInr } from '../utils/currency';
import { X, ShoppingBag, Trash2, ArrowRight, AlertCircle, Heart, Tag, Check, Sparkles } from 'lucide-react';

const FREE_GIFT_BOX_THRESHOLD = 1500;

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

  const { toggleWishlist } = useWishlist();

  // Coupon state
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number } | null>(() => {
    try {
      const saved = localStorage.getItem('sarine_applied_coupon');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [couponError, setCouponError] = useState<string | null>(null);

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

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    setCouponError(null);
    const code = couponInput.trim().toUpperCase();

    if (code === 'SARINE10') {
      const discount = Math.round(subtotal * 0.1);
      const couponObj = { code, discount };
      setAppliedCoupon(couponObj);
      localStorage.setItem('sarine_applied_coupon', JSON.stringify(couponObj));
      setCouponInput('');
    } else if (code === 'WELCOME50') {
      const discount = 50;
      const couponObj = { code, discount };
      setAppliedCoupon(couponObj);
      localStorage.setItem('sarine_applied_coupon', JSON.stringify(couponObj));
      setCouponInput('');
    } else if (code === 'FESTIVE100') {
      if (subtotal < 1500) {
        setCouponError('FESTIVE100 requires minimum order value of ₹1,500');
        return;
      }
      const discount = 100;
      const couponObj = { code, discount };
      setAppliedCoupon(couponObj);
      localStorage.setItem('sarine_applied_coupon', JSON.stringify(couponObj));
      setCouponInput('');
    } else {
      setCouponError('Invalid coupon code. Try SARINE10 or WELCOME50.');
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    localStorage.removeItem('sarine_applied_coupon');
  };

  const handleSaveToWishlist = (item: any) => {
    toggleWishlist(item.product);
    removeItem(item.productId);
  };

  const currentDiscount = appliedCoupon ? appliedCoupon.discount : 0;
  const finalTotal = Math.max(0, subtotal - currentDiscount);

  // Free gift box progress
  const progressPercent = Math.min(100, Math.round((subtotal / FREE_GIFT_BOX_THRESHOLD) * 100));
  const amountToGift = Math.max(0, FREE_GIFT_BOX_THRESHOLD - subtotal);

  return (
    <div className="fixed inset-0 z-50 flex justify-end font-sans">
      {/* Dimmed backdrop */}
      <div
        onClick={closeDrawer}
        className="fixed inset-0 bg-[#302438]/40 backdrop-blur-xs transition-opacity duration-300"
        aria-hidden="true"
      />

      {/* Slide-over panel */}
      <aside
        className="relative w-full max-w-md bg-white text-[#302438] h-full shadow-2xl flex flex-col z-10 border-l border-[#E7DCEB] animate-in slide-in-from-right duration-300"
        role="dialog"
        aria-label="Shopping Bag"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#E7DCEB] flex items-center justify-between bg-white">
          <div className="flex items-baseline gap-2">
            <h2 className="font-serif text-xl sm:text-2xl font-normal tracking-tight text-[#302438]">
              Shopping Bag
            </h2>
            <span className="text-[11px] uppercase tracking-widest text-[#6F6475]">
              ({itemCount} {itemCount === 1 ? 'piece' : 'pieces'})
            </span>
          </div>
          <button
            onClick={closeDrawer}
            className="p-1.5 text-[#6F6475] hover:text-[#563568] transition-colors cursor-pointer"
            aria-label="Close Shopping Bag"
          >
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>

        {/* Free Gift Packaging Progress Bar */}
        {items.length > 0 && (
          <div className="bg-[#FAF5FC] border-b border-[#E7DCEB] px-4 py-2.5">
            <div className="flex items-center justify-between text-[11px] mb-1.5 font-sans">
              <span className="text-[#563568] font-medium flex items-center gap-1">
                <Sparkles size={12} className="text-[#D9B8A0]" />
                {amountToGift > 0 ? (
                  <span>Add {formatInr(amountToGift)} for Complimentary Luxury Velvet Box</span>
                ) : (
                  <span>Unlocked! You unlocked Complimentary Luxury Velvet Box</span>
                )}
              </span>
              <span className="text-[#6F6475]">{progressPercent}%</span>
            </div>
            <div className="w-full bg-[#E7DCEB] h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-[#563568] h-full transition-all duration-500 ease-out"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Availability Notification Banner */}
        {availabilityNotice && (
          <div className="bg-[#F7F0FA] border-b border-[#E7DCEB] p-3 text-xs text-[#6F6475] flex items-start justify-between gap-2">
            <div className="flex items-start gap-2">
              <AlertCircle size={15} className="text-[#563568] shrink-0 mt-0.5" />
              <span>{availabilityNotice}</span>
            </div>
            <button
              onClick={dismissNotice}
              className="text-[#6F6475] hover:text-[#302438] text-xs font-medium cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Bag Items List or Empty State */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 divide-y divide-[#E7DCEB]">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6">
              <ShoppingBag size={40} strokeWidth={1.2} className="text-[#B69ACF] mb-3" />
              <h3 className="font-serif text-xl text-[#302438] font-normal">Your bag is empty</h3>
              <p className="text-xs text-[#6F6475] mt-2 max-w-xs leading-relaxed">
                Explore our curated handcrafted collections to discover chokers, jhumkas, rings, and bangles.
              </p>
              <button
                onClick={() => {
                  closeDrawer();
                  navigate('/shop');
                }}
                className="mt-6 px-7 py-3 bg-[#563568] text-white text-xs uppercase tracking-[0.2em] font-medium hover:bg-[#A184BD] rounded-xs transition-colors shadow-xs cursor-pointer"
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
                    className="w-20 h-24 bg-[#F7F0FA] border border-[#E7DCEB] shrink-0 overflow-hidden rounded-xs"
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
                          className="font-serif text-base text-[#302438] hover:text-[#563568] font-normal line-clamp-1 transition-colors"
                        >
                          {item.product.name}
                        </Link>
                        <button
                          onClick={() => removeItem(item.productId)}
                          className="text-[#6F6475] hover:text-[#DC2626] transition-colors p-1 cursor-pointer"
                          title="Remove item"
                          aria-label={`Remove ${item.product.name}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <p className="text-xs text-[#6F6475] mt-0.5">
                        {formatInr(item.unitPrice)} each
                      </p>
                    </div>

                    {/* Actions Row: Quantity Stepper & Save to Wishlist */}
                    <div className="flex items-end justify-between mt-3">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center border border-[#E7DCEB] bg-white rounded-xs">
                          <button
                            onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                            disabled={item.quantity <= 1}
                            className="w-7 h-7 flex items-center justify-center text-xs text-[#302438] hover:bg-[#F7F0FA] disabled:opacity-30 transition-colors cursor-pointer"
                            aria-label="Decrease quantity"
                          >
                            -
                          </button>
                          <span className="w-8 text-center text-xs font-medium text-[#302438]">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                            disabled={isAtMax}
                            className="w-7 h-7 flex items-center justify-center text-xs text-[#302438] hover:bg-[#F7F0FA] disabled:opacity-30 transition-colors cursor-pointer"
                            aria-label="Increase quantity"
                          >
                            +
                          </button>
                        </div>

                        {/* Save for later / Move to Wishlist */}
                        <button
                          onClick={() => handleSaveToWishlist(item)}
                          className="text-[11px] text-[#6F6475] hover:text-[#563568] inline-flex items-center gap-1 cursor-pointer"
                          title="Save to Wishlist"
                        >
                          <Heart size={12} />
                          <span>Save</span>
                        </button>
                      </div>

                      <div className="text-right">
                        <span className="text-sm font-medium text-[#302438]">
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
          <div className="p-4 sm:p-5 border-t border-[#E7DCEB] bg-[#F7F0FA] space-y-3">
            {/* Coupon Code Section */}
            <div>
              {appliedCoupon ? (
                <div className="flex items-center justify-between bg-white px-3 py-2 border border-[#B69ACF] rounded-xs text-xs">
                  <span className="text-emerald-700 font-medium flex items-center gap-1.5">
                    <Tag size={13} />
                    <span>Coupon {appliedCoupon.code} applied (-{formatInr(appliedCoupon.discount)})</span>
                  </span>
                  <button
                    onClick={handleRemoveCoupon}
                    className="text-[#6F6475] hover:text-[#DC2626] text-xs font-semibold cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <form onSubmit={handleApplyCoupon} className="flex gap-2">
                  <input
                    type="text"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value)}
                    placeholder="Enter coupon (e.g. SARINE10)"
                    className="flex-1 px-3 py-1.5 bg-white border border-[#E7DCEB] rounded-xs text-xs uppercase focus:outline-none focus:border-[#563568]"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-white border border-[#563568] text-[#563568] hover:bg-[#563568] hover:text-white text-xs font-medium rounded-xs transition-colors cursor-pointer"
                  >
                    Apply
                  </button>
                </form>
              )}
              {couponError && <p className="text-[11px] text-[#DC2626] mt-1">{couponError}</p>}
            </div>

            {/* Calculations Breakdown */}
            <div className="space-y-1.5 pt-1 text-xs text-[#6F6475]">
              <div className="flex items-baseline justify-between">
                <span>Subtotal</span>
                <span className="font-medium text-[#302438]">{formatInr(subtotal)}</span>
              </div>
              {appliedCoupon && (
                <div className="flex items-baseline justify-between text-emerald-700">
                  <span>Promotional Discount</span>
                  <span>-{formatInr(appliedCoupon.discount)}</span>
                </div>
              )}
              <div className="flex items-baseline justify-between">
                <span>Pan-India Delivery</span>
                <span className="text-emerald-700 font-medium">Complimentary</span>
              </div>
              <div className="flex items-baseline justify-between pt-2 border-t border-[#E7DCEB] text-sm font-medium text-[#302438]">
                <span>Total Payable</span>
                <span className="text-base font-serif">{formatInr(finalTotal)}</span>
              </div>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <button
                onClick={() => {
                  closeDrawer();
                  navigate('/checkout');
                }}
                className="w-full py-3 bg-[#563568] text-white text-xs uppercase tracking-[0.2em] font-medium hover:bg-[#A184BD] transition-colors flex items-center justify-center gap-2 rounded-xs shadow-xs cursor-pointer"
              >
                <span>Proceed to Checkout</span>
                <ArrowRight size={13} />
              </button>

              <button
                onClick={() => {
                  closeDrawer();
                  navigate('/bag');
                }}
                className="w-full py-1 text-center text-xs uppercase tracking-[0.18em] text-[#6F6475] hover:text-[#563568] transition-colors underline underline-offset-4 cursor-pointer"
              >
                View Full Bag & Gifting
              </button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
};
