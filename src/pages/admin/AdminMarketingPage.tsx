/**
 * AdminMarketingPage for SARINE.
 * Promotion, coupon rules, festival campaign scheduler, and discount margin simulator.
 */

import React, { useState } from 'react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { formatInr } from '../../utils/currency';
import {
  Megaphone,
  Tag,
  Plus,
  Calendar,
  Percent,
  CheckCircle2,
  Clock,
  Sparkles,
  SlidersHorizontal,
  ArrowRight,
  Calculator,
  X
} from 'lucide-react';

interface Coupon {
  code: string;
  discountPercent: number;
  minOrder: number;
  maxDiscount: number;
  usedCount: number;
  expiryDate: string;
  status: 'active' | 'scheduled' | 'expired';
}

const INITIAL_COUPONS: Coupon[] = [
  {
    code: 'DIWALI20',
    discountPercent: 20,
    minOrder: 1999,
    maxDiscount: 1000,
    usedCount: 84,
    expiryDate: '05 Nov 2025',
    status: 'active'
  },
  {
    code: 'SARINEFIRST',
    discountPercent: 15,
    minOrder: 1499,
    maxDiscount: 500,
    usedCount: 236,
    expiryDate: '31 Dec 2025',
    status: 'active'
  },
  {
    code: 'WEDDINGGOLD',
    discountPercent: 25,
    minOrder: 4999,
    maxDiscount: 2500,
    usedCount: 18,
    expiryDate: '10 Dec 2025',
    status: 'scheduled'
  },
  {
    code: 'KARWACHAUTH',
    discountPercent: 15,
    minOrder: 1999,
    maxDiscount: 750,
    usedCount: 42,
    expiryDate: '31 Oct 2025',
    status: 'scheduled'
  }
];

export const AdminMarketingPage: React.FC = () => {
  const [coupons, setCoupons] = useState<Coupon[]>(INITIAL_COUPONS);
  const [showAddModal, setShowAddModal] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  // New coupon form
  const [newCode, setNewCode] = useState('');
  const [newDiscount, setNewDiscount] = useState('20');
  const [newMinOrder, setNewMinOrder] = useState('1999');
  const [newMaxDiscount, setNewMaxDiscount] = useState('1000');
  const [newExpiry, setNewExpiry] = useState('15 Nov 2025');

  // Simulator
  const [simCartTotal, setSimCartTotal] = useState(3499);
  const [simSelectedCoupon, setSimSelectedCoupon] = useState('DIWALI20');

  const selectedCouponObj = coupons.find((c) => c.code === simSelectedCoupon) || coupons[0];
  const calculatedDiscount = Math.min(
    (simCartTotal * selectedCouponObj.discountPercent) / 100,
    selectedCouponObj.maxDiscount
  );
  const postDiscountTotal = Math.max(0, simCartTotal - calculatedDiscount);
  const estimatedCost = Math.round(simCartTotal * 0.35);
  const estimatedContributionProfit = postDiscountTotal - estimatedCost;

  const handleCreateCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim()) return;

    const coupon: Coupon = {
      code: newCode.trim().toUpperCase(),
      discountPercent: parseFloat(newDiscount) || 10,
      minOrder: parseFloat(newMinOrder) || 999,
      maxDiscount: parseFloat(newMaxDiscount) || 500,
      usedCount: 0,
      expiryDate: newExpiry,
      status: 'active'
    };

    setCoupons([coupon, ...coupons]);
    setShowAddModal(false);
    setSuccess(`Coupon "${coupon.code}" created and activated.`);
    setNewCode('');
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-[#2C1838] tracking-tight">
              Marketing & Offers
            </h1>
            <p className="text-xs sm:text-sm text-[#705E7B] mt-0.5">
              Promotional codes, festival campaign scheduling, and gross margin simulator.
            </p>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#563568] hover:bg-[#78469C] text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus size={15} />
            <span>Create New Coupon</span>
          </button>
        </div>

        {success && (
          <div className="p-3.5 bg-[#F2FBF5] border border-[#A7E8BD] rounded-xl flex items-center justify-between text-xs text-[#166534]">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} />
              <span>{success}</span>
            </div>
            <button onClick={() => setSuccess(null)} className="text-[#166534] hover:font-bold">✕</button>
          </div>
        )}

        {/* Coupons List & Simulator Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Active Coupons Table (7 cols) */}
          <div className="lg:col-span-7 bg-white rounded-2xl p-5 border border-[#EADFF0] shadow-2xs">
            <h2 className="text-sm font-semibold text-[#2C1838] pb-3 border-b border-[#F5EDF8]">
              Promotional Discount Codes
            </h2>

            <div className="overflow-x-auto mt-3">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-[10px] text-[#8E769E] uppercase tracking-wider border-b border-[#F5EDF8]">
                    <th className="pb-2 font-medium">Coupon Code</th>
                    <th className="pb-2 font-medium">Discount</th>
                    <th className="pb-2 font-medium">Min Order</th>
                    <th className="pb-2 font-medium text-center">Redemptions</th>
                    <th className="pb-2 font-medium">Valid Till</th>
                    <th className="pb-2 font-medium text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#FAF2FC]">
                  {coupons.map((c) => (
                    <tr key={c.code} className="hover:bg-[#FAF5FC]">
                      <td className="py-2.5 font-bold font-mono text-[#563568]">{c.code}</td>
                      <td className="py-2.5 font-semibold text-[#2C1838]">{c.discountPercent}% OFF</td>
                      <td className="py-2.5 text-[#5D5068]">{formatInr(c.minOrder)}</td>
                      <td className="py-2.5 text-center font-medium text-[#2C1838]">{c.usedCount}</td>
                      <td className="py-2.5 text-[11px] text-[#8E769E]">{c.expiryDate}</td>
                      <td className="py-2.5 text-right">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                            c.status === 'active'
                              ? 'bg-[#DCFCE7] text-[#16A34A]'
                              : 'bg-[#F3E8FF] text-[#78469C]'
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Promotion Margin Simulator (5 cols) */}
          <div className="lg:col-span-5 bg-white rounded-2xl p-5 border border-[#EADFF0] shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 pb-3 border-b border-[#F5EDF8]">
                <Calculator size={16} className="text-[#563568]" />
                <h2 className="text-sm font-semibold text-[#2C1838]">Discount Margin Simulator</h2>
              </div>
              <p className="text-[11px] text-[#705E7B] mt-2">
                Simulate basket totals and verify contribution profit before launching high-value promotions.
              </p>

              <div className="space-y-3.5 mt-4 text-xs">
                <div>
                  <label className="block text-[#5D5068] font-medium mb-1">Select Coupon to Test</label>
                  <select
                    value={simSelectedCoupon}
                    onChange={(e) => setSimSelectedCoupon(e.target.value)}
                    className="w-full px-3 py-2 bg-[#FAF5FC] border border-[#E7DCEB] rounded-xl text-xs font-semibold font-mono"
                  >
                    {coupons.map((c) => (
                      <option key={c.code} value={c.code}>{c.code} ({c.discountPercent}% off, max {c.maxDiscount})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[#5D5068] font-medium mb-1">
                    Simulated Cart Basket Total: <span className="font-bold text-[#2C1838]">{formatInr(simCartTotal)}</span>
                  </label>
                  <input
                    type="range"
                    min="1000"
                    max="15000"
                    step="500"
                    value={simCartTotal}
                    onChange={(e) => setSimCartTotal(parseInt(e.target.value, 10))}
                    className="w-full accent-[#563568]"
                  />
                </div>

                {/* Calculation Output Box */}
                <div className="p-4 bg-[#FAF5FC] rounded-xl border border-[#EADFF0] space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#705E7B]">Original Basket Total:</span>
                    <span className="font-medium text-[#2C1838]">{formatInr(simCartTotal)}</span>
                  </div>
                  <div className="flex justify-between text-[#DC2626]">
                    <span>Discount Deduction ({selectedCouponObj.discountPercent}%):</span>
                    <span>- {formatInr(calculatedDiscount)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-[#2C1838] pt-1 border-t border-[#E7DCEB]">
                    <span>Customer Paid Total:</span>
                    <span>{formatInr(postDiscountTotal)}</span>
                  </div>
                  <div className="flex justify-between text-[#705E7B] text-[11px]">
                    <span>Est. Manufacturing & Packing Cost:</span>
                    <span>{formatInr(estimatedCost)}</span>
                  </div>
                  <div className="flex justify-between text-[#16A34A] font-bold pt-1 border-t border-[#E7DCEB]">
                    <span>Est. Contribution Profit:</span>
                    <span>{formatInr(estimatedContributionProfit)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[#F5EDF8]">
              <span className="text-[10px] text-[#8E769E] block">
                Calculations based on 35% average COGS. Checkout authorization recalculates exact server-side discounts.
              </span>
            </div>
          </div>
        </div>

        {/* Create Coupon Modal */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-[#E7DCEB]">
              <div className="flex items-center justify-between pb-3 border-b border-[#E7DCEB]">
                <h3 className="font-serif text-lg font-semibold text-[#2C1838]">Create New Coupon Code</h3>
                <button onClick={() => setShowAddModal(false)} className="text-[#8E769E] hover:text-black">✕</button>
              </div>

              <form onSubmit={handleCreateCoupon} className="mt-4 space-y-3.5 text-xs">
                <div>
                  <label className="block text-[#5D5068] font-medium mb-1">Coupon Code (Uppercase)</label>
                  <input
                    type="text"
                    required
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    placeholder="e.g. DIWALI30"
                    className="w-full px-3.5 py-2 uppercase font-mono bg-[#FAF5FC] border border-[#E7DCEB] rounded-xl focus:outline-none focus:border-[#563568]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[#5D5068] font-medium mb-1">Discount (%)</label>
                    <input
                      type="number"
                      required
                      value={newDiscount}
                      onChange={(e) => setNewDiscount(e.target.value)}
                      className="w-full px-3.5 py-2 bg-[#FAF5FC] border border-[#E7DCEB] rounded-xl focus:outline-none focus:border-[#563568]"
                    />
                  </div>
                  <div>
                    <label className="block text-[#5D5068] font-medium mb-1">Max Cap (₹)</label>
                    <input
                      type="number"
                      required
                      value={newMaxDiscount}
                      onChange={(e) => setNewMaxDiscount(e.target.value)}
                      className="w-full px-3.5 py-2 bg-[#FAF5FC] border border-[#E7DCEB] rounded-xl focus:outline-none focus:border-[#563568]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[#5D5068] font-medium mb-1">Minimum Order Value (₹)</label>
                  <input
                    type="number"
                    required
                    value={newMinOrder}
                    onChange={(e) => setNewMinOrder(e.target.value)}
                    className="w-full px-3.5 py-2 bg-[#FAF5FC] border border-[#E7DCEB] rounded-xl focus:outline-none focus:border-[#563568]"
                  />
                </div>

                <div className="pt-3 flex items-center justify-end gap-2 border-t border-[#E7DCEB]">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 border border-[#E7DCEB] rounded-xl text-[#5D5068]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-[#563568] hover:bg-[#78469C] text-white rounded-xl font-medium"
                  >
                    Activate Coupon
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};
