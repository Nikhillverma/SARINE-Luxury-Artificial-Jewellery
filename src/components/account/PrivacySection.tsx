/**
 * Privacy Policy Section for SARINE Customer Account.
 * Displays SARINE's published data protection policies,
 * zero payment-card retention commitment, and customer privacy rights.
 */

import React from 'react';
import { ShieldCheck, Lock, Eye, FileText, CheckCircle2, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export const PrivacySection: React.FC = () => {
  return (
    <div className="bg-white p-6 sm:p-8 border border-[#E7DCEB] rounded-xs shadow-xs space-y-8 animate-fadeIn">
      {/* Header */}
      <div>
        <h3 className="font-serif text-xl sm:text-2xl text-[#302438]">Privacy & Data Protection</h3>
        <p className="text-xs sm:text-sm text-[#6F6475] mt-1 leading-relaxed">
          How SARINE safeguards your member credentials, order histories, and personal information.
        </p>
      </div>

      {/* Trust & Non-Card Retention Pledge */}
      <div className="p-5 bg-gradient-to-r from-[#FAF5FC] to-white border border-[#B69ACF]/50 rounded-xs flex items-start gap-3.5">
        <ShieldCheck size={22} className="text-[#563568] shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs text-[#302438]">
          <span className="font-semibold text-sm text-[#563568] block">
            Zero Payment Card Retention Guarantee
          </span>
          <p className="text-[#6F6475] leading-relaxed">
            SARINE never collects, views, or stores your credit card numbers, debit card details, CVVs, or NetBanking passwords.
            All monetary transactions are processed directly by RBI-authorized payment aggregator <strong>Razorpay</strong> over bank-grade 256-bit SSL encryption.
          </p>
        </div>
      </div>

      {/* Core Privacy Tenets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
        {/* 1. Information Collection */}
        <div className="p-4 border border-[#E7DCEB] rounded-xs bg-white space-y-2">
          <div className="w-8 h-8 rounded-full bg-[#FAF5FC] text-[#563568] flex items-center justify-center font-bold">
            <Lock size={15} />
          </div>
          <h4 className="font-semibold text-[#302438]">Data Collected Solely for Order Fulfillment</h4>
          <p className="text-[#6F6475] leading-relaxed">
            We store only your name, verified email, delivery mobile number, and destination address required to craft your tax invoice and dispatch your courier safely.
          </p>
        </div>

        {/* 2. No Third-Party Selling */}
        <div className="p-4 border border-[#E7DCEB] rounded-xs bg-white space-y-2">
          <div className="w-8 h-8 rounded-full bg-[#FAF5FC] text-[#563568] flex items-center justify-center font-bold">
            <Eye size={15} />
          </div>
          <h4 className="font-semibold text-[#302438]">No Third-Party Selling or Telemarketing</h4>
          <p className="text-[#6F6475] leading-relaxed">
            SARINE does not sell, trade, or rent customer personal information to third-party ad networks or unauthorized data brokers.
          </p>
        </div>

        {/* 3. Server Authorization */}
        <div className="p-4 border border-[#E7DCEB] rounded-xs bg-white space-y-2">
          <div className="w-8 h-8 rounded-full bg-[#FAF5FC] text-[#563568] flex items-center justify-center font-bold">
            <ShieldCheck size={15} />
          </div>
          <h4 className="font-semibold text-[#302438]">Customer Data Isolation</h4>
          <p className="text-[#6F6475] leading-relaxed">
            Orders and saved addresses are strictly isolated to your authenticated Firebase UID. No client or external user can view or modify another patron's account.
          </p>
        </div>

        {/* 4. Customer Rights */}
        <div className="p-4 border border-[#E7DCEB] rounded-xs bg-white space-y-2">
          <div className="w-8 h-8 rounded-full bg-[#FAF5FC] text-[#563568] flex items-center justify-center font-bold">
            <FileText size={15} />
          </div>
          <h4 className="font-semibold text-[#302438]">Right to Rectification & Erasure</h4>
          <p className="text-[#6F6475] leading-relaxed">
            You may edit your saved addresses, update contact details, or request full account deactivation at any time by contacting our atelier concierge.
          </p>
        </div>
      </div>

      {/* Link to Full Legal Document */}
      <div className="pt-4 border-t border-[#E7DCEB] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="font-semibold text-xs text-[#302438] block">Read SARINE’s Complete Legal Terms</span>
          <p className="text-[11px] text-[#6F6475]">
            Last updated January 2026 • Compliant with Indian Information Technology (IT) Act & DPDP Act guidelines.
          </p>
        </div>

        <Link
          to="/privacy-policy"
          className="min-h-[44px] px-5 py-2.5 border border-[#563568] text-[#563568] hover:bg-[#FAF5FC] text-xs font-medium rounded-xs transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          <span>View Full Privacy Policy</span>
          <ArrowRight size={13} />
        </Link>
      </div>
    </div>
  );
};
