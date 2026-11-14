/**
 * Terms & Conditions page for SARINE.
 * Covers acceptable site usage, product descriptions, whole-rupee INR pricing,
 * Razorpay transactions, colour variance disclaimers, governing law, and jurisdiction.
 */

import React from 'react';
import { PolicyLayout } from '../components/PolicyLayout';
import { Scale, IndianRupee, CheckSquare, Image as ImageIcon, Gavel } from 'lucide-react';

export const TermsPage: React.FC = () => {
  return (
    <PolicyLayout
      title="Terms & Conditions"
      subtitle="Please read these Terms and Conditions carefully prior to browsing or purchasing from SARINE. By accessing our services, you agree to these clear terms."
      categoryName="Legal & Compliance"
    >
      <div className="space-y-10 text-xs sm:text-sm text-[#6F6475] leading-relaxed font-sans">
        {/* Effective Date Note */}
        <div className="bg-[#FAF5FC] border-l-2 border-[#563568] p-4 text-xs text-[#6F6475]">
          <strong className="text-[#302438] font-medium">Effective Date:</strong> 21 October 2026 | Governing all customer orders and platform access.
        </div>

        {/* Section 1 */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Scale size={16} className="text-[#563568]" />
            <h2 className="font-serif text-lg sm:text-xl text-[#302438]">
              1. Use of the Site
            </h2>
          </div>
          <p>
            The SARINE online store (website, interfaces, and digital catalog) is provided for lawful personal shopping purposes by individuals residing in India or purchasing for delivery to addresses located within India.
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs text-[#6F6475]">
            <li>You agree to provide true, accurate, and current customer details during checkout.</li>
            <li>You may not use our platform for unauthorized commercial reproduction, scraping, reverse engineering, or fraudulent purchase activities.</li>
            <li>SARINE reserves the right to suspend or cancel orders placed with falsified information.</li>
          </ul>
        </section>

        {/* Section 2 */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <IndianRupee size={16} className="text-[#563568]" />
            <h2 className="font-serif text-lg sm:text-xl text-[#302438]">
              2. Product Information & Pricing
            </h2>
          </div>
          <p>
            SARINE offers fashion and artificial jewellery. Materials, finishes, dimensions, and product features may vary by item; please review the individual product description before ordering.
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs text-[#6F6475]">
            <li><strong className="text-[#302438]">Currency:</strong> All prices are displayed and charged strictly in <strong>Indian National Rupees (INR, ₹)</strong>.</li>
            <li><strong className="text-[#302438]">Taxes and charges:</strong> Review the final order summary at checkout for the amount payable and any applicable charges.</li>
            <li><strong className="text-[#302438]">Pricing Accuracy:</strong> While we endeavor to ensure all pricing information is exact, in the rare event of a typographical or system error, SARINE reserves the right to notify the customer and cancel the affected order with a full refund.</li>
          </ul>
        </section>

        {/* Section 3 */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <CheckSquare size={16} className="text-[#563568]" />
            <h2 className="font-serif text-lg sm:text-xl text-[#302438]">
              3. Order Acceptance & Verification
            </h2>
          </div>
          <p>
            Adding an item to your shopping bag or generating a temporary order number does not constitute binding acceptance of your order.
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs text-[#6F6475]">
            <li>Order acceptance occurs solely after successful payment authorization (for online orders) and operational review of stock availability.</li>
            <li>In the rare event that an item goes out of stock prior to final inventory reservation, SARINE will immediately notify you and process a 100% refund.</li>
            <li>We reserve the right to limit order quantities per customer or cancel duplicate/fraudulent orders.</li>
          </ul>
        </section>

        {/* Section 4 */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Scale size={16} className="text-[#563568]" />
            <h2 className="font-serif text-lg sm:text-xl text-[#302438]">
              4. Payment via Razorpay
            </h2>
          </div>
          <p>
            Online payments on our website are facilitated securely through <strong>Razorpay</strong>. Accepted payment modes include UPI (Google Pay, PhonePe, Paytm, BHIM), major Credit &amp; Debit Cards (Visa, MasterCard, RuPay), and NetBanking.
          </p>
          <p className="text-xs text-[#6F6475]">
            An online order is processed after the payment status has been checked and matched to the order. A payment confirmation shown by a bank or payment app alone may not mean that the store has confirmed the order.
          </p>
        </section>

        {/* Section 5 */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <ImageIcon size={16} className="text-[#563568]" />
            <h2 className="font-serif text-lg sm:text-xl text-[#302438]">
              5. Product Images & Visual Representation
            </h2>
          </div>
          <p>
            Product photographs are provided to help illustrate each item. The actual product details and materials are described on the individual product page.
          </p>
          <div className="p-4 bg-[#FAF5FC] border border-[#E7DCEB] text-xs text-[#6F6475] space-y-1.5 rounded-xs">
            <p>
              Please note that slight natural variations in colour tone, gold polish luster, enamel shading, or bead texture may occur due to:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Individual screen calibrations, display brightness, and color gamut settings on your phone or computer.</li>
              <li>Differences in lighting and screen settings when viewing product images.</li>
            </ul>
            <p className="mt-1">
              Please review the specifications shown on each product page. If a detail is not listed, do not assume a particular material, dimension, or weight.
            </p>
          </div>
        </section>

        {/* Section 6 */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Gavel size={16} className="text-[#563568]" />
            <h2 className="font-serif text-lg sm:text-xl text-[#302438]">
              6. Governing Law & Jurisdiction
            </h2>
          </div>
          <p>
            These Terms &amp; Conditions and any transactions conducted on SARINE are governed by and construed in accordance with the laws of the Republic of India.
          </p>
          <p className="text-xs text-[#6F6475]">
            Disputes will be subject to the jurisdiction of the competent courts as determined under applicable Indian law.
          </p>
        </section>
      </div>
    </PolicyLayout>
  );
};
