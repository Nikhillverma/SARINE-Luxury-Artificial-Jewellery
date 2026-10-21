/**
 * About Page for SARINE.
 * Editorial story and brand values matching the brand aesthetic.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export const AboutPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#F8F6F2] text-[#222222] font-sans">
      <section className="mx-auto w-full max-w-[1280px] px-4 sm:px-6 lg:px-10 py-16 sm:py-24">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-xs uppercase tracking-[0.25em] text-[#81776D] font-medium block mb-3">
            Our Story
          </span>
          <h1 className="font-serif text-4xl sm:text-5xl text-[#222222] font-normal leading-tight">
            More Than Just Jewellery
          </h1>
          <p className="mt-4 text-sm sm:text-base text-[#666666] leading-relaxed">
            At SARINE, we believe jewellery is more than an accessory — it's a reflection of your story,
            your style, and your everyday moments. Our collections are designed to help you feel confident,
            beautiful, and effortlessly you.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-10 border-t border-[#E8E0D6]">
          <div className="bg-white p-6 border border-[#E8E0D6] rounded-xs">
            <h3 className="font-serif text-xl text-[#222222] mb-2 font-normal">Thoughtfully Designed</h3>
            <p className="text-xs text-[#666666] leading-relaxed">
              Every curve, setting, and gemstone is curated to transition seamlessly from morning elegance to evening celebration.
            </p>
          </div>
          <div className="bg-white p-6 border border-[#E8E0D6] rounded-xs">
            <h3 className="font-serif text-xl text-[#222222] mb-2 font-normal">Skin-Friendly & Comfortable</h3>
            <p className="text-xs text-[#666666] leading-relaxed">
              Crafted with high-grade brass alloy foundations, durable plating, and smooth closures engineered for extended wear.
            </p>
          </div>
          <div className="bg-white p-6 border border-[#E8E0D6] rounded-xs">
            <h3 className="font-serif text-xl text-[#222222] mb-2 font-normal">Accessible Luxury</h3>
            <p className="text-xs text-[#666666] leading-relaxed">
              Fine jewellery aesthetics at honest, direct prices. No unnecessary markups, just pure craftsmanship.
            </p>
          </div>
        </div>

        <div className="mt-14 text-center">
          <Link
            to="/shop"
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-[#222222] text-white text-xs uppercase tracking-[0.2em] font-medium hover:bg-[#444444] transition-colors rounded-xs"
          >
            <span>Explore the Collection</span>
            <ArrowRight size={13} />
          </Link>
        </div>
      </section>
    </div>
  );
};
