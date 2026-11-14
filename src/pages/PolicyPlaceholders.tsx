/**
 * Sustainability, Blog, Careers, and Cancellation placeholder pages for SARINE.
 * Uses the consistent mx-auto w-full max-w-[1280px] px-4 sm:px-6 lg:px-10 container.
 */

import React from 'react';
import { Link } from 'react-router-dom';

export const SustainabilityPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#F7F0FA] text-[#302438] font-sans py-16 sm:py-24">
      <div className="site-container">
        <div className="max-w-[1000px] mx-auto bg-white p-8 sm:p-12 border border-[#E7DCEB] rounded-xs shadow-2xs">
          <span className="text-xs uppercase tracking-[0.25em] text-[#6F6475] font-medium block mb-2">
            Responsibility
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl text-[#302438] font-normal mb-6">
            Sustainability &amp; Conscious Craft
          </h1>
          <p className="text-xs sm:text-sm text-[#6F6475] leading-relaxed mb-4">
            We are working to publish clear, verifiable information about our materials, sourcing, production, and packaging. We will update this page as those details are confirmed.
          </p>
          <p className="text-xs sm:text-sm text-[#6F6475] leading-relaxed">
            Packaging may vary by product and order. Please check the product and order information for details about the packaging included with your purchase.
          </p>
          <div className="mt-8 pt-6 border-t border-[#E7DCEB]">
            <Link to="/" className="text-xs uppercase tracking-wider text-[#563568] hover:text-[#A184BD] transition-colors underline underline-offset-4">
              ← Return to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export const BlogPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#F7F0FA] text-[#302438] font-sans py-16 sm:py-24">
      <div className="site-container">
        <div className="max-w-[1000px] mx-auto bg-white p-8 sm:p-12 border border-[#E7DCEB] rounded-xs shadow-2xs">
          <span className="text-xs uppercase tracking-[0.25em] text-[#6F6475] font-medium block mb-2">
            The Journal
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl text-[#302438] font-normal mb-6">
            SARINE Editorial Journal
          </h1>
          <p className="text-xs sm:text-sm text-[#6F6475] leading-relaxed mb-4">
            Styling tips, festive guides, and craftsmanship stories from our studio.
          </p>
          <div className="space-y-4 pt-4 border-t border-[#E7DCEB]">
            <div className="p-4 bg-[#FAF5FC] border border-[#E7DCEB] rounded-xs">
              <h3 className="font-serif text-lg text-[#302438]">The Art of Layering: Chokers &amp; Chains</h3>
              <p className="text-xs text-[#6F6475] mt-1">Discover how to combine heritage kundan pieces with sleek modern gold chains.</p>
            </div>
            <div className="p-4 bg-[#FAF5FC] border border-[#E7DCEB] rounded-xs">
              <h3 className="font-serif text-lg text-[#302438]">Jewellery Care Guide</h3>
              <p className="text-xs text-[#6F6475] mt-1">Simple care habits to help look after your jewellery. Materials and finishes vary by product.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const CareersPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#F7F0FA] text-[#302438] font-sans py-16 sm:py-24">
      <div className="site-container">
        <div className="max-w-[1000px] mx-auto bg-white p-8 sm:p-12 border border-[#E7DCEB] rounded-xs shadow-2xs">
          <span className="text-xs uppercase tracking-[0.25em] text-[#6F6475] font-medium block mb-2">
            Careers
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl text-[#302438] font-normal mb-6">
            Join the SARINE Team
          </h1>
          <p className="text-xs sm:text-sm text-[#6F6475] leading-relaxed mb-4">
            We are always eager to connect with passionate individuals in jewellery merchandising, e-commerce operations, digital design, and customer experience.
          </p>
          <p className="text-xs text-[#6F6475]">
            We do not currently list open positions or accept applications through this page.
            
          </p>
        </div>
      </div>
    </div>
  );
};

export const CancellationPolicyPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#F7F0FA] text-[#302438] font-sans py-16 sm:py-24">
      <div className="site-container">
        <div className="max-w-[1000px] mx-auto bg-white p-8 sm:p-12 border border-[#E7DCEB] rounded-xs shadow-2xs">
          <span className="text-xs uppercase tracking-[0.25em] text-[#6F6475] font-medium block mb-2">
            Store Policy
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl text-[#302438] font-normal mb-6">
            Cancellation Policy
          </h1>
          <p className="text-xs sm:text-sm text-[#6F6475] leading-relaxed mb-4">
            You may request cancellation before your order is handed over to the delivery partner. Cancellation may no longer be possible after dispatch.
          </p>
          <p className="text-xs sm:text-sm text-[#6F6475] leading-relaxed mb-4">
            Once an order has been dispatched and handed over to our courier partners, cancellation is no longer possible, but you may avail of our 7-day return assistance upon delivery in accordance with our{' '}
            <Link to="/refund-policy" className="text-[#563568] hover:text-[#A184BD] transition-colors underline">
              Refund &amp; Return Policy
            </Link>.
          </p>
          <p className="text-xs text-[#6F6475]">
            For cancellation requests, use the customer support channel shown in your order communication. The public support contact details on this website are being finalised.
            
          </p>
        </div>
      </div>
    </div>
  );
};
