/**
 * Footer component for SARINE.
 * Editorial brand philosophy, customer service links, and development disclaimer.
 */

import React from 'react';
import { Link } from 'react-router-dom';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-[#1C1917] text-[#FAF8F5] pt-14 pb-10 border-t border-[#37332E]">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-12 border-b border-[#37332E]">
          {/* Brand Philosophy */}
          <div className="md:col-span-5">
            <span className="font-serif text-3xl tracking-[0.25em] text-[#FAF8F5] block">
              SARINE
            </span>
            <span className="text-[10px] uppercase tracking-[0.3em] text-[#B89758] block mt-1">
              Affordable Luxury
            </span>
            <p className="text-xs text-[#8C847C] mt-4 leading-relaxed max-w-sm font-sans">
              Curated Indian artificial and fashion jewellery combining traditional heritage motifs
              with refined contemporary aesthetics. Designed for festive celebrations, weddings, and modern daily elegance.
            </p>
          </div>

          {/* Quick Links */}
          <div className="md:col-span-2 col-span-6">
            <h4 className="text-xs uppercase tracking-widest text-[#B89758] font-semibold mb-4 font-sans">
              Collections
            </h4>
            <ul className="space-y-2 text-xs text-[#8C847C] font-sans">
              <li>
                <Link to="/?category=necklaces" className="hover:text-[#FAF8F5] transition-colors">
                  Chokers & Necklaces
                </Link>
              </li>
              <li>
                <Link to="/?category=earrings" className="hover:text-[#FAF8F5] transition-colors">
                  Bell Jhumkas & Drops
                </Link>
              </li>
              <li>
                <Link to="/?category=bracelets" className="hover:text-[#FAF8F5] transition-colors">
                  Cuffs & Bangles
                </Link>
              </li>
              <li>
                <Link to="/?category=rings" className="hover:text-[#FAF8F5] transition-colors">
                  Cocktail Rings
                </Link>
              </li>
              <li>
                <Link to="/?category=sets" className="hover:text-[#FAF8F5] transition-colors">
                  Curated Sets
                </Link>
              </li>
            </ul>
          </div>

          {/* Customer Care */}
          <div className="md:col-span-2 col-span-6">
            <h4 className="text-xs uppercase tracking-widest text-[#B89758] font-semibold mb-4 font-sans">
              Client Care
            </h4>
            <ul className="space-y-2 text-xs text-[#8C847C] font-sans">
              <li className="hover:text-[#FAF8F5] transition-colors cursor-pointer">
                Track Order
              </li>
              <li className="hover:text-[#FAF8F5] transition-colors cursor-pointer">
                Shipping & Deliveries
              </li>
              <li className="hover:text-[#FAF8F5] transition-colors cursor-pointer">
                Jewellery Care Guide
              </li>
              <li className="hover:text-[#FAF8F5] transition-colors cursor-pointer">
                Exchanges & Returns
              </li>
              <li className="hover:text-[#FAF8F5] transition-colors cursor-pointer">
                Contact Concierge
              </li>
            </ul>
          </div>

          {/* Service Architecture Status */}
          <div className="md:col-span-3">
            <h4 className="text-xs uppercase tracking-widest text-[#B89758] font-semibold mb-4 font-sans">
              Data Layer Architecture
            </h4>
            <div className="bg-[#292524] p-3 border border-[#37332E] text-[11px] text-[#8C847C] font-mono leading-relaxed">
              <span className="text-[#B89758] block mb-1">DATA_SOURCE: &quot;mock&quot;</span>
              <span>All UI views consume IProductService and ICategoryService abstractions. Ready for Firebase Firestore adapter swap.</span>
            </div>
          </div>
        </div>

        {/* Bottom Bar & Disclaimer */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-[11px] text-[#6B635D] gap-4">
          <p>© {new Date().getFullYear()} SARINE. All rights reserved. Built with React & TypeScript.</p>
          <p className="text-center sm:text-right">
            Sample store data for development. Prices stored as whole INR integers.
          </p>
        </div>
      </div>
    </footer>
  );
};
