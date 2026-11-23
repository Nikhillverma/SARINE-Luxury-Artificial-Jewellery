/**
 * Sustainability, Blog, Careers, and Cancellation placeholder pages for SARINE.
 * Uses the consistent mx-auto w-full max-w-[1280px] px-4 sm:px-6 lg:px-10 container.
 */

import React from 'react';
import { Link } from 'react-router-dom';

export const SustainabilityPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-white text-[var(--heading)] font-sans py-16 sm:py-24">
      <div className="site-container">
        <div className="max-w-[1000px] mx-auto bg-white p-8 sm:p-12 border border-[var(--border)] rounded-xs shadow-2xs">
          <span className="text-xs uppercase tracking-[0.25em] text-[var(--body)] font-medium block mb-2">
            Responsibility
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl text-[var(--heading)] font-normal mb-6">
            Sustainability &amp; Conscious Choices
          </h1>
          <p className="text-xs sm:text-sm text-[var(--body)] leading-relaxed mb-4">
            We want information about materials, packaging and production to be specific and verifiable. We avoid making broad environmental claims where we cannot provide clear supporting details.
          </p>
          <p className="text-xs sm:text-sm text-[var(--body)] leading-relaxed">
            If you have a question about the materials, care or packaging of a particular item, please contact our team and include the product name so we can help with the information available.
          </p>
          <div className="mt-8 pt-6 border-t border-[var(--border)]">
            <Link to="/contact" className="text-xs uppercase tracking-wider text-[var(--plum)] underline underline-offset-4">
              Contact SARINE
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export const BlogPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-white text-[var(--heading)] font-sans py-16 sm:py-24">
      <div className="site-container">
        <div className="max-w-[1000px] mx-auto bg-white p-8 sm:p-12 border border-[var(--border)] rounded-xs shadow-2xs">
          <span className="text-xs uppercase tracking-[0.25em] text-[var(--body)] font-medium block mb-2">
            The Journal
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl text-[var(--heading)] font-normal mb-6">
            SARINE Editorial Journal
          </h1>
          <p className="text-xs sm:text-sm text-[var(--body)] leading-relaxed mb-4">
            Styling tips, festive guides, and craftsmanship stories from our studio.
          </p>
          <div className="space-y-4 pt-4 border-t border-[var(--border)]">
            <div className="p-4 bg-[var(--tint)] border border-[var(--border)] rounded-xs">
              <h3 className="font-serif text-lg text-[var(--heading)]">The Art of Layering: Chokers &amp; Chains</h3>
              <p className="text-xs text-[var(--body)] mt-1">Discover how to combine heritage kundan pieces with sleek modern gold chains.</p>
            </div>
            <div className="p-4 bg-[var(--tint)] border border-[var(--border)] rounded-xs">
              <h3 className="font-serif text-lg text-[var(--heading)]">Jewellery Care Guide</h3>
              <p className="text-xs text-[var(--body)] mt-1">Simple daily practices to keep your micron gold-plated jewellery radiant for years.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const CareersPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-white text-[var(--heading)] font-sans py-16 sm:py-24">
      <div className="site-container">
        <div className="max-w-[1000px] mx-auto bg-white p-8 sm:p-12 border border-[var(--border)] rounded-xs shadow-2xs">
          <span className="text-xs uppercase tracking-[0.25em] text-[var(--body)] font-medium block mb-2">
            Careers
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl text-[var(--heading)] font-normal mb-6">
            Join the SARINE Team
          </h1>
          <p className="text-xs sm:text-sm text-[var(--body)] leading-relaxed mb-4">
            We are always eager to connect with passionate individuals in jewellery merchandising, e-commerce operations, digital design, and customer experience.
          </p>
          <p className="text-xs text-[var(--body)]">
            Send your portfolio and resume to{' '}
            <a href="mailto:careers@sarinejewelry.com" className="text-[var(--plum)] hover:text-[var(--white)] underline font-medium">
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
    <div className="min-h-screen bg-white text-[var(--heading)] font-sans py-16 sm:py-24">
      <div className="site-container">
        <div className="max-w-[1000px] mx-auto bg-white p-8 sm:p-12 border border-[var(--border)] rounded-xs shadow-2xs">
          <span className="text-xs uppercase tracking-[0.25em] text-[var(--body)] font-medium block mb-2">
            Store Policy
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl text-[var(--heading)] font-normal mb-6">
            Cancellation Policy
          </h1>
          <p className="text-xs sm:text-sm text-[var(--body)] leading-relaxed mb-4">
            You may request cancellation before your parcel has been packaged and handed over to our courier partner. Cancellation requests are subject to confirmation by SARINE.
          </p>
          <p className="text-xs sm:text-sm text-[var(--body)] leading-relaxed mb-4">
            Once the parcel has been handed over to the courier, it cannot be cancelled in transit. For eligible damaged, defective or incorrect items, you may request a return within 7 days of delivery in accordance with our{' '}
            <Link to="/refund-policy" className="text-[var(--plum)] underline underline-offset-2">
              Refund &amp; Return Policy
            </Link>.
          </p>
          <p className="text-xs text-[var(--body)]">
            To request cancellation, use the{' '}
            <Link to="/contact" className="text-[var(--plum)] underline underline-offset-2">
              Contact page
            </Link>{' '}
            and include your order number.
          </p>
        </div>
      </div>
    </div>
  );
};
