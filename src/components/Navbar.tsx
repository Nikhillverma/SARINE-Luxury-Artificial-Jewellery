/**
 * Navbar component for SARINE.
 * Luxury e-commerce navigation header inspired by high-end jewellery brands (such as GIVA)
 * with SARINE's signature Lavender & Plum palette, zero-pill discipline, smooth hover
 * dropdown interaction with 200ms grace period, comprehensive mega-menus, keyboard accessibility,
 * and an accordion-driven mobile slide-over drawer with body scroll lock.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ShoppingBag,
  Search,
  Heart,
  User,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  Sparkles,
  Gift,
  Truck,
  Phone,
  ArrowRight,
  ShieldCheck,
  Gem,
  Award
} from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { SearchOverlay } from './SearchOverlay';
import { DevFirebaseSeedModal } from './DevFirebaseSeedModal';

interface NavbarProps {
  includeAll: boolean;
  onToggleIncludeAll: () => void;
}

const ANNOUNCEMENT_MESSAGES = [
  'Complimentary Express Delivery on orders across India',
  'Handcrafted in Demi-Fine 18K Gold Polish & Sterling Silver Motifs',
  'Complimentary Luxury Gift Packaging on all orders this week',
  'Need styling help? Chat with our jewellery concierge on WhatsApp'
];

type DropdownId =
  | 'new-arrivals'
  | 'bestsellers'
  | 'categories'
  | 'occasions'
  | 'gifts'
  | 'collections'
  | 'about';

export const Navbar: React.FC<NavbarProps> = ({
  includeAll,
  onToggleIncludeAll
}) => {
  const location = useLocation();
  const { itemCount, openDrawer } = useCart();
  const { count: wishlistCount, openWishlist } = useWishlist();

  // Navigation & Dropdown states
  const [activeDropdown, setActiveDropdown] = useState<DropdownId | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Account Menu dropdown state
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const accountTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Search & Mobile Drawer states
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSeedModalOpen, setIsSeedModalOpen] = useState(false);
  const [activeAnnouncement, setActiveAnnouncement] = useState(0);

  // Mobile Accordion state
  const [mobileExpanded, setMobileExpanded] = useState<Record<string, boolean>>({
    categories: true,
    occasions: false,
    gifts: false,
    collections: false,
    about: false
  });

  // Rotate announcement bar every 5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveAnnouncement((prev) => (prev + 1) % ANNOUNCEMENT_MESSAGES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  // Close dropdown and mobile drawer on route changes
  useEffect(() => {
    setActiveDropdown(null);
    setIsAccountMenuOpen(false);
    setIsMobileMenuOpen(false);
  }, [location.pathname, location.search]);

  // Escape key closes dropdown
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveDropdown(null);
        setIsAccountMenuOpen(false);
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Hover timer management with 200ms grace period
  const handleMouseEnter = (dropdownId: DropdownId) => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    if (accountTimerRef.current) {
      clearTimeout(accountTimerRef.current);
      accountTimerRef.current = null;
    }
    setIsAccountMenuOpen(false);
    setActiveDropdown(dropdownId);
  };

  const handleMouseLeave = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
    }
    closeTimerRef.current = setTimeout(() => {
      setActiveDropdown(null);
      closeTimerRef.current = null;
    }, 200); // 200ms grace period
  };

  // Account dropdown timer handlers
  const handleAccountMouseEnter = () => {
    if (accountTimerRef.current) {
      clearTimeout(accountTimerRef.current);
      accountTimerRef.current = null;
    }
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setActiveDropdown(null);
    setIsAccountMenuOpen(true);
  };

  const handleAccountMouseLeave = () => {
    if (accountTimerRef.current) {
      clearTimeout(accountTimerRef.current);
    }
    accountTimerRef.current = setTimeout(() => {
      setIsAccountMenuOpen(false);
      accountTimerRef.current = null;
    }, 200);
  };

  const toggleMobileAccordion = (section: string) => {
    setMobileExpanded((prev) => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  return (
    <>
      <header
        className="sticky top-0 z-40 bg-white border-b border-[#E7DCEB] shadow-xs"
        onMouseLeave={handleMouseLeave}
      >
        {/* 1. Rotating Announcement Bar */}
        <div className="bg-[#563568] text-[#F7F0FA] text-[11px] sm:text-xs py-1.5 font-sans tracking-wide">
          <div className="site-container flex items-center justify-between">
            <button
              onClick={() =>
                setActiveAnnouncement(
                  (prev) => (prev - 1 + ANNOUNCEMENT_MESSAGES.length) % ANNOUNCEMENT_MESSAGES.length
                )
              }
              className="text-[#B69ACF] hover:text-white px-2 py-0.5 text-xs hidden sm:inline-block cursor-pointer transition-colors"
              aria-label="Previous announcement"
            >
              ‹
            </button>
            <div className="text-center flex-1 truncate transition-all duration-300">
              <span className="font-normal inline-flex items-center gap-1.5">
                <Sparkles size={11} className="text-[#D9B8A0] shrink-0" />
                <span>{ANNOUNCEMENT_MESSAGES[activeAnnouncement]}</span>
              </span>
            </div>
            <button
              onClick={() =>
                setActiveAnnouncement((prev) => (prev + 1) % ANNOUNCEMENT_MESSAGES.length)
              }
              className="text-[#B69ACF] hover:text-white px-2 py-0.5 text-xs hidden sm:inline-block cursor-pointer transition-colors"
              aria-label="Next announcement"
            >
              ›
            </button>
          </div>
        </div>

        {/* 2. Main Navigation Bar */}
        <div className="site-container h-18 sm:h-20 flex items-center justify-between relative">
          {/* Left: Brand Wordmark */}
          <div className="flex items-center gap-8">
            <Link to="/" className="inline-block shrink-0">
              <span className="font-serif text-2xl sm:text-[28px] tracking-[0.22em] text-[#563568] font-normal uppercase transition-colors hover:text-[#80609A]">
                SARINE
              </span>
            </Link>

            {/* Desktop Navigation Links */}
            <nav
              className="hidden lg:flex items-center space-x-6 xl:space-x-8 text-[13px] font-sans"
              aria-label="Main Navigation"
            >
              {/* New Arrivals */}
              <div
                className="relative py-6"
                onMouseEnter={() => handleMouseEnter('new-arrivals')}
              >
                <Link
                  to="/shop?sort=newest"
                  className={`inline-flex items-center gap-1 transition-colors hover:text-[#563568] ${
                    activeDropdown === 'new-arrivals' || location.search.includes('sort=newest')
                      ? 'text-[#563568] font-medium'
                      : 'text-[#6F6475]'
                  }`}
                  aria-expanded={activeDropdown === 'new-arrivals'}
                  aria-haspopup="true"
                >
                  <span>New Arrivals</span>
                  <ChevronDown
                    size={13}
                    className={`transition-transform duration-200 ${
                      activeDropdown === 'new-arrivals' ? 'rotate-180 text-[#563568]' : 'text-[#6F6475]'
                    }`}
                  />
                </Link>
              </div>

              {/* Bestsellers */}
              <div
                className="relative py-6"
                onMouseEnter={() => handleMouseEnter('bestsellers')}
              >
                <Link
                  to="/shop?sort=bestseller"
                  className={`inline-flex items-center gap-1 transition-colors hover:text-[#563568] ${
                    activeDropdown === 'bestsellers' || location.search.includes('sort=bestseller')
                      ? 'text-[#563568] font-medium'
                      : 'text-[#6F6475]'
                  }`}
                  aria-expanded={activeDropdown === 'bestsellers'}
                  aria-haspopup="true"
                >
                  <span>Bestsellers</span>
                  <ChevronDown
                    size={13}
                    className={`transition-transform duration-200 ${
                      activeDropdown === 'bestsellers' ? 'rotate-180 text-[#563568]' : 'text-[#6F6475]'
                    }`}
                  />
                </Link>
              </div>

              {/* Shop by Category (Mega-Menu) */}
              <div
                className="relative py-6"
                onMouseEnter={() => handleMouseEnter('categories')}
              >
                <Link
                  to="/shop"
                  className={`inline-flex items-center gap-1 transition-colors hover:text-[#563568] ${
                    activeDropdown === 'categories' || location.pathname === '/shop'
                      ? 'text-[#563568] font-medium'
                      : 'text-[#6F6475]'
                  }`}
                  aria-expanded={activeDropdown === 'categories'}
                  aria-haspopup="true"
                >
                  <span>Shop by Category</span>
                  <ChevronDown
                    size={13}
                    className={`transition-transform duration-200 ${
                      activeDropdown === 'categories' ? 'rotate-180 text-[#563568]' : 'text-[#6F6475]'
                    }`}
                  />
                </Link>
              </div>

              {/* Shop by Occasion */}
              <div
                className="relative py-6"
                onMouseEnter={() => handleMouseEnter('occasions')}
              >
                <Link
                  to="/shop"
                  className={`inline-flex items-center gap-1 transition-colors hover:text-[#563568] ${
                    activeDropdown === 'occasions' || location.search.includes('occasion=')
                      ? 'text-[#563568] font-medium'
                      : 'text-[#6F6475]'
                  }`}
                  aria-expanded={activeDropdown === 'occasions'}
                  aria-haspopup="true"
                >
                  <span>Shop by Occasion</span>
                  <ChevronDown
                    size={13}
                    className={`transition-transform duration-200 ${
                      activeDropdown === 'occasions' ? 'rotate-180 text-[#563568]' : 'text-[#6F6475]'
                    }`}
                  />
                </Link>
              </div>

              {/* Gifts */}
              <div
                className="relative py-6"
                onMouseEnter={() => handleMouseEnter('gifts')}
              >
                <Link
                  to="/shop?occasion=gifting"
                  className={`inline-flex items-center gap-1 transition-colors hover:text-[#563568] ${
                    activeDropdown === 'gifts' || location.search.includes('gifting')
                      ? 'text-[#563568] font-medium'
                      : 'text-[#6F6475]'
                  }`}
                  aria-expanded={activeDropdown === 'gifts'}
                  aria-haspopup="true"
                >
                  <span>Gifts</span>
                  <ChevronDown
                    size={13}
                    className={`transition-transform duration-200 ${
                      activeDropdown === 'gifts' ? 'rotate-180 text-[#563568]' : 'text-[#6F6475]'
                    }`}
                  />
                </Link>
              </div>

              {/* Collections */}
              <div
                className="relative py-6"
                onMouseEnter={() => handleMouseEnter('collections')}
              >
                <Link
                  to="/shop"
                  className={`inline-flex items-center gap-1 transition-colors hover:text-[#563568] ${
                    activeDropdown === 'collections'
                      ? 'text-[#563568] font-medium'
                      : 'text-[#6F6475]'
                  }`}
                  aria-expanded={activeDropdown === 'collections'}
                  aria-haspopup="true"
                >
                  <span>Collections</span>
                  <ChevronDown
                    size={13}
                    className={`transition-transform duration-200 ${
                      activeDropdown === 'collections' ? 'rotate-180 text-[#563568]' : 'text-[#6F6475]'
                    }`}
                  />
                </Link>
              </div>

              {/* About SARINE */}
              <div
                className="relative py-6"
                onMouseEnter={() => handleMouseEnter('about')}
              >
                <Link
                  to="/about"
                  className={`inline-flex items-center gap-1 transition-colors hover:text-[#563568] ${
                    activeDropdown === 'about' || location.pathname === '/about'
                      ? 'text-[#563568] font-medium'
                      : 'text-[#6F6475]'
                  }`}
                  aria-expanded={activeDropdown === 'about'}
                  aria-haspopup="true"
                >
                  <span>About SARINE</span>
                  <ChevronDown
                    size={13}
                    className={`transition-transform duration-200 ${
                      activeDropdown === 'about' ? 'rotate-180 text-[#563568]' : 'text-[#6F6475]'
                    }`}
                  />
                </Link>
              </div>
            </nav>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center space-x-2.5 sm:space-x-4">
            {/* Quick Search Button / Search Pill */}
            <button
              onClick={() => setIsSearchOpen(true)}
              className="flex items-center bg-[#F7F0FA] hover:bg-[#F0E6F4] border border-[#E7DCEB] hover:border-[#B69ACF] rounded-full px-3 py-1.5 w-32 sm:w-48 lg:w-56 text-xs text-[#6F6475] transition-all cursor-pointer"
              aria-label="Open search modal"
            >
              <Search size={14} className="text-[#563568] shrink-0 mr-2" />
              <span className="truncate">Search jewellery...</span>
            </button>

            {/* Customer Account & Orders Dropdown */}
            <div
              className="relative"
              onMouseEnter={handleAccountMouseEnter}
              onMouseLeave={handleAccountMouseLeave}
            >
              <Link
                to="/account"
                className="text-[#302438] hover:text-[#563568] transition-colors p-1.5 rounded-full hover:bg-[#F7F0FA] flex items-center gap-1.5 cursor-pointer"
                aria-label="Customer Account & Orders"
                title="Customer Account & Orders"
              >
                <User size={19} strokeWidth={1.5} />
              </Link>

              {/* Account & Orders Dropdown Menu */}
              <div
                className={`absolute right-0 top-full mt-2 w-64 bg-white border border-[#E7DCEB] shadow-xl py-2 z-50 transition-all duration-200 rounded-xs ${
                  isAccountMenuOpen
                    ? 'opacity-100 translate-y-0 visible pointer-events-auto'
                    : 'opacity-0 -translate-y-1 invisible pointer-events-none'
                }`}
                onMouseEnter={() => {
                  if (accountTimerRef.current) {
                    clearTimeout(accountTimerRef.current);
                    accountTimerRef.current = null;
                  }
                }}
                onMouseLeave={handleAccountMouseLeave}
              >
                <div className="px-4 py-2 border-b border-[#E7DCEB]">
                  <p className="text-[10px] uppercase tracking-wider text-[#563568] font-semibold">
                    Customer Account & Orders
                  </p>
                  <p className="text-[11px] text-[#6F6475] mt-0.5">
                    Track shipments & manage account
                  </p>
                </div>

                <div className="py-1 text-xs">
                  {/* Shifted Track Order */}
                  <Link
                    to="/track-order"
                    onClick={() => setIsAccountMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-[#302438] hover:bg-[#F7F0FA] hover:text-[#563568] transition-colors group"
                  >
                    <Truck size={15} className="text-[#563568] shrink-0" />
                    <div>
                      <span className="font-medium block text-xs group-hover:text-[#563568]">Track My Order</span>
                      <span className="text-[10px] text-[#6F6475]">Check live delivery status</span>
                    </div>
                  </Link>

                  {/* Customer Account & Sign In */}
                  <Link
                    to="/account"
                    onClick={() => setIsAccountMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-[#302438] hover:bg-[#F7F0FA] hover:text-[#563568] transition-colors group"
                  >
                    <User size={15} className="text-[#563568] shrink-0" />
                    <div>
                      <span className="font-medium block text-xs group-hover:text-[#563568]">My Account & Orders</span>
                      <span className="text-[10px] text-[#6F6475]">Sign in & order history</span>
                    </div>
                  </Link>

                  {/* Saved Wishlist */}
                  <button
                    onClick={() => {
                      setIsAccountMenuOpen(false);
                      openWishlist();
                    }}
                    className="flex items-center gap-3 px-4 py-2.5 text-[#302438] hover:bg-[#F7F0FA] hover:text-[#563568] transition-colors w-full text-left cursor-pointer group"
                  >
                    <Heart size={15} className="text-[#563568] shrink-0" />
                    <div>
                      <span className="font-medium block text-xs group-hover:text-[#563568]">Saved Wishlist</span>
                      <span className="text-[10px] text-[#6F6475]">{wishlistCount} saved pieces</span>
                    </div>
                  </button>
                </div>
              </div>
            </div>

            {/* Wishlist Heart Icon with Count Badge */}
            <button
              onClick={openWishlist}
              className="relative text-[#302438] hover:text-[#563568] transition-colors p-1.5 rounded-full hover:bg-[#F7F0FA] cursor-pointer"
              aria-label={`Wishlist with ${wishlistCount} saved pieces`}
              title="View Wishlist"
            >
              <Heart size={19} strokeWidth={1.5} />
              {wishlistCount > 0 && (
                <span className="absolute 0 top-0.5 right-0.5 w-4 h-4 bg-[#B69ACF] text-[#302438] text-[10px] font-sans font-semibold rounded-full flex items-center justify-center">
                  {wishlistCount}
                </span>
              )}
            </button>

            {/* Shopping Bag with badge */}
            <button
              onClick={openDrawer}
              className="relative text-[#302438] hover:text-[#563568] transition-colors p-1.5 rounded-full hover:bg-[#F7F0FA] cursor-pointer flex items-center"
              aria-label={`Shopping Bag with ${itemCount} items`}
              title="Shopping Bag"
            >
              <ShoppingBag size={20} strokeWidth={1.5} />
              <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-[#563568] text-white text-[10px] font-sans font-medium rounded-full flex items-center justify-center">
                {itemCount}
              </span>
            </button>

            {/* Mobile Menu Hamburger Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-1.5 text-[#302438] hover:text-[#563568] transition-colors lg:hidden cursor-pointer rounded-sm"
              aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            >
              {isMobileMenuOpen ? (
                <X size={22} strokeWidth={1.5} />
              ) : (
                <Menu size={22} strokeWidth={1.5} />
              )}
            </button>
          </div>
        </div>

        {/* 3. Desktop Dropdown Panels Container */}
        {/* Absolute full width container directly below header */}
        <div
          className={`hidden lg:block absolute top-full left-0 w-full bg-white border-t border-[#E7DCEB] border-b border-[#E7DCEB] shadow-lg transition-all duration-200 ease-out z-50 ${
            activeDropdown
              ? 'opacity-100 translate-y-0 visible pointer-events-auto'
              : 'opacity-0 -translate-y-1 invisible pointer-events-none'
          }`}
          onMouseEnter={() => {
            if (closeTimerRef.current) {
              clearTimeout(closeTimerRef.current);
              closeTimerRef.current = null;
            }
          }}
          onMouseLeave={handleMouseLeave}
        >
          {/* Top accent line */}
          <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-[#D9B8A0]/60 to-transparent" />

          {/* Dropdown 1: New Arrivals */}
          {activeDropdown === 'new-arrivals' && (
            <div className="site-container py-7">
              <div className="grid grid-cols-12 gap-8 items-start">
                <div className="col-span-8 grid grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-xs uppercase tracking-wider text-[#563568] font-semibold mb-3">
                      Latest Additions
                    </h3>
                    <ul className="space-y-2.5 text-[13px]">
                      <li>
                        <Link
                          to="/shop?sort=newest"
                          className="text-[#302438] hover:text-[#563568] transition-colors flex items-center justify-between group"
                        >
                          <span>Just Dropped This Week</span>
                          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 bg-[#F7F0FA] text-[#563568] rounded-xs font-medium">
                            New
                          </span>
                        </Link>
                      </li>
                      <li>
                        <Link
                          to="/shop?sort=newest&occasion=everyday"
                          className="text-[#6F6475] hover:text-[#563568] transition-colors block"
                        >
                          Everyday Minimalist Silhouettes
                        </Link>
                      </li>
                      <li>
                        <Link
                          to="/shop?sort=newest&occasion=festive"
                          className="text-[#6F6475] hover:text-[#563568] transition-colors block"
                        >
                          Festive Heritage Accents
                        </Link>
                      </li>
                      <li>
                        <Link
                          to="/shop?sort=newest"
                          className="text-[#6F6475] hover:text-[#563568] transition-colors block"
                        >
                          Demi-Fine 18K Polish Additions
                        </Link>
                      </li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-xs uppercase tracking-wider text-[#563568] font-semibold mb-3">
                      Trending New Styles
                    </h3>
                    <ul className="space-y-2.5 text-[13px]">
                      <li>
                        <Link
                          to="/shop?category=earrings&sort=newest"
                          className="text-[#6F6475] hover:text-[#563568] transition-colors block"
                        >
                          Sui Dhaga & Drop Earrings
                        </Link>
                      </li>
                      <li>
                        <Link
                          to="/shop?category=necklaces&sort=newest"
                          className="text-[#6F6475] hover:text-[#563568] transition-colors block"
                        >
                          Layered Coin & Choker Chains
                        </Link>
                      </li>
                      <li>
                        <Link
                          to="/shop?category=bracelets&sort=newest"
                          className="text-[#6F6475] hover:text-[#563568] transition-colors block"
                        >
                          Adjustable Demi-Fine Cuffs
                        </Link>
                      </li>
                      <li>
                        <Link
                          to="/shop?category=rings&sort=newest"
                          className="text-[#6F6475] hover:text-[#563568] transition-colors block"
                        >
                          Stackable Solitaire Bands
                        </Link>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Visual Feature Card */}
                <div className="col-span-4 bg-[#F7F0FA] border border-[#E7DCEB] p-4 flex gap-4 items-center">
                  <img
                    src="https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=400&q=80"
                    alt="New arrival jewellery piece"
                    className="w-24 h-24 object-cover shrink-0"
                  />
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-[#563568] font-semibold block mb-1">
                      Autumn Atelier Drop
                    </span>
                    <h4 className="font-serif text-sm text-[#302438] mb-1 leading-snug">
                      Temple Coin & Heritage Motifs
                    </h4>
                    <p className="text-[11px] text-[#6F6475] mb-2 line-clamp-2">
                      Handcrafted demi-fine finishes with hypoallergenic protection.
                    </p>
                    <Link
                      to="/shop?sort=newest"
                      className="text-xs text-[#563568] hover:text-[#80609A] font-medium inline-flex items-center gap-1 group"
                    >
                      <span>Explore all arrivals</span>
                      <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Dropdown 2: Bestsellers */}
          {activeDropdown === 'bestsellers' && (
            <div className="site-container py-7">
              <div className="grid grid-cols-12 gap-8 items-start">
                <div className="col-span-8 grid grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-xs uppercase tracking-wider text-[#563568] font-semibold mb-3">
                      Customer Favourites
                    </h3>
                    <ul className="space-y-2.5 text-[13px]">
                      <li>
                        <Link
                          to="/shop?sort=bestseller"
                          className="text-[#302438] hover:text-[#563568] transition-colors flex items-center justify-between"
                        >
                          <span>Most-Loved Pieces (Over 5,000+ Patrons)</span>
                          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 bg-[#D9B8A0]/25 text-[#563568] rounded-xs font-medium">
                            Iconic
                          </span>
                        </Link>
                      </li>
                      <li>
                        <Link
                          to="/shop?category=earrings&sort=bestseller"
                          className="text-[#6F6475] hover:text-[#563568] transition-colors block"
                        >
                          Temple Coin & Kundan Chandbalis
                        </Link>
                      </li>
                      <li>
                        <Link
                          to="/shop?category=necklaces&sort=bestseller"
                          className="text-[#6F6475] hover:text-[#563568] transition-colors block"
                        >
                          Meera Royal Polki Choker Set
                        </Link>
                      </li>
                      <li>
                        <Link
                          to="/shop?category=bracelets&sort=bestseller"
                          className="text-[#6F6475] hover:text-[#563568] transition-colors block"
                        >
                          Zoya Open-Cuff Leaf Bangle
                        </Link>
                      </li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-xs uppercase tracking-wider text-[#563568] font-semibold mb-3">
                      Best-Rated Categories
                    </h3>
                    <ul className="space-y-2.5 text-[13px]">
                      <li>
                        <Link
                          to="/shop?category=rings&sort=bestseller"
                          className="text-[#6F6475] hover:text-[#563568] transition-colors block"
                        >
                          Ananya Navratna Heritage Rings
                        </Link>
                      </li>
                      <li>
                        <Link
                          to="/shop?type=anklet"
                          className="text-[#6F6475] hover:text-[#563568] transition-colors block"
                        >
                          Payal & Ghungroo Silver Anklets
                        </Link>
                      </li>
                      <li>
                        <Link
                          to="/shop?type=set"
                          className="text-[#6F6475] hover:text-[#563568] transition-colors block"
                        >
                          Complete Festive & Bridal Sets
                        </Link>
                      </li>
                      <li>
                        <Link
                          to="/shop?sort=bestseller&price=under-999"
                          className="text-[#6F6475] hover:text-[#563568] transition-colors block"
                        >
                          Bestsellers Under ₹999
                        </Link>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Bestseller Visual Card */}
                <div className="col-span-4 bg-[#F7F0FA] border border-[#E7DCEB] p-4 flex gap-4 items-center">
                  <img
                    src="https://images.unsplash.com/photo-1635767798638-3e25273a8236?auto=format&fit=crop&w=400&q=80"
                    alt="Bestselling earrings"
                    className="w-24 h-24 object-cover shrink-0"
                  />
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-[#563568] font-semibold block mb-1">
                      Highest Rated
                    </span>
                    <h4 className="font-serif text-sm text-[#302438] mb-1 leading-snug">
                      Chandbali & Jhumka Heritage
                    </h4>
                    <p className="text-[11px] text-[#6F6475] mb-2 line-clamp-2">
                      Micro-pearl accents with genuine 18K gold micron plating.
                    </p>
                    <Link
                      to="/shop?sort=bestseller"
                      className="text-xs text-[#563568] hover:text-[#80609A] font-medium inline-flex items-center gap-1 group"
                    >
                      <span>Shop bestsellers</span>
                      <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Dropdown 3: Shop by Category (Mega-Menu) */}
          {activeDropdown === 'categories' && (
            <div className="site-container py-7">
              <div className="grid grid-cols-12 gap-7">
                {/* Col 1: Earrings */}
                <div className="col-span-2">
                  <Link
                    to="/shop?category=earrings"
                    className="text-xs uppercase tracking-wider text-[#563568] font-semibold mb-3 block hover:text-[#80609A]"
                  >
                    Earrings
                  </Link>
                  <ul className="space-y-2 text-[13px] text-[#6F6475]">
                    <li>
                      <Link to="/shop?category=earrings" className="hover:text-[#563568] transition-colors">
                        All Earrings
                      </Link>
                    </li>
                    <li>
                      <Link to="/shop?category=earrings" className="hover:text-[#563568] transition-colors">
                        Jhumkas & Chandbalis
                      </Link>
                    </li>
                    <li>
                      <Link to="/shop?category=earrings" className="hover:text-[#563568] transition-colors">
                        Studs & Daily Tops
                      </Link>
                    </li>
                    <li>
                      <Link to="/shop?category=earrings" className="hover:text-[#563568] transition-colors">
                        Drop & Dangler Earrings
                      </Link>
                    </li>
                    <li>
                      <Link to="/shop?category=earrings" className="hover:text-[#563568] transition-colors">
                        Modern Hoops & Huggies
                      </Link>
                    </li>
                    <li>
                      <Link to="/shop?category=earrings" className="hover:text-[#563568] transition-colors">
                        Sui Dhaga Threaders
                      </Link>
                    </li>
                  </ul>
                </div>

                {/* Col 2: Necklaces */}
                <div className="col-span-2">
                  <Link
                    to="/shop?category=necklaces"
                    className="text-xs uppercase tracking-wider text-[#563568] font-semibold mb-3 block hover:text-[#80609A]"
                  >
                    Necklaces & Chokers
                  </Link>
                  <ul className="space-y-2 text-[13px] text-[#6F6475]">
                    <li>
                      <Link to="/shop?category=necklaces" className="hover:text-[#563568] transition-colors">
                        All Necklaces
                      </Link>
                    </li>
                    <li>
                      <Link to="/shop?category=necklaces" className="hover:text-[#563568] transition-colors">
                        Royal Chokers
                      </Link>
                    </li>
                    <li>
                      <Link to="/shop?category=necklaces" className="hover:text-[#563568] transition-colors">
                        Layered Gold Chains
                      </Link>
                    </li>
                    <li>
                      <Link to="/shop?category=necklaces" className="hover:text-[#563568] transition-colors">
                        Pendants & Lockets
                      </Link>
                    </li>
                    <li>
                      <Link to="/shop?category=necklaces" className="hover:text-[#563568] transition-colors">
                        Mangalsutra & Tanmaniya
                      </Link>
                    </li>
                    <li>
                      <Link to="/shop?type=set" className="hover:text-[#563568] transition-colors">
                        Bridal Necklace Sets
                      </Link>
                    </li>
                  </ul>
                </div>

                {/* Col 3: Bracelets & Bangles */}
                <div className="col-span-2">
                  <Link
                    to="/shop?category=bracelets"
                    className="text-xs uppercase tracking-wider text-[#563568] font-semibold mb-3 block hover:text-[#80609A]"
                  >
                    Bracelets & Cuffs
                  </Link>
                  <ul className="space-y-2 text-[13px] text-[#6F6475]">
                    <li>
                      <Link to="/shop?category=bracelets" className="hover:text-[#563568] transition-colors">
                        All Bracelets & Cuffs
                      </Link>
                    </li>
                    <li>
                      <Link to="/shop?category=bracelets" className="hover:text-[#563568] transition-colors">
                        Open-Cuff Bangles
                      </Link>
                    </li>
                    <li>
                      <Link to="/shop?category=bracelets" className="hover:text-[#563568] transition-colors">
                        Temple Coin Kadas
                      </Link>
                    </li>
                    <li>
                      <Link to="/shop?category=bracelets" className="hover:text-[#563568] transition-colors">
                        Minimal Charm Chains
                      </Link>
                    </li>
                    <li>
                      <Link to="/shop?category=bracelets" className="hover:text-[#563568] transition-colors">
                        Festive Bridal Bangles
                      </Link>
                    </li>
                  </ul>
                </div>

                {/* Col 4: Rings & Anklets */}
                <div className="col-span-2">
                  <Link
                    to="/shop?category=rings"
                    className="text-xs uppercase tracking-wider text-[#563568] font-semibold mb-3 block hover:text-[#80609A]"
                  >
                    Rings & Ornaments
                  </Link>
                  <ul className="space-y-2 text-[13px] text-[#6F6475]">
                    <li>
                      <Link to="/shop?category=rings" className="hover:text-[#563568] transition-colors">
                        All Rings & Bands
                      </Link>
                    </li>
                    <li>
                      <Link to="/shop?category=rings" className="hover:text-[#563568] transition-colors">
                        Solitaire & Cocktail Rings
                      </Link>
                    </li>
                    <li>
                      <Link to="/shop?category=rings" className="hover:text-[#563568] transition-colors">
                        Adjustable Daily Bands
                      </Link>
                    </li>
                    <li>
                      <Link to="/shop?type=anklet" className="hover:text-[#563568] transition-colors">
                        Traditional Payal & Anklets
                      </Link>
                    </li>
                    <li>
                      <Link to="/shop?type=set" className="hover:text-[#563568] transition-colors">
                        Coordinated Jewellery Sets
                      </Link>
                    </li>
                  </ul>
                </div>

                {/* Col 5: Featured Category Showcase */}
                <div className="col-span-4 bg-[#F7F0FA] border border-[#E7DCEB] p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles size={13} className="text-[#D9B8A0]" />
                      <span className="text-[10px] uppercase tracking-wider text-[#563568] font-semibold">
                        SARINE Demi-Fine Promise
                      </span>
                    </div>
                    <h4 className="font-serif text-base text-[#302438] mb-1">
                      18K Gold Polish & Sterling Silver
                    </h4>
                    <p className="text-xs text-[#6F6475] leading-relaxed mb-4">
                      Each SARINE piece is coated with high-micron plating and protective sealant
                      for anti-tarnish durability and hypoallergenic comfort.
                    </p>
                  </div>

                  <div className="pt-3 border-t border-[#E7DCEB] flex items-center justify-between">
                    <Link
                      to="/shop"
                      className="text-xs text-[#563568] hover:text-[#80609A] font-medium inline-flex items-center gap-1 group"
                    >
                      <span>Browse full catalogue</span>
                      <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                    <span className="text-[11px] text-[#6F6475]">
                      Free shipping across India
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Dropdown 4: Shop by Occasion */}
          {activeDropdown === 'occasions' && (
            <div className="site-container py-7">
              <div className="grid grid-cols-5 gap-5">
                <Link
                  to="/shop?occasion=everyday"
                  className="p-4 border border-[#E7DCEB] bg-[#F7F0FA]/50 hover:bg-[#F7F0FA] hover:border-[#B69ACF] transition-all group"
                >
                  <span className="text-[10px] uppercase tracking-wider text-[#563568] font-semibold block mb-1">
                    Daily Comfort
                  </span>
                  <h4 className="font-serif text-sm text-[#302438] group-hover:text-[#563568] transition-colors mb-1.5">
                    Everyday Wear
                  </h4>
                  <p className="text-xs text-[#6F6475] leading-relaxed">
                    Understated chains, lightweight hoops and featherlight studs for seamless day-to-day luxury.
                  </p>
                </Link>

                <Link
                  to="/shop?occasion=everyday"
                  className="p-4 border border-[#E7DCEB] bg-[#F7F0FA]/50 hover:bg-[#F7F0FA] hover:border-[#B69ACF] transition-all group"
                >
                  <span className="text-[10px] uppercase tracking-wider text-[#563568] font-semibold block mb-1">
                    Professional
                  </span>
                  <h4 className="font-serif text-sm text-[#302438] group-hover:text-[#563568] transition-colors mb-1.5">
                    Office & Workwear
                  </h4>
                  <p className="text-xs text-[#6F6475] leading-relaxed">
                    Sleek geometric bands, minimal pendant accents, and quiet sophistication for boardroom presence.
                  </p>
                </Link>

                <Link
                  to="/shop?occasion=festive"
                  className="p-4 border border-[#E7DCEB] bg-[#F7F0FA]/50 hover:bg-[#F7F0FA] hover:border-[#B69ACF] transition-all group"
                >
                  <span className="text-[10px] uppercase tracking-wider text-[#563568] font-semibold block mb-1">
                    Celebratory
                  </span>
                  <h4 className="font-serif text-sm text-[#302438] group-hover:text-[#563568] transition-colors mb-1.5">
                    Festive & Party Wear
                  </h4>
                  <p className="text-xs text-[#6F6475] leading-relaxed">
                    Radiant Kundan motifs, meenakari embellishments and statement earrings for Diwali, Eid & pujas.
                  </p>
                </Link>

                <Link
                  to="/shop?occasion=wedding"
                  className="p-4 border border-[#E7DCEB] bg-[#F7F0FA]/50 hover:bg-[#F7F0FA] hover:border-[#B69ACF] transition-all group"
                >
                  <span className="text-[10px] uppercase tracking-wider text-[#563568] font-semibold block mb-1">
                    Heirloom
                  </span>
                  <h4 className="font-serif text-sm text-[#302438] group-hover:text-[#563568] transition-colors mb-1.5">
                    Regal Wedding
                  </h4>
                  <p className="text-xs text-[#6F6475] leading-relaxed">
                    Opulent bridal chokers, ornate maang tikka sets, and temple coin bangles crafted for memorable vows.
                  </p>
                </Link>

                <Link
                  to="/shop?occasion=gifting"
                  className="p-4 border border-[#E7DCEB] bg-[#F7F0FA]/50 hover:bg-[#F7F0FA] hover:border-[#B69ACF] transition-all group"
                >
                  <span className="text-[10px] uppercase tracking-wider text-[#563568] font-semibold block mb-1">
                    Keepsake
                  </span>
                  <h4 className="font-serif text-sm text-[#302438] group-hover:text-[#563568] transition-colors mb-1.5">
                    Gifting Edition
                  </h4>
                  <p className="text-xs text-[#6F6475] leading-relaxed">
                    Presented in signature SARINE velvet box with handwritten gift card and certificate of authenticity.
                  </p>
                </Link>
              </div>
            </div>
          )}

          {/* Dropdown 5: Gifts */}
          {activeDropdown === 'gifts' && (
            <div className="site-container py-7">
              <div className="grid grid-cols-12 gap-8 items-start">
                <div className="col-span-8 grid grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-xs uppercase tracking-wider text-[#563568] font-semibold mb-3">
                      Gift by Budget
                    </h3>
                    <ul className="space-y-2.5 text-[13px]">
                      <li>
                        <Link
                          to="/shop?price=under-999"
                          className="text-[#302438] hover:text-[#563568] transition-colors flex items-center justify-between"
                        >
                          <span>Gifts Under ₹999</span>
                          <span className="text-[11px] text-[#6F6475]">Pocket-Friendly</span>
                        </Link>
                      </li>
                      <li>
                        <Link
                          to="/shop?price=1000-2000"
                          className="text-[#302438] hover:text-[#563568] transition-colors flex items-center justify-between"
                        >
                          <span>Gifts Between ₹1,000 – ₹1,999</span>
                          <span className="text-[11px] text-[#6F6475]">Popular Choice</span>
                        </Link>
                      </li>
                      <li>
                        <Link
                          to="/shop?price=above-2000"
                          className="text-[#302438] hover:text-[#563568] transition-colors flex items-center justify-between"
                        >
                          <span>Luxury Gifts Above ₹2,000</span>
                          <span className="text-[11px] text-[#6F6475]">Statement Sets</span>
                        </Link>
                      </li>
                      <li>
                        <Link
                          to="/shop?occasion=gifting"
                          className="text-[#6F6475] hover:text-[#563568] transition-colors block"
                        >
                          All Curated Gifts
                        </Link>
                      </li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-xs uppercase tracking-wider text-[#563568] font-semibold mb-3">
                      Gift by Recipient
                    </h3>
                    <ul className="space-y-2.5 text-[13px]">
                      <li>
                        <Link
                          to="/shop?occasion=gifting"
                          className="text-[#6F6475] hover:text-[#563568] transition-colors block"
                        >
                          Gifts for Her (Sister, Mother, Partner)
                        </Link>
                      </li>
                      <li>
                        <Link
                          to="/shop?occasion=wedding"
                          className="text-[#6F6475] hover:text-[#563568] transition-colors block"
                        >
                          Anniversary & Milestone Celebrations
                        </Link>
                      </li>
                      <li>
                        <Link
                          to="/shop?occasion=festive"
                          className="text-[#6F6475] hover:text-[#563568] transition-colors block"
                        >
                          Birthday Surprises & Tokens of Love
                        </Link>
                      </li>
                      <li>
                        <Link
                          to="/shop?type=set"
                          className="text-[#6F6475] hover:text-[#563568] transition-colors block"
                        >
                          Bridesmaid Keepsake Sets
                        </Link>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Complimentary Gifting Highlight */}
                <div className="col-span-4 bg-[#F7F0FA] border border-[#E7DCEB] p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Gift size={16} className="text-[#563568]" />
                    <span className="text-xs uppercase tracking-wider text-[#563568] font-semibold">
                      Complimentary Luxury Gifting
                    </span>
                  </div>
                  <p className="text-xs text-[#6F6475] leading-relaxed mb-4">
                    Every SARINE piece arrives in our plum velvet presentation case, complete with
                    satin pull ribbons, personalized gift greeting card, and care booklet.
                  </p>
                  <Link
                    to="/shop?occasion=gifting"
                    className="text-xs text-[#563568] hover:text-[#80609A] font-medium inline-flex items-center gap-1 group"
                  >
                    <span>Shop gift collection</span>
                    <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Dropdown 6: Collections */}
          {activeDropdown === 'collections' && (
            <div className="site-container py-7">
              <div className="grid grid-cols-12 gap-8 items-start">
                <div className="col-span-8 grid grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-xs uppercase tracking-wider text-[#563568] font-semibold mb-3">
                      Atelier Signature Lines
                    </h3>
                    <ul className="space-y-2.5 text-[13px]">
                      <li>
                        <Link
                          to="/shop?category=bracelets"
                          className="text-[#302438] hover:text-[#563568] transition-colors block"
                        >
                          <span className="font-medium block">The Temple Coin Edit</span>
                          <span className="text-[11px] text-[#6F6475]">Sacred auspicious motifs in warm antique finish</span>
                        </Link>
                      </li>
                      <li>
                        <Link
                          to="/shop?category=necklaces"
                          className="text-[#302438] hover:text-[#563568] transition-colors block"
                        >
                          <span className="font-medium block">Royal Kundan & Polki Collection</span>
                          <span className="text-[11px] text-[#6F6475]">Faceted glass stones & hand-enamelled meenakari</span>
                        </Link>
                      </li>
                      <li>
                        <Link
                          to="/shop?category=earrings"
                          className="text-[#302438] hover:text-[#563568] transition-colors block"
                        >
                          <span className="font-medium block">Floral Filigree Line</span>
                          <span className="text-[11px] text-[#6F6475]">Intricate openwork petals & freshwater pearl drops</span>
                        </Link>
                      </li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-xs uppercase tracking-wider text-[#563568] font-semibold mb-3">
                      Modern Aesthetics
                    </h3>
                    <ul className="space-y-2.5 text-[13px]">
                      <li>
                        <Link
                          to="/shop?category=rings"
                          className="text-[#302438] hover:text-[#563568] transition-colors block"
                        >
                          <span className="font-medium block">Rose Gold Minimalist</span>
                          <span className="text-[11px] text-[#6F6475]">Subtle blushing hues for contemporary stylings</span>
                        </Link>
                      </li>
                      <li>
                        <Link
                          to="/shop?category=necklaces"
                          className="text-[#302438] hover:text-[#563568] transition-colors block"
                        >
                          <span className="font-medium block">Sterling Silver Classics</span>
                          <span className="text-[11px] text-[#6F6475]">Pure 92.5 sterling motifs with rhodium polish</span>
                        </Link>
                      </li>
                      <li>
                        <Link
                          to="/shop?type=set"
                          className="text-[#302438] hover:text-[#563568] transition-colors block"
                        >
                          <span className="font-medium block">Bridal Troussier Sets</span>
                          <span className="text-[11px] text-[#6F6475]">Curated pairings for the discerning bride</span>
                        </Link>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Collections Visual Card */}
                <div className="col-span-4 bg-[#F7F0FA] border border-[#E7DCEB] p-4 flex gap-4 items-center">
                  <img
                    src="https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=400&q=80"
                    alt="Atelier jewellery collection"
                    className="w-24 h-24 object-cover shrink-0"
                  />
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-[#563568] font-semibold block mb-1">
                      Curated Series
                    </span>
                    <h4 className="font-serif text-sm text-[#302438] mb-1 leading-snug">
                      The Heritage Coin Series
                    </h4>
                    <p className="text-[11px] text-[#6F6475] mb-2 line-clamp-2">
                      Centuries of Indian metalsmithing heritage reimagined for modern wardrobes.
                    </p>
                    <Link
                      to="/shop"
                      className="text-xs text-[#563568] hover:text-[#80609A] font-medium inline-flex items-center gap-1 group"
                    >
                      <span>Explore all collections</span>
                      <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Dropdown 7: About SARINE */}
          {activeDropdown === 'about' && (
            <div className="site-container py-7">
              <div className="grid grid-cols-12 gap-8 items-start">
                <div className="col-span-8 grid grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-xs uppercase tracking-wider text-[#563568] font-semibold mb-3">
                      Brand Philosophy
                    </h3>
                    <ul className="space-y-3 text-[13px]">
                      <li>
                        <Link to="/about" className="block group">
                          <span className="font-medium text-[#302438] group-hover:text-[#563568] transition-colors">
                            Our Story & Heritage
                          </span>
                          <span className="text-[11px] text-[#6F6475] block mt-0.5">
                            Crafting conscious demi-fine jewellery rooted in Indian artisanal legacy.
                          </span>
                        </Link>
                      </li>
                      <li>
                        <Link to="/about" className="block group">
                          <span className="font-medium text-[#302438] group-hover:text-[#563568] transition-colors">
                            Atelier Craftsmanship
                          </span>
                          <span className="text-[11px] text-[#6F6475] block mt-0.5">
                            Ethical metals, 18K micro-plating, and meticulous stone setting.
                          </span>
                        </Link>
                      </li>
                      <li>
                        <Link to="/sustainability" className="block group">
                          <span className="font-medium text-[#302438] group-hover:text-[#563568] transition-colors">
                            Sustainability & Sourcing
                          </span>
                          <span className="text-[11px] text-[#6F6475] block mt-0.5">
                            Zero-plastic packaging, conflict-free stones, and fair artisan wages.
                          </span>
                        </Link>
                      </li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-xs uppercase tracking-wider text-[#563568] font-semibold mb-3">
                      Customer Concierge
                    </h3>
                    <ul className="space-y-3 text-[13px]">
                      <li>
                        <Link to="/track-order" className="block group">
                          <span className="font-medium text-[#302438] group-hover:text-[#563568] transition-colors">
                            Track Your Order
                          </span>
                          <span className="text-[11px] text-[#6F6475] block mt-0.5">
                            Real-time order lookup and courier dispatch updates.
                          </span>
                        </Link>
                      </li>
                      <li>
                        <Link to="/contact" className="block group">
                          <span className="font-medium text-[#302438] group-hover:text-[#563568] transition-colors">
                            Styling Help & Concierge
                          </span>
                          <span className="text-[11px] text-[#6F6475] block mt-0.5">
                            Direct support via WhatsApp, email or phone with jewellery advisors.
                          </span>
                        </Link>
                      </li>
                      <li>
                        <Link to="/shipping-policy" className="block group">
                          <span className="font-medium text-[#302438] group-hover:text-[#563568] transition-colors">
                            Shipping & Easy Returns
                          </span>
                          <span className="text-[11px] text-[#6F6475] block mt-0.5">
                            Complimentary doorstep delivery & tamper-evident insured transit.
                          </span>
                        </Link>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Assurance Card */}
                <div className="col-span-4 bg-[#F7F0FA] border border-[#E7DCEB] p-5">
                  <span className="text-xs uppercase tracking-wider text-[#563568] font-semibold block mb-2">
                    The SARINE Assurance
                  </span>
                  <div className="space-y-2.5 text-xs text-[#6F6475] mb-4">
                    <div className="flex items-center gap-2">
                      <ShieldCheck size={14} className="text-[#563568] shrink-0" />
                      <span>Certified 18K Demi-Fine Gold Polish</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Truck size={14} className="text-[#563568] shrink-0" />
                      <span>Complimentary Express Shipping Across India</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Gem size={14} className="text-[#563568] shrink-0" />
                      <span>Hypoallergenic & Anti-Tarnish Guaranteed</span>
                    </div>
                  </div>
                  <Link
                    to="/about"
                    className="text-xs text-[#563568] hover:text-[#80609A] font-medium inline-flex items-center gap-1 group"
                  >
                    <span>Read our full story</span>
                    <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 4. Mobile Navigation Drawer & Backdrop */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-[#302438]/50 backdrop-blur-xs transition-opacity"
              onClick={() => setIsMobileMenuOpen(false)}
              aria-hidden="true"
            />

            {/* Slide-out Menu Panel */}
            <div className="relative w-[85%] max-w-sm bg-white h-full shadow-2xl flex flex-col z-10 overflow-hidden">
              {/* Drawer Header */}
              <div className="h-16 border-b border-[#E7DCEB] px-5 flex items-center justify-between shrink-0 bg-white">
                <Link
                  to="/"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="font-serif text-xl tracking-[0.2em] text-[#563568] font-normal uppercase"
                >
                  SARINE
                </Link>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2 text-[#302438] hover:text-[#563568] transition-colors cursor-pointer"
                  aria-label="Close menu"
                >
                  <X size={20} strokeWidth={1.5} />
                </button>
              </div>

              {/* Drawer Body (Scrollable) */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                {/* Mobile Search Button */}
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setIsSearchOpen(true);
                  }}
                  className="flex items-center bg-[#F7F0FA] border border-[#E7DCEB] rounded-full px-3.5 py-2.5 w-full text-xs text-[#6F6475] cursor-pointer"
                >
                  <Search size={14} className="text-[#563568] shrink-0 mr-2.5" />
                  <span>Search earrings, chokers, bangles...</span>
                </button>

                {/* Direct Highlights */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Link
                    to="/shop?sort=newest"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-2.5 bg-[#F7F0FA] border border-[#E7DCEB] hover:border-[#B69ACF] flex items-center justify-between transition-colors"
                  >
                    <span className="text-xs font-medium text-[#302438]">New Arrivals</span>
                    <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 bg-[#563568] text-white rounded-xs">
                      New
                    </span>
                  </Link>

                  <Link
                    to="/shop?sort=bestseller"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-2.5 bg-[#F7F0FA] border border-[#E7DCEB] hover:border-[#B69ACF] flex items-center justify-between transition-colors"
                  >
                    <span className="text-xs font-medium text-[#302438]">Bestsellers</span>
                    <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 bg-[#D9B8A0]/30 text-[#563568] rounded-xs font-medium">
                      Hot
                    </span>
                  </Link>
                </div>

                {/* Accordion Nav Sections */}
                <div className="space-y-1 divide-y divide-[#E7DCEB]/60 text-sm font-sans pt-2">
                  {/* Accordion 1: Shop by Category */}
                  <div className="pt-2">
                    <button
                      onClick={() => toggleMobileAccordion('categories')}
                      className="w-full flex items-center justify-between py-2.5 text-[#302438] hover:text-[#563568] font-medium text-left cursor-pointer"
                    >
                      <span>Shop by Category</span>
                      <ChevronDown
                        size={16}
                        className={`transition-transform duration-200 text-[#6F6475] ${
                          mobileExpanded.categories ? 'rotate-180 text-[#563568]' : ''
                        }`}
                      />
                    </button>
                    {mobileExpanded.categories && (
                      <div className="pl-3 pb-3 space-y-2 text-xs text-[#6F6475] border-l-2 border-[#B69ACF]/40 ml-1 mt-1">
                        <Link
                          to="/shop"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="block py-1 hover:text-[#563568] font-medium text-[#563568]"
                        >
                          All Jewellery Catalogue
                        </Link>
                        <Link
                          to="/shop?category=earrings"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="block py-1 hover:text-[#563568]"
                        >
                          Earrings & Chandbalis
                        </Link>
                        <Link
                          to="/shop?category=necklaces"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="block py-1 hover:text-[#563568]"
                        >
                          Chokers & Necklaces
                        </Link>
                        <Link
                          to="/shop?category=bracelets"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="block py-1 hover:text-[#563568]"
                        >
                          Bracelets, Bangles & Cuffs
                        </Link>
                        <Link
                          to="/shop?category=rings"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="block py-1 hover:text-[#563568]"
                        >
                          Rings & Bands
                        </Link>
                        <Link
                          to="/shop?type=anklet"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="block py-1 hover:text-[#563568]"
                        >
                          Traditional Anklets & Payal
                        </Link>
                        <Link
                          to="/shop?type=set"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="block py-1 hover:text-[#563568]"
                        >
                          Coordinated Jewellery Sets
                        </Link>
                      </div>
                    )}
                  </div>

                  {/* Accordion 2: Shop by Occasion */}
                  <div className="pt-2">
                    <button
                      onClick={() => toggleMobileAccordion('occasions')}
                      className="w-full flex items-center justify-between py-2.5 text-[#302438] hover:text-[#563568] font-medium text-left cursor-pointer"
                    >
                      <span>Shop by Occasion</span>
                      <ChevronDown
                        size={16}
                        className={`transition-transform duration-200 text-[#6F6475] ${
                          mobileExpanded.occasions ? 'rotate-180 text-[#563568]' : ''
                        }`}
                      />
                    </button>
                    {mobileExpanded.occasions && (
                      <div className="pl-3 pb-3 space-y-2 text-xs text-[#6F6475] border-l-2 border-[#B69ACF]/40 ml-1 mt-1">
                        <Link
                          to="/shop?occasion=everyday"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="block py-1 hover:text-[#563568]"
                        >
                          Everyday Wear & Minimalist
                        </Link>
                        <Link
                          to="/shop?occasion=everyday"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="block py-1 hover:text-[#563568]"
                        >
                          Office & Professional Workwear
                        </Link>
                        <Link
                          to="/shop?occasion=festive"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="block py-1 hover:text-[#563568]"
                        >
                          Festive & Party Wear
                        </Link>
                        <Link
                          to="/shop?occasion=wedding"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="block py-1 hover:text-[#563568]"
                        >
                          Regal Wedding & Bridal
                        </Link>
                        <Link
                          to="/shop?occasion=gifting"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="block py-1 hover:text-[#563568]"
                        >
                          Gifting Edition
                        </Link>
                      </div>
                    )}
                  </div>

                  {/* Accordion 3: Gifts */}
                  <div className="pt-2">
                    <button
                      onClick={() => toggleMobileAccordion('gifts')}
                      className="w-full flex items-center justify-between py-2.5 text-[#302438] hover:text-[#563568] font-medium text-left cursor-pointer"
                    >
                      <span>Gifts</span>
                      <ChevronDown
                        size={16}
                        className={`transition-transform duration-200 text-[#6F6475] ${
                          mobileExpanded.gifts ? 'rotate-180 text-[#563568]' : ''
                        }`}
                      />
                    </button>
                    {mobileExpanded.gifts && (
                      <div className="pl-3 pb-3 space-y-2 text-xs text-[#6F6475] border-l-2 border-[#B69ACF]/40 ml-1 mt-1">
                        <Link
                          to="/shop?price=under-999"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="block py-1 hover:text-[#563568]"
                        >
                          Gifts Under ₹999
                        </Link>
                        <Link
                          to="/shop?price=1000-2000"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="block py-1 hover:text-[#563568]"
                        >
                          Gifts ₹1,000 – ₹1,999
                        </Link>
                        <Link
                          to="/shop?price=above-2000"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="block py-1 hover:text-[#563568]"
                        >
                          Luxury Gifts Above ₹2,000
                        </Link>
                        <Link
                          to="/shop?occasion=gifting"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="block py-1 hover:text-[#563568]"
                        >
                          Gifts for Her & Milestones
                        </Link>
                      </div>
                    )}
                  </div>

                  {/* Accordion 4: Collections */}
                  <div className="pt-2">
                    <button
                      onClick={() => toggleMobileAccordion('collections')}
                      className="w-full flex items-center justify-between py-2.5 text-[#302438] hover:text-[#563568] font-medium text-left cursor-pointer"
                    >
                      <span>Collections</span>
                      <ChevronDown
                        size={16}
                        className={`transition-transform duration-200 text-[#6F6475] ${
                          mobileExpanded.collections ? 'rotate-180 text-[#563568]' : ''
                        }`}
                      />
                    </button>
                    {mobileExpanded.collections && (
                      <div className="pl-3 pb-3 space-y-2 text-xs text-[#6F6475] border-l-2 border-[#B69ACF]/40 ml-1 mt-1">
                        <Link
                          to="/shop?category=bracelets"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="block py-1 hover:text-[#563568]"
                        >
                          The Temple Coin Series
                        </Link>
                        <Link
                          to="/shop?category=necklaces"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="block py-1 hover:text-[#563568]"
                        >
                          Royal Kundan & Polki
                        </Link>
                        <Link
                          to="/shop?category=earrings"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="block py-1 hover:text-[#563568]"
                        >
                          Floral Filigree & Demi-Fine
                        </Link>
                        <Link
                          to="/shop?category=rings"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="block py-1 hover:text-[#563568]"
                        >
                          Rose Gold Minimalist
                        </Link>
                      </div>
                    )}
                  </div>

                  {/* Accordion 5: About SARINE */}
                  <div className="pt-2">
                    <button
                      onClick={() => toggleMobileAccordion('about')}
                      className="w-full flex items-center justify-between py-2.5 text-[#302438] hover:text-[#563568] font-medium text-left cursor-pointer"
                    >
                      <span>About SARINE</span>
                      <ChevronDown
                        size={16}
                        className={`transition-transform duration-200 text-[#6F6475] ${
                          mobileExpanded.about ? 'rotate-180 text-[#563568]' : ''
                        }`}
                      />
                    </button>
                    {mobileExpanded.about && (
                      <div className="pl-3 pb-3 space-y-2 text-xs text-[#6F6475] border-l-2 border-[#B69ACF]/40 ml-1 mt-1">
                        <Link
                          to="/about"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="block py-1 hover:text-[#563568]"
                        >
                          Our Story & Atelier Legacy
                        </Link>
                        <Link
                          to="/contact"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="block py-1 hover:text-[#563568]"
                        >
                          Customer Concierge & Styling Help
                        </Link>
                        <Link
                          to="/sustainability"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="block py-1 hover:text-[#563568]"
                        >
                          Sustainability & Ethical Sourcing
                        </Link>
                        <Link
                          to="/shipping-policy"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="block py-1 hover:text-[#563568]"
                        >
                          Shipping & Return Policy
                        </Link>
                      </div>
                    )}
                  </div>
                </div>

                {/* Account & Utilities Section */}
                <div className="pt-4 border-t border-[#E7DCEB] space-y-2.5">
                  <Link
                    to="/track-order"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center gap-2.5 text-xs text-[#302438] hover:text-[#563568] py-1 font-medium"
                  >
                    <Truck size={15} className="text-[#563568]" />
                    <span>Track Your Order</span>
                  </Link>
                  <Link
                    to="/account"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center gap-2.5 text-xs text-[#302438] hover:text-[#563568] py-1 font-medium"
                  >
                    <User size={15} className="text-[#563568]" />
                    <span>My Account & Orders</span>
                  </Link>
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      openWishlist();
                    }}
                    className="flex items-center justify-between w-full text-xs text-[#302438] hover:text-[#563568] py-1 font-medium cursor-pointer"
                  >
                    <span className="flex items-center gap-2.5">
                      <Heart size={15} className="text-[#563568]" />
                      <span>My Wishlist</span>
                    </span>
                    {wishlistCount > 0 && (
                      <span className="text-[10px] px-2 py-0.5 bg-[#B69ACF] text-[#302438] font-bold rounded-full">
                        {wishlistCount}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      openDrawer();
                    }}
                    className="flex items-center justify-between w-full text-xs text-[#302438] hover:text-[#563568] py-1 font-medium cursor-pointer"
                  >
                    <span className="flex items-center gap-2.5">
                      <ShoppingBag size={15} className="text-[#563568]" />
                      <span>Shopping Bag</span>
                    </span>
                    <span className="text-[10px] px-2 py-0.5 bg-[#563568] text-white font-medium rounded-full">
                      {itemCount}
                    </span>
                  </button>
                </div>

                {/* Concierge Touchpoint */}
                <div className="pt-4 border-t border-[#E7DCEB]">
                  <Link
                    to="/contact"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block p-3 bg-[#F7F0FA] border border-[#E7DCEB] hover:border-[#B69ACF] transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Phone size={13} className="text-[#563568]" />
                      <span className="text-[11px] font-semibold text-[#563568] uppercase tracking-wider">
                        Jewellery Concierge
                      </span>
                    </div>
                    <p className="text-[11px] text-[#6F6475]">
                      Speak with an atelier advisor for bespoke sizes or gift styling.
                    </p>
                  </Link>
                </div>

                {/* Dev seed / includeAll toggle for testing in DEV */}
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
            </div>
          </div>
        )}
      </header>

      {/* Global Search Overlay */}
      <SearchOverlay isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />

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
