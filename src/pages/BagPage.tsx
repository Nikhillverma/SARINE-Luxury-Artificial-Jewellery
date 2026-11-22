/**
 * BagPage component for SARINE.
 * Full-page shopping bag view with item rows, quantity adjustment bounded by stock,
 * save to wishlist, coupon discounts, gifting options, subtotal summary in INR,
 * and seamless checkout progression.
 */

import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { formatInr } from '../utils/currency';
import { calculateShippingFee } from '../config/store';
import { useCheckoutConfig } from '../hooks/useCheckoutConfig';
import { validateStorefrontCoupon } from '../services/hostinger/hostingerMarketingService';
import { ShoppingBag, Trash2, ArrowLeft, ArrowRight, AlertCircle, Heart, Gift, Tag, Sparkles } from 'lucide-react';

const FREE_GIFT_BOX_THRESHOLD = 1500;

export const BagPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    items,
    itemCount,
    subtotal,
    storewideDiscountPercent,
    storewideCampaign,
    promotionDiscount,
    updateQuantity,
    removeItem,
    clearCart,
    availabilityNotice,
    dismissNotice
  } = useCart();

  const { toggleWishlist } = useWishlist();
  const { config: checkoutConfig } = useCheckoutConfig();

  // Coupon state
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number; subtotal: number } | null>(() => {
    try {
      const saved = localStorage.getItem('sarine_applied_coupon');
      const parsed = saved ? JSON.parse(saved) : null;
      return parsed && typeof parsed.code === 'string' && Number.isFinite(Number(parsed.subtotal))
        ? { code: parsed.code, discount: Number(parsed.discount) || 0, subtotal: Number(parsed.subtotal) }
        : null;
    } catch {
      return null;
    }
  });
  const [couponError, setCouponError] = useState<string | null>(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const activeCoupon = !storewideDiscountPercent && appliedCoupon && appliedCoupon.subtotal === subtotal ? appliedCoupon : null;

  useEffect(() => {
    if (storewideDiscountPercent > 0) {
      setAppliedCoupon(null);
      localStorage.removeItem('sarine_applied_coupon');
      setCouponError(null);
    }
  }, [storewideDiscountPercent]);

  // Gifting state
  const [isGift, setIsGift] = useState(false);
  const [giftNote, setGiftNote] = useState('');

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    setCouponError(null);
    if (storewideDiscountPercent > 0) { setCouponError('A storewide sale is already applied automatically. Coupon codes cannot be combined with this offer.'); return; }
    const code = couponInput.trim().toUpperCase();
    if (!code) {
      setCouponError("Enter a coupon code.");
      return;
    }
    // A newly entered code replaces any previously saved coupon. If validation
    // fails, do not leave the old discount silently applied to this basket.
    setAppliedCoupon(null);
    localStorage.removeItem('sarine_applied_coupon');
    setIsApplyingCoupon(true);
    try {
      const result = await validateStorefrontCoupon(code, subtotal);
      const couponObj = { code: result.code, discount: result.discountAmount, subtotal };
      setAppliedCoupon(couponObj);
      localStorage.setItem('sarine_applied_coupon', JSON.stringify(couponObj));
      setCouponInput('');
    } catch (err) {
      setCouponError(err instanceof Error ? err.message : "This coupon could not be applied.");
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    localStorage.removeItem('sarine_applied_coupon');
  };

  const handleSaveToWishlist = (item: any) => {
    toggleWishlist(item.product);
    removeItem(item.productId, item.variantId);
  };

  const currentDiscount = promotionDiscount + (activeCoupon ? activeCoupon.discount : 0);
  const shippingFee = calculateShippingFee(subtotal, checkoutConfig);
  const finalTotal = Math.max(0, subtotal - currentDiscount) + shippingFee;

  const progressPercent = Math.min(100, Math.round((subtotal / FREE_GIFT_BOX_THRESHOLD) * 100));
  const amountToGift = Math.max(0, FREE_GIFT_BOX_THRESHOLD - subtotal);

  return (
    <div className="min-h-screen bg-[var(--tint)] pb-20 text-[var(--heading)] font-sans">
      {/* Header */}
      <section className="bg-[var(--tint)] border-b border-[var(--border)] py-8 sm:py-12 text-center">
        <div className="site-container">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="h-[1px] w-8 bg-[#FFFFFF]"></span>
            <span className="text-xs uppercase tracking-[0.25em] text-[var(--plum)] font-medium font-sans">
              Your Curated Bag
            </span>
            <span className="h-[1px] w-8 bg-[#FFFFFF]"></span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl text-[var(--heading)] font-normal">
            Shopping Bag
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-[var(--body)] font-sans">
            {itemCount > 0
              ? `Review your ${itemCount} ${itemCount === 1 ? 'piece' : 'pieces'} before checkout.`
              : 'Your bag is currently waiting for your handcrafted selections.'}
          </p>
        </div>
      </section>

      {/* Main Bag Area */}
      <main className="site-container pt-8">
        <div className="max-w-[1050px] mx-auto w-full">
          {/* Availability Notice */}
          {availabilityNotice && (
            <div className="mb-6 bg-white border border-[var(--gold)] p-4 text-xs text-[var(--body)] flex items-center justify-between shadow-xs rounded-xs">
              <div className="flex items-center gap-2.5">
                <AlertCircle size={16} className="text-[var(--plum)] shrink-0" />
                <span>{availabilityNotice}</span>
              </div>
              <button
                onClick={dismissNotice}
                className="text-[var(--plum)] hover:text-[var(--heading)] font-semibold text-xs ml-4 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {items.length === 0 ? (
            /* Empty Bag State */
            <div className="bg-white border border-[var(--border)] p-12 sm:p-16 text-center max-w-xl mx-auto my-8 rounded-xs shadow-xs">
              <ShoppingBag size={48} strokeWidth={1.2} className="mx-auto text-[var(--gold)] mb-4" />
              <h2 className="font-serif text-2xl text-[var(--heading)] font-medium">Your shopping bag is empty</h2>
              <p className="text-xs text-[var(--body)] mt-2 font-sans leading-relaxed">
                Explore our festive chokers, bell jhumkas, delicate cuffs, and cocktail rings.
              </p>
              <div className="mt-6 flex justify-center">
                <Link
                  to="/shop"
                  className="px-8 py-3 bg-[var(--plum)] text-white text-xs uppercase tracking-[0.2em] font-semibold hover:bg-[var(--white)] rounded-xs transition-colors shadow-xs"
                >
                  Browse All Collections
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Free Gift Packaging Tracker Banner */}
              <div className="bg-white p-4 border border-[var(--border)] rounded-xs shadow-2xs">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-[var(--plum)] font-medium flex items-center gap-1.5">
                    <Sparkles size={14} className="text-[#FFFFFF]" />
                    {amountToGift > 0 ? (
                      <span>Add {formatInr(amountToGift)} more to receive Complimentary Velvet Presentation Box</span>
                    ) : (
                      <span className="text-emerald-700">Congratulations! You unlocked Complimentary Luxury Velvet Presentation Box</span>
                    )}
                  </span>
                  <span className="text-[var(--body)] font-mono">{progressPercent}%</span>
                </div>
                <div className="w-full bg-[var(--tint)] h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-[var(--plum)] h-full transition-all duration-500 ease-out"
                    style={{ width: `${progressPercent}%` }}
                  ></div>
                </div>
              </div>

              {/* Two-column layout: Items List (Left 8 cols) & Order Summary (Right 4 cols) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Items Table */}
                <div className="lg:col-span-8 bg-white border border-[var(--border)] rounded-xs shadow-xs">
                  {/* Header Row */}
                  <div className="hidden sm:grid grid-cols-12 gap-4 p-4 border-b border-[var(--border)] text-xs uppercase tracking-wider text-[var(--body)] font-medium font-sans">
                    <span className="col-span-6">Piece</span>
                    <span className="col-span-2 text-center">Unit Price</span>
                    <span className="col-span-2 text-center">Quantity</span>
                    <span className="col-span-2 text-right">Subtotal</span>
                  </div>

                  {/* Line Items */}
                  <div className="divide-y divide-[var(--border)]">
                    {items.map((item) => {
                      const maxStock = item.variant?.stock ?? item.product.stock;
                      const isAtMax = item.quantity >= maxStock;

                      return (
                        <div
                          key={`${item.productId}-${item.variantId || 'default'}`}
                          className="p-4 sm:p-5 flex flex-col sm:grid sm:grid-cols-12 sm:items-center gap-4"
                        >
                          {/* Product Preview & Title (6 cols) */}
                          <div className="sm:col-span-6 flex gap-4">
                            <Link
                              to={`/product/${item.product.slug}`}
                              className="w-20 h-24 bg-[var(--tint)] border border-[var(--border)] shrink-0 overflow-hidden rounded-xs"
                            >
                              <img
                                src={item.product.images[0]}
                                alt={item.product.name}
                                className="w-full h-full object-cover object-center"
                              />
                            </Link>
                            <div className="flex flex-col justify-between">
                              <div>
                                <Link
                                  to={`/product/${item.product.slug}`}
                                  className="font-serif text-base sm:text-lg text-[var(--heading)] hover:text-[var(--plum)] font-medium transition-colors"
                                >
                                  {item.product.name}
                                </Link>
                                <span className="text-[11px] text-[var(--body)] block mt-0.5 font-sans">
                                  SKU: {item.product.id.toUpperCase()}
                                </span>
                                {item.variant && <span className="text-[11px] text-[var(--plum)] block mt-1">{item.variant.label} · SKU: {item.variant.sku}</span>}
                              </div>
                              <div className="flex items-center gap-3 mt-2">
                                <button
                                  onClick={() => removeItem(item.productId, item.variantId)}
                                  className="inline-flex items-center gap-1 text-xs text-[#DC2626] hover:underline cursor-pointer"
                                >
                                  <Trash2 size={12} />
                                  <span>Remove</span>
                                </button>
                                <button
                                  onClick={() => handleSaveToWishlist(item)}
                                  className="inline-flex items-center gap-1 text-xs text-[var(--plum)] hover:underline cursor-pointer"
                                >
                                  <Heart size={12} />
                                  <span>Move to Wishlist</span>
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Unit Price (2 cols) */}
                          <div className="sm:col-span-2 text-left sm:text-center text-xs sm:text-sm font-sans text-[var(--heading)]">
                            <span className="sm:hidden text-[var(--body)] mr-2">Price:</span>
                            {storewideDiscountPercent > 0 ? <><span className="text-[#A43E55] font-semibold">{formatInr(item.discountedUnitPrice)}</span><span className="ml-1 text-[var(--body)] line-through">{formatInr(item.unitPrice)}</span></> : formatInr(item.unitPrice)}
                          </div>

                          {/* Quantity Stepper (2 cols) */}
                          <div className="sm:col-span-2 flex flex-col items-start sm:items-center">
                            <div className="flex items-center border border-[var(--border)] bg-white rounded-xs">
                              <button
                                onClick={() => updateQuantity(item.productId, item.quantity - 1, item.variantId)}
                                disabled={item.quantity <= 1}
                                className="w-7 h-8 flex items-center justify-center text-xs text-[var(--heading)] hover:bg-[var(--tint)] disabled:opacity-30 transition-colors cursor-pointer"
                                aria-label="Decrease quantity"
                              >
                                -
                              </button>
                              <span className="w-8 text-center text-xs font-semibold text-[var(--heading)]">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => updateQuantity(item.productId, item.quantity + 1, item.variantId)}
                                disabled={isAtMax}
                                className="w-7 h-8 flex items-center justify-center text-xs text-[var(--heading)] hover:bg-[var(--tint)] disabled:opacity-30 transition-colors cursor-pointer"
                                aria-label="Increase quantity"
                              >
                                +
                              </button>
                            </div>
                            {isAtMax && (
                              <span className="text-[10px] text-[var(--body)] mt-1 text-center">
                                Max {maxStock} in stock
                              </span>
                            )}
                          </div>

                          {/* Line Total (2 cols) */}
                          <div className="sm:col-span-2 text-left sm:text-right font-serif text-base sm:text-lg font-semibold text-[var(--heading)]">
                            <span className="sm:hidden text-xs text-[var(--body)] font-sans font-normal mr-2">
                              Total:
                            </span>
                            {formatInr(storewideDiscountPercent > 0 ? item.discountedLineTotal : item.lineTotal)}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Gifting Section in Bag */}
                  <div className="p-4 sm:p-5 bg-[var(--tint)] border-t border-[var(--border)]">
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isGift}
                        onChange={(e) => setIsGift(e.target.checked)}
                        className="mt-0.5 accent-[#563568] rounded-xs cursor-pointer"
                      />
                      <div>
                        <span className="text-xs font-medium text-[var(--heading)] flex items-center gap-1.5">
                          <Gift size={13} className="text-[var(--plum)]" />
                          <span>This order is a gift (Complimentary packaging & message card)</span>
                        </span>
                        <p className="text-[11px] text-[var(--body)] mt-0.5">
                          We will conceal prices on packing slips and pack your pieces in our signature satin-ribbon box.
                        </p>
                      </div>
                    </label>

                    {isGift && (
                      <div className="mt-3 pl-6">
                        <textarea
                          value={giftNote}
                          onChange={(e) => setGiftNote(e.target.value.slice(0, 200))}
                          placeholder="Add your personalized message for the recipient..."
                          rows={2}
                          className="w-full p-2.5 text-xs bg-white border border-[var(--border)] focus:border-[var(--plum)] rounded-xs focus:outline-none resize-none"
                        />
                        <div className="text-right text-[10px] text-[var(--body)] mt-1">
                          {giftNote.length}/200 characters
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions Footer */}
                  <div className="p-4 bg-[var(--tint)] border-t border-[var(--border)] flex items-center justify-between">
                    <Link
                      to="/shop"
                      className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-[var(--body)] hover:text-[var(--plum)] transition-colors"
                    >
                      <ArrowLeft size={14} />
                      <span>Continue Shopping</span>
                    </Link>
                    <button
                      onClick={clearCart}
                      className="text-xs uppercase tracking-widest text-[#DC2626] hover:underline cursor-pointer"
                    >
                      Clear Bag
                    </button>
                  </div>
                </div>

                {/* Order Summary (Right 4 cols) */}
                <div className="lg:col-span-4 bg-white border border-[var(--border)] p-6 space-y-4 rounded-xs shadow-xs">
                  <h2 className="font-serif text-xl text-[var(--heading)] font-medium border-b border-[var(--border)] pb-3">
                    Order Summary
                  </h2>

                  {/* Coupon Code Module */}
                  <div className="space-y-2">
                    {activeCoupon && (
                      <div className="flex items-center justify-between bg-[var(--tint)] p-2.5 border border-[var(--gold)] rounded-xs text-xs">
                        <span className="text-emerald-700 font-medium flex items-center gap-1.5">
                          <Tag size={13} />
                          <span>Applied: {activeCoupon.code} (-{formatInr(activeCoupon.discount)})</span>
                        </span>
                        <button
                          type="button"
                          onClick={handleRemoveCoupon}
                          className="text-[var(--body)] hover:text-[#DC2626] cursor-pointer"
                          aria-label="Remove applied coupon"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                    <form onSubmit={handleApplyCoupon} className="flex gap-2">
                      <input
                        type="text"
                        value={couponInput}
                        onChange={(e) => setCouponInput(e.target.value)}
                        placeholder={storewideDiscountPercent > 0 ? "Coupon unavailable during storewide sale" : activeCoupon ? "Enter a different coupon code" : "Enter coupon code"}
                        aria-label="Coupon code"
                        disabled={storewideDiscountPercent > 0}
                        className="flex-1 min-w-0 p-2 bg-[var(--tint)] border border-[var(--border)] text-xs uppercase rounded-xs focus:outline-none focus:border-[var(--plum)]"
                      />
                      <button
                        type="submit"
                        disabled={isApplyingCoupon || storewideDiscountPercent > 0}
                        className="px-3.5 py-2 bg-[var(--plum)] text-white text-xs font-medium rounded-xs hover:bg-[var(--white)] transition-colors cursor-pointer disabled:opacity-60"
                      >
                        {isApplyingCoupon ? 'Checking...' : activeCoupon ? 'Replace' : 'Apply'}
                      </button>
                    </form>
                    {couponError && <p className="text-[11px] text-[#DC2626] mt-1">{couponError}</p>}
                  </div>

                  {/* Price Breakdown */}
                  <div className="space-y-2 pt-2 border-t border-[var(--border)] text-xs font-sans text-[var(--body)]">
                    <div className="flex items-baseline justify-between">
                      <span>Subtotal ({itemCount} {itemCount === 1 ? 'item' : 'items'})</span>
                      <span className="text-[var(--heading)] font-medium">{formatInr(subtotal)}</span>
                    </div>

                    {promotionDiscount > 0 && (
                      <div className="flex items-baseline justify-between text-emerald-700">
                        <span>{storewideCampaign?.offerLabel || (storewideDiscountPercent + "% Storewide Sale")}</span>
                        <span>-{formatInr(promotionDiscount)}</span>
                      </div>
                    )}
                    {activeCoupon && (
                      <div className="flex items-baseline justify-between text-emerald-700">
                        <span>Coupon Discount</span>
                        <span>-{formatInr(activeCoupon.discount)}</span>
                      </div>
                    )}

                    <div className="flex items-baseline justify-between">
                      <span>Shipping (Pan-India)</span>
                      <span className={shippingFee === 0 ? 'text-emerald-700 font-medium' : 'text-[var(--heading)] font-medium'}>{shippingFee === 0 ? 'Complimentary' : formatInr(shippingFee)}</span>
                    </div>

                    <div className="flex items-baseline justify-between pt-3 border-t border-[var(--border)] text-sm text-[var(--heading)]">
                      <span className="font-medium">Total Payable</span>
                      <span className="font-serif text-2xl font-semibold text-[var(--heading)]">
                        {formatInr(finalTotal)}
                      </span>
                    </div>
                  </div>

                  <div className="pt-3">
                    <button
                      onClick={() => navigate('/checkout')}
                      className="w-full py-3.5 bg-[var(--plum)] text-white text-xs uppercase tracking-[0.2em] font-semibold hover:bg-[var(--white)] transition-colors flex items-center justify-center gap-2 rounded-xs shadow-xs cursor-pointer"
                    >
                      <span>Proceed to Checkout</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>

                  {/* Reassurance notes */}
                  <div className="pt-4 border-t border-[var(--border)] text-[11px] text-[var(--body)] space-y-1.5 font-sans">
                    <p>• Complimentary tamper-evident presentation packaging</p>
                    <p>• Verified Razorpay payments (UPI, Cards, NetBanking)</p>
                    <p>• Track your order anytime with live updates</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
