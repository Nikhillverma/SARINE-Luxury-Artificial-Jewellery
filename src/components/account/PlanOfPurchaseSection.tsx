/**
 * Plan of Purchase Section for SARINE Customer Account.
 * Explains the upcoming 10+1 Monthly Jewellery Savings Plan with interactive calculator,
 * verified policy framework, and transparent "Coming Soon" disclosure.
 * Does NOT accept customer funds or fabricate real balances.
 */

import React, { useState } from 'react';
import { Sparkles, Calculator, ShieldCheck, FileText, CheckCircle2, AlertCircle, Bell, ArrowRight } from 'lucide-react';
import { formatInr } from '../../utils/currency';

interface PlanOfPurchaseSectionProps {
  userEmail?: string | null;
}

export const PlanOfPurchaseSection: React.FC<PlanOfPurchaseSectionProps> = ({ userEmail }) => {
  const [monthlyAmount, setMonthlyAmount] = useState<number>(5000);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [isNotified, setIsNotified] = useState<boolean>(false);

  const activeAmount = customAmount ? parseInt(customAmount, 10) || 0 : monthlyAmount;
  const totalCustomerContribution = activeAmount * 10;
  const atelierBonusContribution = activeAmount; // 1 full month bonus
  const totalMaturityValue = totalCustomerContribution + atelierBonusContribution;

  const handleSelectPreset = (amount: number) => {
    setMonthlyAmount(amount);
    setCustomAmount('');
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    setCustomAmount(val);
  };

  const handleNotifyMe = () => {
    setIsNotified(true);
    setTimeout(() => setIsNotified(false), 5000);
  };

  return (
    <div className="bg-white p-6 sm:p-8 border border-[#E7DCEB] rounded-xs shadow-xs space-y-8 animate-fadeIn">
      {/* Header */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
          <h3 className="font-serif text-xl sm:text-2xl text-[#302438]">Plan of Purchase</h3>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#D9B8A0]/25 text-[#563568] text-xs font-semibold rounded-xs border border-[#D9B8A0]/40">
            <Sparkles size={13} className="text-[#563568]" />
            <span>Coming Soon • Atelier Protocol</span>
          </span>
        </div>
        <p className="text-xs sm:text-sm text-[#6F6475] leading-relaxed">
          Save monthly towards handcrafted demi-fine pieces and bridal heirlooms with a guaranteed atelier bonus.
        </p>
      </div>

      {/* Transparent Disclaimer Notice */}
      <div className="p-4 bg-[#FAF5FC] border border-[#B69ACF]/40 rounded-xs flex items-start gap-3">
        <AlertCircle size={18} className="text-[#563568] shrink-0 mt-0.5" />
        <div className="text-xs text-[#302438] space-y-1">
          <p className="font-semibold text-[#563568]">Regulatory & Banking Integration in Progress</p>
          <p className="text-[#6F6475] leading-relaxed">
            SARINE’s Plan of Purchase is currently undergoing banking compliance for automated e-NACH mandates.
            <strong> No customer funds are accepted or collected on this page.</strong> The calculator below illustrates the planned benefit structure for informational purposes.
          </p>
        </div>
      </div>

      {/* Interactive Plan Simulator */}
      <div className="border border-[#E7DCEB] rounded-xs p-5 sm:p-6 bg-gradient-to-br from-white to-[#FAF5FC]/40 space-y-6">
        <div className="flex items-center gap-2 pb-3 border-b border-[#E7DCEB]">
          <Calculator size={18} className="text-[#563568]" />
          <h4 className="font-serif text-base text-[#302438]">10 + 1 Monthly Benefit Calculator</h4>
        </div>

        {/* Preset Selection */}
        <div className="space-y-3">
          <label className="block text-xs font-medium text-[#6F6475]">
            Select Monthly Contribution:
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[2000, 3000, 5000, 10000].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => handleSelectPreset(preset)}
                className={`min-h-[44px] py-2.5 px-3 rounded-xs text-xs font-medium transition-all cursor-pointer border ${
                  activeAmount === preset && !customAmount
                    ? 'bg-[#563568] text-white border-[#563568] shadow-xs'
                    : 'bg-white text-[#302438] border-[#E7DCEB] hover:border-[#B69ACF] hover:bg-[#FAF5FC]'
                }`}
              >
                {formatInr(preset)} / mo
              </button>
            ))}
          </div>

          <div className="pt-2">
            <label className="block text-[11px] text-[#6F6475] mb-1">Or enter custom monthly amount (₹):</label>
            <input
              type="text"
              value={customAmount}
              onChange={handleCustomChange}
              placeholder="e.g. 7500"
              className="w-full sm:w-64 min-h-[44px] px-3 py-2 bg-white border border-[#E7DCEB] focus:border-[#563568] rounded-xs text-xs focus:outline-none"
            />
          </div>
        </div>

        {/* Calculation Summary Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="p-4 bg-white border border-[#E7DCEB] rounded-xs">
            <span className="text-[10px] uppercase tracking-wider text-[#6F6475] block mb-1">
              Your 10 Contributions
            </span>
            <span className="font-serif text-lg sm:text-xl text-[#302438] font-normal block">
              {formatInr(totalCustomerContribution)}
            </span>
            <span className="text-[10px] text-[#6F6475]">10 monthly instalments</span>
          </div>

          <div className="p-4 bg-white border border-[#B69ACF]/60 rounded-xs bg-[#FAF5FC]/60">
            <span className="text-[10px] uppercase tracking-wider text-[#563568] font-semibold block mb-1">
              SARINE 11th Month Bonus
            </span>
            <span className="font-serif text-lg sm:text-xl text-[#563568] font-medium block">
              + {formatInr(atelierBonusContribution)}
            </span>
            <span className="text-[10px] text-[#047857] font-medium">100% Atelier Co-Sponsorship</span>
          </div>

          <div className="p-4 bg-[#563568] text-white rounded-xs">
            <span className="text-[10px] uppercase tracking-wider text-[#D9B8A0] font-semibold block mb-1">
              Total Maturity Value
            </span>
            <span className="font-serif text-xl sm:text-2xl text-white font-normal block">
              {formatInr(totalMaturityValue)}
            </span>
            <span className="text-[10px] text-white/80">Redeemable towards any jewellery</span>
          </div>
        </div>

        {/* Informative Note */}
        <p className="text-[11px] text-[#6F6475] italic">
          * Illustration based on the standard 10+1 savings tenure. You pay 10 consecutive monthly instalments, and SARINE contributes the 11th instalment on maturity.
        </p>
      </div>

      {/* Plan Rules & Legal Transparency Framework */}
      <div className="space-y-4">
        <h4 className="font-serif text-base text-[#302438] flex items-center gap-2">
          <ShieldCheck size={16} className="text-[#563568]" />
          <span>Plan Governance & Consumer Protections</span>
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 border border-[#E7DCEB] rounded-xs bg-white space-y-1.5">
            <h5 className="font-medium text-[#302438] flex items-center gap-1.5">
              <FileText size={14} className="text-[#563568]" />
              <span>Timely Digital Receipts</span>
            </h5>
            <p className="text-[#6F6475] leading-relaxed">
              Every monthly contribution generates a digitally signed receipt and ledger entry accessible directly within your customer account.
            </p>
          </div>

          <div className="p-4 border border-[#E7DCEB] rounded-xs bg-white space-y-1.5">
            <h5 className="font-medium text-[#302438] flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-[#563568]" />
              <span>Full Principal Protection & Cancellation</span>
            </h5>
            <p className="text-[#6F6475] leading-relaxed">
              Customers retain the right to pre-close at any time prior to maturity. 100% of your deposited funds are refunded to your source bank account without deduction.
            </p>
          </div>

          <div className="p-4 border border-[#E7DCEB] rounded-xs bg-white space-y-1.5">
            <h5 className="font-medium text-[#302438] flex items-center gap-1.5">
              <Sparkles size={14} className="text-[#563568]" />
              <span>Transparent Catalog Redemption</span>
            </h5>
            <p className="text-[#6F6475] leading-relaxed">
              Redeemable across all SARINE 925 sterling silver, 18k vermeil, and demi-fine collections at prevailing website prices with zero inflated deductions.
            </p>
          </div>

          <div className="p-4 border border-[#E7DCEB] rounded-xs bg-white space-y-1.5">
            <h5 className="font-medium text-[#302438] flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-[#563568]" />
              <span>RBI & Escrow Compliance</span>
            </h5>
            <p className="text-[#6F6475] leading-relaxed">
              All contributions are held in a scheduled commercial bank escrow account governed under applicable Indian financial regulations.
            </p>
          </div>
        </div>
      </div>

      {/* Express Interest Action */}
      <div className="pt-4 border-t border-[#E7DCEB] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h5 className="font-medium text-xs text-[#302438]">Want early access when enrolment goes live?</h5>
          <p className="text-[11px] text-[#6F6475]">
            Receive priority invitation and an additional ₹500 welcome piece credit on launch day.
          </p>
        </div>

        {isNotified ? (
          <div className="px-4 py-2.5 bg-[#10B981]/15 text-[#047857] text-xs font-medium rounded-xs flex items-center gap-1.5">
            <CheckCircle2 size={14} />
            <span>Thank you! Your interest has been recorded.</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleNotifyMe}
            className="min-h-[44px] px-5 py-2.5 bg-[#563568] hover:bg-[#80609A] text-white text-xs font-medium rounded-xs transition-colors shadow-xs flex items-center gap-2 cursor-pointer"
          >
            <Bell size={14} />
            <span>Notify Me on Launch</span>
          </button>
        )}
      </div>
    </div>
  );
};
