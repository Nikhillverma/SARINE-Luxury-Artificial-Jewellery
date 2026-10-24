/**
 * About Page for SARINE.
 * Editorial story and brand values matching the brand aesthetic.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export const AboutPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#F7F0FA] text-[#302438] font-sans">
      <section className="site-container py-16 sm:py-24">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-xs uppercase tracking-[0.25em] text-[#6F6475] font-medium block mb-3">
            Our Story
          </span>
          <h1 className="font-serif text-4xl sm:text-5xl text-[#302438] font-normal leading-tight">
            More Than Just Jewellery
          </h1>
          <p className="mt-4 text-sm sm:text-base text-[#6F6475] leading-relaxed">
            At SARINE, we believe jewellery is more than an accessory — it's a reflection of your story,
            your style, and your everyday moments. Our collections are designed to help you feel confident,
            beautiful, and effortlessly you.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-10 border-t border-[#E7DCEB]">
          <div className="bg-white p-6 border border-[#E7DCEB] rounded-xs shadow-2xs">
            <h3 className="font-serif text-xl text-[#302438] mb-2 font-normal">Thoughtfully Designed</h3>
            <p className="text-xs text-[#6F6475] leading-relaxed">
              Every curve, setting, and gemstone is curated to transition seamlessly from morning elegance to evening celebration.
            </p>
          </div>
          <div className="bg-white p-6 border border-[#E7DCEB] rounded-xs shadow-2xs">
            <h3 className="font-serif text-xl text-[#302438] mb-2 font-normal">Skin-Friendly & Comfortable</h3>
            <p className="text-xs text-[#6F6475] leading-relaxed">
              Crafted with high-grade brass alloy foundations, durable plating, and smooth closures engineered for extended wear.
            </p>
          </div>
          <div className="bg-white p-6 border border-[#E7DCEB] rounded-xs shadow-2xs">
            <h3 className="font-serif text-xl text-[#302438] mb-2 font-normal">Accessible Luxury</h3>
            <p className="text-xs text-[#6F6475] leading-relaxed">
              Fine jewellery aesthetics at honest, direct prices. No unnecessary markups, just pure craftsmanship.
            </p>
          </div>
        </div>

        <div className="mt-14 text-center">
          <Link
            to="/shop"
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-[#563568] text-white text-xs uppercase tracking-[0.2em] font-medium hover:bg-[#A184BD] transition-colors rounded-xs shadow-2xs cursor-pointer"
          >
            <span>Explore the Collection</span>
            <ArrowRight size={13} />
          </Link>
        </div>
      </section>
    </div>
  );
};
