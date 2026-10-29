/**
 * Customer Account & Concierge Portal for SARINE.
 * Inspired by modern Indian fine jewellery brands.
 *
 * Architecture:
 * - Customer profile summary at the top
 * - MAIN MENU:
 *   1. Order History (real authenticated orders, filters, item snapshots, live tracking & details)
 *   2. Plan of Purchase (10+1 monthly savings simulator & verified governance framework; coming-soon)
 *   3. Wishlist (saved demi-fine pieces, move to bag, remove, persistent)
 *   4. SARINE Wallet (verified zero balance, ledger breakdown, coming-soon)
 *   5. Delivery Addresses (CRUD with validation, default toggle, safe deletion, per-UID storage)
 * - OTHERS:
 *   6. SARINE Support Center (official contact, concierge hours, order ticket inquiry)
 *   7. How to Earn (points, birthday perks, patron referral code generator)
 *   8. How to Redeem (1:1 rupee parity, checkout rules, minimum threshold)
 *   9. FAQs (categorized, searchable accordions across 8 domains)
 *   10. Privacy Policy (zero payment-card retention guarantee)
 * - BOTTOM:
 *   11. Sign Out (safe confirmation modal, session reset, redirect)
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  User
} from 'firebase/auth';
import { getFirebaseAuth, isFirebaseConfigured } from '../lib/firebase';
import { useWishlist } from '../context/WishlistContext';
import { useCart } from '../context/CartContext';
import { customerOrderService } from '../services/customerOrderService';
import { Order } from '../types/order';
import { formatInr } from '../utils/currency';

// Modular Account Subcomponents
import { AccountSidebar, AccountSection } from '../components/account/AccountSidebar';
import { PlanOfPurchaseSection } from '../components/account/PlanOfPurchaseSection';
import { WalletSection } from '../components/account/WalletSection';
import { SupportSection } from '../components/account/SupportSection';
import { RewardsEarnSection } from '../components/account/RewardsEarnSection';
import { RewardsRedeemSection } from '../components/account/RewardsRedeemSection';
import { FaqsSection } from '../components/account/FaqsSection';
import { PrivacySection } from '../components/account/PrivacySection';
import { AddressesSection } from '../components/account/AddressesSection';
import { ProfileSection } from '../components/account/ProfileSection';
import { OrderDetailsModal } from '../components/account/OrderDetailsModal';

import {
  Package,
  Heart,
  Truck,
  CheckCircle2,
  Clock,
  AlertCircle,
  ShoppingBag,
  Search,
  ArrowRight,
  ChevronRight,
  RefreshCw,
  LogOut,
  Sparkles,
  Trash2,
  Menu,
  X
} from 'lucide-react';

export const AccountPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { wishlistProducts, count: wishlistCount, openWishlist, removeFromWishlist } = useWishlist();
  const { addItem, openDrawer } = useCart();

  // Authentication State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState<boolean>(true);
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | 'track'>(() => {
    return searchParams.get('tab') === 'track' ? 'track' : 'signin';
  });

  // Active Account Tab with aliases
  const [activeSection, setActiveSection] = useState<AccountSection>(() => {
    const rawSection = searchParams.get('section');
    if (rawSection === 'returns') return 'orders';
    if (rawSection === 'notifications' || rawSection === 'security') return 'profile';
    const validSections: AccountSection[] = [
      'orders',
      'plan-of-purchase',
      'wishlist',
      'wallet',
      'addresses',
      'support',
      'how-to-earn',
      'how-to-redeem',
      'faqs',
      'privacy',
      'profile'
    ];
    if (rawSection && validSections.includes(rawSection as AccountSection)) {
      return rawSection as AccountSection;
    }
    return 'orders';
  });

  // Orders State
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState<boolean>(false);
  const [orderFetchError, setOrderFetchError] = useState<string | null>(null);

  // Order Filters & Search
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateRangeFilter, setDateRangeFilter] = useState<string>('all');

  // Selected Order for Full Details Modal
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Auth Form State
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authFullName, setAuthFullName] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);

  // Quick Order Lookup (Unauthenticated Track Tab)
  const [orderLookupNum, setOrderLookupNum] = useState('');
  const [orderLookupPhone, setOrderLookupPhone] = useState('');

  // Mobile Navigation Menu Toggle
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Logout Dialog State
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // 1. Listen for Firebase Auth Changes
  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setLoadingAuth(false);
      return;
    }

    try {
      const auth = getFirebaseAuth();
      const unsub = onAuthStateChanged(auth, (user) => {
        setCurrentUser(user);
        setLoadingAuth(false);
      });
      return () => unsub();
    } catch {
      setLoadingAuth(false);
    }
  }, []);

  // 2. Fetch Customer Orders when signed in
  const loadOrders = useCallback(async () => {
    if (!currentUser) return;
    setLoadingOrders(true);
    setOrderFetchError(null);

    try {
      const idToken = await currentUser.getIdToken();
      const userOrders = await customerOrderService.getCustomerOrders(
        idToken,
        currentUser.email || '',
        currentUser.displayName || ''
      );
      setOrders(userOrders);
    } catch (err: any) {
      console.error('[AccountPage] Failed to fetch orders:', err);
      setOrderFetchError('Unable to load orders. Please retry.');
    } finally {
      setLoadingOrders(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      loadOrders();
    }
  }, [currentUser, loadOrders]);

  // Sync active section to URL query param
  const handleSelectSection = (sec: AccountSection) => {
    setActiveSection(sec);
    setSearchParams({ section: sec });
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 3. Purchase Statistics Calculations
  const purchaseStats = useMemo(() => {
    const totalOrders = orders.length;

    // Total product units purchased
    const totalUnits = orders.reduce((sum, order) => {
      const orderUnits = order.lines.reduce((lSum, line) => lSum + (line.quantity || 1), 0);
      return sum + orderUnits;
    }, 0);

    // Total spent on completed, non-cancelled purchases
    const totalSpend = orders.reduce((sum, order) => {
      if (order.orderStatus === 'cancelled') return sum;
      if (order.paymentStatus === 'refunded') return sum;
      let orderTotal = order.total || 0;
      if (order.refundAmount) {
        orderTotal = Math.max(0, orderTotal - order.refundAmount);
      }
      return sum + orderTotal;
    }, 0);

    // Orders in progress
    const inProgressCount = orders.filter((o) =>
      ['placed', 'pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery'].includes(
        o.orderStatus
      )
    ).length;

    // Delivered orders
    const deliveredCount = orders.filter((o) => o.orderStatus === 'delivered').length;

    return {
      totalOrders,
      totalUnits,
      totalSpend,
      inProgressCount,
      deliveredCount
    };
  }, [orders]);

  // 4. Filtered Orders
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (orderSearchQuery.trim()) {
        const query = orderSearchQuery.toLowerCase().trim();
        const matchesNumber = order.orderNumber.toLowerCase().includes(query);
        const matchesProduct = order.lines.some((l) => l.name.toLowerCase().includes(query));
        if (!matchesNumber && !matchesProduct) return false;
      }

      if (statusFilter !== 'all') {
        if (statusFilter === 'in_progress') {
          const inProgress = ['placed', 'pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery'];
          if (!inProgress.includes(order.orderStatus)) return false;
        } else if (statusFilter === 'delivered') {
          if (order.orderStatus !== 'delivered') return false;
        } else if (statusFilter === 'cancelled') {
          if (order.orderStatus !== 'cancelled') return false;
        }
      }

      if (dateRangeFilter !== 'all') {
        const orderTime = new Date(order.createdAt).getTime();
        const now = Date.now();
        if (dateRangeFilter === '30days') {
          if (now - orderTime > 30 * 24 * 60 * 60 * 1000) return false;
        } else if (dateRangeFilter === '6months') {
          if (now - orderTime > 180 * 24 * 60 * 60 * 1000) return false;
        } else if (dateRangeFilter === '2026') {
          const year = new Date(order.createdAt).getFullYear();
          if (year !== 2026) return false;
        }
      }

      return true;
    });
  }, [orders, orderSearchQuery, statusFilter, dateRangeFilter]);

  // 5. Auth Handlers
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsAuthSubmitting(true);

    try {
      const auth = getFirebaseAuth();
      if (authMode === 'signin') {
        await signInWithEmailAndPassword(auth, authEmail.trim(), authPassword);
      } else {
        const cred = await createUserWithEmailAndPassword(auth, authEmail.trim(), authPassword);
        if (authFullName.trim()) {
          await updateProfile(cred.user, { displayName: authFullName.trim() });
        }
      }
    } catch (err: any) {
      console.error('[AccountPage] Auth error:', err);
      if (
        err.code === 'auth/user-not-found' ||
        err.code === 'auth/wrong-password' ||
        err.code === 'auth/invalid-credential'
      ) {
        setAuthError('Invalid email address or password.');
      } else if (err.code === 'auth/email-already-in-use') {
        setAuthError('An account with this email address already exists. Please sign in instead.');
      } else if (err.code === 'auth/weak-password') {
        setAuthError('Password should be at least 6 characters.');
      } else {
        setAuthError('Unable to authenticate. Please check your credentials and try again.');
      }
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    try {
      const auth = getFirebaseAuth();
      await signOut(auth);
      setShowLogoutConfirm(false);
      navigate('/account');
    } catch (err) {
      console.error('[AccountPage] Sign out error:', err);
    }
  };

  const handleQuickLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (orderLookupNum.trim()) {
      navigate(`/track-order?orderNumber=${encodeURIComponent(orderLookupNum.trim())}`);
    }
  };

  // 6. Action Handlers for Orders
  const handleCancelOrder = async (orderNumber: string, reason: string) => {
    if (!currentUser) return;
    const idToken = await currentUser.getIdToken();
    await customerOrderService.cancelOrder(
      idToken,
      orderNumber,
      reason,
      currentUser.email || ''
    );
    await loadOrders();
    if (selectedOrder && selectedOrder.orderNumber === orderNumber) {
      setSelectedOrder((prev) =>
        prev
          ? {
              ...prev,
              orderStatus: 'cancelled',
              cancelledAt: new Date().toISOString(),
              cancellationReason: reason
            }
          : null
      );
    }
  };

  const handleReturnOrder = async (
    orderNumber: string,
    reason: string,
    actionType: 'return' | 'exchange',
    notes: string
  ) => {
    if (!currentUser) return;
    const idToken = await currentUser.getIdToken();
    await customerOrderService.requestReturnOrExchange(
      idToken,
      orderNumber,
      reason,
      actionType,
      notes,
      currentUser.email || ''
    );
    await loadOrders();
    if (selectedOrder && selectedOrder.orderNumber === orderNumber) {
      setSelectedOrder((prev) =>
        prev
          ? {
              ...prev,
              returnStatus: actionType === 'exchange' ? 'exchange_requested' : 'return_requested',
              returnReason: reason,
              returnNotes: notes
            }
          : null
      );
    }
  };

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-[#F7F0FA] flex items-center justify-center p-8">
        <div className="text-center font-sans">
          <div className="w-8 h-8 border-2 border-[#563568] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="font-serif text-base text-[#302438]">Connecting to SARINE Atelier...</p>
        </div>
      </div>
    );
  }

  // =========================================================================
  // UNAUTHENTICATED SCREEN (Sign In / Register / Track Tab)
  // =========================================================================
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#F7F0FA] pb-20 text-[#302438] font-sans">
        <section className="bg-white border-b border-[#E7DCEB] py-8 sm:py-12">
          <div className="site-container">
            <div className="max-w-2xl">
              <span className="text-[10px] uppercase tracking-[0.25em] text-[#6F6475] font-medium block mb-2">
                CUSTOMER CONCIERGE & ORDERS
              </span>
              <h1 className="font-serif text-3xl sm:text-4xl text-[#302438] font-normal">
                Customer Account
              </h1>
              <p className="mt-2 text-xs sm:text-sm text-[#6F6475] leading-relaxed">
                Sign in to view your complete order history, track live couriers, and access saved demi-fine pieces.
              </p>
            </div>
          </div>
        </section>

        <div className="site-container pt-8 sm:pt-12">
          <div className="max-w-md mx-auto bg-white p-6 sm:p-8 border border-[#E7DCEB] rounded-xs shadow-xs">
            {/* Tabs */}
            <div className="flex border-b border-[#E7DCEB] mb-6 text-xs font-medium">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signin');
                  setAuthError(null);
                }}
                className={`min-h-[44px] flex-1 py-3 text-center border-b-2 cursor-pointer transition-colors ${
                  authMode === 'signin'
                    ? 'border-[#563568] text-[#563568] font-semibold'
                    : 'border-transparent text-[#6F6475] hover:text-[#302438]'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signup');
                  setAuthError(null);
                }}
                className={`min-h-[44px] flex-1 py-3 text-center border-b-2 cursor-pointer transition-colors ${
                  authMode === 'signup'
                    ? 'border-[#563568] text-[#563568] font-semibold'
                    : 'border-transparent text-[#6F6475] hover:text-[#302438]'
                }`}
              >
                Create Account
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('track');
                  setAuthError(null);
                }}
                className={`min-h-[44px] flex-1 py-3 text-center border-b-2 cursor-pointer transition-colors ${
                  authMode === 'track'
                    ? 'border-[#563568] text-[#563568] font-semibold'
                    : 'border-transparent text-[#6F6475] hover:text-[#302438]'
                }`}
              >
                Track Order
              </button>
            </div>

            {authError && (
              <div className="mb-4 p-3 bg-[#DC2626]/5 border border-[#DC2626]/30 text-xs text-[#DC2626] rounded-xs">
                {authError}
              </div>
            )}

            {authMode === 'track' ? (
              <form onSubmit={handleQuickLookup} className="space-y-4 text-xs font-sans">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-[#563568] font-semibold block mb-1">
                    Live Order Lookup
                  </span>
                  <p className="text-[#6F6475] text-xs leading-relaxed mb-3">
                    Enter your SARINE order reference number and delivery phone number to view real-time courier updates.
                  </p>
                </div>

                <div>
                  <label className="block text-[#6F6475] mb-1 font-medium">Order Number</label>
                  <input
                    type="text"
                    required
                    value={orderLookupNum}
                    onChange={(e) => setOrderLookupNum(e.target.value.toUpperCase())}
                    placeholder="e.g. SAR-000108"
                    className="w-full min-h-[44px] p-2.5 bg-[#F7F0FA] border border-[#E7DCEB] focus:border-[#563568] rounded-xs focus:outline-none uppercase"
                  />
                </div>

                <div>
                  <label className="block text-[#6F6475] mb-1 font-medium">Phone Number (10 digits)</label>
                  <input
                    type="tel"
                    value={orderLookupPhone}
                    onChange={(e) => setOrderLookupPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="e.g. 9876543210"
                    className="w-full min-h-[44px] p-2.5 bg-[#F7F0FA] border border-[#E7DCEB] focus:border-[#563568] rounded-xs focus:outline-none"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full min-h-[44px] py-3 bg-[#563568] text-white hover:bg-[#80609A] text-xs uppercase tracking-[0.2em] font-medium rounded-xs transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Truck size={14} />
                    <span>Track Order Status</span>
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleAuthSubmit} className="space-y-4 text-xs font-sans">
                {authMode === 'signup' && (
                  <div>
                    <label className="block text-[#6F6475] mb-1 font-medium">Full Name</label>
                    <input
                      type="text"
                      required
                      value={authFullName}
                      onChange={(e) => setAuthFullName(e.target.value)}
                      placeholder="e.g. Aarohi Patel"
                      className="w-full min-h-[44px] p-2.5 bg-[#F7F0FA] border border-[#E7DCEB] focus:border-[#563568] rounded-xs focus:outline-none"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[#6F6475] mb-1 font-medium">Email Address</label>
                  <input
                    type="email"
                    required
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full min-h-[44px] p-2.5 bg-[#F7F0FA] border border-[#E7DCEB] focus:border-[#563568] rounded-xs focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[#6F6475] mb-1 font-medium">Password</label>
                  <input
                    type="password"
                    required
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full min-h-[44px] p-2.5 bg-[#F7F0FA] border border-[#E7DCEB] focus:border-[#563568] rounded-xs focus:outline-none"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isAuthSubmitting}
                    className="w-full min-h-[44px] py-3 bg-[#563568] text-white hover:bg-[#80609A] disabled:opacity-50 text-xs uppercase tracking-[0.2em] font-medium rounded-xs transition-colors shadow-xs cursor-pointer"
                  >
                    {isAuthSubmitting
                      ? 'Verifying...'
                      : authMode === 'signin'
                      ? 'Sign In to SARINE'
                      : 'Create Account'}
                  </button>
                </div>

                <div className="text-center pt-3 text-[11px] text-[#6F6475]">
                  <button
                    type="button"
                    onClick={() => setAuthMode('track')}
                    className="text-[#563568] font-medium underline cursor-pointer"
                  >
                    Looking to track an existing order? Track here
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // AUTHENTICATED SCREEN (Full Customer Portal with Upgraded Navigation)
  // =========================================================================
  return (
    <div className="min-h-screen bg-[#F7F0FA] pb-24 text-[#302438] font-sans">
      {/* Header Banner */}
      <section className="bg-white border-b border-[#E7DCEB] py-6 sm:py-8">
        <div className="site-container flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] uppercase tracking-[0.25em] text-[#6F6475] font-medium block mb-1">
              CUSTOMER CONCIERGE & ATELIER PORTAL
            </span>
            <h1 className="font-serif text-2xl sm:text-3xl text-[#302438] font-normal">
              Namaste, {currentUser.displayName || currentUser.email?.split('@')[0]}
            </h1>
            <p className="text-xs text-[#6F6475] mt-1">
              Patron membership: <span className="font-mono text-[#563568]">{currentUser.email}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadOrders}
              className="min-h-[44px] px-3.5 py-2 bg-[#FAF5FC] hover:bg-[#F0E6F4] text-[#563568] border border-[#E7DCEB] text-xs font-medium rounded-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Refresh Orders"
            >
              <RefreshCw size={13} className={loadingOrders ? 'animate-spin' : ''} />
              <span>Refresh Orders</span>
            </button>
            <button
              type="button"
              onClick={() => setShowLogoutConfirm(true)}
              className="min-h-[44px] px-3.5 py-2 border border-[#DC2626]/30 text-[#DC2626] hover:bg-[#DC2626]/5 text-xs font-medium rounded-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut size={13} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </section>

      {/* Mobile Menu Bar / Drawer Toggle (Screens < lg) */}
      <div className="lg:hidden site-container pt-4">
        <div className="bg-white p-3 border border-[#E7DCEB] rounded-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold text-[#6F6475] tracking-wider">
              Viewing:
            </span>
            <span className="text-xs font-serif font-medium text-[#563568] capitalize">
              {activeSection.replace(/-/g, ' ')}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="min-h-[44px] px-3 py-1.5 bg-[#FAF5FC] border border-[#E7DCEB] text-[#563568] rounded-xs text-xs font-medium flex items-center gap-1.5 cursor-pointer"
          >
            {mobileMenuOpen ? <X size={15} /> : <Menu size={15} />}
            <span>Account Menu</span>
          </button>
        </div>

        {/* Mobile Dropdown Menu Drawer */}
        {mobileMenuOpen && (
          <div className="mt-2 bg-white border border-[#E7DCEB] rounded-xs p-3 shadow-lg animate-fadeIn">
            <AccountSidebar
              currentUser={currentUser}
              activeSection={activeSection}
              onSelectSection={handleSelectSection}
              onTriggerLogout={() => {
                setMobileMenuOpen(false);
                setShowLogoutConfirm(true);
              }}
              ordersCount={orders.length}
              wishlistCount={wishlistCount}
              addressesCount={1}
            />
          </div>
        )}
      </div>

      {/* Main Grid: Desktop Sidebar & Active Content */}
      <div className="site-container pt-6 sm:pt-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT: DESKTOP SIDEBAR (4 Cols on LG, 3 Cols on XL) */}
          <div className="hidden lg:block lg:col-span-4 xl:col-span-3 sticky top-24">
            <AccountSidebar
              currentUser={currentUser}
              activeSection={activeSection}
              onSelectSection={handleSelectSection}
              onTriggerLogout={() => setShowLogoutConfirm(true)}
              ordersCount={orders.length}
              wishlistCount={wishlistCount}
              addressesCount={1}
            />
          </div>

          {/* RIGHT: ACTIVE SECTION CONTENT (8 Cols on LG, 9 Cols on XL) */}
          <div className="lg:col-span-8 xl:col-span-9 space-y-6">
            {/* ===============================================================
                1. ORDER HISTORY
               =============================================================== */}
            {activeSection === 'orders' && (
              <div className="space-y-6 animate-fadeIn">
                {/* Purchase Statistics Banner */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div className="p-4 bg-white border border-[#E7DCEB] rounded-xs shadow-2xs">
                    <span className="text-[10px] uppercase tracking-wider text-[#6F6475] block mb-1">
                      Total Orders
                    </span>
                    <span className="font-serif text-xl sm:text-2xl text-[#302438] font-normal block">
                      {purchaseStats.totalOrders}
                    </span>
                    <span className="text-[10px] text-[#6F6475]">Placed to date</span>
                  </div>

                  <div className="p-4 bg-white border border-[#E7DCEB] rounded-xs shadow-2xs">
                    <span className="text-[10px] uppercase tracking-wider text-[#6F6475] block mb-1">
                      Units Acquired
                    </span>
                    <span className="font-serif text-xl sm:text-2xl text-[#563568] font-normal block">
                      {purchaseStats.totalUnits}
                    </span>
                    <span className="text-[10px] text-[#6F6475]">Jewellery pieces</span>
                  </div>

                  <div className="p-4 bg-white border border-[#E7DCEB] rounded-xs shadow-2xs col-span-2 sm:col-span-1">
                    <span className="text-[10px] uppercase tracking-wider text-[#6F6475] block mb-1">
                      Total Spend
                    </span>
                    <span className="font-serif text-xl sm:text-2xl text-[#302438] font-normal block truncate">
                      {formatInr(purchaseStats.totalSpend)}
                    </span>
                    <span className="text-[10px] text-[#047857]">Excludes cancelled</span>
                  </div>

                  <div className="p-4 bg-white border border-[#E7DCEB] rounded-xs shadow-2xs">
                    <span className="text-[10px] uppercase tracking-wider text-[#6F6475] block mb-1">
                      In Progress
                    </span>
                    <span className="font-serif text-xl sm:text-2xl text-[#735135] font-normal block">
                      {purchaseStats.inProgressCount}
                    </span>
                    <span className="text-[10px] text-[#735135]">Active dispatches</span>
                  </div>

                  <div className="p-4 bg-white border border-[#E7DCEB] rounded-xs shadow-2xs">
                    <span className="text-[10px] uppercase tracking-wider text-[#6F6475] block mb-1">
                      Delivered
                    </span>
                    <span className="font-serif text-xl sm:text-2xl text-[#047857] font-normal block">
                      {purchaseStats.deliveredCount}
                    </span>
                    <span className="text-[10px] text-[#047857]">Received successfully</span>
                  </div>
                </div>

                {/* Search & Filter Controls */}
                <div className="bg-white p-4 border border-[#E7DCEB] rounded-xs shadow-2xs flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                  <div className="relative flex-1">
                    <Search
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6F6475]"
                    />
                    <input
                      type="text"
                      value={orderSearchQuery}
                      onChange={(e) => setOrderSearchQuery(e.target.value)}
                      placeholder="Search by order ID (e.g. SAR-000108) or jewellery name..."
                      className="w-full min-h-[44px] pl-9 pr-3 py-2 bg-[#F7F0FA] border border-[#E7DCEB] focus:border-[#563568] rounded-xs text-xs focus:outline-none"
                    />
                    {orderSearchQuery && (
                      <button
                        onClick={() => setOrderSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6F6475] hover:text-[#302438]"
                      >
                        ×
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="min-h-[44px] py-2 px-3 bg-[#F7F0FA] border border-[#E7DCEB] rounded-xs focus:border-[#563568] focus:outline-none cursor-pointer"
                    >
                      <option value="all">All Statuses</option>
                      <option value="in_progress">In Progress</option>
                      <option value="delivered">Delivered</option>
                      <option value="cancelled">Cancelled</option>
                    </select>

                    <select
                      value={dateRangeFilter}
                      onChange={(e) => setDateRangeFilter(e.target.value)}
                      className="min-h-[44px] py-2 px-3 bg-[#F7F0FA] border border-[#E7DCEB] rounded-xs focus:border-[#563568] focus:outline-none cursor-pointer"
                    >
                      <option value="all">All Time</option>
                      <option value="30days">Last 30 Days</option>
                      <option value="6months">Last 6 Months</option>
                      <option value="2026">Year 2026</option>
                    </select>
                  </div>
                </div>

                {/* Orders List / Loading / Empty */}
                {loadingOrders ? (
                  <div className="space-y-4">
                    {[1, 2].map((n) => (
                      <div
                        key={n}
                        className="p-6 bg-white border border-[#E7DCEB] rounded-xs space-y-4 animate-pulse"
                      >
                        <div className="h-4 bg-[#F7F0FA] w-1/3 rounded" />
                        <div className="h-16 bg-[#F7F0FA] rounded" />
                        <div className="h-8 bg-[#F7F0FA] w-1/4 rounded" />
                      </div>
                    ))}
                  </div>
                ) : filteredOrders.length === 0 ? (
                  <div className="bg-white p-10 sm:p-14 border border-[#E7DCEB] rounded-xs text-center space-y-4 shadow-2xs">
                    <div className="w-14 h-14 rounded-full bg-[#FAF5FC] border border-[#E7DCEB] flex items-center justify-center mx-auto text-[#563568]">
                      <Package size={26} strokeWidth={1.5} />
                    </div>
                    <div className="max-w-md mx-auto">
                      <h3 className="font-serif text-lg text-[#302438]">
                        {orderSearchQuery || statusFilter !== 'all' || dateRangeFilter !== 'all'
                          ? 'No matching orders found'
                          : 'You haven’t placed any orders yet'}
                      </h3>
                      <p className="text-xs text-[#6F6475] mt-1 leading-relaxed">
                        {orderSearchQuery || statusFilter !== 'all' || dateRangeFilter !== 'all'
                          ? 'Try clearing your filters or search keywords to view your complete order history.'
                          : 'Explore our latest demi-fine collections, handcrafted chokers, temple bangles, and everyday minimalist designs.'}
                      </p>
                    </div>
                    {orderSearchQuery || statusFilter !== 'all' || dateRangeFilter !== 'all' ? (
                      <button
                        onClick={() => {
                          setOrderSearchQuery('');
                          setStatusFilter('all');
                          setDateRangeFilter('all');
                        }}
                        className="min-h-[44px] px-4 py-2 border border-[#563568] text-[#563568] text-xs font-medium rounded-xs hover:bg-[#FAF5FC] transition-colors cursor-pointer"
                      >
                        Clear Filters
                      </button>
                    ) : (
                      <Link
                        to="/shop"
                        className="inline-flex items-center gap-1.5 min-h-[44px] px-6 py-2.5 bg-[#563568] hover:bg-[#80609A] text-white text-xs font-medium rounded-xs transition-colors shadow-xs"
                      >
                        <span>Start Shopping</span>
                        <ArrowRight size={13} />
                      </Link>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredOrders.map((order) => {
                      const distinctCount = order.lines.length;
                      const unitsCount = order.lines.reduce(
                        (sum, line) => sum + (line.quantity || 1),
                        0
                      );
                      const formattedDate = new Date(order.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      });

                      return (
                        <div
                          key={order.orderNumber}
                          className="bg-white border border-[#E7DCEB] hover:border-[#B69ACF] rounded-xs shadow-2xs overflow-hidden transition-all"
                        >
                          {/* Card Top Info Bar */}
                          <div className="px-5 py-3.5 bg-[#FAF5FC]/60 border-b border-[#E7DCEB] flex flex-wrap items-center justify-between gap-3 text-xs">
                            <div className="flex flex-wrap items-center gap-4">
                              <div>
                                <span className="text-[10px] uppercase text-[#6F6475] block">
                                  Order ID:
                                </span>
                                <span className="font-serif font-medium text-sm text-[#302438]">
                                  #{order.orderNumber}
                                </span>
                              </div>
                              <div>
                                <span className="text-[10px] uppercase text-[#6F6475] block">
                                  Date Placed:
                                </span>
                                <span className="text-[#302438]">{formattedDate}</span>
                              </div>
                              <div>
                                <span className="text-[10px] uppercase text-[#6F6475] block">
                                  Total Amount:
                                </span>
                                <span className="font-semibold text-[#563568]">
                                  {formatInr(order.total)}
                                </span>
                              </div>
                            </div>

                            {/* Status Badge */}
                            <div>
                              {order.orderStatus === 'delivered' && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#10B981]/15 text-[#047857]">
                                  <CheckCircle2 size={11} /> Delivered
                                </span>
                              )}
                              {['placed', 'confirmed'].includes(order.orderStatus) && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#B69ACF]/20 text-[#563568]">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#563568]" /> Confirmed
                                </span>
                              )}
                              {order.orderStatus === 'processing' && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#D9B8A0]/25 text-[#735135]">
                                  <Clock size={11} /> Processing
                                </span>
                              )}
                              {['shipped', 'out_for_delivery'].includes(order.orderStatus) && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#3B82F6]/10 text-[#1D4ED8]">
                                  <Truck size={11} /> Shipped
                                </span>
                              )}
                              {order.orderStatus === 'cancelled' && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#DC2626]/10 text-[#DC2626]">
                                  <AlertCircle size={11} /> Cancelled
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Card Body */}
                          <div className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="flex items-center -space-x-2 shrink-0">
                                {order.lines.slice(0, 3).map((line, idx) => (
                                  <img
                                    key={idx}
                                    src={
                                      line.image ||
                                      'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=300&q=80'
                                    }
                                    alt={line.name}
                                    className="w-12 h-12 object-cover rounded-xs border-2 border-white shadow-2xs bg-white"
                                    onError={(e) => {
                                      (e.target as HTMLElement).style.display = 'none';
                                    }}
                                  />
                                ))}
                                {order.lines.length > 3 && (
                                  <div className="w-12 h-12 rounded-xs border-2 border-white bg-[#FAF5FC] text-[#563568] text-xs font-semibold flex items-center justify-center shadow-2xs">
                                    +{order.lines.length - 3}
                                  </div>
                                )}
                              </div>

                              <div className="min-w-0">
                                <h4 className="font-serif text-xs sm:text-sm text-[#302438] truncate">
                                  {order.lines[0]?.name}
                                  {order.lines.length > 1 && ` and ${order.lines.length - 1} other item(s)`}
                                </h4>
                                <div className="flex items-center gap-2 mt-1 text-[11px] text-[#6F6475]">
                                  <span className="font-medium text-[#563568]">
                                    {distinctCount} Product {distinctCount === 1 ? 'Type' : 'Types'}
                                  </span>
                                  <span>•</span>
                                  <span>
                                    {unitsCount} Total {unitsCount === 1 ? 'Unit' : 'Units'}
                                  </span>
                                  <span>•</span>
                                  <span className="capitalize">
                                    {order.paymentMethod === 'online' ? 'Prepaid' : 'COD'} (
                                    {order.paymentStatus})
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Card Actions */}
                            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-[#E7DCEB]">
                              <Link
                                to={`/track-order?orderNumber=${order.orderNumber}`}
                                className="min-h-[44px] flex-1 sm:flex-none px-3.5 py-2 border border-[#E7DCEB] hover:border-[#563568] text-[#563568] text-xs font-medium rounded-xs transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
                              >
                                <Truck size={13} />
                                <span>Track</span>
                              </Link>

                              <button
                                type="button"
                                onClick={() => setSelectedOrder(order)}
                                className="min-h-[44px] flex-1 sm:flex-none px-4 py-2 bg-[#563568] hover:bg-[#80609A] text-white text-xs font-medium rounded-xs transition-colors flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                              >
                                <span>View Details</span>
                                <ChevronRight size={13} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ===============================================================
                2. PLAN OF PURCHASE (Coming Soon & Simulator)
               =============================================================== */}
            {activeSection === 'plan-of-purchase' && (
              <PlanOfPurchaseSection userEmail={currentUser.email} />
            )}

            {/* ===============================================================
                3. WISHLIST
               =============================================================== */}
            {activeSection === 'wishlist' && (
              <div className="bg-white p-6 sm:p-8 border border-[#E7DCEB] rounded-xs shadow-xs space-y-6 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-serif text-xl sm:text-2xl text-[#302438]">My Wishlist</h3>
                    <p className="text-xs sm:text-sm text-[#6F6475] mt-1">
                      Curated pieces you have saved for celebratory occasions and everyday luxury.
                    </p>
                  </div>
                  <span className="text-xs text-[#563568] font-bold px-2.5 py-1 bg-[#FAF5FC] border border-[#E7DCEB] rounded-xs">
                    {wishlistCount} Saved {wishlistCount === 1 ? 'Piece' : 'Pieces'}
                  </span>
                </div>

                {wishlistProducts.length === 0 ? (
                  <div className="p-12 border border-[#E7DCEB] rounded-xs text-center space-y-4 bg-[#FAF5FC]/40">
                    <Heart size={32} className="mx-auto text-[#B69ACF]" strokeWidth={1.5} />
                    <div className="max-w-sm mx-auto">
                      <h4 className="text-sm font-serif text-[#302438]">Your wishlist is currently empty</h4>
                      <p className="text-xs text-[#6F6475] mt-1">
                        Explore our handcrafted 925 sterling silver, vermeil rings, and bridal chokers.
                      </p>
                    </div>
                    <Link
                      to="/shop"
                      className="inline-flex items-center gap-1.5 min-h-[44px] px-6 py-2.5 bg-[#563568] text-white text-xs font-medium rounded-xs hover:bg-[#80609A] transition-colors"
                    >
                      <span>Explore Collection</span>
                      <ArrowRight size={13} />
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {wishlistProducts.map((item) => (
                      <div
                        key={item.id}
                        className="border border-[#E7DCEB] hover:border-[#B69ACF] rounded-xs p-3.5 space-y-2.5 bg-white transition-all flex flex-col justify-between"
                      >
                        <div>
                          <Link to={`/product/${item.slug || item.id}`}>
                            <img
                              src={
                                item.images[0] ||
                                'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=400&q=80'
                              }
                              alt={item.name}
                              className="w-full h-44 object-cover rounded-xs border border-[#E7DCEB] bg-[#FAF5FC]"
                            />
                          </Link>
                          <h4 className="font-serif text-xs sm:text-sm text-[#302438] truncate mt-2">
                            {item.name}
                          </h4>
                          <div className="flex items-center justify-between mt-1">
                            <span className="font-semibold text-xs text-[#563568]">
                              {formatInr(item.price)}
                            </span>
                            <span className="text-[10px] text-[#047857] font-medium">In Stock</span>
                          </div>
                        </div>

                        <div className="pt-2 flex items-center gap-2 border-t border-[#E7DCEB]">
                          <button
                            type="button"
                            onClick={() => {
                              addItem(item);
                              openDrawer();
                            }}
                            className="min-h-[44px] flex-1 py-2 bg-[#563568] hover:bg-[#80609A] text-white text-xs font-medium rounded-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                          >
                            <ShoppingBag size={13} />
                            <span>Move to Bag</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => removeFromWishlist(item.id)}
                            className="min-h-[44px] min-w-[44px] p-2 border border-[#E7DCEB] text-[#6F6475] hover:text-[#DC2626] hover:bg-[#DC2626]/5 rounded-xs flex items-center justify-center cursor-pointer"
                            title="Remove from wishlist"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ===============================================================
                4. SARINE WALLET (Coming Soon & Zero Balance Ledger)
               =============================================================== */}
            {activeSection === 'wallet' && (
              <WalletSection userEmail={currentUser.email} />
            )}

            {/* ===============================================================
                5. DELIVERY ADDRESSES (Persistent CRUD per UID)
               =============================================================== */}
            {activeSection === 'addresses' && (
              <AddressesSection userId={currentUser.uid} />
            )}

            {/* ===============================================================
                6. SARINE SUPPORT CENTER (Real details & Inquiry Form)
               =============================================================== */}
            {activeSection === 'support' && (
              <SupportSection
                userEmail={currentUser.email}
                orders={orders}
                onNavigateToFaqs={() => handleSelectSection('faqs')}
              />
            )}

            {/* ===============================================================
                7. HOW TO EARN REWARDS
               =============================================================== */}
            {activeSection === 'how-to-earn' && (
              <RewardsEarnSection userId={currentUser.uid} userEmail={currentUser.email} />
            )}

            {/* ===============================================================
                8. HOW TO REDEEM POINTS
               =============================================================== */}
            {activeSection === 'how-to-redeem' && <RewardsRedeemSection />}

            {/* ===============================================================
                9. FAQS (Categorized & Searchable)
               =============================================================== */}
            {activeSection === 'faqs' && <FaqsSection />}

            {/* ===============================================================
                10. PRIVACY POLICY
               =============================================================== */}
            {activeSection === 'privacy' && <PrivacySection />}

            {/* ===============================================================
                11. PROFILE & PREFERENCES
               =============================================================== */}
            {activeSection === 'profile' && <ProfileSection currentUser={currentUser} />}
          </div>
        </div>
      </div>

      {/* Full Order Details Modal */}
      <OrderDetailsModal
        order={selectedOrder}
        isOpen={Boolean(selectedOrder)}
        onClose={() => setSelectedOrder(null)}
        onCancelOrder={handleCancelOrder}
        onReturnOrder={handleReturnOrder}
      />

      {/* Logout Confirmation Dialog */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 bg-[#302438]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E7DCEB] rounded-xs shadow-2xl p-6 max-w-sm w-full space-y-4 animate-fadeIn">
            <h3 className="font-serif text-lg text-[#302438]">Confirm Sign Out</h3>
            <p className="text-xs text-[#6F6475] leading-relaxed">
              Are you sure you want to sign out from your SARINE customer account? Your cart and saved pieces remain securely stored.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="min-h-[44px] px-4 py-2 border border-[#E7DCEB] text-xs text-[#6F6475] hover:text-[#302438] rounded-xs cursor-pointer"
              >
                Stay Signed In
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                className="min-h-[44px] px-4 py-2 bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-medium rounded-xs transition-colors cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
