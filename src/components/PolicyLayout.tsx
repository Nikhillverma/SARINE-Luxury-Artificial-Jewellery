/**
 * Shared layout component for SARINE legal and customer care policy pages.
 * Enforces brand design language: ivory canvas (#FAF8F5), champagne gold (#B89758),
 * serif editorial headings, date stamps, and policy cross-navigation.
 */

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Clock } from 'lucide-react';

interface PolicyLayoutProps {
  title: string;
  subtitle: string;
  categoryName?: string;
  children: React.ReactNode;
}

const POLICY_LINKS = [
  { path: '/contact', label: 'Contact Us' },
  { path: '/shipping-policy', label: 'Shipping & Delivery' },
  { path: '/refund-policy', label: 'Refund & Returns' },
  { path: '/privacy-policy', label: 'Privacy Policy' },
  { path: '/terms', label: 'Terms & Conditions' },
];

export const PolicyLayout: React.FC<PolicyLayoutProps> = ({
  title,
  subtitle,
  categoryName = 'Client Care & Policies',
  children,
}) => {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-[#FAF8F5] pb-20">
      {/* Editorial Header */}
      <section className="bg-[#F3EEE7]/60 border-b border-[#E6DFD5] py-10 sm:py-14 text-center">
        <div className="site-container">
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className="h-[1px] w-8 bg-[#B89758]"></span>
            <span className="text-[11px] uppercase tracking-[0.28em] text-[#B89758] font-medium font-sans">
              {categoryName}
            </span>
            <span className="h-[1px] w-8 bg-[#B89758]"></span>
          </div>

          <h1 className="font-serif text-3xl sm:text-4xl text-[#1C1917] font-normal tracking-wide">
            {title}
          </h1>

          <p className="mt-3 text-xs sm:text-sm text-[#6B635D] font-sans max-w-xl mx-auto leading-relaxed">
            {subtitle}
          </p>

          <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-[#8C847C] font-sans">
            <Clock size={12} className="text-[#B89758]" />
            <span>Last updated: 21 October 2026</span>
          </div>
        </div>
      </section>

      {/* Navigation Tabs Bar for Policies */}
      <nav aria-label="Policy pages" className="bg-[#FAF8F5] border-b border-[#E6DFD5] sticky top-0 z-10 backdrop-blur-md bg-[#FAF8F5]/90">
        <div className="site-container">
          <div className="flex items-center justify-start sm:justify-center overflow-x-auto py-3 gap-1 sm:gap-2 no-scrollbar">
            {POLICY_LINKS.map((link) => {
              const isActive = location.pathname === link.path;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`whitespace-nowrap px-3.5 py-1.5 text-xs font-sans tracking-wider transition-colors uppercase ${
                    isActive
                      ? 'bg-[#1C1917] text-[#FAF8F5] font-medium'
                      : 'text-[#6B635D] hover:text-[#1C1917] hover:bg-[#F3EEE7]'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="site-container pt-10 sm:pt-14">
        <div className="max-w-[1000px] mx-auto w-full">
          {/* Back Link */}
          <div className="mb-8">
            <Link
              to="/shop"
              className="inline-flex items-center gap-1.5 text-xs text-[#8C847C] hover:text-[#1C1917] tracking-wider uppercase font-sans transition-colors"
            >
              <ArrowLeft size={13} />
              <span>Return to Collection</span>
            </Link>
          </div>

          {/* Content Box */}
          <div className="bg-white border border-[#E6DFD5] p-6 sm:p-12 shadow-xs">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};
