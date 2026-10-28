/**
 * AdminOrdersPage for SARINE.
 * Private administration console for managing orders, updating fulfillment states,
 * inspecting customer information, recording tracking details, and managing cancellations.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut, onAuthStateChanged, User } from 'firebase/auth';
import { getFirebaseAuth, isFirebaseConfigured } from '../../lib/firebase';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { formatInr } from '../../utils/currency';
import { getApiEndpoint } from '../../config/api';
import {
  Package,
  Search,
  Filter,
  RefreshCw,
  Truck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Phone,
  Mail,
  MapPin,
  Clock,
  CreditCard,
  X,
  FileText,
  AlertTriangle
} from 'lucide-react';

interface OrderLine {
  productId: string;
  name: string;
  image?: string;
  quantity: number;
  unitPrice: number;
}

interface AdminOrder {
  orderNumber: string;
  createdAt: string;
  customer: {
    name: string;
    email: string;
    phone: string;
  };
  shippingAddress: {
    fullName: string;
    phone: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pincode: string;
  };
  lines: OrderLine[];
  subtotal: number;
  shippingFee: number;
  total: number;
  paymentMethod: string;
  paymentStatus: string;
  orderStatus: string;
  razorpayPaymentId?: string;
  courierName?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  shippedAt?: string;
  deliveredAt?: string;
  adminNote?: string;
  refundNeeded?: boolean;
  cancelledAt?: string;
  updatedAt?: string;
}

export const AdminOrdersPage: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Selected Order for Detail Drawer
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);

  // Action states for selected order
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Shipped Form State
  const [showShipForm, setShowShipForm] = useState(false);
  const [courierName, setCourierName] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');

  // Note State
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // Cancel Confirm State
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const navigate = useNavigate();

  // 1. Monitor Auth State
  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setLoading(false);
      return;
    }
    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, (curr) => {
      if (!curr) {
        navigate('/admin/login', { replace: true });
      } else {
        setUser(curr);
      }
    });
    return () => unsub();
  }, [navigate]);

  // 2. Fetch Orders
  const fetchOrders = useCallback(
    async (isLoadMore = false) => {
      if (!user) return;

      if (isLoadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);
      setAccessDenied(null);

      try {
        const idToken = await user.getIdToken();

        const queryParams = new URLSearchParams();
        if (statusFilter !== 'all') queryParams.set('status', statusFilter);
        if (paymentFilter !== 'all') queryParams.set('paymentStatus', paymentFilter);
        queryParams.set('limit', '50');

        if (isLoadMore && nextCursor) {
          queryParams.set('startAfter', nextCursor);
        }

        const res = await fetch(getApiEndpoint(`admin-list-orders?${queryParams.toString()}`), {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${idToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (res.status === 401 || res.status === 403) {
          const auth = getFirebaseAuth();
          await signOut(auth);
          setAccessDenied('You do not have access.');
          setLoading(false);
          setLoadingMore(false);
          return;
        }

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          setError(data.error || 'Failed to load orders.');
          setLoading(false);
          setLoadingMore(false);
          return;
        }

        const newOrders: AdminOrder[] = data.orders || [];

        if (isLoadMore) {
          setOrders((prev) => [...prev, ...newOrders]);
        } else {
          setOrders(newOrders);
        }

        setNextCursor(data.nextStartAfter || null);
      } catch (err: any) {
        console.error('[AdminOrdersPage] Fetch error:', err);
        setError('Network error: Unable to reach orders server endpoint.');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [user, statusFilter, paymentFilter, nextCursor]
  );

  // Trigger fetch when user is confirmed or server filters change
  useEffect(() => {
    if (user) {
      fetchOrders(false);
    }
  }, [user, statusFilter, paymentFilter]);

  // Reset note text when selected order changes
  useEffect(() => {
    if (selectedOrder) {
      setNoteText(selectedOrder.adminNote || '');
      setActionError(null);
      setActionSuccess(null);
      setShowShipForm(false);
      setShowCancelConfirm(false);
      setCourierName(selectedOrder.courierName || '');
      setTrackingNumber(selectedOrder.trackingNumber || '');
      setTrackingUrl(selectedOrder.trackingUrl || '');
    }
  }, [selectedOrder]);

  // 3. Client-side Search Filtering
  const filteredOrders = useMemo(() => {
    if (!searchTerm.trim()) return orders;
    const term = searchTerm.toLowerCase().trim();
    return orders.filter(
      (o) =>
        o.orderNumber.toLowerCase().includes(term) ||
        o.customer.name.toLowerCase().includes(term) ||
        o.customer.email.toLowerCase().includes(term) ||
        o.customer.phone.includes(term)
    );
  }, [orders, searchTerm]);

  // 4. Order Mutation Actions
  const handleUpdateOrder = async (action: string, extraPayload: Record<string, any> = {}) => {
    if (!selectedOrder || !user) return;

    setActionLoading(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const idToken = await user.getIdToken();
      const res = await fetch(getApiEndpoint('admin-update-order'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          orderNumber: selectedOrder.orderNumber,
          action,
          ...extraPayload
        })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setActionError(data.error || 'Failed to update order.');
        return;
      }

      setActionSuccess('Order updated successfully.');
      setShowShipForm(false);
      setShowCancelConfirm(false);

      // Update local state
      const updatedOrderData: Partial<AdminOrder> = {};
      if (action === 'mark_shipped') {
        updatedOrderData.orderStatus = 'shipped';
        updatedOrderData.shippedAt = data.shippedAt;
        if (extraPayload.courierName) updatedOrderData.courierName = extraPayload.courierName;
        if (extraPayload.trackingNumber) updatedOrderData.trackingNumber = extraPayload.trackingNumber;
        if (extraPayload.trackingUrl) updatedOrderData.trackingUrl = extraPayload.trackingUrl;
      } else if (action === 'mark_delivered') {
        updatedOrderData.orderStatus = 'delivered';
        updatedOrderData.deliveredAt = data.deliveredAt;
        if (selectedOrder.paymentMethod === 'cod') {
          updatedOrderData.paymentStatus = 'paid';
        }
      } else if (action === 'cancel') {
        updatedOrderData.orderStatus = 'cancelled';
        updatedOrderData.cancelledAt = data.cancelledAt;
        if (data.refundNeeded) {
          updatedOrderData.refundNeeded = true;
        }
      } else if (action === 'add_note') {
        updatedOrderData.adminNote = extraPayload.note;
      }

      const merged = { ...selectedOrder, ...updatedOrderData };
      setSelectedOrder(merged);
      setOrders((prev) => prev.map((o) => (o.orderNumber === merged.orderNumber ? merged : o)));
    } catch (err: any) {
      console.error('[AdminOrdersPage] Update error:', err);
      setActionError('Network error while updating order.');
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return '—';
    try {
      return new Date(isoString).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  // Payment Badge Helper
  const renderPaymentBadge = (order: AdminOrder) => {
    const isCod = order.paymentMethod?.toLowerCase() === 'cod';
    const status = order.paymentStatus?.toLowerCase();

    if (isCod && status !== 'paid') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-xs text-[11px] font-medium bg-[#FAF5FC] text-[#563568] border border-[#E7DCEB]">
          COD
        </span>
      );
    }

    if (status === 'paid') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-xs text-[11px] font-medium bg-[#F0FDF4] text-[#15803D] border border-[#DCFCE7]">
          Paid
        </span>
      );
    }

    if (status === 'failed') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-xs text-[11px] font-medium bg-[#FEF2F2] text-[#DC2626] border border-[#FEE2E2]">
          Failed
        </span>
      );
    }

    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-xs text-[11px] font-medium bg-[#FAF5FC] text-[#6F6475] border border-[#E7DCEB]">
        Pending
      </span>
    );
  };

  // Order Status Badge Helper
  const renderStatusBadge = (order: AdminOrder) => {
    const status = order.orderStatus?.toLowerCase();
    const needsRefund = order.refundNeeded || status === 'needs_refund';

    if (needsRefund) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-xs text-[11px] font-semibold bg-[#FFFBEB] text-[#92400E] border-2 border-[#D9B8A0]">
          <AlertTriangle size={12} className="text-[#B45309]" />
          <span>Needs refund</span>
        </span>
      );
    }

    switch (status) {
      case 'confirmed':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-xs text-[11px] font-medium bg-[#F0E6F4] text-[#563568]">
            Confirmed
          </span>
        );
      case 'placed':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-xs text-[11px] font-medium bg-[#FAF5FC] text-[#563568] border border-[#E7DCEB]">
            Placed
          </span>
        );
      case 'shipped':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-xs text-[11px] font-medium bg-[#E0F2FE] text-[#0369A1]">
            Shipped
          </span>
        );
      case 'delivered':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-xs text-[11px] font-medium bg-[#DCFCE7] text-[#15803D]">
            Delivered
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-xs text-[11px] font-medium bg-[#F3F4F6] text-[#6B7280]">
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-xs text-[11px] font-medium bg-[#FAF5FC] text-[#6F6475]">
            Pending
          </span>
        );
    }
  };

  if (accessDenied) {
    return (
      <AdminLayout>
        <div className="max-w-md mx-auto my-12 bg-white p-8 border border-[#E7DCEB] rounded-xs shadow-xs text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-[#FEF2F2] text-[#DC2626] flex items-center justify-center mx-auto">
            <XCircle size={24} />
          </div>
          <h2 className="font-serif text-2xl text-[#302438]">Access Denied</h2>
          <p className="text-xs text-[#6F6475] leading-relaxed">
            {accessDenied} Your email address is not listed in the administrative access directory.
          </p>
          <div className="pt-2">
            <button
              onClick={() => navigate('/admin/login', { replace: true })}
              className="px-6 py-2.5 bg-[#563568] text-white text-xs uppercase tracking-wider font-medium hover:bg-[#A184BD] transition-colors rounded-xs cursor-pointer"
            >
              Back to Sign In
            </button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header Title & Controls Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#E7DCEB]">
          <div>
            <h1 className="font-serif text-3xl sm:text-4xl text-[#302438] font-normal tracking-tight">
              Customer Orders
            </h1>
            <p className="mt-1 text-xs text-[#6F6475]">
              Real-time fulfillment ledger, courier tracking assignment, and order cancellation.
            </p>
          </div>

          <button
            onClick={() => fetchOrders(false)}
            disabled={loading}
            className="self-start sm:self-auto inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-[#E7DCEB] text-xs font-medium text-[#563568] hover:bg-[#FAF5FC] hover:border-[#563568] transition-colors rounded-xs shadow-2xs cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh Ledger</span>
          </button>
        </div>

        {/* Filter Bar */}
        <div className="bg-white p-4 border border-[#E7DCEB] rounded-xs shadow-2xs space-y-3 sm:space-y-0 sm:flex sm:items-center sm:gap-4 sm:justify-between">
          {/* Client-side Search */}
          <div className="relative flex-1 max-w-sm">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by order # or customer..."
              className="w-full pl-9 pr-3 py-2 bg-[#F7F0FA] border border-[#E7DCEB] text-xs text-[#302438] placeholder:text-[#9E90A2] rounded-xs focus:outline-none focus:border-[#B69ACF] focus:ring-1 focus:ring-[#80609A]"
            />
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6F6475]" />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6F6475] hover:text-[#302438]"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Filter Selects */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-[#6F6475]">
              <Filter size={13} />
              <span className="hidden sm:inline">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-[#F7F0FA] border border-[#E7DCEB] text-xs text-[#302438] px-2.5 py-1.5 rounded-xs focus:outline-none focus:border-[#B69ACF]"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="placed">Placed (COD)</option>
                <option value="confirmed">Confirmed (Paid)</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
                <option value="needs_refund">Needs Refund</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-[#6F6475]">
              <span className="hidden sm:inline">Payment:</span>
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="bg-[#F7F0FA] border border-[#E7DCEB] text-xs text-[#302438] px-2.5 py-1.5 rounded-xs focus:outline-none focus:border-[#B69ACF]"
              >
                <option value="all">All Payments</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending / COD</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>
        </div>

        {/* Global Error Notice */}
        {error && (
          <div className="p-4 bg-[#FAF5FC] border border-[#E7DCEB] rounded-xs flex items-start gap-2.5 text-xs text-[#DC2626]">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        {/* Orders Table & Cards */}
        {loading && orders.length === 0 ? (
          <div className="bg-white p-12 border border-[#E7DCEB] rounded-xs text-center space-y-3">
            <div className="w-6 h-6 border-2 border-[#563568] border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-xs text-[#6F6475]">Fetching orders from Firestore ledger...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-white p-12 border border-[#E7DCEB] rounded-xs text-center space-y-2">
            <Package size={28} className="mx-auto text-[#6F6475] stroke-1" />
            <h3 className="font-serif text-lg text-[#302438]">No orders found</h3>
            <p className="text-xs text-[#6F6475] max-w-sm mx-auto">
              {searchTerm || statusFilter !== 'all' || paymentFilter !== 'all'
                ? 'Try adjusting your search query or status filter.'
                : 'Orders placed on the storefront will appear here.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Desktop Table */}
            <div className="hidden md:block bg-white border border-[#E7DCEB] rounded-xs shadow-2xs overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF5FC] border-b border-[#E7DCEB] text-[10px] uppercase tracking-wider text-[#6F6475]">
                  <tr>
                    <th className="py-3 px-4 font-medium">Order Number</th>
                    <th className="py-3 px-4 font-medium">Date</th>
                    <th className="py-3 px-4 font-medium">Customer</th>
                    <th className="py-3 px-4 font-medium">Items</th>
                    <th className="py-3 px-4 font-medium">Total</th>
                    <th className="py-3 px-4 font-medium">Payment</th>
                    <th className="py-3 px-4 font-medium">Status</th>
                    <th className="py-3 px-4 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7DCEB]">
                  {filteredOrders.map((order) => {
                    const isRefundHighlight =
                      order.refundNeeded || order.orderStatus === 'needs_refund';
                    return (
                      <tr
                        key={order.orderNumber}
                        onClick={() => setSelectedOrder(order)}
                        className={`hover:bg-[#FAF5FC] transition-colors cursor-pointer ${
                          isRefundHighlight ? 'bg-[#FFFDF7] ring-1 ring-[#D9B8A0]' : ''
                        }`}
                      >
                        <td className="py-3.5 px-4 font-mono font-medium text-[#563568]">
                          {order.orderNumber}
                        </td>
                        <td className="py-3.5 px-4 text-[#6F6475] whitespace-nowrap">
                          {formatDate(order.createdAt)}
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="font-medium text-[#302438]">{order.customer.name}</p>
                          <p className="text-[11px] text-[#6F6475] truncate max-w-[150px]">
                            {order.customer.email}
                          </p>
                        </td>
                        <td className="py-3.5 px-4 text-[#6F6475]">
                          {order.lines.length} {order.lines.length === 1 ? 'piece' : 'pieces'}
                        </td>
                        <td className="py-3.5 px-4 font-serif text-sm text-[#302438] font-normal tabular-nums">
                          {formatInr(order.total)}
                        </td>
                        <td className="py-3.5 px-4">{renderPaymentBadge(order)}</td>
                        <td className="py-3.5 px-4">{renderStatusBadge(order)}</td>
                        <td className="py-3.5 px-4 text-right">
                          <span className="inline-flex items-center gap-1 text-[#563568] font-medium hover:text-[#A184BD] text-[11px]">
                            <span>Details</span>
                            <ChevronRight size={12} />
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {filteredOrders.map((order) => {
                const isRefundHighlight =
                  order.refundNeeded || order.orderStatus === 'needs_refund';
                return (
                  <div
                    key={order.orderNumber}
                    onClick={() => setSelectedOrder(order)}
                    className={`bg-white p-4 border rounded-xs shadow-2xs space-y-3 cursor-pointer ${
                      isRefundHighlight
                        ? 'border-2 border-[#D9B8A0] bg-[#FFFDF7]'
                        : 'border-[#E7DCEB]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-medium text-xs text-[#563568]">
                        {order.orderNumber}
                      </span>
                      {renderStatusBadge(order)}
                    </div>

                    <div className="flex justify-between items-start text-xs">
                      <div>
                        <p className="font-medium text-[#302438]">{order.customer.name}</p>
                        <p className="text-[11px] text-[#6F6475]">{formatDate(order.createdAt)}</p>
                      </div>
                      <div className="text-right">
                        <span className="font-serif text-sm text-[#302438] font-normal block">
                          {formatInr(order.total)}
                        </span>
                        <div className="mt-1">{renderPaymentBadge(order)}</div>
                      </div>
                    </div>

                    {isRefundHighlight && (
                      <div className="p-2 bg-[#FFFBEB] border border-[#D9B8A0] text-[11px] font-semibold text-[#92400E] rounded-xs flex items-center gap-1.5">
                        <AlertTriangle size={13} className="shrink-0 text-[#B45309]" />
                        <span>Refund this payment in the Razorpay dashboard</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Pagination Button */}
            {nextCursor && (
              <div className="text-center pt-2">
                <button
                  onClick={() => fetchOrders(true)}
                  disabled={loadingMore}
                  className="px-6 py-2.5 bg-white border border-[#E7DCEB] text-xs text-[#563568] hover:bg-[#FAF5FC] hover:border-[#563568] rounded-xs font-medium transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                >
                  {loadingMore ? 'Loading more orders...' : 'Load more orders'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Slide-in Order Details Panel / Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div
            onClick={() => setSelectedOrder(null)}
            className="absolute inset-0 bg-[#302438]/50 backdrop-blur-2xs transition-opacity"
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10">
            <div className="w-screen max-w-xl bg-white shadow-xl flex flex-col font-sans">
              {/* Drawer Header */}
              <div className="px-6 py-5 bg-[#FAF5FC] border-b border-[#E7DCEB] flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-[#6F6475] font-medium block">
                    Order Details
                  </span>
                  <h2 className="font-serif text-2xl text-[#302438] font-normal mt-0.5">
                    {selectedOrder.orderNumber}
                  </h2>
                </div>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="w-8 h-8 rounded-full border border-[#E7DCEB] flex items-center justify-center text-[#6F6475] hover:text-[#302438] hover:border-[#302438] transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Drawer Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
                {/* Gold Refund Callout if refundNeeded or needs_refund */}
                {(selectedOrder.refundNeeded || selectedOrder.orderStatus === 'needs_refund') && (
                  <div className="p-4 bg-[#FFFBEB] border-2 border-[#D9B8A0] rounded-xs text-[#92400E] space-y-1 animate-fadeIn">
                    <div className="flex items-center gap-2 font-semibold text-xs">
                      <AlertTriangle size={16} className="text-[#B45309]" />
                      <span>Action Required: Razorpay Dashboard</span>
                    </div>
                    <p className="text-[11px] leading-relaxed">
                      <strong>Refund this payment in the Razorpay dashboard</strong>, since refunds
                      are handled securely via Razorpay's merchant portal.
                    </p>
                  </div>
                )}

                {/* Status Banners / Messages */}
                {actionError && (
                  <div className="p-3 bg-[#FEF2F2] border border-[#FEE2E2] text-[#DC2626] rounded-xs flex items-start gap-2">
                    <AlertCircle size={15} className="shrink-0 mt-0.5" />
                    <p>{actionError}</p>
                  </div>
                )}

                {actionSuccess && (
                  <div className="p-3 bg-[#F0FDF4] border border-[#DCFCE7] text-[#15803D] rounded-xs flex items-start gap-2">
                    <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
                    <p>{actionSuccess}</p>
                  </div>
                )}

                {/* Quick Info Grid */}
                <div className="grid grid-cols-2 gap-3 p-3.5 bg-[#FAF5FC] border border-[#E7DCEB] rounded-xs">
                  <div>
                    <span className="text-[10px] uppercase text-[#6F6475] block">Order Status</span>
                    <div className="mt-1">{renderStatusBadge(selectedOrder)}</div>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-[#6F6475] block">Payment State</span>
                    <div className="mt-1">{renderPaymentBadge(selectedOrder)}</div>
                  </div>
                  <div className="pt-2 border-t border-[#E7DCEB]">
                    <span className="text-[10px] uppercase text-[#6F6475] block">Method</span>
                    <span className="font-medium text-[#302438] capitalize">
                      {selectedOrder.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Online (Razorpay)'}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-[#E7DCEB]">
                    <span className="text-[10px] uppercase text-[#6F6475] block">Placed At</span>
                    <span className="text-[#302438]">{formatDate(selectedOrder.createdAt)}</span>
                  </div>
                </div>

                {/* Razorpay Payment Reference if online */}
                {selectedOrder.razorpayPaymentId && (
                  <div className="p-3 bg-white border border-[#E7DCEB] rounded-xs flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[#6F6475]">
                      <CreditCard size={15} />
                      <span className="text-[11px]">Razorpay Payment ID:</span>
                    </div>
                    <span className="font-mono text-xs font-medium text-[#563568]">
                      {selectedOrder.razorpayPaymentId}
                    </span>
                  </div>
                )}

                {/* Customer Details */}
                <div className="space-y-2">
                  <h3 className="font-serif text-base text-[#302438] font-normal">Customer Details</h3>
                  <div className="p-3.5 bg-white border border-[#E7DCEB] rounded-xs space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[#6F6475]">Name:</span>
                      <span className="font-medium text-[#302438]">{selectedOrder.customer.name}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#6F6475]">Phone:</span>
                      <a
                        href={`tel:${selectedOrder.customer.phone}`}
                        className="text-[#563568] hover:text-[#A184BD] font-medium inline-flex items-center gap-1 transition-colors"
                      >
                        <Phone size={12} />
                        <span>{selectedOrder.customer.phone}</span>
                      </a>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#6F6475]">Email:</span>
                      <a
                        href={`mailto:${selectedOrder.customer.email}`}
                        className="text-[#563568] hover:text-[#A184BD] font-medium inline-flex items-center gap-1 transition-colors"
                      >
                        <Mail size={12} />
                        <span>{selectedOrder.customer.email}</span>
                      </a>
                    </div>
                  </div>
                </div>

                {/* Shipping Address */}
                <div className="space-y-2">
                  <h3 className="font-serif text-base text-[#302438] font-normal">
                    Shipping Address (India)
                  </h3>
                  <div className="p-3.5 bg-white border border-[#E7DCEB] rounded-xs space-y-1 text-[#302438]">
                    <div className="flex items-center gap-1.5 font-medium text-xs">
                      <MapPin size={13} className="text-[#563568]" />
                      <span>{selectedOrder.shippingAddress.fullName}</span>
                      <span className="text-[#6F6475] font-normal">
                        ({selectedOrder.shippingAddress.phone})
                      </span>
                    </div>
                    <p className="pl-4 text-[#6F6475]">
                      {selectedOrder.shippingAddress.line1}
                      {selectedOrder.shippingAddress.line2 ? `, ${selectedOrder.shippingAddress.line2}` : ''}
                    </p>
                    <p className="pl-4 text-[#6F6475]">
                      {selectedOrder.shippingAddress.city}, {selectedOrder.shippingAddress.state} –{' '}
                      <span className="font-mono">{selectedOrder.shippingAddress.pincode}</span>
                    </p>
                  </div>
                </div>

                {/* Courier / Fulfillment Details if present */}
                {(selectedOrder.courierName ||
                  selectedOrder.trackingNumber ||
                  selectedOrder.trackingUrl ||
                  selectedOrder.shippedAt) && (
                  <div className="space-y-2">
                    <h3 className="font-serif text-base text-[#302438] font-normal">
                      Dispatch & Tracking Details
                    </h3>
                    <div className="p-3.5 bg-[#FAF5FC] border border-[#E7DCEB] rounded-xs space-y-2">
                      {selectedOrder.shippedAt && (
                        <div className="flex justify-between">
                          <span className="text-[#6F6475]">Dispatched on:</span>
                          <span className="text-[#302438]">{formatDate(selectedOrder.shippedAt)}</span>
                        </div>
                      )}
                      {selectedOrder.courierName && (
                        <div className="flex justify-between">
                          <span className="text-[#6F6475]">Courier Partner:</span>
                          <span className="font-medium text-[#302438]">{selectedOrder.courierName}</span>
                        </div>
                      )}
                      {selectedOrder.trackingNumber && (
                        <div className="flex justify-between">
                          <span className="text-[#6F6475]">Airway Bill (AWB):</span>
                          <span className="font-mono font-medium text-[#302438]">
                            {selectedOrder.trackingNumber}
                          </span>
                        </div>
                      )}
                      {selectedOrder.trackingUrl && (
                        <div className="pt-2 border-t border-[#E7DCEB]">
                          <a
                            href={selectedOrder.trackingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-[#563568] hover:text-[#A184BD] font-medium"
                          >
                            <span>Open Courier Tracking Link</span>
                            <ExternalLink size={12} />
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Items Ordered */}
                <div className="space-y-2">
                  <h3 className="font-serif text-base text-[#302438] font-normal">
                    Ordered Items ({selectedOrder.lines.length})
                  </h3>
                  <div className="divide-y divide-[#E7DCEB] border border-[#E7DCEB] rounded-xs bg-white">
                    {selectedOrder.lines.map((line, idx) => (
                      <div key={idx} className="p-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          {line.image ? (
                            <img
                              src={line.image}
                              alt={line.name}
                              className="w-10 h-10 object-cover rounded-xs border border-[#E7DCEB] bg-[#F7F0FA]"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-xs border border-[#E7DCEB] bg-[#F7F0FA] flex items-center justify-center text-[#6F6475]">
                              <Package size={16} />
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-[#302438] line-clamp-1">{line.name}</p>
                            <p className="text-[11px] text-[#6F6475]">
                              Qty: {line.quantity} × {formatInr(line.unitPrice)}
                            </p>
                          </div>
                        </div>
                        <span className="font-sans font-medium text-[#302438] tabular-nums">
                          {formatInr(line.unitPrice * line.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="p-3.5 bg-white border border-[#E7DCEB] rounded-xs space-y-2">
                  <div className="flex justify-between text-[#6F6475]">
                    <span>Subtotal:</span>
                    <span className="tabular-nums text-[#302438]">{formatInr(selectedOrder.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-[#6F6475]">
                    <span>Shipping Fee:</span>
                    <span className="tabular-nums text-[#302438]">
                      {selectedOrder.shippingFee === 0 ? 'Complimentary' : formatInr(selectedOrder.shippingFee)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-[#E7DCEB] font-medium text-sm text-[#302438]">
                    <span>Grand Total:</span>
                    <span className="font-serif text-base">{formatInr(selectedOrder.total)}</span>
                  </div>
                </div>

                {/* Admin Note Box */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-serif text-base text-[#302438] font-normal flex items-center gap-1.5">
                      <FileText size={14} className="text-[#563568]" />
                      <span>Atelier Admin Note</span>
                    </h3>
                    <span className="text-[10px] text-[#6F6475]">{noteText.length}/500</span>
                  </div>
                  <div className="space-y-2">
                    <textarea
                      rows={3}
                      maxLength={500}
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Add private packaging notes, bespoke sizing instructions, or customer communication details..."
                      className="w-full p-3 bg-[#F7F0FA] border border-[#E7DCEB] text-xs text-[#302438] placeholder:text-[#9E90A2] rounded-xs focus:outline-none focus:border-[#B69ACF] resize-none"
                    />
                    <button
                      type="button"
                      disabled={savingNote || actionLoading || noteText === (selectedOrder.adminNote || '')}
                      onClick={async () => {
                        setSavingNote(true);
                        await handleUpdateOrder('add_note', { note: noteText });
                        setSavingNote(false);
                      }}
                      className="px-4 py-2 bg-[#563568] text-white text-xs font-medium uppercase tracking-wider hover:bg-[#A184BD] rounded-xs transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {savingNote ? 'Saving...' : 'Save Note'}
                    </button>
                  </div>
                </div>

                {/* State-Based Action Controls */}
                <div className="space-y-3 pt-4 border-t border-[#E7DCEB]">
                  <h3 className="text-xs uppercase tracking-wider text-[#6F6475] font-semibold">
                    Fulfillment Actions
                  </h3>

                  {/* 1. Mark as Shipped Form */}
                  {selectedOrder.orderStatus !== 'shipped' &&
                    selectedOrder.orderStatus !== 'delivered' &&
                    selectedOrder.orderStatus !== 'cancelled' && (
                      <div className="space-y-2">
                        {!showShipForm ? (
                          <button
                            type="button"
                            disabled={actionLoading}
                            onClick={() => setShowShipForm(true)}
                            className="w-full py-2.5 bg-[#563568] text-white text-xs font-medium uppercase tracking-wider hover:bg-[#A184BD] transition-colors rounded-xs flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <Truck size={14} />
                            <span>Mark as Shipped</span>
                          </button>
                        ) : (
                          <div className="p-4 bg-[#FAF5FC] border border-[#E7DCEB] rounded-xs space-y-3 animate-fadeIn">
                            <h4 className="font-medium text-xs text-[#302438]">
                              Record Dispatch Details
                            </h4>
                            <div>
                              <label className="block text-[11px] text-[#6F6475] mb-1">
                                Courier Partner Name
                              </label>
                              <input
                                type="text"
                                value={courierName}
                                onChange={(e) => setCourierName(e.target.value)}
                                placeholder="e.g. Blue Dart, Delhivery, DTDC"
                                className="w-full px-3 py-2 bg-white border border-[#E7DCEB] text-xs text-[#302438] rounded-xs focus:outline-none focus:border-[#B69ACF]"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] text-[#6F6475] mb-1">
                                Airway Bill (AWB) / Tracking Number
                              </label>
                              <input
                                type="text"
                                value={trackingNumber}
                                onChange={(e) => setTrackingNumber(e.target.value)}
                                placeholder="e.g. BLU12345678"
                                className="w-full px-3 py-2 bg-white border border-[#E7DCEB] text-xs text-[#302438] rounded-xs focus:outline-none focus:border-[#B69ACF]"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] text-[#6F6475] mb-1">
                                Online Tracking URL (must start with https://)
                              </label>
                              <input
                                type="url"
                                value={trackingUrl}
                                onChange={(e) => setTrackingUrl(e.target.value)}
                                placeholder="https://track.bluedart.com/..."
                                className="w-full px-3 py-2 bg-white border border-[#E7DCEB] text-xs text-[#302438] rounded-xs focus:outline-none focus:border-[#B69ACF]"
                              />
                            </div>
                            <div className="flex gap-2 pt-1">
                              <button
                                type="button"
                                disabled={actionLoading}
                                onClick={() =>
                                  handleUpdateOrder('mark_shipped', {
                                    courierName,
                                    trackingNumber,
                                    trackingUrl
                                  })
                                }
                                className="flex-1 py-2 bg-[#563568] text-white text-xs font-medium uppercase tracking-wider hover:bg-[#A184BD] rounded-xs transition-colors cursor-pointer disabled:opacity-50"
                              >
                                {actionLoading ? 'Saving...' : 'Confirm Shipment'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setShowShipForm(false)}
                                className="px-4 py-2 border border-[#E7DCEB] text-xs text-[#6F6475] hover:bg-white rounded-xs transition-colors cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                  {/* 2. Mark as Delivered */}
                  {selectedOrder.orderStatus === 'shipped' && (
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Confirm delivery for order ${selectedOrder.orderNumber}? If Cash on Delivery, this will mark the payment as collected.`
                          )
                        ) {
                          handleUpdateOrder('mark_delivered');
                        }
                      }}
                      className="w-full py-2.5 bg-[#15803D] text-white text-xs font-medium uppercase tracking-wider hover:bg-[#166534] transition-colors rounded-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <CheckCircle2 size={14} />
                      <span>{actionLoading ? 'Updating...' : 'Mark as Delivered'}</span>
                    </button>
                  )}

                  {/* 3. Cancel Order */}
                  {selectedOrder.orderStatus !== 'shipped' &&
                    selectedOrder.orderStatus !== 'delivered' &&
                    selectedOrder.orderStatus !== 'cancelled' && (
                      <div>
                        {!showCancelConfirm ? (
                          <button
                            type="button"
                            disabled={actionLoading}
                            onClick={() => setShowCancelConfirm(true)}
                            className="w-full py-2.5 border border-[#DC2626] text-[#DC2626] hover:bg-[#FEF2F2] text-xs font-medium uppercase tracking-wider transition-colors rounded-xs flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <XCircle size={14} />
                            <span>Cancel Order</span>
                          </button>
                        ) : (
                          <div className="p-4 bg-[#FEF2F2] border border-[#FEE2E2] rounded-xs space-y-3 animate-fadeIn">
                            <h4 className="font-semibold text-xs text-[#DC2626]">
                              Confirm Order Cancellation
                            </h4>
                            <p className="text-[11px] text-[#991B1B] leading-relaxed">
                              This will set the status to <strong>Cancelled</strong>.
                              {selectedOrder.paymentStatus === 'paid' && (
                                <span>
                                  {' '}
                                  Because this order was paid online, it will be flagged for refund
                                  in Razorpay.
                                </span>
                              )}
                              {' '}Inventory reserved for this order will be atomically restored.
                            </p>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                disabled={actionLoading}
                                onClick={() => handleUpdateOrder('cancel')}
                                className="flex-1 py-2 bg-[#DC2626] text-white text-xs font-medium uppercase tracking-wider hover:bg-[#B91C1C] rounded-xs transition-colors cursor-pointer disabled:opacity-50"
                              >
                                {actionLoading ? 'Cancelling...' : 'Yes, Cancel Order'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setShowCancelConfirm(false)}
                                className="px-4 py-2 border border-[#E7DCEB] bg-white text-xs text-[#6F6475] rounded-xs cursor-pointer"
                              >
                                Abort
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};
