/**
 * Navbar component for SARINE.
 * Luxury e-commerce navigation header inspired by high-end jewellery brands (such as GIVA)
 * with SARINE's signature Lavender & Plum palette, zero-pill discipline, smooth hover
 * dropdown interaction with 200ms grace period, comprehensive mega-menus, keyboard accessibility,
 * and an accordion-driven mobile slide-over drawer with body scroll lock.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
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
  Award,
  HelpCircle,
  SlidersHorizontal
} from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { SearchOverlay } from './SearchOverlay';
import { hostingerStorefrontService } from '../services/hostinger/hostingerStorefrontService';
import { DEFAULT_SITE_CHROME, siteChromeService } from '../services/hostinger/siteChromeService';

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
  const navigate = useNavigate();
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
  const [activeAnnouncement, setActiveAnnouncement] = useState(0);
  const [managedAnnouncement, setManagedAnnouncement] = useState('');
  const [managedTrustMessages, setManagedTrustMessages] = useState<string[]>([]);
  const [headerTagline, setHeaderTagline] = useState(DEFAULT_SITE_CHROME.header.tagline);

  // Mobile Accordion state
  const [mobileExpanded, setMobileExpanded] = useState<Record<string, boolean>>({
    categories: true,
    occasions: false,
    gifts: false,
    collections: false,
    about: false
  });

  // Load the published header tagline independently from announcement content.
  useEffect(() => {
    let cancelled = false;
    siteChromeService.getPublic().then(({ settings }) => {
      if (!cancelled) setHeaderTagline(settings.header.tagline);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  // Load the currently published announcement managed in Storefront Studio.
  useEffect(() => {
    let cancelled = false;
    hostingerStorefrontService.getPublicAnnouncement()
      .then(({ announcement }) => {
        if (!cancelled && announcement?.active && announcement.message?.trim()) {
          setManagedAnnouncement(announcement.message.trim());
          setManagedTrustMessages((announcement.trustMessages || []).filter(Boolean));
        } else if (!cancelled) {
          setManagedAnnouncement('');
          setManagedTrustMessages((announcement.trustMessages || []).filter(Boolean));
        }
      })
      .catch((error) => console.warn('[Navbar] Published announcement unavailable; using default messages.', error));
    return () => { cancelled = true; };
  }, []);

  // Rotate the fallback messages only when no managed announcement is published.
  useEffect(() => {
    if (managedAnnouncement) return;
    const timer = setInterval(() => {
      setActiveAnnouncement((prev) => (prev + 1) % ANNOUNCEMENT_MESSAGES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [managedAnnouncement]);

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
        className="sarine-global-header sticky top-0 z-40 bg-[var(--white)] border-b border-[var(--white)] shadow-xs"
        onMouseLeave={handleMouseLeave}
      >
        {/* TIER 1: Continuous, admin-managed announcement ticker */}
        <div className="sarine-global-announcement bg-[var(--plum)] text-white text-[11px] sm:text-xs font-sans tracking-wide overflow-hidden">
          <div className="site-container flex items-center min-h-[36px] sm:min-h-[40px] gap-4">
            <div className="flex-1 min-w-0 overflow-hidden" aria-label="Store announcements">
              <div className="sarine-announcement-track flex w-max items-center">
                {[...managedTrustMessages, ...(managedAnnouncement ? [managedAnnouncement] : [])].filter(Boolean).length > 0 ? (
                  [...managedTrustMessages, ...(managedAnnouncement ? [managedAnnouncement] : [])].filter(Boolean).map((item, index) => (
                    <span key={index} className="inline-flex items-center gap-2 px-6 whitespace-nowrap text-[11px] sm:text-xs text-white">
                      <Sparkles size={12} className="text-[#FFFFFF] shrink-0" />
                      {item}
                      <span className="text-[color:var(--gold-light)] ml-4" style={{ "--sarine-announcement-text": "var(--gold-light)" } as React.CSSProperties}>✦</span>
                    </span>
                  ))
                ) : (
                  <span className="inline-flex items-center gap-2 px-6 whitespace-nowrap">
                    <Sparkles size={12} className="text-[#FFFFFF]" />
                    {ANNOUNCEMENT_MESSAGES[activeAnnouncement]}
                  </span>
                )}
                {[...managedTrustMessages, ...(managedAnnouncement ? [managedAnnouncement] : [])].filter(Boolean).length > 0 && (
                  [...managedTrustMessages, ...(managedAnnouncement ? [managedAnnouncement] : [])].filter(Boolean).map((item, index) => (
                    <span key={`repeat-${index}`} className="inline-flex items-center gap-2 px-6 whitespace-nowrap text-[11px] sm:text-xs text-white" aria-hidden="true">
                      <Sparkles size={12} className="text-[#FFFFFF] shrink-0" />
                      {item}
                      <span className="text-[color:var(--gold-light)] ml-4" style={{ "--sarine-announcement-text": "var(--gold-light)" } as React.CSSProperties}>✦</span>
                    </span>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>

        {/* TIER 2: MAIN BRAND HEADER (Warm Pale Ivory/Lavender #FAF5FC) */}
        <div className="bg-[var(--white)]">
          <div className="site-container relative py-3 sm:py-4 flex items-center justify-between gap-2 sm:gap-3 xl:gap-4">
            {/* Left: SARINE Wordmark with Diamond Star Motif & Tagline */}
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="inline-flex min-h-11 min-w-11 items-center justify-center text-[#302438] hover:text-[color:var(--plum)] transition-colors xl:hidden cursor-pointer rounded-xs"
                aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
                aria-expanded={isMobileMenuOpen}
                aria-controls="sarine-mobile-navigation"
              >
                {isMobileMenuOpen ? <X size={22} strokeWidth={1.5} /> : <Menu size={22} strokeWidth={1.5} />}
              </button>

              <Link to="/" className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center group xl:static xl:translate-x-0">
                <span className="font-serif text-[26px] sm:text-[34px] tracking-[0.24em] text-[color:var(--heading)] uppercase font-normal leading-tight group-hover:text-[color:var(--gold)] transition-colors">
                  SARINE
                </span>
                <div className="flex items-center justify-center w-full my-0.5 gap-2 px-1">
                  <div className="h-[1px] flex-1 bg-[var(--white)]" />
                  <svg
                    className="w-2.5 h-2.5 text-[#FFFFFF] shrink-0"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z" />
                  </svg>
                  <div className="h-[1px] flex-1 bg-[var(--white)]" />
                </div>
                <span className="text-[8px] sm:text-[9px] tracking-[0.32em] text-[color:var(--body)] uppercase font-sans font-medium whitespace-nowrap">
                  {headerTagline || 'LUXURY ARTIFICIAL JEWELLERY'}
                </span>
              </Link>
            </div>

            {/* Centre: Wide Rounded Search Bar (Desktop) */}
            <div className="hidden xl:flex min-w-0 flex-1 max-w-xl mx-3 xl:mx-5">
              <div
                onClick={() => setIsSearchOpen(true)}
                className="w-full flex items-center bg-white border border-[#FFFFFF] hover:border-[var(--plum)] rounded-full px-4 py-2 cursor-pointer shadow-2xs transition-all group"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setIsSearchOpen(true);
                  }
                }}
                aria-label="Search for jewellery, collections, or more..."
              >
                <Search size={16} className="text-[color:var(--plum)] shrink-0 mr-3" strokeWidth={1.75} />
                <span className="block min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] text-[color:var(--body)] italic tracking-wide select-none">
                  Search for jewellery, collections, or more...
                </span>
                <span className="w-[1px] h-4 bg-[var(--border)] mx-2.5 shrink-0" />
                <span
                  title="Search Filters"
                  className="p-1 text-[color:var(--plum)] hover:text-[color:var(--gold)] transition-colors"
                >
                  <SlidersHorizontal size={15} strokeWidth={1.75} />
                </span>
              </div>
            </div>

            {/* Right: Account, Wishlist, Bag */}
            <div className="flex items-center space-x-1.5 sm:space-x-3">
              {/* Mobile Quick Search Button */}
              <button
                onClick={() => setIsSearchOpen(true)}
                className="hidden xl:inline-flex min-h-11 min-w-11 items-center justify-center p-2 text-[#302438] hover:text-[color:var(--plum)] transition-colors cursor-pointer rounded-full hover:bg-[var(--white)]"
                aria-label="Open search"
              >
                <Search size={20} strokeWidth={1.5} />
              </button>

              {/* Customer Account & Orders Dropdown */}
              <div
                className="relative"
                onMouseEnter={handleAccountMouseEnter}
                onMouseLeave={handleAccountMouseLeave}
              >
                <Link
                  to="/account"
                  className="hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 text-[#302438] hover:text-[color:var(--plum)] transition-colors cursor-pointer group"
                  aria-label="My Account"
                  title="My Account"
                >
                  <User size={19} strokeWidth={1.5} className="text-[color:var(--plum)] shrink-0" />
                  <span className="text-[13px] font-medium text-[#302438] group-hover:text-[color:var(--plum)]">
                    My Account
                  </span>
                  <ChevronDown
                    size={13}
                    className={`text-[color:var(--plum)] transition-transform duration-200 ${
                      isAccountMenuOpen ? 'rotate-180' : ''
                    }`}
                  />
                </Link>

                {/* Mobile Account Icon Only */}
                <Link
                  to="/account"
                  className="inline-flex xl:hidden min-h-11 min-w-11 items-center justify-center p-2 text-[#302438] hover:text-[color:var(--plum)] transition-colors rounded-full hover:bg-[var(--white)]"
                  aria-label="My Account"
                >
                  <User size={19} strokeWidth={1.5} className="text-[color:var(--plum)]" />
                </Link>

                {/* Account & Orders Dropdown Menu */}
                <div
                  className={`absolute right-0 top-full mt-1.5 w-68 bg-white border border-[var(--border)] shadow-xl py-2 z-50 transition-all duration-200 rounded-xs ${
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
                  <div className="px-4 py-2 border-b border-[var(--border)]">
                    <p className="text-[10px] uppercase tracking-wider text-[color:var(--plum)] font-semibold">
                      Customer Account & Orders
                    </p>
                    <p className="text-[11px] text-[color:var(--body)] mt-0.5">
                      Track shipments & manage account
                    </p>
                  </div>

                  <div className="py-1 text-xs">
                    {/* Track Order */}
                    <Link
                      to="/track-order"
                      onClick={() => setIsAccountMenuOpen(false)}
                      className="min-h-[44px] flex items-center gap-3 px-4 py-2 text-[#302438] hover:bg-[var(--tint)] hover:text-[color:var(--plum)] transition-colors group"
                    >
                      <Truck size={15} className="text-[color:var(--plum)] shrink-0" />
                      <div>
                        <span className="font-medium block text-xs group-hover:text-[color:var(--plum)]">Track My Order</span>
                        <span className="text-[10px] text-[color:var(--body)]">Check live delivery status</span>
                      </div>
                    </Link>

                    {/* Saved Wishlist */}
                    <button
                      onClick={() => {
                        setIsAccountMenuOpen(false);
                        openWishlist();
                      }}
                      className="min-h-[44px] flex items-center gap-3 px-4 py-2 text-[#302438] hover:bg-[var(--tint)] hover:text-[color:var(--plum)] transition-colors w-full text-left cursor-pointer group"
                    >
                      <Heart size={15} className="text-[color:var(--plum)] shrink-0" />
                      <div className="flex-1 flex items-center justify-between">
                        <div>
                          <span className="font-medium block text-xs group-hover:text-[color:var(--plum)]">Saved Wishlist</span>
                          <span className="text-[10px] text-[color:var(--body)]">All your favourite pieces</span>
                        </div>
                        {wishlistCount > 0 && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-[var(--rose)] text-white" style={{ color: "var(--white)" }}>
                            {wishlistCount}
                          </span>
                        )}
                      </div>
                    </button>

                    {/* Concierge & Support */}
                    <div className="border-t border-[var(--border)] mt-1 pt-1">
                      <Link
                        to="/contact"
                        onClick={() => setIsAccountMenuOpen(false)}
                        className="min-h-[44px] flex items-center gap-3 px-4 py-2 text-[#302438] hover:bg-[var(--tint)] hover:text-[color:var(--plum)] transition-colors group"
                      >
                        <HelpCircle size={15} className="text-[color:var(--plum)] shrink-0" />
                        <div>
                          <span className="font-medium block text-xs group-hover:text-[color:var(--plum)]">Help & Support</span>
                          <span className="text-[10px] text-[color:var(--body)]">Help, inquiries & FAQs</span>
                        </div>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>

              {/* Subtle divider */}
              <span className="w-[1px] h-5 bg-[var(--border)] hidden xl:block" />

              {/* Wishlist Button with Label & Numeric Badge */}
              <button
                onClick={openWishlist}
                className="relative inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 px-2.5 py-1.5 text-[#302438] hover:text-[color:var(--plum)] transition-colors cursor-pointer group rounded-xs hover:bg-[var(--white)]"
                aria-label={`Wishlist with ${wishlistCount} saved pieces`}
                title="View Wishlist"
              >
                <div className="relative">
                  <Heart size={20} strokeWidth={1.5} className="text-[color:var(--plum)]" />
                  <span className="absolute -top-2 -right-2 min-w-4 h-4 px-1 bg-[var(--rose)] text-white text-[10px] font-sans font-medium rounded-full flex items-center justify-center" style={{ color: "var(--white)" }}>
                    {wishlistCount}
                  </span>
                </div>
                <span className="text-[13px] font-medium text-[#302438] group-hover:text-[color:var(--plum)] hidden xl:inline">
                  Wishlist
                </span>
              </button>

              {/* Subtle divider */}
              <span className="w-[1px] h-5 bg-[var(--border)] hidden xl:block" />

              {/* Bag Button with Label & Numeric Badge */}
              <button
                onClick={openDrawer}
                className="relative inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 px-2.5 py-1.5 text-[#302438] hover:text-[color:var(--plum)] transition-colors cursor-pointer group rounded-xs hover:bg-[var(--white)]"
                aria-label={`Shopping Bag with ${itemCount} items`}
                title="Shopping Bag"
              >
                <div className="relative">
                  <ShoppingBag size={20} strokeWidth={1.5} className="text-[color:var(--plum)]" />
                  <span className="absolute -top-2 -right-2 min-w-4 h-4 px-1 bg-[var(--rose)] text-white text-[10px] font-sans font-medium rounded-full flex items-center justify-center" style={{ color: "var(--white)" }}>
                    {itemCount}
                  </span>
                </div>
                <span className="text-[13px] font-medium text-[#302438] group-hover:text-[color:var(--plum)] hidden xl:inline">
                  Bag
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile search row: full-width, readable and separate from the brand controls */}
        <div className="xl:hidden border-t border-[var(--border)]/60 bg-[var(--white)] px-4 py-2">
          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            className="flex min-h-11 w-full items-center gap-3 border border-[var(--border)] bg-white px-3.5 text-left text-sm text-[color:var(--body)] shadow-2xs transition-colors hover:border-[var(--plum)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--plum)]"
            aria-label="Search jewellery, collections, or more"
          >
            <Search size={18} className="shrink-0 text-[color:var(--plum)]" strokeWidth={1.75} />
            <span className="min-w-0 flex-1 truncate">Search jewellery, collections, or more...</span>
            <SlidersHorizontal size={16} className="shrink-0 text-[color:var(--plum)]" />
          </button>
        </div>

        {/* TIER 3: SECONDARY NAVIGATION BAR (Pale Ivory/Lavender #FAF5FC with Delicate Champagne Gold Borders) */}
        <nav
          className="hidden xl:block bg-[var(--white)] border-t border-[var(--white)] border-b border-[var(--white)]"
          aria-label="Main Category Navigation"
        >
          <div className="site-container flex items-center justify-center space-x-6 xl:space-x-8 text-[13px] font-sans">
            {/* 1. Home */}
            <div className="py-3.5">
              <Link
                to="/"
                className={`relative inline-flex items-center pb-1 transition-colors hover:text-[color:var(--plum)] ${
                  location.pathname === '/' && !location.search
                    ? 'text-[color:var(--plum)] font-medium border-b-2 border-[#FFFFFF]'
                    : 'text-[#302438]'
                }`}
              >
                <span>Home</span>
              </Link>
            </div>

            {/* 2. New Arrivals */}
            <div
              className="relative py-3.5"
              onMouseEnter={() => handleMouseEnter('new-arrivals')}
            >
              <Link
                to="/shop?sort=newest"
                className={`inline-flex items-center gap-1 transition-colors hover:text-[color:var(--plum)] ${
                  activeDropdown === 'new-arrivals' || location.search.includes('sort=newest')
                    ? 'text-[color:var(--plum)] font-medium'
                    : 'text-[#302438]'
                }`}
                aria-expanded={activeDropdown === 'new-arrivals'}
                aria-haspopup="true"
              >
                <span>New Arrivals</span>
                <ChevronDown
                  size={12}
                  className={`transition-transform duration-200 text-[color:var(--plum)] ${
                    activeDropdown === 'new-arrivals' ? 'rotate-180' : ''
                  }`}
                />
              </Link>
            </div>

            {/* 3. Bestsellers */}
            <div
              className="relative py-3.5"
              onMouseEnter={() => handleMouseEnter('bestsellers')}
            >
              <Link
                to="/shop?sort=bestseller"
                className={`inline-flex items-center gap-1 transition-colors hover:text-[color:var(--plum)] ${
                  activeDropdown === 'bestsellers' || location.search.includes('sort=bestseller')
                    ? 'text-[color:var(--plum)] font-medium'
                    : 'text-[#302438]'
                }`}
                aria-expanded={activeDropdown === 'bestsellers'}
                aria-haspopup="true"
              >
                <span>Bestsellers</span>
                <ChevronDown
                  size={12}
                  className={`transition-transform duration-200 text-[color:var(--plum)] ${
                    activeDropdown === 'bestsellers' ? 'rotate-180' : ''
                  }`}
                />
              </Link>
            </div>

            {/* 4. Shop by Category */}
            <div
              className="relative py-3.5"
              onMouseEnter={() => handleMouseEnter('categories')}
            >
              <Link
                to="/shop"
                className={`inline-flex items-center gap-1 transition-colors hover:text-[color:var(--plum)] ${
                  activeDropdown === 'categories' || location.pathname === '/shop'
                    ? 'text-[color:var(--plum)] font-medium'
                    : 'text-[#302438]'
                }`}
                aria-expanded={activeDropdown === 'categories'}
                aria-haspopup="true"
              >
                <span>Shop by Category</span>
                <ChevronDown
                  size={12}
                  className={`transition-transform duration-200 text-[color:var(--plum)] ${
                    activeDropdown === 'categories' ? 'rotate-180' : ''
                  }`}
                />
              </Link>
            </div>

            {/* 5. Shop by Occasion */}
            <div
              className="relative py-3.5"
              onMouseEnter={() => handleMouseEnter('occasions')}
            >
              <Link
                to="/shop"
                className={`inline-flex items-center gap-1 transition-colors hover:text-[color:var(--plum)] ${
                  activeDropdown === 'occasions' || location.search.includes('occasion=')
                    ? 'text-[color:var(--plum)] font-medium'
                    : 'text-[#302438]'
                }`}
                aria-expanded={activeDropdown === 'occasions'}
                aria-haspopup="true"
              >
                <span>Shop by Occasion</span>
                <ChevronDown
                  size={12}
                  className={`transition-transform duration-200 text-[color:var(--plum)] ${
                    activeDropdown === 'occasions' ? 'rotate-180' : ''
                  }`}
                />
              </Link>
            </div>

            {/* 6. Gifts */}
            <div
              className="relative py-3.5"
              onMouseEnter={() => handleMouseEnter('gifts')}
            >
              <Link
                to="/shop?occasion=gifting"
                className={`inline-flex items-center gap-1 transition-colors hover:text-[color:var(--plum)] ${
                  activeDropdown === 'gifts' || location.search.includes('gifting')
                    ? 'text-[color:var(--plum)] font-medium'
                    : 'text-[#302438]'
                }`}
                aria-expanded={activeDropdown === 'gifts'}
                aria-haspopup="true"
              >
                <span>Gifts</span>
              </Link>
            </div>

            {/* 7. Collections */}
            <div
              className="relative py-3.5"
              onMouseEnter={() => handleMouseEnter('collections')}
            >
              <Link
                to="/shop"
                className={`inline-flex items-center gap-1 transition-colors hover:text-[color:var(--plum)] ${
                  activeDropdown === 'collections'
                    ? 'text-[color:var(--plum)] font-medium'
                    : 'text-[#302438]'
                }`}
                aria-expanded={activeDropdown === 'collections'}
                aria-haspopup="true"
              >
                <span>Collections</span>
              </Link>
            </div>

            {/* 8. About SARINE */}
            <div
              className="relative py-3.5"
              onMouseEnter={() => handleMouseEnter('about')}
            >
              <Link
                to="/about"
                className={`inline-flex items-center gap-1 transition-colors hover:text-[color:var(--plum)] ${
                  activeDropdown === 'about' || location.pathname === '/about'
                    ? 'text-[color:var(--plum)] font-medium'
                    : 'text-[#302438]'
                }`}
                aria-expanded={activeDropdown === 'about'}
                aria-haspopup="true"
              >
                <span>About SARINE</span>
              </Link>
            </div>
          </div>
        </nav>

        {/* 3. Desktop Dropdown Panels Container */}
        {/* Absolute full width container directly below header */}
        <div
          className={`hidden xl:block absolute top-full left-0 w-full bg-white border-t border-[var(--border)] border-b border-[var(--border)] shadow-lg transition-all duration-200 ease-out z-50 ${
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
          <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-[var(--white)] to-transparent" />

          {/* Dropdown 1: New Arrivals */}
          {activeDropdown === 'new-arrivals' && (
            <div className="site-container py-7">
              <div className="grid grid-cols-12 gap-8 items-start">
                <div className="col-span-8 grid grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-xs uppercase tracking-wider text-[color:var(--heading)] font-semibold mb-3">
                      Latest Additions
                    </h3>
                    <ul className="space-y-2.5 text-[13px]">
                      <li>
                        <Link
                          to="/shop?sort=newest"
                          className="text-[#302438] hover:text-[color:var(--plum)] transition-colors flex items-center justify-between group"
                        >
                          <span>Just Dropped This Week</span>
                          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 bg-[var(--pill)] text-[color:var(--body)] rounded-xs font-medium">
                            New
                          </span>
                        </Link>
                      </li>
                      <li>
                        <Link
                          to="/shop?sort=newest&occasion=everyday"
                          className="text-[color:var(--body)] hover:text-[color:var(--plum)] transition-colors block"
                        >
                          Everyday Minimalist Silhouettes
                        </Link>
                      </li>
                      <li>
                        <Link
                          to="/shop?sort=newest&occasion=festive"
                          className="text-[color:var(--body)] hover:text-[color:var(--plum)] transition-colors block"
                        >
                          Festive Heritage Accents
                        </Link>
                      </li>
                      <li>
                        <Link
                          to="/shop?sort=newest"
                          className="text-[color:var(--body)] hover:text-[color:var(--plum)] transition-colors block"
                        >
                          Demi-Fine 18K Polish Additions
                        </Link>
                      </li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-xs uppercase tracking-wider text-[color:var(--heading)] font-semibold mb-3">
                      Trending New Styles
                    </h3>
                    <ul className="space-y-2.5 text-[13px]">
                      <li>
                        <Link
                          to="/shop?category=earrings&sort=newest"
                          className="text-[color:var(--body)] hover:text-[color:var(--plum)] transition-colors block"
                        >
                          Sui Dhaga & Drop Earrings
                        </Link>
                      </li>
                      <li>
                        <Link
                          to="/shop?category=necklaces&sort=newest"
                          className="text-[color:var(--body)] hover:text-[color:var(--plum)] transition-colors block"
                        >
                          Layered Coin & Choker Chains
                        </Link>
                      </li>
                      <li>
                        <Link
                          to="/shop?category=bracelets&sort=newest"
                          className="text-[color:var(--body)] hover:text-[color:var(--plum)] transition-colors block"
                        >
                          Adjustable Demi-Fine Cuffs
                        </Link>
                      </li>
                      <li>
                        <Link
                          to="/shop?category=rings&sort=newest"
                          className="text-[color:var(--body)] hover:text-[color:var(--plum)] transition-colors block"
                        >
                          Stackable Solitaire Bands
                        </Link>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Visual Feature Card */}
                <div className="col-span-4 bg-[var(--white)] border border-[var(--border)] p-4 flex gap-4 items-center">
                  <img
                    src="https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=400&q=80"
                    alt="New arrival jewellery piece"
                    className="w-24 h-24 object-cover shrink-0"
                  />
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-[color:var(--plum)] font-semibold block mb-1">
                      Autumn Atelier Drop
                    </span>
                    <h4 className="font-serif text-sm text-[#302438] mb-1 leading-snug">
                      Temple Coin & Heritage Motifs
                    </h4>
                    <p className="text-[11px] text-[color:var(--body)] mb-2 line-clamp-2">
                      Handcrafted demi-fine finishes with hypoallergenic protection.
                    </p>
                    <Link
                      to="/shop?sort=newest"
                      className="text-xs text-[color:var(--plum)] hover:text-[color:var(--gold)] font-medium inline-flex items-center gap-1 group"
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
                    <h3 className="text-xs uppercase tracking-wider text-[color:var(--heading)] font-semibold mb-3">
                      Customer Favourites
                    </h3>
                    <ul className="space-y-2.5 text-[13px]">
                      <li>
                        <Link
                          to="/shop?sort=bestseller"
                          className="text-[#302438] hover:text-[color:var(--plum)] transition-colors flex items-center justify-between"
                        >
                          <span>Most-Loved Pieces (Over 5,000+ Patrons)</span>
                          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 bg-[var(--white)] text-[color:var(--plum)] rounded-xs font-medium">
                            Iconic
                          </span>
                        </Link>
                      </li>
                      <li>
                        <Link
                          to="/shop?category=earrings&sort=bestseller"
                          className="text-[color:var(--body)] hover:text-[color:var(--plum)] transition-colors block"
                        >
                          Temple Coin & Kundan Chandbalis
                        </Link>
                      </li>
                      <li>
                        <Link
                          to="/shop?category=necklaces&sort=bestseller"
                          className="text-[color:var(--body)] hover:text-[color:var(--plum)] transition-colors block"
                        >
                          Meera Royal Polki Choker Set
                        </Link>
                      </li>
                      <li>
                        <Link
                          to="/shop?category=bracelets&sort=bestseller"
                          className="text-[color:var(--body)] hover:text-[color:var(--plum)] transition-colors block"
                        >
                          Zoya Open-Cuff Leaf Bangle
                        </Link>
                      </li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-xs uppercase tracking-wider text-[color:var(--heading)] font-semibold mb-3">
                      Best-Rated Categories
                    </h3>
                    <ul className="space-y-2.5 text-[13px]">
                      <li>
                        <Link
                          to="/shop?category=rings&sort=bestseller"
                          className="text-[color:var(--body)] hover:text-[color:var(--plum)] transition-colors block"
                        >
                          Ananya Navratna Heritage Rings
                        </Link>
                      </li>
                      <li>
                        <Link
                          to="/shop?type=anklet"
                          className="text-[color:var(--body)] hover:text-[color:var(--plum)] transition-colors block"
                        >
                          Payal & Ghungroo Silver Anklets
                        </Link>
                      </li>
                      <li>
                        <Link
                          to="/shop?type=set"
                          className="text-[color:var(--body)] hover:text-[color:var(--plum)] transition-colors block"
                        >
                          Complete Festive & Bridal Sets
                        </Link>
                      </li>
                      <li>
                        <Link
                          to="/shop?sort=bestseller&price=under-999"
                          className="text-[color:var(--body)] hover:text-[color:var(--plum)] transition-colors block"
                        >
                          Bestsellers Under ₹999
                        </Link>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Bestseller Visual Card */}
                <div className="col-span-4 bg-[var(--white)] border border-[var(--border)] p-4 flex gap-4 items-center">
                  <img
                    src="https://images.unsplash.com/photo-1635767798638-3e25273a8236?auto=format&fit=crop&w=400&q=80"
                    alt="Bestselling earrings"
                    className="w-24 h-24 object-cover shrink-0"
                  />
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-[color:var(--plum)] font-semibold block mb-1">
                      Highest Rated
                    </span>
                    <h4 className="font-serif text-sm text-[#302438] mb-1 leading-snug">
                      Chandbali & Jhumka Heritage
                    </h4>
                    <p className="text-[11px] text-[color:var(--body)] mb-2 line-clamp-2">
                      Micro-pearl accents with genuine 18K gold micron plating.
                    </p>
                    <Link
                      to="/shop?sort=bestseller"
                      className="text-xs text-[color:var(--plum)] hover:text-[color:var(--gold)] font-medium inline-flex items-center gap-1 group"
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
                    className="text-xs uppercase tracking-wider text-[color:var(--plum)] font-semibold mb-3 block hover:text-[color:var(--gold)]"
                  >
                    Earrings
                  </Link>
                  <ul className="space-y-2 text-[13px] text-[color:var(--body)]">
                    <li>
                      <Link to="/shop?category=earrings" className="hover:text-[color:var(--plum)] transition-colors">
                        All Earrings
                      </Link>
                    </li>
                    <li>
                      <Link to="/shop?category=earrings" className="hover:text-[color:var(--plum)] transition-colors">
                        Jhumkas & Chandbalis
                      </Link>
                    </li>
                    <li>
                      <Link to="/shop?category=earrings" className="hover:text-[color:var(--plum)] transition-colors">
                        Studs & Daily Tops
                      </Link>
                    </li>
                    <li>
                      <Link to="/shop?category=earrings" className="hover:text-[color:var(--plum)] transition-colors">
                        Drop & Dangler Earrings
                      </Link>
                    </li>
                    <li>
                      <Link to="/shop?category=earrings" className="hover:text-[color:var(--plum)] transition-colors">
                        Modern Hoops & Huggies
                      </Link>
                    </li>
                    <li>
                      <Link to="/shop?category=earrings" className="hover:text-[color:var(--plum)] transition-colors">
                        Sui Dhaga Threaders
                      </Link>
                    </li>
                  </ul>
                </div>

                {/* Col 2: Necklaces */}
                <div className="col-span-2">
                  <Link
                    to="/shop?category=necklaces"
                    className="text-xs uppercase tracking-wider text-[color:var(--plum)] font-semibold mb-3 block hover:text-[color:var(--gold)]"
                  >
                    Necklaces & Chokers
                  </Link>
                  <ul className="space-y-2 text-[13px] text-[color:var(--body)]">
                    <li>
                      <Link to="/shop?category=necklaces" className="hover:text-[color:var(--plum)] transition-colors">
                        All Necklaces
                      </Link>
                    </li>
                    <li>
                      <Link to="/shop?category=necklaces" className="hover:text-[color:var(--plum)] transition-colors">
                        Royal Chokers
                      </Link>
                    </li>
                    <li>
                      <Link to="/shop?category=necklaces" className="hover:text-[color:var(--plum)] transition-colors">
                        Layered Gold Chains
                      </Link>
                    </li>
                    <li>
                      <Link to="/shop?category=necklaces" className="hover:text-[color:var(--plum)] transition-colors">
                        Pendants & Lockets
                      </Link>
                    </li>
                    <li>
                      <Link to="/shop?category=necklaces" className="hover:text-[color:var(--plum)] transition-colors">
                        Mangalsutra & Tanmaniya
                      </Link>
                    </li>
                    <li>
                      <Link to="/shop?type=set" className="hover:text-[color:var(--plum)] transition-colors">
                        Bridal Necklace Sets
                      </Link>
                    </li>
                  </ul>
                </div>

                {/* Col 3: Bracelets & Bangles */}
                <div className="col-span-2">
                  <Link
                    to="/shop?category=bracelets"
                    className="text-xs uppercase tracking-wider text-[color:var(--plum)] font-semibold mb-3 block hover:text-[color:var(--gold)]"
                  >
                    Bracelets & Cuffs
                  </Link>
                  <ul className="space-y-2 text-[13px] text-[color:var(--body)]">
                    <li>
                      <Link to="/shop?category=bracelets" className="hover:text-[color:var(--plum)] transition-colors">
                        All Bracelets & Cuffs
                      </Link>
                    </li>
                    <li>
                      <Link to="/shop?category=bracelets" className="hover:text-[color:var(--plum)] transition-colors">
                        Open-Cuff Bangles
                      </Link>
                    </li>
                    <li>
                      <Link to="/shop?category=bracelets" className="hover:text-[color:var(--plum)] transition-colors">
                        Temple Coin Kadas
                      </Link>
                    </li>
                    <li>
                      <Link to="/shop?category=bracelets" className="hover:text-[color:var(--plum)] transition-colors">
                        Minimal Charm Chains
                      </Link>
                    </li>
                    <li>
                      <Link to="/shop?category=bracelets" className="hover:text-[color:var(--plum)] transition-colors">
                        Festive Bridal Bangles
                      </Link>
                    </li>
                  </ul>
                </div>

                {/* Col 4: Rings & Anklets */}
                <div className="col-span-2">
                  <Link
                    to="/shop?category=rings"
                    className="text-xs uppercase tracking-wider text-[color:var(--plum)] font-semibold mb-3 block hover:text-[color:var(--gold)]"
                  >
                    Rings & Ornaments
                  </Link>
                  <ul className="space-y-2 text-[13px] text-[color:var(--body)]">
                    <li>
                      <Link to="/shop?category=rings" className="hover:text-[color:var(--plum)] transition-colors">
                        All Rings & Bands
                      </Link>
                    </li>
                    <li>
                      <Link to="/shop?category=rings" className="hover:text-[color:var(--plum)] transition-colors">
                        Solitaire & Cocktail Rings
                      </Link>
                    </li>
                    <li>
                      <Link to="/shop?category=rings" className="hover:text-[color:var(--plum)] transition-colors">
                        Adjustable Daily Bands
                      </Link>
                    </li>
                    <li>
                      <Link to="/shop?type=anklet" className="hover:text-[color:var(--plum)] transition-colors">
                        Traditional Payal & Anklets
                      </Link>
                    </li>
                    <li>
                      <Link to="/shop?type=set" className="hover:text-[color:var(--plum)] transition-colors">
                        Coordinated Jewellery Sets
                      </Link>
                    </li>
                  </ul>
                </div>

                {/* Col 5: Featured Category Showcase */}
                <div className="col-span-4 bg-[var(--white)] border border-[var(--border)] p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles size={13} className="text-[#FFFFFF]" />
                      <span className="text-[10px] uppercase tracking-wider text-[color:var(--plum)] font-semibold">
                        SARINE Demi-Fine Promise
                      </span>
                    </div>
                    <h4 className="font-serif text-base text-[#302438] mb-1">
                      18K Gold Polish & Sterling Silver
                    </h4>
                    <p className="text-xs text-[color:var(--body)] leading-relaxed mb-4">
                      Each SARINE piece is coated with high-micron plating and protective sealant
                      for anti-tarnish durability and hypoallergenic comfort.
                    </p>
                  </div>

                  <div className="pt-3 border-t border-[var(--border)] flex items-center justify-between">
                    <Link
                      to="/shop"
                      className="text-xs text-[color:var(--plum)] hover:text-[color:var(--gold)] font-medium inline-flex items-center gap-1 group"
                    >
                      <span>Browse full catalogue</span>
                      <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                    <span className="text-[11px] text-[color:var(--body)]">
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
                  className="p-4 border border-[var(--border)] bg-[var(--tint)] hover:bg-[var(--tint)] hover:border-[var(--gold)] transition-all group"
                >
                  <span className="text-[10px] uppercase tracking-wider text-[color:var(--plum)] font-semibold block mb-1">
                    Daily Comfort
                  </span>
                  <h4 className="font-serif text-sm text-[#302438] group-hover:text-[color:var(--plum)] transition-colors mb-1.5">
                    Everyday Wear
                  </h4>
                  <p className="text-xs text-[color:var(--body)] leading-relaxed">
                    Understated chains, lightweight hoops and featherlight studs for seamless day-to-day luxury.
                  </p>
                </Link>

                <Link
                  to="/shop?occasion=everyday"
                  className="p-4 border border-[var(--border)] bg-[var(--tint)] hover:bg-[var(--tint)] hover:border-[var(--gold)] transition-all group"
                >
                  <span className="text-[10px] uppercase tracking-wider text-[color:var(--plum)] font-semibold block mb-1">
                    Professional
                  </span>
                  <h4 className="font-serif text-sm text-[#302438] group-hover:text-[color:var(--plum)] transition-colors mb-1.5">
                    Office & Workwear
                  </h4>
                  <p className="text-xs text-[color:var(--body)] leading-relaxed">
                    Sleek geometric bands, minimal pendant accents, and quiet sophistication for boardroom presence.
                  </p>
                </Link>

                <Link
                  to="/shop?occasion=festive"
                  className="p-4 border border-[var(--border)] bg-[var(--tint)] hover:bg-[var(--tint)] hover:border-[var(--gold)] transition-all group"
                >
                  <span className="text-[10px] uppercase tracking-wider text-[color:var(--plum)] font-semibold block mb-1">
                    Celebratory
                  </span>
                  <h4 className="font-serif text-sm text-[#302438] group-hover:text-[color:var(--plum)] transition-colors mb-1.5">
                    Festive & Party Wear
                  </h4>
                  <p className="text-xs text-[color:var(--body)] leading-relaxed">
                    Radiant Kundan motifs, meenakari embellishments and statement earrings for Diwali, Eid & pujas.
                  </p>
                </Link>

                <Link
                  to="/shop?occasion=wedding"
                  className="p-4 border border-[var(--border)] bg-[var(--tint)] hover:bg-[var(--tint)] hover:border-[var(--gold)] transition-all group"
                >
                  <span className="text-[10px] uppercase tracking-wider text-[color:var(--plum)] font-semibold block mb-1">
                    Heirloom
                  </span>
                  <h4 className="font-serif text-sm text-[#302438] group-hover:text-[color:var(--plum)] transition-colors mb-1.5">
                    Regal Wedding
                  </h4>
                  <p className="text-xs text-[color:var(--body)] leading-relaxed">
                    Opulent bridal chokers, ornate maang tikka sets, and temple coin bangles crafted for memorable vows.
                  </p>
                </Link>

                <Link
                  to="/shop?occasion=gifting"
                  className="p-4 border border-[var(--border)] bg-[var(--tint)] hover:bg-[var(--tint)] hover:border-[var(--gold)] transition-all group"
                >
                  <span className="text-[10px] uppercase tracking-wider text-[color:var(--plum)] font-semibold block mb-1">
                    Keepsake
                  </span>
                  <h4 className="font-serif text-sm text-[#302438] group-hover:text-[color:var(--plum)] transition-colors mb-1.5">
                    Gifting Edition
                  </h4>
                  <p className="text-xs text-[color:var(--body)] leading-relaxed">
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
                    <h3 className="text-xs uppercase tracking-wider text-[color:var(--heading)] font-semibold mb-3">
                      Gift by Budget
                    </h3>
                    <ul className="space-y-2.5 text-[13px]">
                      <li>
                        <Link
                          to="/shop?price=under-999"
                          className="text-[#302438] hover:text-[color:var(--plum)] transition-colors flex items-center justify-between"
                        >
                          <span>Gifts Under ₹999</span>
                          <span className="text-[11px] text-[color:var(--body)]">Pocket-Friendly</span>
                        </Link>
                      </li>
                      <li>
                        <Link
                          to="/shop?price=1000-2000"
                          className="text-[#302438] hover:text-[color:var(--plum)] transition-colors flex items-center justify-between"
                        >
                          <span>Gifts Between ₹1,000 – ₹1,999</span>
                          <span className="text-[11px] text-[color:var(--body)]">Popular Choice</span>
                        </Link>
                      </li>
                      <li>
                        <Link
                          to="/shop?price=above-2000"
                          className="text-[#302438] hover:text-[color:var(--plum)] transition-colors flex items-center justify-between"
                        >
                          <span>Luxury Gifts Above ₹2,000</span>
                          <span className="text-[11px] text-[color:var(--body)]">Statement Sets</span>
                        </Link>
                      </li>
                      <li>
                        <Link
                          to="/shop?occasion=gifting"
                          className="text-[color:var(--body)] hover:text-[color:var(--plum)] transition-colors block"
                        >
                          All Curated Gifts
                        </Link>
                      </li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-xs uppercase tracking-wider text-[color:var(--heading)] font-semibold mb-3">
                      Gift by Recipient
                    </h3>
                    <ul className="space-y-2.5 text-[13px]">
                      <li>
                        <Link
                          to="/shop?occasion=gifting"
                          className="text-[color:var(--body)] hover:text-[color:var(--plum)] transition-colors block"
                        >
                          Gifts for Her (Sister, Mother, Partner)
                        </Link>
                      </li>
                      <li>
                        <Link
                          to="/shop?occasion=wedding"
                          className="text-[color:var(--body)] hover:text-[color:var(--plum)] transition-colors block"
                        >
                          Anniversary & Milestone Celebrations
                        </Link>
                      </li>
                      <li>
                        <Link
                          to="/shop?occasion=festive"
                          className="text-[color:var(--body)] hover:text-[color:var(--plum)] transition-colors block"
                        >
                          Birthday Surprises & Tokens of Love
                        </Link>
                      </li>
                      <li>
                        <Link
                          to="/shop?type=set"
                          className="text-[color:var(--body)] hover:text-[color:var(--plum)] transition-colors block"
                        >
                          Bridesmaid Keepsake Sets
                        </Link>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Complimentary Gifting Highlight */}
                <div className="col-span-4 bg-[var(--white)] border border-[var(--border)] p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Gift size={16} className="text-[color:var(--plum)]" />
                    <span className="text-xs uppercase tracking-wider text-[color:var(--plum)] font-semibold">
                      Complimentary Luxury Gifting
                    </span>
                  </div>
                  <p className="text-xs text-[color:var(--body)] leading-relaxed mb-4">
                    Every SARINE piece arrives in our plum velvet presentation case, complete with
                    satin pull ribbons, personalized gift greeting card, and care booklet.
                  </p>
                  <Link
                    to="/shop?occasion=gifting"
                    className="text-xs text-[color:var(--plum)] hover:text-[color:var(--gold)] font-medium inline-flex items-center gap-1 group"
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
                    <h3 className="text-xs uppercase tracking-wider text-[color:var(--heading)] font-semibold mb-3">
                      Atelier Signature Lines
                    </h3>
                    <ul className="space-y-2.5 text-[13px]">
                      <li>
                        <Link
                          to="/shop?category=bracelets"
                          className="text-[#302438] hover:text-[color:var(--plum)] transition-colors block"
                        >
                          <span className="font-medium block">The Temple Coin Edit</span>
                          <span className="text-[11px] text-[color:var(--body)]">Sacred auspicious motifs in warm antique finish</span>
                        </Link>
                      </li>
                      <li>
                        <Link
                          to="/shop?category=necklaces"
                          className="text-[#302438] hover:text-[color:var(--plum)] transition-colors block"
                        >
                          <span className="font-medium block">Royal Kundan & Polki Collection</span>
                          <span className="text-[11px] text-[color:var(--body)]">Faceted glass stones & hand-enamelled meenakari</span>
                        </Link>
                      </li>
                      <li>
                        <Link
                          to="/shop?category=earrings"
                          className="text-[#302438] hover:text-[color:var(--plum)] transition-colors block"
                        >
                          <span className="font-medium block">Floral Filigree Line</span>
                          <span className="text-[11px] text-[color:var(--body)]">Intricate openwork petals & freshwater pearl drops</span>
                        </Link>
                      </li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-xs uppercase tracking-wider text-[color:var(--heading)] font-semibold mb-3">
                      Modern Aesthetics
                    </h3>
                    <ul className="space-y-2.5 text-[13px]">
                      <li>
                        <Link
                          to="/shop?category=rings"
                          className="text-[#302438] hover:text-[color:var(--plum)] transition-colors block"
                        >
                          <span className="font-medium block">Rose Gold Minimalist</span>
                          <span className="text-[11px] text-[color:var(--body)]">Subtle blushing hues for contemporary stylings</span>
                        </Link>
                      </li>
                      <li>
                        <Link
                          to="/shop?category=necklaces"
                          className="text-[#302438] hover:text-[color:var(--plum)] transition-colors block"
                        >
                          <span className="font-medium block">Sterling Silver Classics</span>
                          <span className="text-[11px] text-[color:var(--body)]">Pure 92.5 sterling motifs with rhodium polish</span>
                        </Link>
                      </li>
                      <li>
                        <Link
                          to="/shop?type=set"
                          className="text-[#302438] hover:text-[color:var(--plum)] transition-colors block"
                        >
                          <span className="font-medium block">Bridal Troussier Sets</span>
                          <span className="text-[11px] text-[color:var(--body)]">Curated pairings for the discerning bride</span>
                        </Link>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Collections Visual Card */}
                <div className="col-span-4 bg-[var(--white)] border border-[var(--border)] p-4 flex gap-4 items-center">
                  <img
                    src="https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=400&q=80"
                    alt="Atelier jewellery collection"
                    className="w-24 h-24 object-cover shrink-0"
                  />
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-[color:var(--plum)] font-semibold block mb-1">
                      Curated Series
                    </span>
                    <h4 className="font-serif text-sm text-[#302438] mb-1 leading-snug">
                      The Heritage Coin Series
                    </h4>
                    <p className="text-[11px] text-[color:var(--body)] mb-2 line-clamp-2">
                      Centuries of Indian metalsmithing heritage reimagined for modern wardrobes.
                    </p>
                    <Link
                      to="/shop"
                      className="text-xs text-[color:var(--plum)] hover:text-[color:var(--gold)] font-medium inline-flex items-center gap-1 group"
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
                    <h3 className="text-xs uppercase tracking-wider text-[color:var(--heading)] font-semibold mb-3">
                      Brand Philosophy
                    </h3>
                    <ul className="space-y-3 text-[13px]">
                      <li>
                        <Link to="/about" className="block group">
                          <span className="font-medium text-[#302438] group-hover:text-[color:var(--plum)] transition-colors">
                            Our Story & Heritage
                          </span>
                          <span className="text-[11px] text-[color:var(--body)] block mt-0.5">
                            Crafting conscious demi-fine jewellery rooted in Indian artisanal legacy.
                          </span>
                        </Link>
                      </li>
                      <li>
                        <Link to="/about" className="block group">
                          <span className="font-medium text-[#302438] group-hover:text-[color:var(--plum)] transition-colors">
                            Atelier Craftsmanship
                          </span>
                          <span className="text-[11px] text-[color:var(--body)] block mt-0.5">
                            Ethical metals, 18K micro-plating, and meticulous stone setting.
                          </span>
                        </Link>
                      </li>
                      <li>
                        <Link to="/sustainability" className="block group">
                          <span className="font-medium text-[#302438] group-hover:text-[color:var(--plum)] transition-colors">
                            Sustainability & Sourcing
                          </span>
                          <span className="text-[11px] text-[color:var(--body)] block mt-0.5">
                            Zero-plastic packaging, conflict-free stones, and fair artisan wages.
                          </span>
                        </Link>
                      </li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-xs uppercase tracking-wider text-[color:var(--heading)] font-semibold mb-3">
                      Customer Concierge
                    </h3>
                    <ul className="space-y-3 text-[13px]">
                      <li>
                        <Link to="/track-order" className="block group">
                          <span className="font-medium text-[#302438] group-hover:text-[color:var(--plum)] transition-colors">
                            Track Your Order
                          </span>
                          <span className="text-[11px] text-[color:var(--body)] block mt-0.5">
                            Real-time order lookup and courier dispatch updates.
                          </span>
                        </Link>
                      </li>
                      <li>
                        <Link to="/contact" className="block group">
                          <span className="font-medium text-[#302438] group-hover:text-[color:var(--plum)] transition-colors">
                            Styling Help & Concierge
                          </span>
                          <span className="text-[11px] text-[color:var(--body)] block mt-0.5">
                            Direct support via WhatsApp, email or phone with jewellery advisors.
                          </span>
                        </Link>
                      </li>
                      <li>
                        <Link to="/shipping-policy" className="block group">
                          <span className="font-medium text-[#302438] group-hover:text-[color:var(--plum)] transition-colors">
                            Shipping & Easy Returns
                          </span>
                          <span className="text-[11px] text-[color:var(--body)] block mt-0.5">
                            Complimentary doorstep delivery & tamper-evident insured transit.
                          </span>
                        </Link>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Assurance Card */}
                <div className="col-span-4 bg-[var(--white)] border border-[var(--border)] p-5">
                  <span className="text-xs uppercase tracking-wider text-[color:var(--plum)] font-semibold block mb-2">
                    The SARINE Assurance
                  </span>
                  <div className="space-y-2.5 text-xs text-[color:var(--body)] mb-4">
                    <div className="flex items-center gap-2">
                      <ShieldCheck size={14} className="text-[color:var(--plum)] shrink-0" />
                      <span>Certified 18K Demi-Fine Gold Polish</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Truck size={14} className="text-[color:var(--plum)] shrink-0" />
                      <span>Complimentary Express Shipping Across India</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Gem size={14} className="text-[color:var(--plum)] shrink-0" />
                      <span>Hypoallergenic & Anti-Tarnish Guaranteed</span>
                    </div>
                  </div>
                  <Link
                    to="/about"
                    className="text-xs text-[color:var(--plum)] hover:text-[color:var(--gold)] font-medium inline-flex items-center gap-1 group"
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
          <div className="fixed inset-0 z-50 xl:hidden flex">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-[var(--heading)] backdrop-blur-xs transition-opacity"
              onClick={() => setIsMobileMenuOpen(false)}
              aria-hidden="true"
            />

            {/* Slide-out Menu Panel */}
            <div id="sarine-mobile-navigation" role="dialog" aria-modal="true" aria-label="SARINE navigation" className="relative w-[88%] max-w-sm bg-white h-[100dvh] max-h-[100dvh] shadow-2xl flex flex-col z-10 overflow-hidden">
              {/* Drawer Header */}
              <div className="min-h-16 border-b border-[var(--border)] px-5 pt-[env(safe-area-inset-top)] flex items-center justify-between shrink-0 bg-white">
                <Link
                  to="/"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="font-serif text-xl tracking-[0.2em] text-[color:var(--plum)] font-normal uppercase"
                >
                  SARINE
                </Link>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center p-2 text-[#302438] hover:text-[color:var(--plum)] transition-colors cursor-pointer"
                  aria-label="Close menu"
                >
                  <X size={20} strokeWidth={1.5} />
                </button>
              </div>

              {/* Drawer Body (Scrollable) */}
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] space-y-4">
                {/* Mobile Search Button */}
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setIsSearchOpen(true);
                  }}
                  className="flex items-center bg-[var(--white)] border border-[var(--border)] rounded-full px-3.5 py-2.5 w-full text-xs text-[color:var(--body)] cursor-pointer"
                >
                  <Search size={14} className="text-[color:var(--plum)] shrink-0 mr-2.5" />
                  <span>Search earrings, chokers, bangles...</span>
                </button>

                {/* Direct Highlights */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Link
                    to="/shop?sort=newest"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-2.5 bg-[var(--white)] border border-[var(--border)] hover:border-[var(--gold)] flex items-center justify-between transition-colors"
                  >
                    <span className="text-xs font-medium text-[#302438]">New Arrivals</span>
                    <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 bg-[var(--plum)] text-white rounded-xs" style={{ color: "var(--white)" }}>
                      New
                    </span>
                  </Link>

                  <Link
                    to="/shop?sort=bestseller"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-2.5 bg-[var(--white)] border border-[var(--border)] hover:border-[var(--gold)] flex items-center justify-between transition-colors"
                  >
                    <span className="text-xs font-medium text-[#302438]">Bestsellers</span>
                    <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 bg-[var(--white)] text-[color:var(--plum)] rounded-xs font-medium">
                      Hot
                    </span>
                  </Link>
                </div>

                {/* Accordion Nav Sections */}
                <div className="space-y-1 divide-y divide-[var(--border)] text-sm font-sans pt-2">
                  {/* Accordion 1: Shop by Category */}
                  <div className="pt-2">
                    <button
                      type="button"
                      aria-expanded={mobileExpanded.categories}
                      aria-controls="mobile-nav-categories"
                      onClick={() => toggleMobileAccordion('categories')}
                      className="w-full min-h-11 flex items-center justify-between py-2.5 text-[#302438] hover:text-[color:var(--plum)] font-medium text-left cursor-pointer"
                    >
                      <span>Shop by Category</span>
                      <ChevronDown
                        size={16}
                        className={`transition-transform duration-200 text-[color:var(--body)] ${
                          mobileExpanded.categories ? 'rotate-180 text-[color:var(--plum)]' : ''
                        }`}
                      />
                    </button>
                    {mobileExpanded.categories && (
                      <div id="mobile-nav-categories" className="pl-3 pb-3 space-y-2 text-xs text-[color:var(--body)] border-l-2 border-[var(--border)] ml-1 mt-1">
                        <Link
                          to="/shop"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="flex min-h-10 items-center py-2 hover:text-[color:var(--plum)] font-medium text-[color:var(--plum)]"
                        >
                          All Jewellery Catalogue
                        </Link>
                        <Link
                          to="/shop?category=earrings"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="flex min-h-10 items-center py-2 hover:text-[color:var(--plum)]"
                        >
                          Earrings & Chandbalis
                        </Link>
                        <Link
                          to="/shop?category=necklaces"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="block py-1 hover:text-[color:var(--plum)]"
                        >
                          Chokers & Necklaces
                        </Link>
                        <Link
                          to="/shop?category=bracelets"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="block py-1 hover:text-[color:var(--plum)]"
                        >
                          Bracelets, Bangles & Cuffs
                        </Link>
                        <Link
                          to="/shop?category=rings"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="block py-1 hover:text-[color:var(--plum)]"
                        >
                          Rings & Bands
                        </Link>
                        <Link
                          to="/shop?type=anklet"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="block py-1 hover:text-[color:var(--plum)]"
                        >
                          Traditional Anklets & Payal
                        </Link>
                        <Link
                          to="/shop?type=set"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="block py-1 hover:text-[color:var(--plum)]"
                        >
                          Coordinated Jewellery Sets
                        </Link>
                      </div>
                    )}
                  </div>

                  {/* Accordion 2: Shop by Occasion */}
                  <div className="pt-2">
                    <button
                      type="button"
                      aria-expanded={mobileExpanded.occasions}
                      aria-controls="mobile-nav-occasions"
                      onClick={() => toggleMobileAccordion('occasions')}
                      className="w-full flex items-center justify-between py-2.5 text-[#302438] hover:text-[color:var(--plum)] font-medium text-left cursor-pointer"
                    >
                      <span>Shop by Occasion</span>
                      <ChevronDown
                        size={16}
                        className={`transition-transform duration-200 text-[color:var(--body)] ${
                          mobileExpanded.occasions ? 'rotate-180 text-[color:var(--plum)]' : ''
                        }`}
                      />
                    </button>
                    {mobileExpanded.occasions && (
                      <div id="mobile-nav-occasions" className="pl-3 pb-3 space-y-2 text-xs text-[color:var(--body)] border-l-2 border-[var(--border)] ml-1 mt-1">
                        <Link
                          to="/shop?occasion=everyday"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="block py-1 hover:text-[color:var(--plum)]"
                        >
                          Everyday Wear & Minimalist
                        </Link>
                        <Link
                          to="/shop?occasion=everyday"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="block py-1 hover:text-[color:var(--plum)]"
                        >
                          Office & Professional Workwear
                        </Link>
                        <Link
                          to="/shop?occasion=festive"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="block py-1 hover:text-[color:var(--plum)]"
                        >
                          Festive & Party Wear
                        </Link>
                        <Link
                          to="/shop?occasion=wedding"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="block py-1 hover:text-[color:var(--plum)]"
                        >
                          Regal Wedding & Bridal
                        </Link>
                        <Link
                          to="/shop?occasion=gifting"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="block py-1 hover:text-[color:var(--plum)]"
                        >
                          Gifting Edition
                        </Link>
                      </div>
                    )}
                  </div>

                  {/* Accordion 3: Gifts */}
                  <div className="pt-2">
                    <button
                      type="button"
                      aria-expanded={mobileExpanded.gifts}
                      aria-controls="mobile-nav-gifts"
                      onClick={() => toggleMobileAccordion('gifts')}
                      className="w-full flex items-center justify-between py-2.5 text-[#302438] hover:text-[color:var(--plum)] font-medium text-left cursor-pointer"
                    >
                      <span>Gifts</span>
                      <ChevronDown
                        size={16}
                        className={`transition-transform duration-200 text-[color:var(--body)] ${
                          mobileExpanded.gifts ? 'rotate-180 text-[color:var(--plum)]' : ''
                        }`}
                      />
                    </button>
                    {mobileExpanded.gifts && (
                      <div id="mobile-nav-gifts" className="pl-3 pb-3 space-y-2 text-xs text-[color:var(--body)] border-l-2 border-[var(--border)] ml-1 mt-1">
                        <Link
                          to="/shop?price=under-999"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="block py-1 hover:text-[color:var(--plum)]"
                        >
                          Gifts Under ₹999
                        </Link>
                        <Link
                          to="/shop?price=1000-2000"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="block py-1 hover:text-[color:var(--plum)]"
                        >
                          Gifts ₹1,000 – ₹1,999
                        </Link>
                        <Link
                          to="/shop?price=above-2000"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="block py-1 hover:text-[color:var(--plum)]"
                        >
                          Luxury Gifts Above ₹2,000
                        </Link>
                        <Link
                          to="/shop?occasion=gifting"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="block py-1 hover:text-[color:var(--plum)]"
                        >
                          Gifts for Her & Milestones
                        </Link>
                      </div>
                    )}
                  </div>

                  {/* Accordion 4: Collections */}
                  <div className="pt-2">
                    <button
                      type="button"
                      aria-expanded={mobileExpanded.collections}
                      aria-controls="mobile-nav-collections"
                      onClick={() => toggleMobileAccordion('collections')}
                      className="w-full flex items-center justify-between py-2.5 text-[#302438] hover:text-[color:var(--plum)] font-medium text-left cursor-pointer"
                    >
                      <span>Collections</span>
                      <ChevronDown
                        size={16}
                        className={`transition-transform duration-200 text-[color:var(--body)] ${
                          mobileExpanded.collections ? 'rotate-180 text-[color:var(--plum)]' : ''
                        }`}
                      />
                    </button>
                    {mobileExpanded.collections && (
                      <div id="mobile-nav-collections" className="pl-3 pb-3 space-y-2 text-xs text-[color:var(--body)] border-l-2 border-[var(--border)] ml-1 mt-1">
                        <Link
                          to="/shop?category=bracelets"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="block py-1 hover:text-[color:var(--plum)]"
                        >
                          The Temple Coin Series
                        </Link>
                        <Link
                          to="/shop?category=necklaces"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="block py-1 hover:text-[color:var(--plum)]"
                        >
                          Royal Kundan & Polki
                        </Link>
                        <Link
                          to="/shop?category=earrings"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="block py-1 hover:text-[color:var(--plum)]"
                        >
                          Floral Filigree & Demi-Fine
                        </Link>
                        <Link
                          to="/shop?category=rings"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="block py-1 hover:text-[color:var(--plum)]"
                        >
                          Rose Gold Minimalist
                        </Link>
                      </div>
                    )}
                  </div>

                  {/* Accordion 5: About SARINE */}
                  <div className="pt-2">
                    <button
                      type="button"
                      aria-expanded={mobileExpanded.about}
                      aria-controls="mobile-nav-about"
                      onClick={() => toggleMobileAccordion('about')}
                      className="w-full flex items-center justify-between py-2.5 text-[#302438] hover:text-[color:var(--plum)] font-medium text-left cursor-pointer"
                    >
                      <span>About SARINE</span>
                      <ChevronDown
                        size={16}
                        className={`transition-transform duration-200 text-[color:var(--body)] ${
                          mobileExpanded.about ? 'rotate-180 text-[color:var(--plum)]' : ''
                        }`}
                      />
                    </button>
                    {mobileExpanded.about && (
                      <div id="mobile-nav-about" className="pl-3 pb-3 space-y-2 text-xs text-[color:var(--body)] border-l-2 border-[var(--border)] ml-1 mt-1">
                        <Link
                          to="/about"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="block py-1 hover:text-[color:var(--plum)]"
                        >
                          Our Story & Atelier Legacy
                        </Link>
                        <Link
                          to="/contact"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="block py-1 hover:text-[color:var(--plum)]"
                        >
                          Customer Concierge & Styling Help
                        </Link>
                        <Link
                          to="/sustainability"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="block py-1 hover:text-[color:var(--plum)]"
                        >
                          Sustainability & Ethical Sourcing
                        </Link>
                        <Link
                          to="/shipping-policy"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="block py-1 hover:text-[color:var(--plum)]"
                        >
                          Shipping & Return Policy
                        </Link>
                      </div>
                    )}
                  </div>
                </div>

                {/* Account & Utilities Section */}
                <div className="pt-4 border-t border-[var(--border)] space-y-2.5">
                  <Link
                    to="/account"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center gap-2.5 text-xs text-[#302438] hover:text-[color:var(--plum)] py-1 font-medium"
                  >
                    <User size={15} className="text-[color:var(--plum)]" />
                    <span>My Account & Orders</span>
                  </Link>
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      openWishlist();
                    }}
                    className="flex items-center justify-between w-full text-xs text-[#302438] hover:text-[color:var(--plum)] py-1 font-medium cursor-pointer"
                  >
                    <span className="flex items-center gap-2.5">
                      <Heart size={15} className="text-[color:var(--plum)]" />
                      <span>My Wishlist</span>
                    </span>
                    {wishlistCount > 0 && (
                      <span className="text-[10px] px-2 py-0.5 bg-[var(--rose)] text-white font-bold rounded-full" style={{ color: "var(--white)" }}>
                        {wishlistCount}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      openDrawer();
                    }}
                    className="flex items-center justify-between w-full text-xs text-[#302438] hover:text-[color:var(--plum)] py-1 font-medium cursor-pointer"
                  >
                    <span className="flex items-center gap-2.5">
                      <ShoppingBag size={15} className="text-[color:var(--plum)]" />
                      <span>Shopping Bag</span>
                    </span>
                    <span className="text-[10px] px-2 py-0.5 bg-[var(--rose)] text-white font-medium rounded-full" style={{ color: "var(--white)" }}>
                      {itemCount}
                    </span>
                  </button>
                </div>

                {/* Concierge Touchpoint */}
                <div className="pt-4 border-t border-[var(--border)]">
                  <Link
                    to="/contact"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block p-3 bg-[var(--white)] border border-[var(--border)] hover:border-[var(--gold)] transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Phone size={13} className="text-[color:var(--plum)]" />
                      <span className="text-[11px] font-semibold text-[color:var(--body)] uppercase tracking-wider">
                        Jewellery Concierge
                      </span>
                    </div>
                    <p className="text-[11px] text-[color:var(--body)]">
                      Speak with an atelier advisor for bespoke sizes or gift styling.
                    </p>
                  </Link>
                </div>

                {/* Dev seed / includeAll toggle for testing in DEV */}
                {import.meta.env.DEV && (
                  <div className="pt-3 border-t border-[var(--border)] flex items-center justify-between text-xs text-[color:var(--body)]">
                    <button
                      onClick={onToggleIncludeAll}
                      className="text-[11px] uppercase tracking-wider underline hover:text-[color:var(--plum)]"
                    >
                      includeAll: {includeAll ? 'ON' : 'OFF'}
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

    </>
  );
};
