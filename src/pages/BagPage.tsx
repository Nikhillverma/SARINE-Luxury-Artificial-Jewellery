/**
 * BagPage component for SARINE.
 * Full-page shopping bag view with item rows, quantity adjustment bounded by stock,
 * save to wishlist, coupon discounts, gifting options, subtotal summary in INR,
 * and seamless checkout progression.
 */

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { formatInr } from '../utils/currency';
import { ShoppingBag, Trash2, ArrowLeft, ArrowRight, AlertCircle, Heart, Gift, Tag, Sparkles } from 'lucide-react';

const FREE_GIFT_BOX_THRESHOLD = 1500;

export const BagPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    items,
    itemCount,
    subtotal,
    updateQuantity,
    removeItem,
    clearCart,
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

  // Gifting state
  const [isGift, setIsGift] = useState(false);
  const [giftNote, setGiftNote] = useState('');

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
      setCouponError('Invalid code. Try SARINE10 or WELCOME50.');
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

  const progressPercent = Math.min(100, Math.round((subtotal / FREE_GIFT_BOX_THRESHOLD) * 100));
  const amountToGift = Math.max(0, FREE_GIFT_BOX_THRESHOLD - subtotal);

  return (
    <div className="min-h-screen bg-[#F7F0FA] pb-20 text-[#302438] font-sans">
      {/* Header */}
      <section className="bg-[#F0E6F4]/50 border-b border-[#E7DCEB] py-8 sm:py-12 text-center">
        <div className="site-container">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="h-[1px] w-8 bg-[#D9B8A0]"></span>
            <span className="text-xs uppercase tracking-[0.25em] text-[#563568] font-medium font-sans">
              Your Curated Bag
            </span>
            <span className="h-[1px] w-8 bg-[#D9B8A0]"></span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl text-[#302438] font-normal">
            Shopping Bag
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-[#6F6475] font-sans">
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
            <div className="mb-6 bg-white border border-[#B69ACF] p-4 text-xs text-[#6F6475] flex items-center justify-between shadow-xs rounded-xs">
              <div className="flex items-center gap-2.5">
                <AlertCircle size={16} className="text-[#563568] shrink-0" />
                <span>{availabilityNotice}</span>
              </div>
              <button
                onClick={dismissNotice}
                className="text-[#563568] hover:text-[#302438] font-semibold text-xs ml-4 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {items.length === 0 ? (
            /* Empty Bag State */
            <div className="bg-white border border-[#E7DCEB] p-12 sm:p-16 text-center max-w-xl mx-auto my-8 rounded-xs shadow-xs">
              <ShoppingBag size={48} strokeWidth={1.2} className="mx-auto text-[#B69ACF] mb-4" />
              <h2 className="font-serif text-2xl text-[#302438] font-medium">Your shopping bag is empty</h2>
              <p className="text-xs text-[#6F6475] mt-2 font-sans leading-relaxed">
                Explore our festive chokers, bell jhumkas, delicate cuffs, and cocktail rings.
              </p>
              <div className="mt-6 flex justify-center">
                <Link
                  to="/shop"
                  className="px-8 py-3 bg-[#563568] text-white text-xs uppercase tracking-[0.2em] font-semibold hover:bg-[#A184BD] rounded-xs transition-colors shadow-xs"
                >
                  Browse All Collections
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Free Gift Packaging Tracker Banner */}
              <div className="bg-white p-4 border border-[#E7DCEB] rounded-xs shadow-2xs">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-[#563568] font-medium flex items-center gap-1.5">
                    <Sparkles size={14} className="text-[#D9B8A0]" />
                    {amountToGift > 0 ? (
                      <span>Add {formatInr(amountToGift)} more to receive Complimentary Velvet Presentation Box</span>
                    ) : (
                      <span className="text-emerald-700">Congratulations! You unlocked Complimentary Luxury Velvet Presentation Box</span>
                    )}
                  </span>
                  <span className="text-[#6F6475] font-mono">{progressPercent}%</span>
                </div>
                <div className="w-full bg-[#F0E6F4] h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-[#563568] h-full transition-all duration-500 ease-out"
                    style={{ width: `${progressPercent}%` }}
                  ></div>
                </div>
              </div>

              {/* Two-column layout: Items List (Left 8 cols) & Order Summary (Right 4 cols) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Items Table */}
                <div className="lg:col-span-8 bg-white border border-[#E7DCEB] rounded-xs shadow-xs">
                  {/* Header Row */}
                  <div className="hidden sm:grid grid-cols-12 gap-4 p-4 border-b border-[#E7DCEB] text-xs uppercase tracking-wider text-[#6F6475] font-medium font-sans">
                    <span className="col-span-6">Piece</span>
                    <span className="col-span-2 text-center">Unit Price</span>
                    <span className="col-span-2 text-center">Quantity</span>
                    <span className="col-span-2 text-right">Subtotal</span>
                  </div>

                  {/* Line Items */}
                  <div className="divide-y divide-[#E7DCEB]">
                    {items.map((item) => {
                      const maxStock = item.product.stock;
                      const isAtMax = item.quantity >= maxStock;

                      return (
                        <div
                          key={item.productId}
                          className="p-4 sm:p-5 flex flex-col sm:grid sm:grid-cols-12 sm:items-center gap-4"
                        >
                          {/* Product Preview & Title (6 cols) */}
                          <div className="sm:col-span-6 flex gap-4">
                            <Link
                              to={`/product/${item.product.slug}`}
                              className="w-20 h-24 bg-[#F7F0FA] border border-[#E7DCEB] shrink-0 overflow-hidden rounded-xs"
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
                                  className="font-serif text-base sm:text-lg text-[#302438] hover:text-[#563568] font-medium transition-colors"
                                >
                                  {item.product.name}
                                </Link>
                                <span className="text-[11px] text-[#6F6475] block mt-0.5 font-sans">
                                  SKU: {item.product.id.toUpperCase()}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 mt-2">
                                <button
                                  onClick={() => removeItem(item.productId)}
                                  className="inline-flex items-center gap-1 text-xs text-[#DC2626] hover:underline cursor-pointer"
                                >
                                  <Trash2 size={12} />
                                  <span>Remove</span>
                                </button>
                                <button
                                  onClick={() => handleSaveToWishlist(item)}
                                  className="inline-flex items-center gap-1 text-xs text-[#563568] hover:underline cursor-pointer"
                                >
                                  <Heart size={12} />
                                  <span>Move to Wishlist</span>
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Unit Price (2 cols) */}
                          <div className="sm:col-span-2 text-left sm:text-center text-xs sm:text-sm font-sans text-[#302438]">
                            <span className="sm:hidden text-[#6F6475] mr-2">Price:</span>
                            {formatInr(item.unitPrice)}
                          </div>

                          {/* Quantity Stepper (2 cols) */}
                          <div className="sm:col-span-2 flex flex-col items-start sm:items-center">
                            <div className="flex items-center border border-[#E7DCEB] bg-white rounded-xs">
                              <button
                                onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                                disabled={item.quantity <= 1}
                                className="w-7 h-8 flex items-center justify-center text-xs text-[#302438] hover:bg-[#F7F0FA] disabled:opacity-30 transition-colors cursor-pointer"
                                aria-label="Decrease quantity"
                              >
                                -
                              </button>
                              <span className="w-8 text-center text-xs font-semibold text-[#302438]">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                                disabled={isAtMax}
                                className="w-7 h-8 flex items-center justify-center text-xs text-[#302438] hover:bg-[#F7F0FA] disabled:opacity-30 transition-colors cursor-pointer"
                                aria-label="Increase quantity"
                              >
                                +
                              </button>
                            </div>
                            {isAtMax && (
                              <span className="text-[10px] text-[#6F6475] mt-1 text-center">
                                Max {maxStock} in stock
                              </span>
                            )}
                          </div>

                          {/* Line Total (2 cols) */}
                          <div className="sm:col-span-2 text-left sm:text-right font-serif text-base sm:text-lg font-semibold text-[#302438]">
                            <span className="sm:hidden text-xs text-[#6F6475] font-sans font-normal mr-2">
                              Total:
                            </span>
                            {formatInr(item.lineTotal)}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Gifting Section in Bag */}
                  <div className="p-4 sm:p-5 bg-[#FAF5FC] border-t border-[#E7DCEB]">
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isGift}
                        onChange={(e) => setIsGift(e.target.checked)}
                        className="mt-0.5 accent-[#563568] rounded-xs cursor-pointer"
                      />
                      <div>
                        <span className="text-xs font-medium text-[#302438] flex items-center gap-1.5">
                          <Gift size={13} className="text-[#563568]" />
                          <span>This order is a gift (Complimentary packaging & message card)</span>
                        </span>
                        <p className="text-[11px] text-[#6F6475] mt-0.5">
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
                          className="w-full p-2.5 text-xs bg-white border border-[#E7DCEB] focus:border-[#563568] rounded-xs focus:outline-none resize-none"
                        />
                        <div className="text-right text-[10px] text-[#6F6475] mt-1">
                          {giftNote.length}/200 characters
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions Footer */}
                  <div className="p-4 bg-[#F7F0FA] border-t border-[#E7DCEB] flex items-center justify-between">
                    <Link
                      to="/shop"
                      className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-[#6F6475] hover:text-[#563568] transition-colors"
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
                <div className="lg:col-span-4 bg-white border border-[#E7DCEB] p-6 space-y-4 rounded-xs shadow-xs">
                  <h2 className="font-serif text-xl text-[#302438] font-medium border-b border-[#E7DCEB] pb-3">
                    Order Summary
                  </h2>

                  {/* Coupon Code Module */}
                  <div>
                    {appliedCoupon ? (
                      <div className="flex items-center justify-between bg-[#F7F0FA] p-2.5 border border-[#B69ACF] rounded-xs text-xs">
                        <span className="text-emerald-700 font-medium flex items-center gap-1.5">
                          <Tag size={13} />
                          <span>Code {appliedCoupon.code} (-{formatInr(appliedCoupon.discount)})</span>
                        </span>
                        <button
                          onClick={handleRemoveCoupon}
                          className="text-[#6F6475] hover:text-[#DC2626] cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <form onSubmit={handleApplyCoupon} className="flex gap-2">
                        <input
                          type="text"
                          value={couponInput}
                          onChange={(e) => setCouponInput(e.target.value)}
                          placeholder="Promo code (SARINE10)"
                          className="flex-1 p-2 bg-[#F7F0FA] border border-[#E7DCEB] text-xs uppercase rounded-xs focus:outline-none focus:border-[#563568]"
                        />
                        <button
                          type="submit"
                          className="px-3.5 py-2 bg-[#563568] text-white text-xs font-medium rounded-xs hover:bg-[#A184BD] transition-colors cursor-pointer"
                        >
                          Apply
                        </button>
                      </form>
                    )}
                    {couponError && <p className="text-[11px] text-[#DC2626] mt-1">{couponError}</p>}
                  </div>

                  {/* Price Breakdown */}
                  <div className="space-y-2 pt-2 border-t border-[#E7DCEB] text-xs font-sans text-[#6F6475]">
                    <div className="flex items-baseline justify-between">
                      <span>Subtotal ({itemCount} {itemCount === 1 ? 'item' : 'items'})</span>
                      <span className="text-[#302438] font-medium">{formatInr(subtotal)}</span>
                    </div>

                    {appliedCoupon && (
                      <div className="flex items-baseline justify-between text-emerald-700">
                        <span>Coupon Discount</span>
                        <span>-{formatInr(appliedCoupon.discount)}</span>
                      </div>
                    )}

                    <div className="flex items-baseline justify-between">
                      <span>Shipping (Pan-India)</span>
                      <span className="text-emerald-700 font-medium">Complimentary</span>
                    </div>

                    <div className="flex items-baseline justify-between pt-3 border-t border-[#E7DCEB] text-sm text-[#302438]">
                      <span className="font-medium">Total Payable</span>
                      <span className="font-serif text-2xl font-semibold text-[#302438]">
                        {formatInr(finalTotal)}
                      </span>
                    </div>
                  </div>

                  <div className="pt-3">
                    <button
                      onClick={() => navigate('/checkout')}
                      className="w-full py-3.5 bg-[#563568] text-white text-xs uppercase tracking-[0.2em] font-semibold hover:bg-[#A184BD] transition-colors flex items-center justify-center gap-2 rounded-xs shadow-xs cursor-pointer"
                    >
                      <span>Proceed to Checkout</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>

                  {/* Reassurance notes */}
                  <div className="pt-4 border-t border-[#E7DCEB] text-[11px] text-[#6F6475] space-y-1.5 font-sans">
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
