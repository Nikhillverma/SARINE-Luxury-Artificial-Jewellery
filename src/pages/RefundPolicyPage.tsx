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
            <li>To request a cancellation, use the customer-support contact details included with your order communication. The public support contact details on this website are being finalised.</li>
            <li>If cancellation is accepted before dispatch, the order will be cancelled and any applicable refund will be processed to the original payment method.</li>
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
            <li><strong className="text-[#302438]">Unboxing Video / Photos:</strong> If an item arrives damaged or incorrect, photographs or an unboxing video can help document the issue. Please retain the outer packaging until the request is reviewed.</li>
            <li><strong className="text-[#302438]">Unused Condition:</strong> Please keep the item unused and include the packaging and accessories that arrived with it while the return request is reviewed.</li>
            <li><strong className="text-[#302438]">Original Packaging:</strong> Include any tags, packaging, or accessories that were supplied with the item.</li>
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
                Approved prepaid refunds are returned through the original payment method where supported. Processing and credit timelines depend on the payment provider and the customer’s bank; the applicable details will be shared when the refund is approved.
              </div>
            </div>
            <div className="flex items-start gap-2.5 pt-2 border-t border-[#E7DCEB]">
              <CheckCircle2 size={16} className="text-[#563568] shrink-0 mt-0.5" />
              <div>
                <strong className="text-[#302438] block">Cash on Delivery (COD) Orders:</strong>
                For an approved COD return, the refund method and any information required from the customer will be confirmed as part of the return approval.
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
            To request a return within the 7-day delivery window:
          </p>
          <ol className="list-decimal pl-5 space-y-2 text-xs text-[#6F6475]">
            <li>Use the customer-support contact details included with your order communication to request a return. The public support contact details on this website are being finalised.</li>
            <li>Attach the unboxing video/photos clearly illustrating the damage, defect, or wrong item received.</li>
            <li>Provide a brief description of the issue along with your registered contact phone number.</li>
            <li>The return request will need to be reviewed before return instructions or a return address can be provided.</li>
          </ol>
        </section>
      </div>
    </PolicyLayout>
  );
};
