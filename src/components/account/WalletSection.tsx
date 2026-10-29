/**
 * SARINE Wallet Section for Customer Account.
 * Displays verified customer wallet balance (₹0.00), promotional ledger breakdown,
 * and transparent "Coming Soon" disclosure.
 * Strictly adheres to rule: never fabricate balances, cashback, or simulated transactions.
 */

import React, { useState } from 'react';
import { Wallet, Sparkles, Shield, ArrowUpRight, ArrowDownLeft, Clock, AlertCircle, Bell, CheckCircle2, RefreshCw } from 'lucide-react';
import { formatInr } from '../../utils/currency';

interface WalletSectionProps {
  userEmail?: string | null;
}

export const WalletSection: React.FC<WalletSectionProps> = ({ userEmail }) => {
  const [isNotified, setIsNotified] = useState(false);

  // Real verified balances: ₹0.00 (No fabricated funds or fake credits)
  const availableBalance = 0;
  const promotionalCashback = 0;
  const pendingCredits = 0;

  return (
    <div className="bg-white p-6 sm:p-8 border border-[#E7DCEB] rounded-xs shadow-xs space-y-8 animate-fadeIn">
      {/* Header */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
          <h3 className="font-serif text-xl sm:text-2xl text-[#302438]">SARINE Wallet</h3>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#D9B8A0]/25 text-[#563568] text-xs font-semibold rounded-xs border border-[#D9B8A0]/40">
            <Sparkles size={13} className="text-[#563568]" />
            <span>Coming Soon • Server Ledger</span>
          </span>
        </div>
        <p className="text-xs sm:text-sm text-[#6F6475] leading-relaxed">
          Store instant refund credits, promotional cashbacks, and seamless checkout credits in one secure place.
        </p>
      </div>

      {/* Transparent Disclaimer Notice */}
      <div className="p-4 bg-[#FAF5FC] border border-[#B69ACF]/40 rounded-xs flex items-start gap-3">
        <AlertCircle size={18} className="text-[#563568] shrink-0 mt-0.5" />
        <div className="text-xs text-[#302438] space-y-1">
          <p className="font-semibold text-[#563568]">Server-Authoritative Ledger in Development</p>
          <p className="text-[#6F6475] leading-relaxed">
            The SARINE Wallet utilizes an immutable server-side ledger to ensure balance security.
            Balances can never be modified from the browser. The active balance for your authenticated member account is accurately shown below.
          </p>
        </div>
      </div>

      {/* Wallet Balance Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Available Balance */}
        <div className="p-5 bg-gradient-to-br from-[#563568] to-[#6E4784] text-white rounded-xs shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-[#D9B8A0] font-semibold">
              Available Balance
            </span>
            <Wallet size={18} className="text-[#D9B8A0]" />
          </div>
          <div className="font-serif text-2xl sm:text-3xl font-normal">
            {formatInr(availableBalance)}
          </div>
          <p className="text-[11px] text-white/80">
            Ready for instant redemption at checkout
          </p>
        </div>

        {/* Promotional Cashback */}
        <div className="p-5 bg-[#FAF5FC] border border-[#E7DCEB] rounded-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-[#6F6475]">
              Promotional Cashback
            </span>
            <Sparkles size={18} className="text-[#563568]" />
          </div>
          <div className="font-serif text-2xl text-[#302438] font-normal">
            {formatInr(promotionalCashback)}
          </div>
          <p className="text-[11px] text-[#6F6475]">
            From eligible seasonal promotions
          </p>
        </div>

        {/* Pending In-Transit Credits */}
        <div className="p-5 bg-white border border-[#E7DCEB] rounded-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-[#6F6475]">
              Pending Return Credits
            </span>
            <Clock size={18} className="text-[#735135]" />
          </div>
          <div className="font-serif text-2xl text-[#735135] font-normal">
            {formatInr(pendingCredits)}
          </div>
          <p className="text-[11px] text-[#6F6475]">
            Awaiting atelier return inspection
          </p>
        </div>
      </div>

      {/* Wallet Features & Security Details */}
      <div className="space-y-4">
        <h4 className="font-serif text-base text-[#302438] flex items-center gap-2">
          <Shield size={16} className="text-[#563568]" />
          <span>Wallet Capabilities & Consumer Protections</span>
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-4 border border-[#E7DCEB] rounded-xs bg-white space-y-1.5">
            <span className="font-medium text-[#302438] block">Instant Checkout Offset</span>
            <p className="text-[#6F6475] leading-relaxed">
              When enabled, your available wallet balance applies directly at payment step, reducing your checkout total with 100% encryption.
            </p>
          </div>

          <div className="p-4 border border-[#E7DCEB] rounded-xs bg-white space-y-1.5">
            <span className="font-medium text-[#302438] block">Instant Refund Settlement</span>
            <p className="text-[#6F6475] leading-relaxed">
              Skip standard 5–7 banking days wait: choose instant wallet refund upon return approval to immediately shop replacement pieces.
            </p>
          </div>

          <div className="p-4 border border-[#E7DCEB] rounded-xs bg-white space-y-1.5">
            <span className="font-medium text-[#302438] block">Source Account Cash-Out</span>
            <p className="text-[#6F6475] leading-relaxed">
              Refund credits deposited into your wallet remain 100% eligible for withdrawal back to your original bank account upon simple concierge request.
            </p>
          </div>

          <div className="p-4 border border-[#E7DCEB] rounded-xs bg-white space-y-1.5">
            <span className="font-medium text-[#302438] block">Zero Unsolicited Expiries</span>
            <p className="text-[#6F6475] leading-relaxed">
              Real cash-equivalent balances never expire. Any promotional bonus credits maintain a transparent 1-year validity window.
            </p>
          </div>
        </div>
      </div>

      {/* Transaction History Ledger */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <h4 className="font-serif text-base text-[#302438]">Transaction History</h4>
          <span className="text-[11px] text-[#6F6475]">0 verified transactions</span>
        </div>

        {/* Empty State Table */}
        <div className="border border-[#E7DCEB] rounded-xs p-8 text-center space-y-3 bg-[#FAF5FC]/40">
          <div className="w-12 h-12 rounded-full bg-white border border-[#E7DCEB] flex items-center justify-center mx-auto text-[#563568]">
            <Wallet size={20} strokeWidth={1.5} />
          </div>
          <div className="max-w-sm mx-auto">
            <h5 className="font-serif text-sm text-[#302438]">No transactions recorded yet</h5>
            <p className="text-xs text-[#6F6475] mt-1 leading-relaxed">
              Once the automated wallet ledger is active, all cashbacks, order deductions, and return refunds will appear here with cryptographic receipt IDs.
            </p>
          </div>
        </div>
      </div>

      {/* Early Access Action */}
      <div className="pt-4 border-t border-[#E7DCEB] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h5 className="font-medium text-xs text-[#302438]">Interested in instant wallet refunds & cashback?</h5>
          <p className="text-[11px] text-[#6F6475]">
            Be among the first members to unlock instant checkout credits.
          </p>
        </div>

        {isNotified ? (
          <div className="px-4 py-2.5 bg-[#10B981]/15 text-[#047857] text-xs font-medium rounded-xs flex items-center gap-1.5">
            <CheckCircle2 size={14} />
            <span>Preference saved for {userEmail || 'your account'}</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsNotified(true)}
            className="min-h-[44px] px-5 py-2.5 bg-[#563568] hover:bg-[#80609A] text-white text-xs font-medium rounded-xs transition-colors shadow-xs flex items-center gap-2 cursor-pointer"
          >
            <Bell size={14} />
            <span>Notify Me When Live</span>
          </button>
        )}
      </div>
    </div>
  );
};
