/**
 * Navbar component for SARINE.
 * Provides luxury brand typography, category links, search bar, includeAll toggle,
 * shopping bag trigger backed by CartContext, and dev-only Firestore seed utility.
 */

import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShoppingBag, Sparkles, Filter, Database } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { DevFirebaseSeedModal } from './DevFirebaseSeedModal';
import { DATA_SOURCE } from '../services';

interface NavbarProps {
  includeAll: boolean;
  onToggleIncludeAll: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  includeAll,
  onToggleIncludeAll
}) => {
  const location = useLocation();
  const { itemCount, openDrawer } = useCart();
  const [isSeedModalOpen, setIsSeedModalOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 bg-[#FAF8F5]/95 backdrop-blur-md border-b border-[#E6DFD5]">
        {/* Editorial Announcement Bar */}
        <div className="bg-[#1C1917] text-[#FAF8F5] text-xs py-2 px-4 text-center tracking-widest uppercase flex items-center justify-center gap-2">
          <Sparkles size={12} className="text-[#B89758]" />
          <span>Complimentary Express Delivery on orders above ₹1,999</span>
          <Sparkles size={12} className="text-[#B89758]" />
        </div>

        <div className="max-w-[1280px] mx-auto px-4 sm:px-8 h-18 flex items-center justify-between">
          {/* Brand Logo */}
          <Link to="/" className="flex flex-col items-start group">
            <span className="font-serif text-2xl sm:text-3xl tracking-[0.25em] text-[#1C1917] group-hover:text-[#B89758] transition-colors">
              SARINE
            </span>
            <span className="text-[9px] uppercase tracking-[0.3em] text-[#6B635D] -mt-1 font-sans">
              Affordable Luxury
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center space-x-8 text-sm font-sans tracking-wide text-[#57534E]">
            <Link
              to="/shop"
              className={`transition-colors hover:text-[#1C1917] ${
                location.pathname === '/' || location.pathname === '/shop'
                  ? 'text-[#1C1917] font-semibold border-b border-[#B89758] pb-1'
                  : ''
              }`}
            >
              All Pieces
            </Link>
            <Link
              to="/shop?category=earrings"
              className="transition-colors hover:text-[#1C1917] pb-1"
            >
              Earrings
            </Link>
            <Link
              to="/shop?category=necklaces"
              className="transition-colors hover:text-[#1C1917] pb-1"
            >
              Necklaces
            </Link>
            <Link
              to="/shop?category=bracelets"
              className="transition-colors hover:text-[#1C1917] pb-1"
            >
              Bracelets
            </Link>
            <Link
              to="/shop?category=rings"
              className="transition-colors hover:text-[#1C1917] pb-1"
            >
              Rings
            </Link>
            <Link
              to="/shop?category=sets"
              className="transition-colors hover:text-[#1C1917] pb-1"
            >
              Sets
            </Link>
          </nav>

          {/* Right Controls: Dev Controls & Bag Trigger */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Dev Firestore Seed Button (Hidden in production) */}
            {import.meta.env.DEV && (
              <button
                onClick={() => setIsSeedModalOpen(true)}
                title="Developer tool: Seed Firestore with products and categories"
                className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 text-xs border border-[#B89758] bg-[#F6F1E8] text-[#1C1917] hover:bg-[#B89758] hover:text-[#FAF8F5] transition-colors rounded"
              >
                <Database size={12} />
                <span className="font-medium">Seed Firestore (Dev)</span>
              </button>
            )}

            {/* Test includeAll switch */}
            <button
              onClick={onToggleIncludeAll}
              title="Toggle Draft and Archived products (tests includeAll flag)"
              className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 text-xs border rounded transition-colors ${
                includeAll
                  ? 'bg-[#B89758] text-[#1C1917] font-medium border-[#9E7F43]'
                  : 'bg-[#F3EEE7] text-[#6B635D] border-[#E6DFD5] hover:text-[#1C1917]'
              }`}
            >
              <Filter size={12} />
              <span>includeAll: {includeAll ? 'ON' : 'OFF'}</span>
            </button>

            {/* Cart Bag Icon with live count badge */}
            <button
              onClick={openDrawer}
              className="relative p-2 text-[#1C1917] hover:text-[#B89758] transition-colors cursor-pointer flex items-center"
              title="Open Shopping Bag"
              aria-label={`Shopping Bag (${itemCount} items)`}
            >
              <ShoppingBag size={22} strokeWidth={1.5} />
              {itemCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-[#B89758] text-[#1C1917] font-bold text-[10px] rounded-full flex items-center justify-center">
                  {itemCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Dev Seed Modal */}
      {import.meta.env.DEV && (
        <DevFirebaseSeedModal
          isOpen={isSeedModalOpen}
          onClose={() => setIsSeedModalOpen(false)}
        />
      )}
    </>
  );
};
