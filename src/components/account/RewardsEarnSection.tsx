/**
 * How to Earn Section for SARINE Customer Account.
 * Details verified reward points, patron referral benefits, and birthday perks.
 * Displays only authentic reward structures without unconfigured promises.
 */

import React, { useState } from 'react';
import { Gift, Sparkles, Users, Award, ShoppingBag, Copy, Check, Info } from 'lucide-react';

interface RewardsEarnSectionProps {
  userId?: string;
  userEmail?: string | null;
}

export const RewardsEarnSection: React.FC<RewardsEarnSectionProps> = ({ userId, userEmail }) => {
  const [copied, setCopied] = useState(false);

  // Deterministic patron referral code
  const referralCode = `SARINE-${(userId || 'ATELIER').slice(0, 6).toUpperCase()}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="bg-white p-6 sm:p-8 border border-[#E7DCEB] rounded-xs shadow-xs space-y-8 animate-fadeIn">
      {/* Header */}
      <div>
        <h3 className="font-serif text-xl sm:text-2xl text-[#302438]">How to Earn Rewards</h3>
        <p className="text-xs sm:text-sm text-[#6F6475] mt-1 leading-relaxed">
          Discover how every jewellery purchase, patron referral, and atelier milestone earns you reward credits.
        </p>
      </div>

      {/* Patron Referral Code Banner */}
      <div className="p-5 sm:p-6 bg-gradient-to-r from-[#FAF5FC] to-white border border-[#B69ACF]/50 rounded-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-[#563568] font-bold block">
            Your Personal Patron Referral Code
          </span>
          <p className="text-xs text-[#302438] font-medium">
            Give 10% off to friends • Earn 250 Points (₹250) on their first order
          </p>
          <p className="text-[11px] text-[#6F6475]">
            Share your unique code. Points are credited once their jewellery piece is delivered.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="px-3.5 py-2 bg-white border border-[#563568]/30 rounded-xs font-mono font-semibold text-xs text-[#563568] tracking-widest">
            {referralCode}
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="min-h-[44px] px-4 py-2 bg-[#563568] hover:bg-[#80609A] text-white text-xs font-medium rounded-xs transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0"
            aria-label="Copy referral code"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            <span>{copied ? 'Copied' : 'Copy Code'}</span>
          </button>
        </div>
      </div>

      {/* 4 Pillars of Earning */}
      <div className="space-y-4">
        <h4 className="font-serif text-base text-[#302438]">Ways to Earn Atelier Points</h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          {/* 1. Shopping Points */}
          <div className="p-5 border border-[#E7DCEB] rounded-xs bg-white space-y-2">
            <div className="w-9 h-9 rounded-full bg-[#FAF5FC] border border-[#E7DCEB] flex items-center justify-center text-[#563568]">
              <ShoppingBag size={16} />
            </div>
            <h5 className="font-semibold text-[#302438] text-sm">1 Point per ₹100 Spent</h5>
            <p className="text-[#6F6475] leading-relaxed">
              Earn 1 reward point for every ₹100 spent across all collections. Points activate automatically 7 days after delivery (post-return inspection window).
            </p>
          </div>

          {/* 2. Referrals */}
          <div className="p-5 border border-[#E7DCEB] rounded-xs bg-white space-y-2">
            <div className="w-9 h-9 rounded-full bg-[#FAF5FC] border border-[#E7DCEB] flex items-center justify-center text-[#563568]">
              <Users size={16} />
            </div>
            <h5 className="font-semibold text-[#302438] text-sm">250 Points per Patron Referral</h5>
            <p className="text-[#6F6475] leading-relaxed">
              When friends place their first purchase using your referral code, they receive 10% off and 250 points are deposited to your account.
            </p>
          </div>

          {/* 3. Birthday Celebrations */}
          <div className="p-5 border border-[#E7DCEB] rounded-xs bg-white space-y-2">
            <div className="w-9 h-9 rounded-full bg-[#FAF5FC] border border-[#E7DCEB] flex items-center justify-center text-[#563568]">
              <Gift size={16} />
            </div>
            <h5 className="font-semibold text-[#302438] text-sm">₹500 Birthday Month Credit</h5>
            <p className="text-[#6F6475] leading-relaxed">
              Celebrate your milestone with a bespoke ₹500 voucher credited to your registered profile during your birthday month.
            </p>
          </div>

          {/* 4. Atelier Sign Up */}
          <div className="p-5 border border-[#E7DCEB] rounded-xs bg-white space-y-2">
            <div className="w-9 h-9 rounded-full bg-[#FAF5FC] border border-[#E7DCEB] flex items-center justify-center text-[#563568]">
              <Award size={16} />
            </div>
            <h5 className="font-semibold text-[#302438] text-sm">100 Welcome Points</h5>
            <p className="text-[#6F6475] leading-relaxed">
              Enjoy 100 introductory points upon creating your member profile to begin your demi-fine jewellery collection.
            </p>
          </div>
        </div>
      </div>

      {/* Program Integrity Policy */}
      <div className="p-4 bg-[#FAF5FC] border border-[#E7DCEB] rounded-xs text-xs text-[#6F6475] space-y-2">
        <div className="flex items-center gap-1.5 font-semibold text-[#563568]">
          <Info size={14} />
          <span>Reward Integrity & Settlement Guidelines</span>
        </div>
        <ul className="list-disc pl-5 space-y-1">
          <li>Points are strictly non-transferable and tied to your authenticated Firebase member account.</li>
          <li>If an order is cancelled or refunded, points earned from that order are reversed.</li>
          <li>Points remain active for 365 days from the date of issue.</li>
        </ul>
      </div>
    </div>
  );
};
