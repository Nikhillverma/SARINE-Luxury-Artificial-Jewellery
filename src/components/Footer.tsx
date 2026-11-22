/**
 * Footer component for SARINE.
 * Matches the reference design with:
 * - Off-white #F8F6F2 background
 * - SARINE wordmark & "{chrome.footer.tagline}" tagline
 * - Instagram, Facebook, Pinterest, and YouTube social icons
 * - Shop, Customer Care, About, and Payment Methods columns (UPI, Visa, Mastercard, RuPay)
 * - Bottom copyright and Privacy Policy | Terms & Conditions
 */

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Facebook,
  Instagram,
  Youtube,
  ShieldCheck,
  Truck,
  RotateCcw,
  Headphones,
  ArrowRight,
  CheckCircle2
} from 'lucide-react';
import { useCheckoutConfig } from '../hooks/useCheckoutConfig';
import { DEFAULT_SITE_CHROME, siteChromeService, type SiteChromeSettings } from '../services/hostinger/siteChromeService';

export const Footer: React.FC = () => {
  const { config } = useCheckoutConfig();
  const [chrome, setChrome] = useState<SiteChromeSettings>(DEFAULT_SITE_CHROME);
  useEffect(() => { let active = true; siteChromeService.getPublic().then(({ settings }) => { if (active) setChrome(settings); }).catch(() => undefined); return () => { active = false; }; }, []);

  return (
    <footer className="bg-[#563568] text-[#F7F0FA] border-t border-[#E7DCEB] font-sans">
      {/* Trust Strip */}
      <div className="w-full bg-[#F7F0FA] text-[#302438] border-b border-[#E7DCEB] py-8 sm:py-10">
        <div className="site-container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6">
            <div className="flex items-center gap-3 p-3.5 sm:p-4 bg-white border border-[#E7DCEB] rounded-md shadow-xs">
              <div className="p-2.5 bg-[#F0E6F4] rounded-md text-[#563568] shrink-0">
                <ShieldCheck size={20} strokeWidth={1.5} />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-medium text-[#302438] leading-tight font-sans">
                  Secure payments
                </h4>
                <p className="text-[11px] text-[#6F6475] font-sans mt-0.5">
                  via Razorpay
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3.5 sm:p-4 bg-white border border-[#E7DCEB] rounded-md shadow-xs">
              <div className="p-2.5 bg-[#F0E6F4] rounded-md text-[#563568] shrink-0">
                <Truck size={20} strokeWidth={1.5} />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-medium text-[#302438] leading-tight font-sans">
                  Delivery across India
                </h4>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3.5 sm:p-4 bg-white border border-[#E7DCEB] rounded-md shadow-xs">
              <div className="p-2.5 bg-[#F0E6F4] rounded-md text-[#563568] shrink-0">
                <RotateCcw size={20} strokeWidth={1.5} />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-medium text-[#302438] leading-tight font-sans">
                  7-day returns
                </h4>
                <p className="text-[11px] text-[#6F6475] font-sans mt-0.5">
                  for damaged or wrong items
                </p>
              </div>
            </div>

            <Link
              to="/contact"
              className="group flex items-center gap-3 p-3.5 sm:p-4 bg-white border border-[#E7DCEB] hover:border-[#B69ACF] hover:bg-[#FAF5FC] rounded-md transition-colors shadow-xs"
            >
              <div className="p-2.5 bg-[#F0E6F4] rounded-md text-[#563568] group-hover:bg-[#EBDFF2] shrink-0 transition-colors">
                <Headphones size={20} strokeWidth={1.5} />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-xs sm:text-sm font-medium text-[#302438] group-hover:text-[#563568] transition-colors leading-tight font-sans inline-flex items-center gap-1">
                  <span>Help & Support</span>
                  <ArrowRight size={12} className="opacity-0 group-hover:opacity-100 text-[#563568] transition-opacity" />
                </h4>
                <p className="text-[11px] text-[#6F6475] font-sans mt-0.5 truncate">
                  Help when you need it
                </p>
              </div>
            </Link>

            {config.codEnabled && (
              <div className="flex items-center gap-3 p-3.5 sm:p-4 bg-white border border-[#E7DCEB] rounded-md shadow-xs col-span-2 md:col-span-1">
                <div className="p-2.5 bg-[#F0E6F4] rounded-md text-[#563568] shrink-0">
                  <CheckCircle2 size={20} strokeWidth={1.5} />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-medium text-[#302438] leading-tight font-sans">
                    Cash on Delivery
                  </h4>
                  <p className="text-[11px] text-[#6F6475] font-sans mt-0.5">
                    Available on eligible orders
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="site-container pt-14 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 pb-12 border-b border-[#6E4682]">
          {/* Brand & Socials Column */}
          <div className="lg:col-span-4">
            <Link to="/" className="inline-block">
              <span className="font-serif text-2xl tracking-[0.25em] text-white font-normal uppercase hover:text-[#FFFFFF] transition-colors">
                SARINE
              </span>
            </Link>
            <p className="text-xs text-[#E7DCEB] mt-2">
              {chrome.footer.tagline}
            </p>

            {/* Social Icons */}
            <div className="flex items-center space-x-4 mt-5 text-[#E7DCEB]">
              <a
                href={chrome.footer.social.facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[#FFFFFF] transition-colors p-1"
                aria-label="Facebook"
              >
                <Facebook size={17} strokeWidth={1.5} />
              </a>
              <a href={chrome.footer.social.instagram} target="_blank" rel="noopener noreferrer" className="hover:text-[#FFFFFF] transition-colors p-1" aria-label="Instagram">
                <Instagram size={17} strokeWidth={1.5} />
              </a>
              {/* Pinterest SVG */}
              <a
                href={chrome.footer.social.pinterest}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[#FFFFFF] transition-colors p-1"
                aria-label="Pinterest"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738.098.119.112.224.083.345-.09.375-.291 1.199-.334 1.373-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12 0-6.628-5.373-12-12-12z" />
                </svg>
              </a>
              <a
                href={chrome.footer.social.youtube}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[#FFFFFF] transition-colors p-1"
                aria-label="YouTube"
              >
                <Youtube size={17} strokeWidth={1.5} />
              </a>
            </div>
          </div>

          {/* Column 1: Shop */}
          <div className="lg:col-span-2 col-span-1">
            <h4 className="text-xs uppercase tracking-wider text-[#FFFFFF] font-semibold mb-4">
              {chrome.footer.headings.shop}
            </h4>
            <ul className="space-y-2.5 text-xs text-[#E7DCEB]">
              <li>
                <Link to="/shop" className="hover:text-[#FFFFFF] transition-colors">
                  All Products
                </Link>
              </li>
              <li>
                <Link to="/shop?sort=newest" className="hover:text-[#FFFFFF] transition-colors">
                  New Arrivals
                </Link>
              </li>
              <li>
                <Link to="/shop?sort=bestseller" className="hover:text-[#FFFFFF] transition-colors">
                  Best Sellers
                </Link>
              </li>
              <li>
                <a href="/#categories" className="hover:text-[#FFFFFF] transition-colors">
                  Categories
                </a>
              </li>
            </ul>
          </div>

          {/* Column 2: Customer Care */}
          <div className="lg:col-span-2 col-span-1">
            <h4 className="text-xs uppercase tracking-wider text-[#FFFFFF] font-semibold mb-4">
              {chrome.footer.headings.care}
            </h4>
            <ul className="space-y-2.5 text-xs text-[#E7DCEB]">
              <li>
                <Link to="/contact" className="hover:text-[#FFFFFF] transition-colors">
                  Help & Support
                </Link>
              </li>
              <li>
                <Link to="/track-order" className="hover:text-[#FFFFFF] transition-colors">
                  Track Order
                </Link>
              </li>
              <li>
                <Link to="/shipping-policy" className="hover:text-[#FFFFFF] transition-colors">
                  Shipping Policy
                </Link>
              </li>
              <li>
                <Link to="/refund-policy" className="hover:text-[#FFFFFF] transition-colors">
                  Returns & Refunds
                </Link>
              </li>
              <li>
                <Link to="/cancellation-policy" className="hover:text-[#FFFFFF] transition-colors">
                  Cancellation Policy
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: About */}
          <div className="lg:col-span-2 col-span-1">
            <h4 className="text-xs uppercase tracking-wider text-[#FFFFFF] font-semibold mb-4">
              {chrome.footer.headings.about}
            </h4>
            <ul className="space-y-2.5 text-xs text-[#E7DCEB]">
              <li>
                <Link to="/about" className="hover:text-[#FFFFFF] transition-colors">
                  Our Story
                </Link>
              </li>
              <li>
                <Link to="/sustainability" className="hover:text-[#FFFFFF] transition-colors">
                  Sustainability
                </Link>
              </li>
              <li>
                <Link to="/blog" className="hover:text-[#FFFFFF] transition-colors">
                  Blog
                </Link>
              </li>
              <li>
                <Link to="/careers" className="hover:text-[#FFFFFF] transition-colors">
                  Careers
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Payment Methods */}
          <div className="lg:col-span-2 col-span-1">
            <h4 className="text-xs uppercase tracking-wider text-[#FFFFFF] font-semibold mb-4">
              {chrome.footer.headings.payments}
            </h4>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 text-[11px] font-bold tracking-wider uppercase border border-[#E7DCEB] bg-white text-[#302438] rounded-xs shadow-xs">
                UPI
              </span>
              <span className="px-2.5 py-1 text-[11px] font-bold tracking-wider uppercase border border-[#E7DCEB] bg-white text-[#1A1F71] rounded-xs shadow-xs">
                VISA
              </span>
              <span className="px-2 py-1 flex items-center border border-[#E7DCEB] bg-white rounded-xs shadow-xs">
                <span className="w-2.5 h-2.5 rounded-full bg-[#EB001B] inline-block -mr-1 opacity-90"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-[#F79E1B] inline-block opacity-90"></span>
              </span>
              <span className="px-2.5 py-1 text-[11px] font-bold tracking-wider uppercase border border-[#E7DCEB] bg-white text-[#302438] rounded-xs shadow-xs">
                RuPay
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-[#E7DCEB]/80 gap-4">
          <p>{chrome.footer.copyright}</p>
          <div className="flex items-center space-x-3">
            <Link to="/privacy-policy" className="hover:text-[#FFFFFF] transition-colors">
              Privacy Policy
            </Link>
            <span>|</span>
            <Link to="/terms" className="hover:text-[#FFFFFF] transition-colors">
              Terms & Conditions
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};
