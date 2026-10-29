/**
 * How to Redeem Section for SARINE Customer Account.
 * Details point-to-rupee valuation, minimum thresholds, exclusions,
 * and step-by-step redemption process at checkout.
 */

import React from 'react';
import { Coins, CheckCircle2, ArrowRight, ShieldAlert, Sparkles, ShoppingBag, CreditCard } from 'lucide-react';
import { Link } from 'react-router-dom';

export const RewardsRedeemSection: React.FC = () => {
  return (
    <div className="bg-white p-6 sm:p-8 border border-[#E7DCEB] rounded-xs shadow-xs space-y-8 animate-fadeIn">
      {/* Header */}
      <div>
        <h3 className="font-serif text-xl sm:text-2xl text-[#302438]">How to Redeem Points</h3>
        <p className="text-xs sm:text-sm text-[#6F6475] mt-1 leading-relaxed">
          Use your earned atelier reward points as an instant discount during checkout.
        </p>
      </div>

      {/* Point Valuation Banner */}
      <div className="p-5 sm:p-6 bg-gradient-to-r from-[#FAF5FC] to-white border border-[#B69ACF]/50 rounded-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-[#563568] font-bold block">
            Guaranteed Valuation
          </span>
          <p className="font-serif text-xl sm:text-2xl text-[#302438]">
            1 Reward Point = <span className="text-[#563568] font-normal">₹1 INR</span>
          </p>
          <p className="text-xs text-[#6F6475]">
            Transparent 1:1 rupee parity with zero complex conversion formulas.
          </p>
        </div>

        <Link
          to="/shop"
          className="min-h-[44px] px-5 py-2.5 bg-[#563568] hover:bg-[#80609A] text-white text-xs font-medium rounded-xs transition-colors shadow-xs flex items-center gap-2 cursor-pointer shrink-0"
        >
          <span>Explore Jewellery</span>
          <ArrowRight size={14} />
        </Link>
      </div>

      {/* Step-by-Step Checkout Process */}
      <div className="space-y-4">
        <h4 className="font-serif text-base text-[#302438]">Redemption at Checkout in 3 Steps</h4>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          {/* Step 1 */}
          <div className="p-4 border border-[#E7DCEB] rounded-xs bg-white space-y-2">
            <div className="w-8 h-8 rounded-full bg-[#563568] text-white flex items-center justify-center font-bold text-xs">
              1
            </div>
            <h5 className="font-semibold text-[#302438]">Add Pieces to Shopping Bag</h5>
            <p className="text-[#6F6475] leading-relaxed">
              Curate your favorite 925 silver chokers, studs, bracelets, or vermeil rings into your bag.
            </p>
          </div>

          {/* Step 2 */}
          <div className="p-4 border border-[#E7DCEB] rounded-xs bg-white space-y-2">
            <div className="w-8 h-8 rounded-full bg-[#563568] text-white flex items-center justify-center font-bold text-xs">
              2
            </div>
            <h5 className="font-semibold text-[#302438]">Apply Points in Order Summary</h5>
            <p className="text-[#6F6475] leading-relaxed">
              At checkout, select "Redeem Points". Enter any amount up to 20% of your cart subtotal.
            </p>
          </div>

          {/* Step 3 */}
          <div className="p-4 border border-[#E7DCEB] rounded-xs bg-white space-y-2">
            <div className="w-8 h-8 rounded-full bg-[#563568] text-white flex items-center justify-center font-bold text-xs">
              3
            </div>
            <h5 className="font-semibold text-[#302438]">Instant Price Reduction</h5>
            <p className="text-[#6F6475] leading-relaxed">
              Your final payable total updates instantly before Razorpay payment authorization.
            </p>
          </div>
        </div>
      </div>

      {/* Key Redemption Rules & Exclusions */}
      <div className="space-y-4">
        <h4 className="font-serif text-base text-[#302438]">Redemption Terms & Conditions</h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-4 border border-[#E7DCEB] rounded-xs bg-white space-y-1.5">
            <h5 className="font-medium text-[#302438] flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-[#047857]" />
              <span>Minimum Threshold: 250 Points</span>
            </h5>
            <p className="text-[#6F6475] leading-relaxed">
              Redemption begins once your active balance reaches 250 points (₹250). Points can be accumulated across multiple purchases.
            </p>
          </div>

          <div className="p-4 border border-[#E7DCEB] rounded-xs bg-white space-y-1.5">
            <h5 className="font-medium text-[#302438] flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-[#047857]" />
              <span>Maximum 20% Cart Value Offset</span>
            </h5>
            <p className="text-[#6F6475] leading-relaxed">
              To ensure sustainable craft economics, points may be applied for up to 20% of an order's subtotal value.
            </p>
          </div>

          <div className="p-4 border border-[#E7DCEB] rounded-xs bg-white space-y-1.5">
            <h5 className="font-medium text-[#302438] flex items-center gap-1.5">
              <ShieldAlert size={14} className="text-[#735135]" />
              <span>Non-Cash Equivalence</span>
            </h5>
            <p className="text-[#6F6475] leading-relaxed">
              Reward points are store credits redeemable exclusively on SARINE jewellery and cannot be encashed or withdrawn as currency.
            </p>
          </div>

          <div className="p-4 border border-[#E7DCEB] rounded-xs bg-white space-y-1.5">
            <h5 className="font-medium text-[#302438] flex items-center gap-1.5">
              <Sparkles size={14} className="text-[#563568]" />
              <span>365-Day Validity</span>
            </h5>
            <p className="text-[#6F6475] leading-relaxed">
              Points remain valid for 1 full year from issuance, giving you ample time to plan celebratory gifting.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
