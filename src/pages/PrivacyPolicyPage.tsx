/**
 * Privacy Policy page for SARINE.
 * Transparent disclosure of personal information collected, legitimate processing reasons,
 * Razorpay PCI-DSS payment separation, data non-sale guarantee, and deletion request rights.
 */

import React from 'react';
import { PolicyLayout } from '../components/PolicyLayout';
import { ShieldCheck, Lock, Database, UserX, Mail } from 'lucide-react';

export const PrivacyPolicyPage: React.FC = () => {
  return (
    <PolicyLayout
      title="Privacy Policy"
      subtitle="At SARINE, we respect and safeguard your privacy. This policy outlines how we handle your personal data with complete transparency and care."
      categoryName="Legal & Compliance"
    >
      <div className="space-y-10 text-xs sm:text-sm text-[#57534E] leading-relaxed font-sans">
        {/* Effective Date Note */}
        <div className="bg-[#FAF8F5] border-l-2 border-[#B89758] p-4 text-xs text-[#6B635D]">
          <strong className="text-[#1C1917] font-medium">Effective Date:</strong> 21 October 2026 | Applies to all visitors and customers of SARINE.
        </div>

        {/* Section 1 */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Database size={16} className="text-[#B89758]" />
            <h2 className="font-serif text-lg sm:text-xl text-[#1C1917]">
              1. Information We Collect
            </h2>
          </div>
          <p>
            When you browse our storefront, curate selections in your bag, or place an order, we collect only the information strictly necessary to provide our services:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs text-[#6B635D]">
            <li><strong className="text-[#1C1917]">Contact Information:</strong> Your full name, email address, and mobile phone number.</li>
            <li><strong className="text-[#1C1917]">Delivery Address:</strong> Street address, apartment/suite number, landmark, city, state, and postal PIN code.</li>
            <li><strong className="text-[#1C1917]">Order Details:</strong> Items purchased, order reference numbers (e.g., SAR-000001), transaction timestamp, and delivery status.</li>
            <li><strong className="text-[#1C1917]">Technical Session Data:</strong> Browser type, approximate geographical region, and device category to ensure seamless display and responsive design.</li>
          </ul>
        </section>

        {/* Section 2 */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-[#B89758]" />
            <h2 className="font-serif text-lg sm:text-xl text-[#1C1917]">
              2. Why We Collect Your Information
            </h2>
          </div>
          <p>
            Your information is utilized solely for lawful e-commerce and customer fulfillment functions:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs text-[#6B635D]">
            <li>To process, verify, and fulfill your jewellery orders.</li>
            <li>To coordinate domestic dispatch and courier tracking to your doorstep.</li>
            <li>To send order confirmation notices, dispatch updates, and delivery confirmations via email and SMS.</li>
            <li>To provide timely assistance through our concierge team regarding sizing, returns, or order inquiries.</li>
            <li>To detect and prevent fraudulent transactions or security breaches.</li>
          </ul>
        </section>

        {/* Section 3: Razorpay Payment Processing */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Lock size={16} className="text-[#B89758]" />
            <h2 className="font-serif text-lg sm:text-xl text-[#1C1917]">
              3. Payment Security & Razorpay Integration
            </h2>
          </div>
          <div className="p-4 bg-[#FAF8F5] border border-[#E6DFD5] space-y-2">
            <p className="font-medium text-[#1C1917] text-xs">
              We never collect or store your payment card details.
            </p>
            <p className="text-xs text-[#6B635D]">
              All online payments on SARINE are securely processed by <strong>Razorpay Software Private Limited</strong>, an RBI-regulated and PCI-DSS Level 1 certified payment gateway partner. When completing a purchase:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-xs text-[#6B635D]">
              <li>Credit card, debit card, UPI credentials, and NetBanking passwords are entered directly into Razorpay’s encrypted interface.</li>
              <li>SARINE servers and staff do not have access to, nor do we ever log, store, or view your full card numbers, CVV, or banking credentials.</li>
              <li>We only receive an encrypted token and confirmation status (e.g., payment ID and order match) to confirm your order.</li>
            </ul>
          </div>
        </section>

        {/* Section 4 */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <UserX size={16} className="text-[#B89758]" />
            <h2 className="font-serif text-lg sm:text-xl text-[#1C1917]">
              4. We Do Not Sell Your Data
            </h2>
          </div>
          <p>
            SARINE has a strict zero-data-monetization policy:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs text-[#6B635D]">
            <li>We do <strong>not</strong> sell, rent, trade, or lease personal information to any third party, advertising network, or data aggregator.</li>
            <li>Your details are shared strictly with operational partners required to deliver your order (specifically our logistics courier partners for parcel delivery, and Razorpay for payment verification).</li>
            <li>These partners receive only the details strictly required to perform their discrete function.</li>
          </ul>
        </section>

        {/* Section 5: Deletion Request */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Mail size={16} className="text-[#B89758]" />
            <h2 className="font-serif text-lg sm:text-xl text-[#1C1917]">
              5. Data Deletion & Your Rights
            </h2>
          </div>
          <p>
            You hold complete ownership over your personal data. You may at any time request:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs text-[#6B635D]">
            <li>Confirmation of what personal data we retain on your account.</li>
            <li>Correction or updating of any inaccurate contact or address records.</li>
            <li>Permanent deletion of your customer profile and historical contact records.</li>
          </ul>
          <div className="mt-3 p-4 bg-[#FAF8F5] border border-[#E6DFD5] text-xs text-[#1C1917]">
            To exercise your deletion right or for any privacy inquiry, please send an email with the subject line <em>&ldquo;Data Deletion Request&rdquo;</em> to{' '}
            <a href="mailto:care@sarinejewelry.com" className="text-[#B89758] font-medium underline underline-offset-2">
              care@sarinejewelry.com
            </a>
            . We process and confirm verified deletion requests within 15 business days, subject to statutory tax and financial record retention required by Indian law.
          </div>
        </section>
      </div>
    </PolicyLayout>
  );
};
