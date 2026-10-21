/**
 * Footer component for SARINE.
 * Matches the reference design with:
 * - Off-white #F8F6F2 background
 * - SARINE wordmark & "Timeless jewellery for every you." tagline
 * - Instagram, Facebook, Pinterest, and YouTube social icons
 * - Shop, Customer Care, About, and Payment Methods columns (UPI, Visa, Mastercard, RuPay)
 * - Bottom copyright and Privacy Policy | Terms & Conditions
 */

import React from 'react';
import { Link } from 'react-router-dom';
import {
  Instagram,
  Facebook,
  Youtube
} from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-[#F8F6F2] text-[#222222] pt-16 pb-12 border-t border-[#E8E0D6] font-sans">
      <div className="mx-auto w-full max-w-[1280px] px-4 sm:px-6 lg:px-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 pb-12 border-b border-[#E8E0D6]">
          {/* Brand & Socials Column */}
          <div className="lg:col-span-4">
            <Link to="/" className="inline-block">
              <span className="font-serif text-2xl tracking-[0.25em] text-[#222222] font-normal uppercase">
                SARINE
              </span>
            </Link>
            <p className="text-xs text-[#666666] mt-2">
              Timeless jewellery for every you.
            </p>

            {/* Social Icons */}
            <div className="flex items-center space-x-4 mt-5 text-[#333333]">
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[#B79A68] transition-colors"
                aria-label="Instagram"
              >
                <Instagram size={17} strokeWidth={1.5} />
              </a>
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[#B79A68] transition-colors"
                aria-label="Facebook"
              >
                <Facebook size={17} strokeWidth={1.5} />
              </a>
              {/* Pinterest SVG */}
              <a
                href="https://pinterest.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[#B79A68] transition-colors"
                aria-label="Pinterest"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738.098.119.112.224.083.345-.09.375-.291 1.199-.334 1.373-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12 0-6.628-5.373-12-12-12z" />
                </svg>
              </a>
              <a
                href="https://youtube.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[#B79A68] transition-colors"
                aria-label="YouTube"
              >
                <Youtube size={17} strokeWidth={1.5} />
              </a>
            </div>
          </div>

          {/* Column 1: Shop */}
          <div className="lg:col-span-2 col-span-1">
            <h4 className="text-xs uppercase tracking-wider text-[#222222] font-semibold mb-4">
              Shop
            </h4>
            <ul className="space-y-2.5 text-xs text-[#555555]">
              <li>
                <Link to="/shop" className="hover:text-[#000000] transition-colors">
                  All Products
                </Link>
              </li>
              <li>
                <Link to="/shop?sort=newest" className="hover:text-[#000000] transition-colors">
                  New Arrivals
                </Link>
              </li>
              <li>
                <Link to="/shop?sort=bestseller" className="hover:text-[#000000] transition-colors">
                  Best Sellers
                </Link>
              </li>
              <li>
                <a href="/#categories" className="hover:text-[#000000] transition-colors">
                  Categories
                </a>
              </li>
            </ul>
          </div>

          {/* Column 2: Customer Care */}
          <div className="lg:col-span-2 col-span-1">
            <h4 className="text-xs uppercase tracking-wider text-[#222222] font-semibold mb-4">
              Customer Care
            </h4>
            <ul className="space-y-2.5 text-xs text-[#555555]">
              <li>
                <Link to="/contact" className="hover:text-[#000000] transition-colors">
                  Contact Us
                </Link>
              </li>
              <li>
                <Link to="/shipping-policy" className="hover:text-[#000000] transition-colors">
                  Shipping Policy
                </Link>
              </li>
              <li>
                <Link to="/refund-policy" className="hover:text-[#000000] transition-colors">
                  Returns & Refunds
                </Link>
              </li>
              <li>
                <Link to="/cancellation-policy" className="hover:text-[#000000] transition-colors">
                  Cancellation Policy
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: About */}
          <div className="lg:col-span-2 col-span-1">
            <h4 className="text-xs uppercase tracking-wider text-[#222222] font-semibold mb-4">
              About
            </h4>
            <ul className="space-y-2.5 text-xs text-[#555555]">
              <li>
                <Link to="/about" className="hover:text-[#000000] transition-colors">
                  Our Story
                </Link>
              </li>
              <li>
                <Link to="/sustainability" className="hover:text-[#000000] transition-colors">
                  Sustainability
                </Link>
              </li>
              <li>
                <Link to="/blog" className="hover:text-[#000000] transition-colors">
                  Blog
                </Link>
              </li>
              <li>
                <Link to="/careers" className="hover:text-[#000000] transition-colors">
                  Careers
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Payment Methods */}
          <div className="lg:col-span-2 col-span-1">
            <h4 className="text-xs uppercase tracking-wider text-[#222222] font-semibold mb-4">
              Payment Methods
            </h4>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 text-[11px] font-bold tracking-wider uppercase border border-[#DDD5CB] bg-white text-[#222222] rounded-xs">
                UPI
              </span>
              <span className="px-2.5 py-1 text-[11px] font-bold tracking-wider uppercase border border-[#DDD5CB] bg-white text-[#1A1F71] rounded-xs">
                VISA
              </span>
              <span className="px-2 py-1 flex items-center border border-[#DDD5CB] bg-white rounded-xs">
                <span className="w-2.5 h-2.5 rounded-full bg-[#EB001B] inline-block -mr-1 opacity-90"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-[#F79E1B] inline-block opacity-90"></span>
              </span>
              <span className="px-2.5 py-1 text-[11px] font-bold tracking-wider uppercase border border-[#DDD5CB] bg-white text-[#222222] rounded-xs">
                RuPay
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-[#777777] gap-4">
          <p>© 2026 SARINE. All rights reserved.</p>
          <div className="flex items-center space-x-3">
            <Link to="/privacy-policy" className="hover:text-[#222222] transition-colors">
              Privacy Policy
            </Link>
            <span>|</span>
            <Link to="/terms" className="hover:text-[#222222] transition-colors">
              Terms & Conditions
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};
