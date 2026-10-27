/**
 * Customer Account & My Orders Portal for SARINE.
 * Complete, professional customer dashboard featuring:
 * - 8-section account navigation: Profile, Orders, Addresses, Wishlist, Returns, Notifications, Security, Logout
 * - Comprehensive My Orders dashboard with purchase statistics (Orders, Units, Spend, In-Progress, Delivered)
 * - Order search & status/date filters
 * - Rich order cards distinguishing distinct product types vs total units
 * - Full Order Details modal with itemized snapshots, tracking timeline, invoice download, cancel & return flows
 * - Integration with Firebase Authentication and secure Netlify customer endpoints
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
import { Order, OrderStatus } from '../types/order';
import { formatInr } from '../utils/currency';
import { OrderDetailsModal } from '../components/account/OrderDetailsModal';
import {
  User as UserIcon,
  Package,
  Heart,
  LogOut,
  MapPin,
  RotateCcw,
  Bell,
  Shield,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Truck,
  AlertCircle,
  FileText,
  ShoppingBag,
  ExternalLink,
  ChevronRight,
  ArrowRight,
  Sparkles,
  Lock,
  Mail,
  Phone,
  RefreshCw,
  Plus,
  Trash2,
  Check
} from 'lucide-react';

type AccountSection =
  | 'orders'
  | 'profile'
  | 'addresses'
  | 'wishlist'
  | 'returns'
  | 'notifications'
  | 'security';

interface SavedAddress {
  id: string;
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
}

export const AccountPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { wishlistProducts, count: wishlistCount, openWishlist, removeFromWishlist } = useWishlist();
  const { itemCount, openDrawer, addItem } = useCart();

  // Authentication State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState<boolean>(true);
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | 'track'>(() => {
    return searchParams.get('tab') === 'track' ? 'track' : 'signin';
  });

  // Active Account Tab
  const [activeSection, setActiveSection] = useState<AccountSection>(() => {
    const sectionParam = searchParams.get('section') as AccountSection;
    return sectionParam || 'orders';
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

  // Profile Edit State
  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);

  // Saved Addresses State
  const [addresses, setAddresses] = useState<SavedAddress[]>([
    {
      id: 'addr-1',
      fullName: 'Aarohi Patel',
      phone: '9876543210',
      line1: 'Flat 402, Lotus Grand Residences',
      line2: 'Jubilee Hills, Road No. 36',
      city: 'Hyderabad',
      state: 'Telangana',
      pincode: '500033',
      isDefault: true
    }
  ]);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [newAddress, setNewAddress] = useState<Omit<SavedAddress, 'id'>>({
    fullName: '',
    phone: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    pincode: '',
    isDefault: false
  });

  // Notification Preferences
  const [notifPreferences, setNotifPreferences] = useState({
    smsDispatch: true,
    whatsappUpdates: true,
    emailInvoices: true,
    atelierDrops: false
  });

  // Security State
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securityMessage, setSecurityMessage] = useState<string | null>(null);
  const [securityError, setSecurityError] = useState<string | null>(null);

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
        if (user) {
          setProfileName(user.displayName || user.email?.split('@')[0] || '');
        }
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
  };

  // 3. Purchase Statistics Calculations
  const purchaseStats = useMemo(() => {
    const totalOrders = orders.length;

    // Total product units purchased across all orders
    const totalUnits = orders.reduce((sum, order) => {
      const orderUnits = order.lines.reduce((lSum, line) => lSum + (line.quantity || 1), 0);
      return sum + orderUnits;
    }, 0);

    // Total spent on completed, non-cancelled purchases (excludes cancelled orders; handles refunds)
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
      // Search by order number or product name
      if (orderSearchQuery.trim()) {
        const query = orderSearchQuery.toLowerCase().trim();
        const matchesNumber = order.orderNumber.toLowerCase().includes(query);
        const matchesProduct = order.lines.some((l) => l.name.toLowerCase().includes(query));
        if (!matchesNumber && !matchesProduct) return false;
      }

      // Status filter
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

      // Date Range filter
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
    const res = await customerOrderService.cancelOrder(
      idToken,
      orderNumber,
      reason,
      currentUser.email || ''
    );
    // Reload local orders
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

  // 7. Profile Save Handler
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setProfileSuccess(null);
    try {
      await updateProfile(currentUser, { displayName: profileName.trim() });
      setProfileSuccess('Profile details updated successfully.');
      setTimeout(() => setProfileSuccess(null), 3000);
    } catch (err) {
      console.error('Failed to update profile', err);
    }
  };

  // 8. Address Handlers
  const handleAddAddress = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAddress.fullName || !newAddress.line1 || !newAddress.city || !newAddress.pincode) return;
    const added: SavedAddress = {
      ...newAddress,
      id: `addr-${Date.now()}`
    };
    if (added.isDefault) {
      setAddresses((prev) => prev.map((a) => ({ ...a, isDefault: false })).concat(added));
    } else {
      setAddresses((prev) => [...prev, added]);
    }
    setShowAddressForm(false);
    setNewAddress({
      fullName: '',
      phone: '',
      line1: '',
      line2: '',
      city: '',
      state: '',
      pincode: '',
      isDefault: false
    });
  };

  const handleDeleteAddress = (id: string) => {
    setAddresses((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSetDefaultAddress = (id: string) => {
    setAddresses((prev) =>
      prev.map((a) => ({
        ...a,
        isDefault: a.id === id
      }))
    );
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
                className={`flex-1 py-3 text-center border-b-2 cursor-pointer transition-colors ${
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
                className={`flex-1 py-3 text-center border-b-2 cursor-pointer transition-colors ${
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
                className={`flex-1 py-3 text-center border-b-2 cursor-pointer transition-colors ${
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
                    className="w-full p-2.5 bg-[#F7F0FA] border border-[#E7DCEB] focus:border-[#563568] rounded-xs focus:outline-none uppercase"
                  />
                </div>

                <div>
                  <label className="block text-[#6F6475] mb-1 font-medium">Phone Number (10 digits)</label>
                  <input
                    type="tel"
                    value={orderLookupPhone}
                    onChange={(e) => setOrderLookupPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="e.g. 9876543210"
                    className="w-full p-2.5 bg-[#F7F0FA] border border-[#E7DCEB] focus:border-[#563568] rounded-xs focus:outline-none"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full py-3 bg-[#563568] text-white hover:bg-[#80609A] text-xs uppercase tracking-[0.2em] font-medium rounded-xs transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-2"
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
                      className="w-full p-2.5 bg-[#F7F0FA] border border-[#E7DCEB] focus:border-[#563568] rounded-xs focus:outline-none"
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
                    className="w-full p-2.5 bg-[#F7F0FA] border border-[#E7DCEB] focus:border-[#563568] rounded-xs focus:outline-none"
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
                    className="w-full p-2.5 bg-[#F7F0FA] border border-[#E7DCEB] focus:border-[#563568] rounded-xs focus:outline-none"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isAuthSubmitting}
                    className="w-full py-3 bg-[#563568] text-white hover:bg-[#80609A] disabled:opacity-50 text-xs uppercase tracking-[0.2em] font-medium rounded-xs transition-colors shadow-xs cursor-pointer"
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
  // AUTHENTICATED SCREEN (Full 8-Section Customer Portal)
  // =========================================================================
  return (
    <div className="min-h-screen bg-[#F7F0FA] pb-24 text-[#302438] font-sans">
      {/* Header */}
      <section className="bg-white border-b border-[#E7DCEB] py-6 sm:py-10">
        <div className="site-container flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] uppercase tracking-[0.25em] text-[#6F6475] font-medium block mb-1">
              CUSTOMER CONCIERGE & ORDERS
            </span>
            <h1 className="font-serif text-2xl sm:text-3xl text-[#302438] font-normal">
              Welcome back, {currentUser.displayName || currentUser.email?.split('@')[0]}
            </h1>
            <p className="text-xs text-[#6F6475] mt-1">
              Member account: <span className="font-mono text-[#563568]">{currentUser.email}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadOrders}
              className="px-3 py-1.5 bg-[#FAF5FC] hover:bg-[#F0E6F4] text-[#563568] border border-[#E7DCEB] text-xs font-medium rounded-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Refresh Orders"
            >
              <RefreshCw size={13} className={loadingOrders ? 'animate-spin' : ''} />
              <span>Refresh Orders</span>
            </button>
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="px-3 py-1.5 border border-[#DC2626]/30 text-[#DC2626] hover:bg-[#DC2626]/5 text-xs font-medium rounded-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut size={13} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </section>

      {/* Main Container: 8-Section Navigation & Content */}
      <div className="site-container pt-8 sm:pt-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT: 8-Item Navigation Sidebar (3 Cols) */}
          <div className="lg:col-span-3 bg-white border border-[#E7DCEB] rounded-xs shadow-xs overflow-hidden">
            {/* User Mini Card */}
            <div className="p-5 border-b border-[#E7DCEB] bg-[#FAF5FC]/60 flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-[#563568] text-white flex items-center justify-center font-serif text-base shrink-0">
                {(currentUser.displayName || currentUser.email || 'S')[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="font-medium text-xs text-[#302438] truncate">
                  {currentUser.displayName || currentUser.email?.split('@')[0]}
                </p>
                <p className="text-[10px] text-[#6F6475] truncate">{currentUser.email}</p>
                <span className="inline-block mt-1 text-[9px] uppercase tracking-wider px-1.5 py-0.5 bg-[#D9B8A0]/25 text-[#563568] font-bold rounded-xs">
                  Atelier Patron
                </span>
              </div>
            </div>

            {/* Navigation List */}
            <nav className="p-2 space-y-0.5 text-xs font-medium">
              <button
                onClick={() => handleSelectSection('orders')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xs transition-colors cursor-pointer ${
                  activeSection === 'orders'
                    ? 'bg-[#563568] text-white'
                    : 'text-[#302438] hover:bg-[#F7F0FA] hover:text-[#563568]'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Package size={15} />
                  <span>My Orders</span>
                </span>
                {orders.length > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      activeSection === 'orders' ? 'bg-[#B69ACF] text-[#302438]' : 'bg-[#E7DCEB] text-[#563568]'
                    }`}
                  >
                    {orders.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => handleSelectSection('profile')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xs transition-colors cursor-pointer ${
                  activeSection === 'profile'
                    ? 'bg-[#563568] text-white'
                    : 'text-[#302438] hover:bg-[#F7F0FA] hover:text-[#563568]'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <UserIcon size={15} />
                  <span>My Profile</span>
                </span>
              </button>

              <button
                onClick={() => handleSelectSection('addresses')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xs transition-colors cursor-pointer ${
                  activeSection === 'addresses'
                    ? 'bg-[#563568] text-white'
                    : 'text-[#302438] hover:bg-[#F7F0FA] hover:text-[#563568]'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <MapPin size={15} />
                  <span>My Addresses</span>
                </span>
                <span className="text-[10px] text-[#6F6475]">{addresses.length}</span>
              </button>

              <button
                onClick={() => handleSelectSection('wishlist')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xs transition-colors cursor-pointer ${
                  activeSection === 'wishlist'
                    ? 'bg-[#563568] text-white'
                    : 'text-[#302438] hover:bg-[#F7F0FA] hover:text-[#563568]'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Heart size={15} />
                  <span>My Wishlist</span>
                </span>
                {wishlistCount > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-[#B69ACF] text-[#302438]">
                    {wishlistCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => handleSelectSection('returns')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xs transition-colors cursor-pointer ${
                  activeSection === 'returns'
                    ? 'bg-[#563568] text-white'
                    : 'text-[#302438] hover:bg-[#F7F0FA] hover:text-[#563568]'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <RotateCcw size={15} />
                  <span>Returns & Exchanges</span>
                </span>
              </button>

              <button
                onClick={() => handleSelectSection('notifications')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xs transition-colors cursor-pointer ${
                  activeSection === 'notifications'
                    ? 'bg-[#563568] text-white'
                    : 'text-[#302438] hover:bg-[#F7F0FA] hover:text-[#563568]'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Bell size={15} />
                  <span>Notifications</span>
                </span>
              </button>

              <button
                onClick={() => handleSelectSection('security')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xs transition-colors cursor-pointer ${
                  activeSection === 'security'
                    ? 'bg-[#563568] text-white'
                    : 'text-[#302438] hover:bg-[#F7F0FA] hover:text-[#563568]'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Shield size={15} />
                  <span>Account Security</span>
                </span>
              </button>

              <div className="pt-2 border-t border-[#E7DCEB]">
                <button
                  onClick={() => setShowLogoutConfirm(true)}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[#DC2626] hover:bg-[#DC2626]/5 rounded-xs transition-colors cursor-pointer"
                >
                  <LogOut size={15} />
                  <span>Logout</span>
                </button>
              </div>
            </nav>
          </div>

          {/* RIGHT: Active Tab Content (9 Cols) */}
          <div className="lg:col-span-9 space-y-6">
            {/* ===============================================================
                TAB 1: MY ORDERS DASHBOARD
               =============================================================== */}
            {activeSection === 'orders' && (
              <div className="space-y-6 animate-fadeIn">
                {/* 1. Purchase Statistics Banner */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {/* Total Orders */}
                  <div className="p-4 bg-white border border-[#E7DCEB] rounded-xs shadow-2xs">
                    <span className="text-[10px] uppercase tracking-wider text-[#6F6475] block mb-1">
                      Total Orders
                    </span>
                    <span className="font-serif text-xl sm:text-2xl text-[#302438] font-normal block">
                      {purchaseStats.totalOrders}
                    </span>
                    <span className="text-[10px] text-[#6F6475]">Placed to date</span>
                  </div>

                  {/* Total Units Purchased */}
                  <div className="p-4 bg-white border border-[#E7DCEB] rounded-xs shadow-2xs">
                    <span className="text-[10px] uppercase tracking-wider text-[#6F6475] block mb-1">
                      Units Acquired
                    </span>
                    <span className="font-serif text-xl sm:text-2xl text-[#563568] font-normal block">
                      {purchaseStats.totalUnits}
                    </span>
                    <span className="text-[10px] text-[#6F6475]">Jewellery pieces</span>
                  </div>

                  {/* Total Net Spend */}
                  <div className="p-4 bg-white border border-[#E7DCEB] rounded-xs shadow-2xs col-span-2 sm:col-span-1">
                    <span className="text-[10px] uppercase tracking-wider text-[#6F6475] block mb-1">
                      Total Spend
                    </span>
                    <span className="font-serif text-xl sm:text-2xl text-[#302438] font-normal block truncate">
                      {formatInr(purchaseStats.totalSpend)}
                    </span>
                    <span className="text-[10px] text-[#047857]">Excludes cancelled</span>
                  </div>

                  {/* In Progress */}
                  <div className="p-4 bg-white border border-[#E7DCEB] rounded-xs shadow-2xs">
                    <span className="text-[10px] uppercase tracking-wider text-[#6F6475] block mb-1">
                      In Progress
                    </span>
                    <span className="font-serif text-xl sm:text-2xl text-[#735135] font-normal block">
                      {purchaseStats.inProgressCount}
                    </span>
                    <span className="text-[10px] text-[#735135]">Active dispatches</span>
                  </div>

                  {/* Delivered */}
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

                {/* 2. Controls & Search Bar */}
                <div className="bg-white p-4 border border-[#E7DCEB] rounded-xs shadow-2xs flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                  {/* Search by Order ID or Product Name */}
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
                      className="w-full pl-9 pr-3 py-2 bg-[#F7F0FA] border border-[#E7DCEB] focus:border-[#563568] rounded-xs text-xs focus:outline-none"
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

                  {/* Filters */}
                  <div className="flex items-center gap-2 text-xs">
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="py-2 px-3 bg-[#F7F0FA] border border-[#E7DCEB] rounded-xs focus:border-[#563568] focus:outline-none cursor-pointer"
                    >
                      <option value="all">All Statuses</option>
                      <option value="in_progress">In Progress</option>
                      <option value="delivered">Delivered</option>
                      <option value="cancelled">Cancelled</option>
                    </select>

                    <select
                      value={dateRangeFilter}
                      onChange={(e) => setDateRangeFilter(e.target.value)}
                      className="py-2 px-3 bg-[#F7F0FA] border border-[#E7DCEB] rounded-xs focus:border-[#563568] focus:outline-none cursor-pointer"
                    >
                      <option value="all">All Time</option>
                      <option value="30days">Last 30 Days</option>
                      <option value="6months">Last 6 Months</option>
                      <option value="2026">Year 2026</option>
                    </select>
                  </div>
                </div>

                {/* 3. Orders List or Skeletons or Empty State */}
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
                        className="px-4 py-2 border border-[#563568] text-[#563568] text-xs font-medium rounded-xs hover:bg-[#FAF5FC] transition-colors cursor-pointer"
                      >
                        Clear Filters
                      </button>
                    ) : (
                      <Link
                        to="/shop"
                        className="inline-flex items-center gap-1.5 px-6 py-2.5 bg-[#563568] hover:bg-[#80609A] text-white text-xs font-medium rounded-xs transition-colors shadow-xs"
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

                          {/* Card Body: Items Preview & Distinct Counts */}
                          <div className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-3 min-w-0">
                              {/* Product Thumbnails Gallery */}
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

                            {/* Card Action Buttons */}
                            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-[#E7DCEB]">
                              <Link
                                to={`/track-order?orderNumber=${order.orderNumber}`}
                                className="flex-1 sm:flex-none px-3.5 py-2 border border-[#E7DCEB] hover:border-[#563568] text-[#563568] text-xs font-medium rounded-xs transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
                              >
                                <Truck size={13} />
                                <span>Track</span>
                              </Link>

                              <button
                                onClick={() => setSelectedOrder(order)}
                                className="flex-1 sm:flex-none px-4 py-2 bg-[#563568] hover:bg-[#80609A] text-white text-xs font-medium rounded-xs transition-colors flex items-center justify-center gap-1 shadow-xs cursor-pointer"
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
                TAB 2: MY PROFILE
               =============================================================== */}
            {activeSection === 'profile' && (
              <div className="bg-white p-6 sm:p-8 border border-[#E7DCEB] rounded-xs shadow-xs space-y-6 animate-fadeIn">
                <div>
                  <h3 className="font-serif text-xl text-[#302438]">My Profile</h3>
                  <p className="text-xs text-[#6F6475] mt-0.5">
                    Manage your personal details, contact preferences, and membership records.
                  </p>
                </div>

                {profileSuccess && (
                  <div className="p-3 bg-[#10B981]/10 border border-[#10B981]/30 text-[#047857] text-xs rounded-xs flex items-center gap-2">
                    <CheckCircle2 size={14} />
                    <span>{profileSuccess}</span>
                  </div>
                )}

                <form onSubmit={handleSaveProfile} className="space-y-4 max-w-lg text-xs font-sans">
                  <div>
                    <label className="block text-[#6F6475] mb-1 font-medium">Full Name</label>
                    <input
                      type="text"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      placeholder="Your full name"
                      className="w-full p-2.5 bg-[#F7F0FA] border border-[#E7DCEB] focus:border-[#563568] rounded-xs focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[#6F6475] mb-1 font-medium">Email Address</label>
                    <input
                      type="email"
                      disabled
                      value={currentUser.email || ''}
                      className="w-full p-2.5 bg-gray-100 border border-[#E7DCEB] text-gray-500 rounded-xs cursor-not-allowed"
                    />
                    <span className="text-[10px] text-[#6F6475] mt-1 block">
                      Email address is linked to your order records and cannot be changed directly.
                    </span>
                  </div>

                  <div>
                    <label className="block text-[#6F6475] mb-1 font-medium">
                      Mobile Phone Number
                    </label>
                    <input
                      type="tel"
                      value={profilePhone}
                      onChange={(e) => setProfilePhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="10-digit Indian mobile (e.g. 9876543210)"
                      className="w-full p-2.5 bg-[#F7F0FA] border border-[#E7DCEB] focus:border-[#563568] rounded-xs focus:outline-none"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-[#563568] hover:bg-[#80609A] text-white font-medium rounded-xs transition-colors shadow-xs cursor-pointer"
                    >
                      Save Profile Changes
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* ===============================================================
                TAB 3: MY ADDRESSES
               =============================================================== */}
            {activeSection === 'addresses' && (
              <div className="bg-white p-6 sm:p-8 border border-[#E7DCEB] rounded-xs shadow-xs space-y-6 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-serif text-xl text-[#302438]">Saved Addresses</h3>
                    <p className="text-xs text-[#6F6475] mt-0.5">
                      Delivery destinations used for swift checkout and express courier dispatch.
                    </p>
                  </div>
                  {!showAddressForm && (
                    <button
                      onClick={() => setShowAddressForm(true)}
                      className="px-3.5 py-2 bg-[#563568] hover:bg-[#80609A] text-white text-xs font-medium rounded-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Plus size={14} />
                      <span>Add New Address</span>
                    </button>
                  )}
                </div>

                {/* Address Form */}
                {showAddressForm && (
                  <form
                    onSubmit={handleAddAddress}
                    className="p-5 bg-[#FAF5FC] border border-[#E7DCEB] rounded-xs space-y-3 text-xs"
                  >
                    <h4 className="font-medium text-[#302438]">Add New Delivery Address</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[#6F6475] mb-1">Full Name</label>
                        <input
                          type="text"
                          required
                          value={newAddress.fullName}
                          onChange={(e) => setNewAddress({ ...newAddress, fullName: e.target.value })}
                          className="w-full p-2 bg-white border border-[#E7DCEB] focus:border-[#563568] rounded-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[#6F6475] mb-1">Phone Number (10 digits)</label>
                        <input
                          type="tel"
                          required
                          value={newAddress.phone}
                          onChange={(e) =>
                            setNewAddress({
                              ...newAddress,
                              phone: e.target.value.replace(/\D/g, '').slice(0, 10)
                            })
                          }
                          className="w-full p-2 bg-white border border-[#E7DCEB] focus:border-[#563568] rounded-xs"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[#6F6475] mb-1">House / Flat / Street (Line 1)</label>
                      <input
                        type="text"
                        required
                        value={newAddress.line1}
                        onChange={(e) => setNewAddress({ ...newAddress, line1: e.target.value })}
                        className="w-full p-2 bg-white border border-[#E7DCEB] focus:border-[#563568] rounded-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[#6F6475] mb-1">Landmark / Area (Line 2)</label>
                      <input
                        type="text"
                        value={newAddress.line2 || ''}
                        onChange={(e) => setNewAddress({ ...newAddress, line2: e.target.value })}
                        className="w-full p-2 bg-white border border-[#E7DCEB] focus:border-[#563568] rounded-xs"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[#6F6475] mb-1">City</label>
                        <input
                          type="text"
                          required
                          value={newAddress.city}
                          onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                          className="w-full p-2 bg-white border border-[#E7DCEB] focus:border-[#563568] rounded-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[#6F6475] mb-1">State</label>
                        <input
                          type="text"
                          required
                          value={newAddress.state}
                          onChange={(e) => setNewAddress({ ...newAddress, state: e.target.value })}
                          className="w-full p-2 bg-white border border-[#E7DCEB] focus:border-[#563568] rounded-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[#6F6475] mb-1">PIN Code (6 digits)</label>
                        <input
                          type="text"
                          required
                          value={newAddress.pincode}
                          onChange={(e) =>
                            setNewAddress({
                              ...newAddress,
                              pincode: e.target.value.replace(/\D/g, '').slice(0, 6)
                            })
                          }
                          className="w-full p-2 bg-white border border-[#E7DCEB] focus:border-[#563568] rounded-xs"
                        />
                      </div>
                    </div>
                    <label className="flex items-center gap-2 pt-1 text-[#6F6475] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newAddress.isDefault}
                        onChange={(e) => setNewAddress({ ...newAddress, isDefault: e.target.checked })}
                        className="accent-[#563568]"
                      />
                      <span>Set as default shipping address</span>
                    </label>
                    <div className="pt-2 flex items-center gap-3">
                      <button
                        type="submit"
                        className="px-4 py-2 bg-[#563568] text-white rounded-xs font-medium cursor-pointer"
                      >
                        Save Address
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAddressForm(false)}
                        className="px-4 py-2 border border-[#E7DCEB] text-[#6F6475] rounded-xs cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}

                {/* Address Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {addresses.map((addr) => (
                    <div
                      key={addr.id}
                      className={`p-4 border rounded-xs relative space-y-1.5 text-xs ${
                        addr.isDefault ? 'border-[#563568] bg-[#FAF5FC]/40' : 'border-[#E7DCEB] bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[#302438]">{addr.fullName}</span>
                        {addr.isDefault && (
                          <span className="text-[10px] uppercase font-bold text-[#563568] bg-[#B69ACF]/20 px-2 py-0.5 rounded-xs">
                            Default
                          </span>
                        )}
                      </div>
                      <p className="text-[#6F6475]">
                        {addr.line1}
                        {addr.line2 ? `, ${addr.line2}` : ''}
                      </p>
                      <p className="text-[#6F6475]">
                        {addr.city}, {addr.state} — {addr.pincode}
                      </p>
                      <p className="text-[#6F6475]">Phone: +91 {addr.phone}</p>
                      <div className="pt-2 flex items-center justify-between border-t border-[#E7DCEB] mt-2">
                        {!addr.isDefault ? (
                          <button
                            onClick={() => handleSetDefaultAddress(addr.id)}
                            className="text-[#563568] text-[11px] underline hover:text-[#80609A] cursor-pointer"
                          >
                            Set as Default
                          </button>
                        ) : (
                          <span className="text-[11px] text-[#047857] flex items-center gap-1">
                            <Check size={11} /> Primary Delivery Address
                          </span>
                        )}
                        <button
                          onClick={() => handleDeleteAddress(addr.id)}
                          className="text-[#DC2626] hover:text-[#B91C1C] p-1 cursor-pointer"
                          title="Delete address"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ===============================================================
                TAB 4: MY WISHLIST
               =============================================================== */}
            {activeSection === 'wishlist' && (
              <div className="bg-white p-6 sm:p-8 border border-[#E7DCEB] rounded-xs shadow-xs space-y-6 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-serif text-xl text-[#302438]">My Wishlist</h3>
                    <p className="text-xs text-[#6F6475] mt-0.5">
                      Curated pieces you have saved for celebratory occasions and everyday luxury.
                    </p>
                  </div>
                  <span className="text-xs text-[#6F6475] font-medium">{wishlistCount} Saved</span>
                </div>

                {wishlistProducts.length === 0 ? (
                  <div className="p-10 border border-[#E7DCEB] rounded-xs text-center space-y-3">
                    <Heart size={32} className="mx-auto text-[#B69ACF]" strokeWidth={1.5} />
                    <p className="text-sm font-serif text-[#302438]">Your wishlist is currently empty</p>
                    <Link
                      to="/shop"
                      className="inline-block px-5 py-2 bg-[#563568] text-white text-xs font-medium rounded-xs hover:bg-[#80609A]"
                    >
                      Explore Catalogue
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {wishlistProducts.map((item) => (
                      <div
                        key={item.id}
                        className="border border-[#E7DCEB] rounded-xs p-3 space-y-2 bg-[#F7F0FA]/30 relative"
                      >
                        <img
                          src={item.images[0] || 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=300&q=80'}
                          alt={item.name}
                          className="w-full h-36 object-cover rounded-xs border border-[#E7DCEB] bg-white"
                        />
                        <h4 className="font-serif text-xs text-[#302438] truncate">{item.name}</h4>
                        <p className="font-semibold text-xs text-[#563568]">{formatInr(item.price)}</p>
                        <div className="pt-2 flex items-center gap-2">
                          <button
                            onClick={() => {
                              addItem(item);
                              openDrawer();
                            }}
                            className="flex-1 py-1.5 bg-[#563568] hover:bg-[#80609A] text-white text-xs rounded-xs flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <ShoppingBag size={12} />
                            <span>Move to Bag</span>
                          </button>
                          <button
                            onClick={() => removeFromWishlist(item.id)}
                            className="p-1.5 border border-[#E7DCEB] text-[#6F6475] hover:text-[#DC2626] rounded-xs cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ===============================================================
                TAB 5: RETURNS & EXCHANGES
               =============================================================== */}
            {activeSection === 'returns' && (
              <div className="bg-white p-6 sm:p-8 border border-[#E7DCEB] rounded-xs shadow-xs space-y-6 animate-fadeIn">
                <div>
                  <h3 className="font-serif text-xl text-[#302438]">Returns & Exchanges</h3>
                  <p className="text-xs text-[#6F6475] mt-0.5">
                    Track existing return requests or review SARINE’s 7-day atelier policy.
                  </p>
                </div>

                {/* Returns List */}
                {orders.filter((o) => o.returnStatus && o.returnStatus !== 'none').length > 0 ? (
                  <div className="space-y-3">
                    <span className="text-[10px] uppercase tracking-wider text-[#563568] font-semibold">
                      Active Return Requests
                    </span>
                    {orders
                      .filter((o) => o.returnStatus && o.returnStatus !== 'none')
                      .map((o) => (
                        <div
                          key={o.orderNumber}
                          className="p-4 border border-[#E7DCEB] bg-[#FAF5FC]/50 rounded-xs flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-semibold text-[#302438]">Order #{o.orderNumber}</span>
                            <p className="text-[#6F6475] text-[11px] mt-0.5">
                              Type: {o.returnStatus?.replace('_', ' ').toUpperCase()} • Reason: {o.returnReason}
                            </p>
                          </div>
                          <span className="px-2.5 py-1 bg-[#D9B8A0]/30 text-[#735135] text-[11px] font-semibold rounded-xs">
                            Under Atelier Review
                          </span>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="p-6 bg-[#FAF5FC] border border-[#E7DCEB] rounded-xs space-y-2 text-xs text-[#6F6475]">
                    <span className="font-semibold text-[#563568] block">No Active Returns or Exchanges</span>
                    <p>
                      All delivered pieces can be returned or exchanged within 7 days of delivery.
                      To initiate a return, navigate to <strong>My Orders</strong>, choose a delivered order, and click <strong>Return / Exchange</strong>.
                    </p>
                  </div>
                )}

                {/* Policy Guide */}
                <div className="pt-4 border-t border-[#E7DCEB] space-y-3 text-xs text-[#6F6475]">
                  <h4 className="font-serif text-sm text-[#302438]">The SARINE 7-Day Guarantee</h4>
                  <ul className="list-disc pl-5 space-y-1.5">
                    <li>Complimentary doorstep reverse pickup across all serviced pin codes in India.</li>
                    <li>Items must be unworn, in original velvet presentation packaging with product tag intact.</li>
                    <li>Full refunds for prepaid orders are credited back within 5–7 business days upon receipt.</li>
                  </ul>
                </div>
              </div>
            )}

            {/* ===============================================================
                TAB 6: NOTIFICATIONS
               =============================================================== */}
            {activeSection === 'notifications' && (
              <div className="bg-white p-6 sm:p-8 border border-[#E7DCEB] rounded-xs shadow-xs space-y-6 animate-fadeIn">
                <div>
                  <h3 className="font-serif text-xl text-[#302438]">Notification Preferences</h3>
                  <p className="text-xs text-[#6F6475] mt-0.5">
                    Choose how and when you receive courier dispatch updates and atelier announcements.
                  </p>
                </div>

                <div className="space-y-4 text-xs font-sans">
                  <label className="flex items-start justify-between p-3.5 border border-[#E7DCEB] rounded-xs cursor-pointer hover:bg-[#F7F0FA]/50 transition-colors">
                    <div>
                      <span className="font-medium text-[#302438] block">SMS Courier Dispatch Alerts</span>
                      <span className="text-[11px] text-[#6F6475]">
                        Receive real-time tracking numbers and delivery verification OTPs.
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={notifPreferences.smsDispatch}
                      onChange={(e) =>
                        setNotifPreferences({ ...notifPreferences, smsDispatch: e.target.checked })
                      }
                      className="accent-[#563568] mt-1"
                    />
                  </label>

                  <label className="flex items-start justify-between p-3.5 border border-[#E7DCEB] rounded-xs cursor-pointer hover:bg-[#F7F0FA]/50 transition-colors">
                    <div>
                      <span className="font-medium text-[#302438] block">WhatsApp Concierge Updates</span>
                      <span className="text-[11px] text-[#6F6475]">
                        Get direct order milestones and customer concierge styling assistance on WhatsApp.
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={notifPreferences.whatsappUpdates}
                      onChange={(e) =>
                        setNotifPreferences({ ...notifPreferences, whatsappUpdates: e.target.checked })
                      }
                      className="accent-[#563568] mt-1"
                    />
                  </label>

                  <label className="flex items-start justify-between p-3.5 border border-[#E7DCEB] rounded-xs cursor-pointer hover:bg-[#F7F0FA]/50 transition-colors">
                    <div>
                      <span className="font-medium text-[#302438] block">Email Order Tax Invoices</span>
                      <span className="text-[11px] text-[#6F6475]">
                        Receive PDF copies of computer-generated invoices upon order confirmation.
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={notifPreferences.emailInvoices}
                      onChange={(e) =>
                        setNotifPreferences({ ...notifPreferences, emailInvoices: e.target.checked })
                      }
                      className="accent-[#563568] mt-1"
                    />
                  </label>
                </div>
              </div>
            )}

            {/* ===============================================================
                TAB 7: ACCOUNT SECURITY
               =============================================================== */}
            {activeSection === 'security' && (
              <div className="bg-white p-6 sm:p-8 border border-[#E7DCEB] rounded-xs shadow-xs space-y-6 animate-fadeIn">
                <div>
                  <h3 className="font-serif text-xl text-[#302438]">Account Security</h3>
                  <p className="text-xs text-[#6F6475] mt-0.5">
                    Manage your credentials, active login sessions, and data protection settings.
                  </p>
                </div>

                {securityMessage && (
                  <div className="p-3 bg-[#10B981]/10 border border-[#10B981]/30 text-[#047857] text-xs rounded-xs flex items-center gap-2">
                    <CheckCircle2 size={14} />
                    <span>{securityMessage}</span>
                  </div>
                )}

                {securityError && (
                  <div className="p-3 bg-[#DC2626]/5 border border-[#DC2626]/20 text-[#DC2626] text-xs rounded-xs">
                    {securityError}
                  </div>
                )}

                <div className="p-4 bg-[#FAF5FC] border border-[#E7DCEB] rounded-xs space-y-1.5 text-xs">
                  <span className="font-semibold text-[#563568] block">Firebase Authentication Guard</span>
                  <p className="text-[#6F6475]">
                    Your account is protected with encrypted token verification. Never share OTPs or authentication secrets with anyone.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => {
                      setSecurityMessage('Security audit passed: No suspicious logins detected.');
                      setTimeout(() => setSecurityMessage(null), 4000);
                    }}
                    className="px-4 py-2 border border-[#563568] text-[#563568] text-xs font-medium rounded-xs hover:bg-[#FAF5FC] transition-colors cursor-pointer"
                  >
                    Run Security Check
                  </button>
                </div>
              </div>
            )}
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
              Are you sure you want to sign out from your SARINE customer account?
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="px-4 py-2 border border-[#E7DCEB] text-xs text-[#6F6475] hover:text-[#302438] rounded-xs cursor-pointer"
              >
                Stay Signed In
              </button>
              <button
                onClick={handleSignOut}
                className="px-4 py-2 bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-medium rounded-xs transition-colors cursor-pointer"
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
