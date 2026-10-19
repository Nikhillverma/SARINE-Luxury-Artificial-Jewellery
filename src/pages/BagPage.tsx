/**
 * BagPage component for SARINE.
 * Full-page shopping bag view with item rows, quantity adjustment bounded by stock,
 * subtotal summary in INR, empty state, and checkout progression.
 */

import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { formatInr } from '../utils/currency';
import { ShoppingBag, Trash2, ArrowLeft, ArrowRight, AlertCircle } from 'lucide-react';

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

  return (
    <div className="min-h-screen bg-[#FAF8F5] pb-16">
      {/* Header */}
      <section className="bg-[#F3EEE7]/50 border-b border-[#E6DFD5] py-8 sm:py-12 px-4 text-center">
        <div className="max-w-[860px] mx-auto">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="h-[1px] w-8 bg-[#B89758]"></span>
            <span className="text-xs uppercase tracking-[0.25em] text-[#B89758] font-medium font-sans">
              Your Selection
            </span>
            <span className="h-[1px] w-8 bg-[#B89758]"></span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl text-[#1C1917] font-normal">
            Shopping Bag
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-[#6B635D] font-sans">
            {itemCount > 0
              ? `You have selected ${itemCount} ${itemCount === 1 ? 'piece' : 'pieces'} for review.`
              : 'Your bag is currently waiting for your handcrafted selections.'}
          </p>
        </div>
      </section>

      {/* Main Bag Area */}
      <main className="max-w-[1280px] mx-auto px-4 sm:px-8 pt-8">
        {/* Availability Notice */}
        {availabilityNotice && (
          <div className="mb-6 bg-white border border-[#B89758] p-4 text-xs text-[#57534E] flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5">
              <AlertCircle size={16} className="text-[#B89758] shrink-0" />
              <span>{availabilityNotice}</span>
            </div>
            <button
              onClick={dismissNotice}
              className="text-[#6B635D] hover:text-[#1C1917] font-semibold text-xs ml-4"
            >
              Dismiss
            </button>
          </div>
        )}

        {items.length === 0 ? (
          /* Empty Bag State */
          <div className="bg-white border border-[#E6DFD5] p-12 sm:p-16 text-center max-w-xl mx-auto my-8">
            <ShoppingBag size={48} strokeWidth={1.2} className="mx-auto text-[#8C847C] mb-4" />
            <h2 className="font-serif text-2xl text-[#1C1917] font-medium">Your shopping bag is empty</h2>
            <p className="text-xs text-[#6B635D] mt-2 font-sans leading-relaxed">
              Explore our festive chokers, bell jhumkas, delicate cuffs, and cocktail rings.
            </p>
            <div className="mt-6 flex justify-center">
              <Link
                to="/shop"
                className="px-8 py-3 bg-[#1C1917] text-[#FAF8F5] text-xs uppercase tracking-[0.2em] font-semibold hover:bg-[#B89758] transition-colors"
              >
                Browse All Collections
              </Link>
            </div>
          </div>
        ) : (
          /* Two-column layout: Items List (Left 8 cols) & Order Summary (Right 4 cols) */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            {/* Items Table */}
            <div className="lg:col-span-8 bg-white border border-[#E6DFD5]">
              {/* Header Row */}
              <div className="hidden sm:grid grid-cols-12 gap-4 p-4 border-b border-[#E6DFD5] text-xs uppercase tracking-wider text-[#6B635D] font-medium font-sans">
                <span className="col-span-6">Piece</span>
                <span className="col-span-2 text-center">Unit Price</span>
                <span className="col-span-2 text-center">Quantity</span>
                <span className="col-span-2 text-right">Subtotal</span>
              </div>

              {/* Line Items */}
              <div className="divide-y divide-[#F0EAE1]">
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
                          className="w-20 h-24 bg-[#F3EEE7] border border-[#E6DFD5] shrink-0 overflow-hidden"
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
                              className="font-serif text-base sm:text-lg text-[#1C1917] hover:text-[#B89758] font-medium transition-colors"
                            >
                              {item.product.name}
                            </Link>
                            <span className="text-[11px] text-[#6B635D] block mt-0.5 font-sans">
                              SKU: {item.product.id.toUpperCase()}
                            </span>
                          </div>
                          <button
                            onClick={() => removeItem(item.productId)}
                            className="inline-flex items-center gap-1 text-xs text-[#8C2F2F] hover:underline mt-2 self-start"
                          >
                            <Trash2 size={13} />
                            <span>Remove</span>
                          </button>
                        </div>
                      </div>

                      {/* Unit Price (2 cols) */}
                      <div className="sm:col-span-2 text-left sm:text-center text-xs sm:text-sm font-sans text-[#57534E]">
                        <span className="sm:hidden text-[#6B635D] mr-2">Price:</span>
                        {formatInr(item.unitPrice)}
                      </div>

                      {/* Quantity Stepper (2 cols) */}
                      <div className="sm:col-span-2 flex flex-col items-start sm:items-center">
                        <div className="flex items-center border border-[#8C847C] bg-white">
                          <button
                            onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                            disabled={item.quantity <= 1}
                            className="w-7 h-8 flex items-center justify-center text-xs text-[#1C1917] hover:bg-[#F3EEE7] disabled:opacity-30 transition-colors"
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
                            className="w-7 h-8 flex items-center justify-center text-xs text-[#1C1917] hover:bg-[#F3EEE7] disabled:opacity-30 transition-colors"
                            aria-label="Increase quantity"
                          >
                            +
                          </button>
                        </div>
                        {isAtMax && (
                          <span className="text-[10px] text-[#6B635D] mt-1 text-center">
                            Max {maxStock} in stock
                          </span>
                        )}
                      </div>

                      {/* Line Total (2 cols) */}
                      <div className="sm:col-span-2 text-left sm:text-right font-serif text-base sm:text-lg font-semibold text-[#1C1917]">
                        <span className="sm:hidden text-xs text-[#6B635D] font-sans font-normal mr-2">
                          Total:
                        </span>
                        {formatInr(item.lineTotal)}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Actions Footer */}
              <div className="p-4 bg-[#FAF8F5] border-t border-[#E6DFD5] flex items-center justify-between">
                <Link
                  to="/shop"
                  className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-[#57534E] hover:text-[#1C1917] transition-colors"
                >
                  <ArrowLeft size={14} />
                  <span>Continue Shopping</span>
                </Link>
                <button
                  onClick={clearCart}
                  className="text-xs uppercase tracking-widest text-[#8C2F2F] hover:underline"
                >
                  Clear Bag
                </button>
              </div>
            </div>

            {/* Order Summary (Right 4 cols) */}
            <div className="lg:col-span-4 bg-white border border-[#E6DFD5] p-6 space-y-4">
              <h2 className="font-serif text-xl text-[#1C1917] font-medium border-b border-[#F0EAE1] pb-3">
                Order Summary
              </h2>

              <div className="flex items-baseline justify-between py-2">
                <span className="text-xs uppercase tracking-widest text-[#57534E] font-sans">
                  Subtotal ({itemCount} {itemCount === 1 ? 'item' : 'items'})
                </span>
                <span className="font-serif text-2xl font-semibold text-[#1C1917]">
                  {formatInr(subtotal)}
                </span>
              </div>

              <div className="text-xs text-[#6B635D] leading-relaxed font-sans pt-1 border-t border-[#F0EAE1]">
                Shipping and taxes calculated at checkout.
              </div>

              <div className="pt-3">
                <button
                  onClick={() => navigate('/checkout')}
                  className="w-full py-3.5 bg-[#1C1917] text-[#FAF8F5] text-xs uppercase tracking-[0.2em] font-semibold hover:bg-[#B89758] transition-colors flex items-center justify-center gap-2"
                >
                  <span>Proceed to Checkout</span>
                  <ArrowRight size={14} />
                </button>
              </div>

              {/* Reassurance notes */}
              <div className="pt-4 border-t border-[#F0EAE1] text-[11px] text-[#6B635D] space-y-1.5 font-sans">
                <p>• Complimentary tamper-evident presentation packaging</p>
                <p>• Secured digital payments with instant confirmation</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
