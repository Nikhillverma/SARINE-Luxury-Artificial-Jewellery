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
            At SARINE, thoughtful craftsmanship extends beyond aesthetics. We focus on mindful small-batch production, minimal packaging waste, and long-lasting wearable designs that transcend fleeting seasonal cycles.
          </p>
          <p className="text-xs sm:text-sm text-[#6F6475] leading-relaxed">
            Each order is shipped in reusable keepsake pouches and protective recyclable cardboard mailers designed to minimize single-use plastics.
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
              <p className="text-xs text-[#6F6475] mt-1">Simple daily practices to keep your micron gold-plated jewellery radiant for years.</p>
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
            Send your portfolio and resume to{' '}
            <a href="mailto:careers@sarinejewelry.com" className="text-[#563568] hover:text-[#A184BD] underline font-medium">
              careers@sarinejewelry.com
            </a>.
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
            You may request cancellation of your order at any time before it has been dispatched from our studio (typically within 24 hours of placement).
          </p>
          <p className="text-xs sm:text-sm text-[#6F6475] leading-relaxed mb-4">
            Once an order has been dispatched and handed over to our courier partners, cancellation is no longer possible, but you may avail of our 7-day return assistance upon delivery in accordance with our{' '}
            <Link to="/refund-policy" className="text-[#563568] hover:text-[#A184BD] transition-colors underline">
              Refund &amp; Return Policy
            </Link>.
          </p>
          <p className="text-xs text-[#6F6475]">
            Last updated: 21 October 2026. For cancellation requests, email{' '}
            <a href="mailto:care@sarinejewelry.com" className="underline font-medium text-[#563568] hover:text-[#A184BD] transition-colors">
              care@sarinejewelry.com
            </a>.
          </p>
        </div>
      </div>
    </div>
  );
};
