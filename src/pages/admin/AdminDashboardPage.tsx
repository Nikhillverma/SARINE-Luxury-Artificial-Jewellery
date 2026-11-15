import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { formatInr } from '../../utils/currency';
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Clock3,
  IndianRupee,
  Package,
  RefreshCw,
  ShoppingBag,
  TrendingUp,
  Truck,
} from 'lucide-react';

const API_BASE = (
  import.meta.env.VITE_HOSTINGER_API_BASE_URL ||
  (import.meta.env.DEV ? '/api' : 'https://lavender-goldfish-844589.hostingersite.com/api')
).replace(/\/+$/, '');

interface DashboardMetrics {
  orders: number;
  pendingOrders: number;
  processingOrders: number;
  shippedOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  paidRevenue: number;
  todayRevenue: number;
  todayOrders: number;
  products: number;
  activeProducts: number;
  draftProducts: number;
  archivedProducts: number;
  lowStockProducts: number;
}

interface RecentOrder {
  orderNumber: string;
  customerName: string;
  total: number;
  paymentStatus: string;
  orderStatus: string;
  createdAt: string | null;
}

interface LowStockProduct {
  id: string;
  slug: string;
  name: string;
  stock: number;
  images: string[];
}

interface DashboardResponse {
  metrics: DashboardMetrics;
  recentOrders: RecentOrder[];
  lowStockProducts: LowStockProduct[];
}

const emptyMetrics: DashboardMetrics = {
  orders: 0, pendingOrders: 0, processingOrders: 0, shippedOrders: 0,
  deliveredOrders: 0, cancelledOrders: 0, paidRevenue: 0, todayRevenue: 0,
  todayOrders: 0, products: 0, activeProducts: 0, draftProducts: 0,
  archivedProducts: 0, lowStockProducts: 0
};

function formatDateTime(value: string | null): string {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(date);
}

function statusClass(value: string): string {
  switch ((value || '').toLowerCase()) {
    case 'paid':
    case 'delivered':
    case 'active':
      return 'bg-[#DCFCE7] text-[#15803D]';
    case 'shipped':
      return 'bg-[#E0F2FE] text-[#0369A1]';
    case 'cancelled':
    case 'failed':
      return 'bg-[#FEE2E2] text-[#B91C1C]';
    case 'pending':
    case 'awaiting_payment':
      return 'bg-[#FEF3C7] text-[#92400E]';
    default:
      return 'bg-[#F3E8FF] text-[#78469C]';
  }
}

export const AdminDashboardPage: React.FC = () => {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/admin/dashboard`, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
        headers: { Accept: 'application/json' }
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof result.error === 'string'
            ? result.error
            : `Dashboard request failed (${response.status}).`
        );
      }
      if (!result.metrics || !Array.isArray(result.recentOrders) || !Array.isArray(result.lowStockProducts)) {
        throw new Error('The dashboard API returned an unexpected response.');
      }
      setData(result as DashboardResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load dashboard data.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const metrics = data?.metrics || emptyMetrics;
  const cards = [
    { label: 'Paid Revenue', value: formatInr(metrics.paidRevenue), note: `${formatInr(metrics.todayRevenue)} today`, icon: IndianRupee },
    { label: 'Total Orders', value: metrics.orders.toLocaleString('en-IN'), note: `${metrics.todayOrders} today`, icon: ShoppingBag },
    { label: 'Low Stock Alerts', value: metrics.lowStockProducts.toLocaleString('en-IN'), note: '5 or fewer units', icon: AlertTriangle }
  ];

  const orderStatuses = [
    { label: 'Pending', value: metrics.pendingOrders, icon: Clock3 },
    { label: 'Processing', value: metrics.processingOrders, icon: Package },
    { label: 'Shipped', value: metrics.shippedOrders, icon: Truck },
    { label: 'Delivered', value: metrics.deliveredOrders, icon: CheckCircle2 },
    { label: 'Cancelled', value: metrics.cancelledOrders, icon: AlertTriangle }
  ];

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-[#8B7598]">SARINE Atelier</p>
            <h1 className="font-serif text-2xl sm:text-3xl text-[#302438] mt-1">Dashboard Overview</h1>
            <p className="text-xs text-[#817487] mt-1">
              Live store information from your Hostinger MariaDB database.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadDashboard()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-11 rounded-lg border border-[#E7DCEB] bg-white text-xs font-medium text-[#563568] hover:bg-[#FAF5FC] disabled:opacity-60"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh data
          </button>
        </div>

        {error && (
          <div role="alert" className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-xl border border-red-200 bg-red-50 text-red-800">
            <div>
              <p className="text-sm font-semibold">Dashboard data could not be loaded</p>
              <p className="text-xs mt-1">{error}</p>
              <p className="text-[11px] mt-1">Check your admin session and Hostinger API connection.</p>
            </div>
            <button type="button" onClick={() => void loadDashboard()} className="min-h-10 px-3 rounded-lg bg-white border border-red-200 text-xs font-medium">
              Try again
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="bg-white border border-[#EDE4F0] rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-wider text-[#817487]">{card.label}</span>
                  <span className="w-9 h-9 rounded-lg bg-[#F7F0FA] text-[#704A83] flex items-center justify-center">
                    <Icon size={17} />
                  </span>
                </div>
                <p className="font-serif text-2xl text-[#302438] mt-4">
                  {loading ? '—' : card.value}
                </p>
                <p className="text-[11px] text-[#8B7598] mt-1">{loading ? 'Loading…' : card.note}</p>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <section className="xl:col-span-2 bg-white border border-[#EDE4F0] rounded-xl p-5">
            <div className="flex items-center justify-between gap-3 mb-5">
              <div>
                <h2 className="font-serif text-lg text-[#302438]">Order Fulfilment</h2>
                <p className="text-[11px] text-[#8B7598] mt-1">Current order counts by status</p>
              </div>
              <Link to="/admin/orders" className="text-[11px] font-semibold text-[#704A83] hover:underline">View orders</Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {orderStatuses.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="rounded-lg bg-[#FAF7FB] border border-[#F0E8F3] p-3">
                    <Icon size={16} className="text-[#80609A]" />
                    <p className="font-serif text-xl text-[#302438] mt-3">{loading ? '—' : item.value}</p>
                    <p className="text-[10px] text-[#817487] mt-1">{item.label}</p>
                  </div>
                );
              })}
            </div>
            <div className="mt-5 pt-4 border-t border-[#F0E8F3] flex flex-wrap gap-x-6 gap-y-2 text-[11px] text-[#817487]">
              <span><strong className="text-[#302438]">{metrics.products}</strong> catalogue products</span>
              <span><strong className="text-[#15803D]">{metrics.activeProducts}</strong> active</span>
              <span><strong className="text-[#80609A]">{metrics.draftProducts}</strong> drafts</span>
              <span><strong className="text-[#817487]">{metrics.archivedProducts}</strong> archived</span>
            </div>
          </section>

          <section className="bg-white border border-[#EDE4F0] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Boxes size={17} className="text-[#80609A]" />
              <div>
                <h2 className="font-serif text-lg text-[#302438]">Inventory Watch</h2>
                <p className="text-[11px] text-[#8B7598]">Active products with stock ≤ 5</p>
              </div>
            </div>
            {loading ? (
              <p className="text-xs text-[#8B7598] py-6">Loading inventory…</p>
            ) : data?.lowStockProducts.length ? (
              <div className="space-y-3">
                {data.lowStockProducts.map((product) => (
                  <div key={product.id} className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#F7F0FA] overflow-hidden shrink-0 flex items-center justify-center">
                      {product.images?.[0] ? (
                        <img src={product.images[0]} alt="" className="w-full h-full object-cover" />
                      ) : <Package size={16} className="text-[#A58BB3]" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-[#302438] font-medium truncate">{product.name}</p>
                      <p className="text-[10px] text-[#8B7598] truncate">{product.slug}</p>
                    </div>
                    <span className="text-xs font-semibold text-amber-700 whitespace-nowrap">{product.stock} left</span>
                  </div>
                ))}
                <Link to="/admin/products" className="inline-block text-[11px] font-semibold text-[#704A83] hover:underline pt-2">Manage products</Link>
              </div>
            ) : (
              <div className="py-6 text-center">
                <CheckCircle2 size={22} className="mx-auto text-[#16A34A]" />
                <p className="text-xs text-[#5F5267] mt-2">No low-stock products</p>
              </div>
            )}
          </section>
        </div>

        <section className="bg-white border border-[#EDE4F0] rounded-xl overflow-hidden">
          <div className="p-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-serif text-lg text-[#302438]">Recent Orders</h2>
              <p className="text-[11px] text-[#8B7598] mt-1">Latest orders recorded in MariaDB</p>
            </div>
            <Link to="/admin/orders" className="text-[11px] font-semibold text-[#704A83] hover:underline">All orders</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left">
              <thead className="bg-[#FAF7FB] text-[10px] uppercase tracking-wider text-[#817487]">
                <tr>
                  <th className="px-5 py-3 font-semibold">Order</th>
                  <th className="px-5 py-3 font-semibold">Customer</th>
                  <th className="px-5 py-3 font-semibold">Date &amp; Time (IST)</th>
                  <th className="px-5 py-3 font-semibold">Payment</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0E8F3]">
                {loading ? (
                  <tr><td colSpan={6} className="px-5 py-8 text-center text-xs text-[#8B7598]">Loading recent orders…</td></tr>
                ) : data?.recentOrders.length ? data.recentOrders.map((order) => (
                  <tr key={order.orderNumber} className="text-xs text-[#514657]">
                    <td className="px-5 py-3 font-semibold text-[#563568]">{order.orderNumber}</td>
                    <td className="px-5 py-3">{order.customerName || 'Customer'}</td>
                    <td className="px-5 py-3 whitespace-nowrap">{formatDateTime(order.createdAt)}</td>
                    <td className="px-5 py-3"><span className={`px-2 py-1 rounded-full text-[10px] ${statusClass(order.paymentStatus)}`}>{order.paymentStatus || 'unknown'}</span></td>
                    <td className="px-5 py-3"><span className={`px-2 py-1 rounded-full text-[10px] ${statusClass(order.orderStatus)}`}>{order.orderStatus || 'unknown'}</span></td>
                    <td className="px-5 py-3 text-right font-semibold text-[#302438]">{formatInr(order.total)}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={6} className="px-5 py-8 text-center text-xs text-[#8B7598]">No orders have been recorded yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div className="flex flex-wrap gap-3">
          <Link to="/admin/products" className="inline-flex items-center gap-2 min-h-11 px-4 rounded-lg bg-[#563568] text-white text-xs font-medium hover:bg-[#704A83]">
            <Package size={14} /> Manage catalogue
          </Link>
          <Link to="/admin/orders" className="inline-flex items-center gap-2 min-h-11 px-4 rounded-lg border border-[#E7DCEB] bg-white text-[#563568] text-xs font-medium hover:bg-[#FAF5FC]">
            <ShoppingBag size={14} /> Manage orders
          </Link>
          <span className="inline-flex items-center gap-2 text-[10px] text-[#8B7598] ml-auto self-center">
            <TrendingUp size={13} /> Metrics reflect the latest database snapshot
          </span>
        </div>
      </div>
    </AdminLayout>
  );
};
