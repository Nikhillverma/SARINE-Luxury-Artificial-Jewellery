/**
 * Refund, Return & Cancellation Policy page for SARINE.
 * Covers pre-dispatch cancellations, 7-day return window for damaged/defective/incorrect items,
 * mandatory unboxing video/photo requirement, original packaging condition, 5-7 business day
 * refund timelines back to original payment method or bank transfer (COD), and return initiation steps.
 */

import React from 'react';
import { PolicyLayout } from '../components/PolicyLayout';
import { RotateCcw, AlertOctagon, CheckCircle2, IndianRupee, Video, Mail } from 'lucide-react';

export const RefundPolicyPage: React.FC = () => {
  return (
    <PolicyLayout
      title="Refund, Return & Cancellation"
      subtitle="We want every experience with SARINE jewellery to be effortless and dependable. Here are our exact guidelines on cancellations, returns, and refunds."
      categoryName="Customer Satisfaction"
    >
      <div className="space-y-10 text-xs sm:text-sm text-[#6F6475] leading-relaxed font-sans">
        {/* Effective Date Note */}
        <div className="bg-[#FAF5FC] border-l-2 border-[#563568] p-4 text-xs text-[#6F6475]">
          <strong className="text-[#302438] font-medium">Effective Date:</strong> 21 October 2026 | Policy valid for all purchases made through SARINE.
        </div>

        {/* Section 1: Cancellation Before Dispatch */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <RotateCcw size={16} className="text-[#563568]" />
            <h2 className="font-serif text-lg sm:text-xl text-[#302438]">
              1. Order Cancellation (Before Dispatch)
            </h2>
          </div>
          <p>
            You may cancel your order at any time <strong>before the parcel has been packaged and handed over to our courier partner</strong>.
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs text-[#6F6475]">
            <li>To cancel an order before dispatch, immediately email our concierge team at <a href="mailto:care@sarinejewelry.com" className="text-[#563568] hover:text-[#A184BD] underline underline-offset-2">care@sarinejewelry.com</a> or message on WhatsApp at <strong className="text-[#302438]">+91 98765 43210</strong> with your order number.</li>
            <li>If the order has not yet been dispatched, we will cancel the order immediately and issue a 100% full refund to your original payment method.</li>
            <li>Once an order has been picked up by the courier and an AWB tracking number has been generated, it cannot be canceled in transit.</li>
          </ul>
        </section>

        {/* Section 2: Returns Window & Eligibility */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertOctagon size={16} className="text-[#563568]" />
            <h2 className="font-serif text-lg sm:text-xl text-[#302438]">
              2. 7-Day Return Eligibility (Damaged, Defective or Wrong Items)
            </h2>
          </div>
          <p>
            Due to the intimate and delicate nature of fashion jewellery, returns are accepted strictly within <strong>7 days of delivery</strong> exclusively for orders that meet one of the following criteria:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div className="p-3.5 bg-[#FAF5FC] border border-[#E7DCEB] text-xs rounded-xs">
              <strong className="text-[#302438] block mb-1">Transit Damage</strong>
              Item was physically damaged or broken during domestic courier transit.
            </div>
            <div className="p-3.5 bg-[#FAF5FC] border border-[#E7DCEB] text-xs rounded-xs">
              <strong className="text-[#302438] block mb-1">Manufacturing Defect</strong>
              Defective clasp, missing stones, or structural flaw evident upon opening.
            </div>
            <div className="p-3.5 bg-[#FAF5FC] border border-[#E7DCEB] text-xs rounded-xs">
              <strong className="text-[#302438] block mb-1">Incorrect Item</strong>
              An incorrect design, size, or category was shipped in error by our atelier.
            </div>
          </div>
        </section>

        {/* Section 3: Conditions & Unboxing Evidence */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Video size={16} className="text-[#563568]" />
            <h2 className="font-serif text-lg sm:text-xl text-[#302438]">
              3. Condition of Items & Unboxing Video Requirement
            </h2>
          </div>
          <p>
            To prevent fraudulent claims and ensure fair verification:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs text-[#6F6475]">
            <li><strong className="text-[#302438]">Unboxing Video / Photos:</strong> For claims of damage or wrong items, a clear, continuous unboxing video or photographs taken immediately upon opening the outer package is mandatory.</li>
            <li><strong className="text-[#302438]">Unused Condition:</strong> All returned jewellery must be completely unused, unworn, and free of perfume, makeup, moisture, or alterations.</li>
            <li><strong className="text-[#302438]">Original Packaging:</strong> The item must be returned with all original tags, velvet pouch, gift box, and authenticity inserts intact.</li>
          </ul>
        </section>

        {/* Section 4: Refund Processing & Timelines */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <IndianRupee size={16} className="text-[#563568]" />
            <h2 className="font-serif text-lg sm:text-xl text-[#302438]">
              4. Refund Timelines & Payment Reversal
            </h2>
          </div>
          <p>
            Once our quality control team at the atelier receives and inspects your returned package:
          </p>
          <div className="p-4 bg-[#FAF5FC] border border-[#E7DCEB] space-y-3 text-xs rounded-xs">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 size={16} className="text-[#563568] shrink-0 mt-0.5" />
              <div>
                <strong className="text-[#302438] block">Online Prepaid Orders (Razorpay):</strong>
                Approved refunds are initiated back to the original source method (UPI account, Credit/Debit Card, or NetBanking) within <strong>5 to 7 business days</strong>. The time required for the credit to reflect on your card or bank statement depends on your issuing bank.
              </div>
            </div>
            <div className="flex items-start gap-2.5 pt-2 border-t border-[#E7DCEB]">
              <CheckCircle2 size={16} className="text-[#563568] shrink-0 mt-0.5" />
              <div>
                <strong className="text-[#302438] block">Cash on Delivery (COD) Orders:</strong>
                For verified COD returns, refunds are transferred via direct <strong>NEFT / IMPS bank transfer</strong> to the customer’s verified bank account within 5 to 7 business days following return approval.
              </div>
            </div>
          </div>
        </section>

        {/* Section 5: How to Start a Return */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Mail size={16} className="text-[#563568]" />
            <h2 className="font-serif text-lg sm:text-xl text-[#302438]">
              5. How to Initiate a Return or Exchange
            </h2>
          </div>
          <p>
            To begin a return request within the 7-day delivery window:
          </p>
          <ol className="list-decimal pl-5 space-y-2 text-xs text-[#6F6475]">
            <li>Send an email to <a href="mailto:care@sarinejewelry.com" className="text-[#563568] hover:text-[#A184BD] font-medium underline underline-offset-2">care@sarinejewelry.com</a> with the subject: <em>&ldquo;Return Request: [Your Order Number]&rdquo;</em>.</li>
            <li>Attach the unboxing video/photos clearly illustrating the damage, defect, or wrong item received.</li>
            <li>Provide a brief description of the issue along with your registered contact phone number.</li>
            <li>Our concierge will verify the claim within 24 to 48 hours and coordinate reverse pickup instructions or provide the return shipping address.</li>
          </ol>
        </section>
      </div>
    </PolicyLayout>
  );
};
