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
    <div className="min-h-screen bg-[var(--tint)] pb-20">
      {/* Editorial Header */}
      <section className="bg-[var(--tint)] border-b border-[var(--border)] py-10 sm:py-14 text-center">
        <div className="site-container">
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className="h-[1px] w-8 bg-[var(--gold)]"></span>
            <span className="text-[11px] uppercase tracking-[0.28em] text-[var(--plum)] font-medium font-sans">
              {categoryName}
            </span>
            <span className="h-[1px] w-8 bg-[var(--gold)]"></span>
          </div>

          <h1 className="font-serif text-3xl sm:text-4xl text-[var(--heading)] font-normal tracking-wide">
            {title}
          </h1>

          <p className="mt-3 text-xs sm:text-sm text-[color:var(--body)] font-sans max-w-xl mx-auto leading-relaxed">
            {subtitle}
          </p>

          <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-[color:var(--body)] font-sans">
            <Clock size={12} className="text-[var(--plum)]" />
            <span>Last updated: 21 October 2026</span>
          </div>
        </div>
      </section>

      {/* Navigation Tabs Bar for Policies */}
      <nav aria-label="Policy pages" className="bg-[var(--tint)] border-b border-[var(--border)] sticky top-0 z-10 backdrop-blur-md">
        <div className="site-container">
          <div className="flex items-center justify-start sm:justify-center overflow-x-auto py-3 gap-1 sm:gap-2 no-scrollbar">
            {POLICY_LINKS.map((link) => {
              const isActive = location.pathname === link.path;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`whitespace-nowrap px-3.5 py-1.5 text-xs font-sans tracking-wider transition-colors uppercase rounded-xs ${
                    isActive
                      ? 'bg-[var(--plum)] text-white font-medium'
                      : 'text-[color:var(--body)] hover:text-[color:var(--plum)] hover:bg-[var(--tint)]'
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
              className="inline-flex items-center gap-1.5 text-xs text-[color:var(--body)] hover:text-[color:var(--plum)] tracking-wider uppercase font-sans transition-colors"
            >
              <ArrowLeft size={13} />
              <span>Return to Collection</span>
            </Link>
          </div>

          {/* Content Box */}
          <div className="bg-white border border-[var(--border)] p-6 sm:p-12 shadow-xs rounded-sm">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};
