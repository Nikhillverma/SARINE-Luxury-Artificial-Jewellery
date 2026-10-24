/**
 * Navbar component for SARINE.
 * Matches the reference design with:
 * 1. Announcement bar: thin beige strip with "Timeless jewellery for every moment +"
 * 2. Header: white background, spaced serif SARINE logo, Home, Shop, Categories, About, Contact,
 *    and on the right: rounded search pill, user, wishlist, and shopping bag with count badge.
 */

import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ShoppingBag,
  Search,
  Heart,
  User,
  ChevronDown,
  Menu,
  X
} from 'lucide-react';
import { useCart } from '../context/CartContext';
import { DevFirebaseSeedModal } from './DevFirebaseSeedModal';

interface NavbarProps {
  includeAll: boolean;
  onToggleIncludeAll: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  includeAll,
  onToggleIncludeAll
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { itemCount, openDrawer } = useCart();
  const [isSeedModalOpen, setIsSeedModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/shop?search=${encodeURIComponent(searchQuery.trim())}`);
      setShowSearchDropdown(false);
      setSearchQuery('');
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-white border-b border-[#E7DCEB] shadow-xs">
        {/* 1. Announcement bar: Deep Plum strip */}
        <div className="bg-[#563568] text-[#F7F0FA] text-[11px] sm:text-xs py-1.5 font-sans tracking-wide">
          <div className="site-container text-center">
            <span className="font-normal">Timeless jewellery for every moment +</span>
          </div>
        </div>

        {/* 2. Main Header */}
        <div className="site-container h-18 sm:h-20 flex items-center justify-between">
          {/* Left: Brand Wordmark */}
          <div className="flex items-center gap-6">
            <Link to="/" className="inline-block">
              <span className="font-serif text-2xl sm:text-[26px] tracking-[0.25em] text-[#563568] font-normal uppercase transition-colors hover:text-[#80609A]">
                SARINE
              </span>
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="hidden lg:flex items-center space-x-7 ml-4 text-[13px] font-sans">
              <Link
                to="/"
                className={`transition-colors hover:text-[#B69ACF] pb-1 ${
                  location.pathname === '/' ? 'text-[#563568] font-medium border-b-2 border-[#B69ACF]' : 'text-[#6F6475]'
                }`}
              >
                Home
              </Link>
              <Link
                to="/shop"
                className={`transition-colors hover:text-[#B69ACF] pb-1 ${
                  location.pathname === '/shop' ? 'text-[#563568] font-medium border-b-2 border-[#B69ACF]' : 'text-[#6F6475]'
                }`}
              >
                Shop
              </Link>
              <a
                href="/#categories"
                className="transition-colors hover:text-[#B69ACF] text-[#6F6475] pb-1"
              >
                Categories
              </a>
              <Link
                to="/about"
                className={`transition-colors hover:text-[#B69ACF] pb-1 ${
                  location.pathname === '/about' ? 'text-[#563568] font-medium border-b-2 border-[#B69ACF]' : 'text-[#6F6475]'
                }`}
              >
                About
              </Link>
              <Link
                to="/contact"
                className={`transition-colors hover:text-[#B69ACF] pb-1 ${
                  location.pathname === '/contact' ? 'text-[#563568] font-medium border-b-2 border-[#B69ACF]' : 'text-[#6F6475]'
                }`}
              >
                Contact
              </Link>
            </nav>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center space-x-3 sm:space-x-5">
            {/* Rounded Search Pill */}
            <div className="relative hidden md:block">
              <form
                onSubmit={handleSearchSubmit}
                className="flex items-center bg-[#F7F0FA] border border-[#E7DCEB] rounded-full px-3.5 py-1.5 w-52 lg:w-64 text-xs text-[#302438] transition-colors focus-within:border-[#B69ACF] focus-within:bg-white focus-within:ring-1 focus-within:ring-[#80609A]/40"
              >
                <Search size={14} className="text-[#6F6475] shrink-0 mr-2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search jewellery..."
                  className="bg-transparent w-full text-xs text-[#302438] placeholder-[#6F6475]/60 focus:outline-none font-sans"
                />
                <button
                  type="button"
                  onClick={() => setShowSearchDropdown(!showSearchDropdown)}
                  className="text-[#6F6475] hover:text-[#B69ACF] ml-1 shrink-0 transition-colors"
                  aria-label="Category selector"
                >
                  <ChevronDown size={13} />
                </button>
              </form>

              {/* Quick Search Suggestions Dropdown */}
              {showSearchDropdown && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-[#E7DCEB] rounded-md shadow-lg py-2 z-50 text-xs font-sans">
                  <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-[#6F6475] font-medium border-b border-[#E7DCEB]">
                    Quick Categories
                  </div>
                  <Link
                    to="/shop?category=earrings"
                    onClick={() => setShowSearchDropdown(false)}
                    className="block px-3 py-2 text-[#302438] hover:bg-[#F7F0FA] hover:text-[#563568] transition-colors"
                  >
                    Earrings & Jhumkas
                  </Link>
                  <Link
                    to="/shop?category=necklaces"
                    onClick={() => setShowSearchDropdown(false)}
                    className="block px-3 py-2 text-[#302438] hover:bg-[#F7F0FA] hover:text-[#563568] transition-colors"
                  >
                    Chokers & Necklaces
                  </Link>
                  <Link
                    to="/shop?category=rings"
                    onClick={() => setShowSearchDropdown(false)}
                    className="block px-3 py-2 text-[#302438] hover:bg-[#F7F0FA] hover:text-[#563568] transition-colors"
                  >
                    Rings & Bands
                  </Link>
                  <Link
                    to="/shop?category=bracelets"
                    onClick={() => setShowSearchDropdown(false)}
                    className="block px-3 py-2 text-[#302438] hover:bg-[#F7F0FA] hover:text-[#563568] transition-colors"
                  >
                    Bracelets & Cuffs
                  </Link>
                  <Link
                    to="/shop?category=sets"
                    onClick={() => setShowSearchDropdown(false)}
                    className="block px-3 py-2 text-[#302438] hover:bg-[#F7F0FA] hover:text-[#563568] transition-colors"
                  >
                    Curated Sets
                  </Link>
                </div>
              )}
            </div>

            {/* Track Order Small Text Link */}
            <Link
              to="/track-order"
              className="hidden md:inline-block text-xs uppercase tracking-wider text-[#6F6475] hover:text-[#B69ACF] transition-colors whitespace-nowrap font-medium"
            >
              Track Order
            </Link>

            {/* User Icon */}
            <Link
              to="/contact"
              className="text-[#302438] hover:text-[#B69ACF] transition-colors p-1"
              aria-label="Account & Support"
              title="Account & Support"
            >
              <User size={18} strokeWidth={1.5} />
            </Link>

            {/* Wishlist Heart Icon */}
            <Link
              to="/shop"
              className="text-[#302438] hover:text-[#B69ACF] transition-colors p-1"
              aria-label="Wishlist"
              title="Wishlist"
            >
              <Heart size={18} strokeWidth={1.5} />
            </Link>

            {/* Shopping Bag with badge */}
            <button
              onClick={openDrawer}
              className="relative text-[#302438] hover:text-[#B69ACF] transition-colors p-1 flex items-center"
              aria-label={`Shopping Bag with ${itemCount} items`}
              title="Shopping Bag"
            >
              <ShoppingBag size={19} strokeWidth={1.5} />
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#563568] text-white text-[10px] font-sans font-medium rounded-full flex items-center justify-center">
                {itemCount}
              </span>
            </button>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-1 text-[#302438] hover:text-[#B69ACF] transition-colors lg:hidden"
              aria-label="Menu"
            >
              {isMobileMenuOpen ? <X size={22} strokeWidth={1.5} /> : <Menu size={22} strokeWidth={1.5} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div className="lg:hidden border-t border-[#E7DCEB] bg-white px-6 py-6 space-y-4 animate-fadeIn">
            {/* Mobile Search */}
            <form onSubmit={handleSearchSubmit} className="mb-4">
              <div className="flex items-center bg-[#F7F0FA] border border-[#E7DCEB] rounded-full px-3.5 py-2 w-full text-xs text-[#302438]">
                <Search size={14} className="text-[#6F6475] shrink-0 mr-2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search jewellery..."
                  className="bg-transparent w-full text-xs text-[#302438] placeholder-[#6F6475]/60 focus:outline-none font-sans"
                />
              </div>
            </form>

            <nav className="flex flex-col space-y-3 text-sm font-sans text-[#302438]">
              <Link
                to="/"
                onClick={() => setIsMobileMenuOpen(false)}
                className="py-1 border-b border-[#E7DCEB] hover:text-[#B69ACF] transition-colors"
              >
                Home
              </Link>
              <Link
                to="/shop"
                onClick={() => setIsMobileMenuOpen(false)}
                className="py-1 border-b border-[#E7DCEB] hover:text-[#B69ACF] transition-colors"
              >
                Shop All
              </Link>
              <a
                href="/#categories"
                onClick={() => setIsMobileMenuOpen(false)}
                className="py-1 border-b border-[#E7DCEB] hover:text-[#B69ACF] transition-colors"
              >
                Categories
              </a>
              <Link
                to="/about"
                onClick={() => setIsMobileMenuOpen(false)}
                className="py-1 border-b border-[#E7DCEB] hover:text-[#B69ACF] transition-colors"
              >
                About
              </Link>
              <Link
                to="/contact"
                onClick={() => setIsMobileMenuOpen(false)}
                className="py-1 border-b border-[#E7DCEB] hover:text-[#B69ACF] transition-colors"
              >
                Contact
              </Link>
              <Link
                to="/track-order"
                onClick={() => setIsMobileMenuOpen(false)}
                className="py-1 border-b border-[#E7DCEB] hover:text-[#B69ACF] transition-colors"
              >
                Track Order
              </Link>
            </nav>

            {/* Dev seed / includeAll utility button for testing */}
            {import.meta.env.DEV && (
              <div className="pt-3 border-t border-[#E7DCEB] flex items-center justify-between text-xs text-[#6F6475]">
                <button
                  onClick={onToggleIncludeAll}
                  className="text-[11px] uppercase tracking-wider underline hover:text-[#563568]"
                >
                  includeAll: {includeAll ? 'ON' : 'OFF'}
                </button>
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setIsSeedModalOpen(true);
                  }}
                  className="text-[11px] uppercase tracking-wider text-[#563568] hover:text-[#B69ACF] underline"
                >
                  Seed Firestore
                </button>
              </div>
            )}
          </div>
        )}
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
