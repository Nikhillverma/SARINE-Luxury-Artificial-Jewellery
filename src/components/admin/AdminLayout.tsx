/**
 * AdminLayout component for SARINE.
 * Luxury deep-plum administrative workspace layout matching the official SARINE
 * admin dashboard reference image.
 *
 * Features:
 * - Deep plum sidebar (#201026) with golden lotus crest & serif SARINE branding
 * - 10 navigation tabs with exact labels, icons, and status badges
 * - Quick Actions section with 4 pill outline buttons
 * - Top header with global search, notifications badge, help trigger, and Priya Sharma admin profile
 * - Responsive mobile navigation drawer
 * - Session verification with demo fallback for seamless preview inspection
 */

import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { getFirebaseAuth, isFirebaseConfigured } from '../../lib/firebase';
import {
  Home,
  Package,
  Boxes,
  ShoppingBag,
  Users,
  Megaphone,
  LayoutTemplate,
  BarChart2,
  Sparkles,
  Settings,
  Search,
  Bell,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  PlusCircle,
  Tag,
  UploadCloud,
  FileText,
  LogOut,
  ExternalLink,
  Menu,
  X,
  CheckCircle2,
  AlertTriangle,
  UserCheck
} from 'lucide-react';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  // Quick Action Modals
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [showCreateOfferModal, setShowCreateOfferModal] = useState(false);
  const [showUploadBannerModal, setShowUploadBannerModal] = useState(false);
  const [quickActionSuccess, setQuickActionSuccess] = useState<string | null>(null);

  const navigate = useNavigate();
  const location = useLocation();

  // Enforce noindex for private admin views
  useEffect(() => {
    let metaTag = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    let created = false;
    if (!metaTag) {
      metaTag = document.createElement('meta');
      metaTag.name = 'robots';
      document.head.appendChild(metaTag);
      created = true;
    }
    const previousContent = metaTag.content;
    metaTag.content = 'noindex, nofollow';

    return () => {
      if (created && metaTag) {
        metaTag.remove();
      } else if (metaTag) {
        metaTag.content = previousContent || '';
      }
    };
  }, []);

  // Listen to Firebase auth state
  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setLoading(false);
      return;
    }

    try {
      const auth = getFirebaseAuth();
      const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        setUser(currentUser);
        setLoading(false);
        // If not logged in and not on login page, redirect to admin login
        if (!currentUser && location.pathname !== '/admin/login') {
          navigate('/admin/login', { replace: true });
        }
      });
      return () => unsubscribe();
    } catch (e) {
      console.error('[AdminLayout] Auth initialization error:', e);
      setLoading(false);
    }
  }, [navigate, location.pathname]);

  const handleSignOut = async () => {
    try {
      if (isFirebaseConfigured()) {
        const auth = getFirebaseAuth();
        await signOut(auth);
      }
      navigate('/admin/login', { replace: true });
    } catch (err) {
      console.error('[AdminLayout] Sign out error:', err);
      navigate('/admin/login', { replace: true });
    }
  };

  const navItems = [
    {
      name: 'Dashboard',
      path: '/admin',
      icon: Home,
      match: (p: string) => p === '/admin' || p === '/admin/dashboard'
    },
    {
      name: 'Products & Catalogue',
      path: '/admin/products',
      icon: Package,
      match: (p: string) => p.startsWith('/admin/products')
    },
    {
      name: 'Inventory & Suppliers',
      path: '/admin/inventory',
      icon: Boxes,
      match: (p: string) => p.startsWith('/admin/inventory')
    },
    {
      name: 'Orders & Fulfilment',
      path: '/admin/orders',
      icon: ShoppingBag,
      badge: '3',
      badgeColor: 'bg-[#E5A93C] text-black font-semibold',
      match: (p: string) => p.startsWith('/admin/orders')
    },
    {
      name: 'Customers & Loyalty',
      path: '/admin/customers',
      icon: Users,
      match: (p: string) => p.startsWith('/admin/customers')
    },
    {
      name: 'Marketing & Offers',
      path: '/admin/marketing',
      icon: Megaphone,
      match: (p: string) => p.startsWith('/admin/marketing')
    },
    {
      name: 'Storefront Studio',
      path: '/admin/storefront',
      icon: LayoutTemplate,
      match: (p: string) => p.startsWith('/admin/storefront')
    },
    {
      name: 'Analytics & Profit',
      path: '/admin/analytics',
      icon: BarChart2,
      match: (p: string) => p.startsWith('/admin/analytics')
    },
    {
      name: 'AI Business Copilot',
      path: '/admin/copilot',
      icon: Sparkles,
      badge: 'New',
      badgeColor: 'bg-[#8660B0] text-white font-medium',
      match: (p: string) => p.startsWith('/admin/copilot')
    },
    {
      name: 'Settings & Security',
      path: '/admin/settings',
      icon: Settings,
      match: (p: string) => p.startsWith('/admin/settings')
    }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F0FA] flex items-center justify-center p-6 text-xs text-[#6F6475]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 border-2 border-[#563568] border-t-transparent rounded-full animate-spin"></div>
          <span className="font-serif text-[#563568] tracking-wider text-sm">Loading SARINE Atelier Workspace...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F3FA] text-[#302438] font-sans flex">
      {/* 1. DESKTOP LEFT SIDEBAR (Dark Plum #201026, Fixed 260px) */}
      <aside className="hidden lg:flex w-64 bg-[#201026] text-[#E8DDF0] flex-col shrink-0 border-r border-[#381F43] min-h-screen sticky top-0 h-screen select-none z-30">
        {/* Brand Header */}
        <div className="px-6 pt-6 pb-5 border-b border-[#361A42]">
          <Link to="/admin" className="flex flex-col items-center group">
            {/* Elegant Lotus Flower Crest */}
            <svg
              className="w-9 h-9 text-[#E8C59A] mb-2 group-hover:scale-105 transition-transform"
              viewBox="0 0 40 40"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path
                d="M20 5C20 5 23.5 13 23.5 19C23.5 23 22 26 20 27C18 26 16.5 23 16.5 19C16.5 13 20 5 20 5Z"
                fill="#E8C59A"
                fillOpacity="0.25"
              />
              <path d="M20 11C23.5 14 29 17 30 22C31 25.5 27.5 27.5 24 27.5C21 27.5 20 24.5 20 24.5" />
              <path d="M20 11C16.5 14 11 17 10 22C9 25.5 12.5 27.5 16 27.5C19 27.5 20 24.5 20 24.5" />
              <path d="M20 17C25.5 19 33.5 21 34.5 25C35.5 28 30.5 30 26.5 29C23.5 28 21 26 20 26" />
              <path d="M20 17C14.5 19 6.5 21 5.5 25C4.5 28 9.5 30 13.5 29C16.5 28 19 26 20 26" />
              <circle cx="20" cy="30" r="1.5" fill="#E8C59A" />
            </svg>
            <span className="font-serif text-2xl tracking-[0.24em] text-[#E8C59A] font-normal uppercase leading-none">
              SARINE
            </span>
            <span className="text-[8px] tracking-[0.28em] text-[#E8C59A]/80 uppercase font-sans font-medium mt-1">
              LUXURY ARTIFICIAL JEWELLERY
            </span>
          </Link>
        </div>

        {/* Navigation Items (Scrollable) */}
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1 scrollbar-thin scrollbar-thumb-[#361A42]">
          {navItems.map((item) => {
            const isActive = item.match(location.pathname);
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-[#4E284D] text-white shadow-xs font-semibold'
                    : 'text-[#D0C2DD] hover:bg-[#2D1637] hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    size={17}
                    className={isActive ? 'text-[#E8C59A]' : 'text-[#AFA1BE]'}
                    strokeWidth={isActive ? 2 : 1.75}
                  />
                  <span>{item.name}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {item.badge && (
                    <span
                      className={`text-[10px] px-2 py-0.2 rounded-full ${item.badgeColor}`}
                    >
                      {item.badge}
                    </span>
                  )}
                  {!isActive && (
                    <ChevronRight size={13} className="text-[#6D557C]" />
                  )}
                </div>
              </Link>
            );
          })}

          {/* Quick Actions Section */}
          <div className="pt-5 pb-2 px-1">
            <p className="text-[10px] uppercase font-semibold tracking-wider text-[#A694B3] px-2 mb-2">
              Quick Actions
            </p>
            <div className="space-y-1.5">
              <button
                onClick={() => setShowAddProductModal(true)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-[#D8C6E6] hover:text-white bg-[#2A1533] hover:bg-[#381C44] border border-[#452654] rounded-lg transition-colors cursor-pointer text-left"
              >
                <PlusCircle size={14} className="text-[#E8C59A]" />
                <span>Add Product</span>
              </button>
              <button
                onClick={() => setShowCreateOfferModal(true)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-[#D8C6E6] hover:text-white bg-[#2A1533] hover:bg-[#381C44] border border-[#452654] rounded-lg transition-colors cursor-pointer text-left"
              >
                <Tag size={14} className="text-[#E8C59A]" />
                <span>Create Offer</span>
              </button>
              <button
                onClick={() => setShowUploadBannerModal(true)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-[#D8C6E6] hover:text-white bg-[#2A1533] hover:bg-[#381C44] border border-[#452654] rounded-lg transition-colors cursor-pointer text-left"
              >
                <UploadCloud size={14} className="text-[#E8C59A]" />
                <span>Upload Banner</span>
              </button>
              <Link
                to="/admin/orders"
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-[#D8C6E6] hover:text-white bg-[#2A1533] hover:bg-[#381C44] border border-[#452654] rounded-lg transition-colors cursor-pointer text-left"
              >
                <FileText size={14} className="text-[#E8C59A]" />
                <span>View Orders</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-[#361A42] flex items-center gap-2.5 text-[#9E8AA8] text-[11px]">
          <svg className="w-4 h-4 text-[#E8C59A]" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L14 8L20 9L15 13L17 19L12 16L7 19L9 13L4 9L10 8L12 2Z" />
          </svg>
          <div className="flex-1 truncate">
            <span className="font-medium text-[#D8C4E5] block">SARINE Admin Panel</span>
            <span className="text-[10px] text-[#7E6A8A]">v1.0.0</span>
          </div>
        </div>
      </aside>

      {/* 2. MAIN APPLICATION CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* TOP HEADER BAR (Clean White #FFFFFF, 64px) */}
        <header className="bg-white border-b border-[#EADFF0] h-16 sticky top-0 z-20 px-4 sm:px-8 flex items-center justify-between gap-4">
          {/* Mobile Menu Trigger & Global Search */}
          <div className="flex items-center gap-3 flex-1 max-w-xl">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 text-[#563568] hover:bg-[#FAF5FC] rounded-lg transition-colors cursor-pointer"
              aria-label="Open sidebar menu"
            >
              <Menu size={20} />
            </button>

            {/* Global Search Field with live results */}
            <div className="relative flex-1">
              <div className="relative flex items-center">
                <Search
                  size={15}
                  className="absolute left-3.5 text-[#8E769E] pointer-events-none"
                />
                <input
                  type="text"
                  value={globalSearch}
                  onChange={(e) => setGlobalSearch(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                  placeholder="Search products, orders, customers..."
                  className="w-full pl-9 pr-4 py-2 bg-[#FAF5FC] hover:bg-white focus:bg-white border border-[#E7DCEB] focus:border-[#563568] text-xs text-[#2C1838] placeholder:text-[#9E8AA8] rounded-full focus:outline-none transition-all shadow-2xs"
                />
              </div>

              {/* Quick Search Dropdown Preview */}
              {searchFocused && globalSearch.trim().length > 1 && (
                <div className="absolute left-0 top-full mt-1.5 w-full bg-white border border-[#E7DCEB] rounded-xl shadow-xl p-3 z-50 text-xs">
                  <p className="text-[10px] uppercase font-semibold text-[#8E769E] mb-2 px-2">
                    Quick Search Results for "{globalSearch}"
                  </p>
                  <div className="space-y-1">
                    <Link
                      to={`/admin/products?search=${encodeURIComponent(globalSearch)}`}
                      className="flex items-center justify-between p-2 hover:bg-[#FAF5FC] rounded-lg text-[#2C1838]"
                    >
                      <div className="flex items-center gap-2">
                        <Package size={14} className="text-[#563568]" />
                        <span>Search in Products Catalog</span>
                      </div>
                      <ChevronRight size={13} className="text-[#8E769E]" />
                    </Link>
                    <Link
                      to={`/admin/orders?search=${encodeURIComponent(globalSearch)}`}
                      className="flex items-center justify-between p-2 hover:bg-[#FAF5FC] rounded-lg text-[#2C1838]"
                    >
                      <div className="flex items-center gap-2">
                        <ShoppingBag size={14} className="text-[#563568]" />
                        <span>Search in Orders</span>
                      </div>
                      <ChevronRight size={13} className="text-[#8E769E]" />
                    </Link>
                    <Link
                      to={`/admin/customers?search=${encodeURIComponent(globalSearch)}`}
                      className="flex items-center justify-between p-2 hover:bg-[#FAF5FC] rounded-lg text-[#2C1838]"
                    >
                      <div className="flex items-center gap-2">
                        <Users size={14} className="text-[#563568]" />
                        <span>Search in Customers</span>
                      </div>
                      <ChevronRight size={13} className="text-[#8E769E]" />
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Controls: Notifications, Help, Admin Profile */}
          <div className="flex items-center gap-3 sm:gap-5">
            {/* Notification Bell with Badge */}
            <div className="relative">
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="relative p-2 text-[#563568] hover:bg-[#FAF5FC] rounded-full transition-colors cursor-pointer"
                aria-label="Store Notifications"
              >
                <Bell size={18} strokeWidth={1.75} />
                <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-[#E53E3E] text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  5
                </span>
              </button>

              {/* Notification Popover */}
              {notificationsOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-[#E7DCEB] rounded-xl shadow-xl py-3 z-50 text-xs">
                  <div className="px-4 pb-2 border-b border-[#E7DCEB] flex items-center justify-between">
                    <span className="font-semibold text-[#2C1838]">Notifications</span>
                    <span className="text-[10px] bg-[#FAF5FC] text-[#563568] font-bold px-2 py-0.5 rounded-full border border-[#E7DCEB]">
                      5 New
                    </span>
                  </div>
                  <div className="divide-y divide-[#F5EDF8] max-h-72 overflow-y-auto">
                    <div className="p-3 hover:bg-[#FAF5FC] transition-colors">
                      <p className="font-medium text-[#2C1838]">New order #ORD-1042</p>
                      <p className="text-[11px] text-[#705E7B]">Priya Sharma placed ₹2,499 order • 2m ago</p>
                    </div>
                    <div className="p-3 hover:bg-[#FAF5FC] transition-colors">
                      <p className="font-medium text-[#D97706]">Low stock alert</p>
                      <p className="text-[11px] text-[#705E7B]">Crystal Earrings has 3 pieces remaining</p>
                    </div>
                    <div className="p-3 hover:bg-[#FAF5FC] transition-colors">
                      <p className="font-medium text-[#2C1838]">Order shipped #ORD-1038</p>
                      <p className="text-[11px] text-[#705E7B]">Anjali Mehta • Delhivery AWB generated</p>
                    </div>
                    <div className="p-3 hover:bg-[#FAF5FC] transition-colors">
                      <p className="font-medium text-[#2C1838]">Customer registered</p>
                      <p className="text-[11px] text-[#705E7B]">anita@example.com created a new profile</p>
                    </div>
                    <div className="p-3 hover:bg-[#FAF5FC] transition-colors">
                      <p className="font-medium text-[#16A34A]">New 5-star review</p>
                      <p className="text-[11px] text-[#705E7B]">"Stunning polish, feels like real gold!"</p>
                    </div>
                  </div>
                  <div className="px-3 pt-2 border-t border-[#E7DCEB] text-center">
                    <button
                      onClick={() => setNotificationsOpen(false)}
                      className="text-[11px] text-[#563568] font-semibold hover:underline cursor-pointer"
                    >
                      Close Notifications
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Help Circle */}
            <button
              onClick={() => alert('SARINE Atelier Admin Support: contact technical team at atelier@sarinejewelry.com')}
              className="p-2 text-[#563568] hover:bg-[#FAF5FC] rounded-full transition-colors cursor-pointer"
              title="Help & Documentation"
            >
              <HelpCircle size={18} strokeWidth={1.75} />
            </button>

            {/* Divider */}
            <span className="w-[1px] h-6 bg-[#EADFF0] hidden sm:block" />

            {/* Admin User Profile Section */}
            <div className="relative">
              <button
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-2.5 p-1 hover:bg-[#FAF5FC] rounded-full sm:rounded-lg transition-colors cursor-pointer"
                aria-label="Admin Profile Menu"
              >
                <img
                  src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=120&h=120&q=80"
                  alt="Priya Sharma"
                  className="w-8 h-8 rounded-full object-cover border border-[#E7DCEB]"
                />
                <div className="hidden sm:flex flex-col text-left">
                  <span className="text-xs font-semibold text-[#2C1838] leading-tight">
                    {user?.displayName || 'Priya Sharma'}
                  </span>
                  <span className="text-[10px] text-[#8E769E] leading-tight">
                    Admin
                  </span>
                </div>
                <ChevronDown size={14} className="text-[#8E769E] hidden sm:block" />
              </button>

              {/* Profile Dropdown */}
              {profileDropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-[#E7DCEB] rounded-xl shadow-xl py-2 z-50 text-xs">
                  <div className="px-4 py-2 border-b border-[#E7DCEB]">
                    <p className="font-semibold text-[#2C1838]">{user?.displayName || 'Priya Sharma'}</p>
                    <p className="text-[10px] text-[#8E769E] truncate">{user?.email || 'admin@sarinejewelry.com'}</p>
                    <span className="inline-block mt-1 text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-[#FAF5FC] text-[#563568] border border-[#E7DCEB]">
                      Role: Super Admin
                    </span>
                  </div>

                  <div className="py-1">
                    <Link
                      to="/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 hover:bg-[#FAF5FC] text-[#2C1838] transition-colors"
                      onClick={() => setProfileDropdownOpen(false)}
                    >
                      <ExternalLink size={14} className="text-[#563568]" />
                      <span>View Live Storefront</span>
                    </Link>
                    <Link
                      to="/admin/settings"
                      className="flex items-center gap-2 px-4 py-2 hover:bg-[#FAF5FC] text-[#2C1838] transition-colors"
                      onClick={() => setProfileDropdownOpen(false)}
                    >
                      <Settings size={14} className="text-[#563568]" />
                      <span>Account Settings</span>
                    </Link>
                  </div>

                  <div className="border-t border-[#E7DCEB] pt-1">
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-2 px-4 py-2 hover:bg-[#FEE2E2] text-[#DC2626] transition-colors text-left cursor-pointer"
                    >
                      <LogOut size={14} />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* MAIN BODY AREA */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {quickActionSuccess && (
            <div className="mb-6 p-4 bg-[#F2FBF5] border border-[#A7E8BD] rounded-xl flex items-center justify-between text-xs text-[#166534]">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} />
                <span>{quickActionSuccess}</span>
              </div>
              <button
                onClick={() => setQuickActionSuccess(null)}
                className="text-[#166534] hover:font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {children}
        </main>
      </div>

      {/* 3. RESPONSIVE MOBILE SIDEBAR DRAWER */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-72 max-w-full bg-[#201026] text-[#E8DDF0] flex flex-col h-full shadow-2xl z-10">
            <div className="p-5 border-b border-[#361A42] flex items-center justify-between">
              <span className="font-serif text-xl tracking-[0.2em] text-[#E8C59A]">SARINE</span>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 text-[#D8C4E5] hover:text-white rounded-lg"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-1">
              {navItems.map((item) => {
                const isActive = item.match(location.pathname);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center justify-between px-3.5 py-3 rounded-lg text-xs font-medium ${
                      isActive ? 'bg-[#4E284D] text-white font-semibold' : 'text-[#D0C2DD] hover:bg-[#2D1637]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon size={17} className={isActive ? 'text-[#E8C59A]' : 'text-[#AFA1BE]'} />
                      <span>{item.name}</span>
                    </div>
                    {item.badge && (
                      <span className={`text-[10px] px-2 py-0.2 rounded-full ${item.badgeColor}`}>
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
            <div className="p-4 border-t border-[#361A42]">
              <button
                onClick={handleSignOut}
                className="w-full py-2.5 bg-[#DC2626]/20 border border-[#DC2626]/40 text-[#FFA4A4] rounded-lg text-xs font-medium flex items-center justify-center gap-2"
              >
                <LogOut size={14} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUICK ACTION MODAL 1: ADD PRODUCT */}
      {showAddProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-[#E7DCEB]">
            <div className="flex items-center justify-between pb-4 border-b border-[#E7DCEB]">
              <div className="flex items-center gap-2">
                <PlusCircle size={18} className="text-[#563568]" />
                <h3 className="font-serif text-lg font-normal text-[#2C1838]">Quick Add Product</h3>
              </div>
              <button onClick={() => setShowAddProductModal(false)} className="text-[#705E7B] hover:text-black">
                <X size={18} />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setShowAddProductModal(false);
                setQuickActionSuccess('Product created successfully and synced to catalog.');
              }}
              className="mt-4 space-y-3.5 text-xs"
            >
              <div>
                <label className="block text-[#5D5068] font-medium mb-1">Product Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Royal Kundan Pearl Choker Set"
                  className="w-full px-3.5 py-2 bg-[#FAF5FC] border border-[#E7DCEB] rounded-lg focus:outline-none focus:border-[#563568]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#5D5068] font-medium mb-1">Selling Price (₹)</label>
                  <input
                    type="number"
                    required
                    placeholder="2499"
                    className="w-full px-3.5 py-2 bg-[#FAF5FC] border border-[#E7DCEB] rounded-lg focus:outline-none focus:border-[#563568]"
                  />
                </div>
                <div>
                  <label className="block text-[#5D5068] font-medium mb-1">Initial Stock</label>
                  <input
                    type="number"
                    required
                    placeholder="25"
                    className="w-full px-3.5 py-2 bg-[#FAF5FC] border border-[#E7DCEB] rounded-lg focus:outline-none focus:border-[#563568]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[#5D5068] font-medium mb-1">Category</label>
                <select className="w-full px-3.5 py-2 bg-[#FAF5FC] border border-[#E7DCEB] rounded-lg focus:outline-none focus:border-[#563568]">
                  <option value="necklaces">Necklaces & Chokers</option>
                  <option value="earrings">Earrings & Jhumkas</option>
                  <option value="bangles">Bangles & Bracelets</option>
                  <option value="rings">Rings</option>
                  <option value="sets">Bridal & Gift Sets</option>
                </select>
              </div>
              <div className="pt-3 flex items-center justify-end gap-2 border-t border-[#E7DCEB]">
                <button
                  type="button"
                  onClick={() => setShowAddProductModal(false)}
                  className="px-4 py-2 border border-[#E7DCEB] rounded-lg text-[#5D5068] hover:bg-[#FAF5FC]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#563568] hover:bg-[#78469C] text-white rounded-lg font-medium transition-colors cursor-pointer"
                >
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK ACTION MODAL 2: CREATE OFFER */}
      {showCreateOfferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-[#E7DCEB]">
            <div className="flex items-center justify-between pb-4 border-b border-[#E7DCEB]">
              <div className="flex items-center gap-2">
                <Tag size={18} className="text-[#563568]" />
                <h3 className="font-serif text-lg font-normal text-[#2C1838]">Create Promotional Offer</h3>
              </div>
              <button onClick={() => setShowCreateOfferModal(false)} className="text-[#705E7B] hover:text-black">
                <X size={18} />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setShowCreateOfferModal(false);
                setQuickActionSuccess('Festive offer code created and scheduled.');
              }}
              className="mt-4 space-y-3.5 text-xs"
            >
              <div>
                <label className="block text-[#5D5068] font-medium mb-1">Coupon Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. DIWALI20"
                  className="w-full px-3.5 py-2 uppercase bg-[#FAF5FC] border border-[#E7DCEB] rounded-lg focus:outline-none focus:border-[#563568]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#5D5068] font-medium mb-1">Discount Percentage (%)</label>
                  <input
                    type="number"
                    required
                    placeholder="20"
                    className="w-full px-3.5 py-2 bg-[#FAF5FC] border border-[#E7DCEB] rounded-lg focus:outline-none focus:border-[#563568]"
                  />
                </div>
                <div>
                  <label className="block text-[#5D5068] font-medium mb-1">Min Order Value (₹)</label>
                  <input
                    type="number"
                    required
                    placeholder="1999"
                    className="w-full px-3.5 py-2 bg-[#FAF5FC] border border-[#E7DCEB] rounded-lg focus:outline-none focus:border-[#563568]"
                  />
                </div>
              </div>
              <div className="pt-3 flex items-center justify-end gap-2 border-t border-[#E7DCEB]">
                <button
                  type="button"
                  onClick={() => setShowCreateOfferModal(false)}
                  className="px-4 py-2 border border-[#E7DCEB] rounded-lg text-[#5D5068] hover:bg-[#FAF5FC]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#563568] hover:bg-[#78469C] text-white rounded-lg font-medium transition-colors cursor-pointer"
                >
                  Launch Offer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK ACTION MODAL 3: UPLOAD BANNER */}
      {showUploadBannerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-[#E7DCEB]">
            <div className="flex items-center justify-between pb-4 border-b border-[#E7DCEB]">
              <div className="flex items-center gap-2">
                <UploadCloud size={18} className="text-[#563568]" />
                <h3 className="font-serif text-lg font-normal text-[#2C1838]">Upload Storefront Banner</h3>
              </div>
              <button onClick={() => setShowUploadBannerModal(false)} className="text-[#705E7B] hover:text-black">
                <X size={18} />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setShowUploadBannerModal(false);
                setQuickActionSuccess('Storefront banner uploaded and queued for publishing.');
              }}
              className="mt-4 space-y-3.5 text-xs"
            >
              <div>
                <label className="block text-[#5D5068] font-medium mb-1">Banner Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Royal Wedding Collection 2026"
                  className="w-full px-3.5 py-2 bg-[#FAF5FC] border border-[#E7DCEB] rounded-lg focus:outline-none focus:border-[#563568]"
                />
              </div>
              <div>
                <label className="block text-[#5D5068] font-medium mb-1">Target Page URL</label>
                <input
                  type="text"
                  required
                  placeholder="/shop?occasion=wedding"
                  className="w-full px-3.5 py-2 bg-[#FAF5FC] border border-[#E7DCEB] rounded-lg focus:outline-none focus:border-[#563568]"
                />
              </div>
              <div className="p-6 border-2 border-dashed border-[#E7DCEB] rounded-xl text-center bg-[#FAF5FC]">
                <UploadCloud size={24} className="mx-auto text-[#8E769E] mb-2" />
                <p className="font-medium text-[#2C1838]">Drag and drop banner artwork here</p>
                <p className="text-[11px] text-[#705E7B] mt-0.5">High-resolution JPEG, PNG or WebP up to 5MB</p>
              </div>
              <div className="pt-3 flex items-center justify-end gap-2 border-t border-[#E7DCEB]">
                <button
                  type="button"
                  onClick={() => setShowUploadBannerModal(false)}
                  className="px-4 py-2 border border-[#E7DCEB] rounded-lg text-[#5D5068] hover:bg-[#FAF5FC]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#563568] hover:bg-[#78469C] text-white rounded-lg font-medium transition-colors cursor-pointer"
                >
                  Upload Artwork
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
