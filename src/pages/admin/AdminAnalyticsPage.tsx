/**
 * AdminAnalyticsPage for SARINE.
 * Real database-backed business intelligence calculating total gross sales,
 * order statuses, average order value, payment distribution, and fulfillment health.
 */

import React, { useState, useEffect } from 'react';
import { getFirebaseAuth, isFirebaseConfigured } from '../../lib/firebase';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { formatInr } from '../../utils/currency';
import {
  TrendingUp,
  DollarSign,
  Package,
  Clock,
  CheckCircle2,
  XCircle,
  Truck,
  CreditCard,
  Banknote,
  RotateCcw,
  Sparkles,
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
  lines: OrderLine[];
  subtotal: number;
  shippingFee: number;
  total: number;
  paymentMethod: string;
  paymentStatus: string;
  orderStatus: string;
  shippedAt?: string;
  deliveredAt?: string;
  refundNeeded?: boolean;
}

export const AdminAnalyticsPage: React.FC = () => {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchOrders() {
      if (!isFirebaseConfigured()) {
        setLoading(false);
        return;
      }

      try {
        const auth = getFirebaseAuth();
        const user = auth.currentUser;
        if (!user) {
          setLoading(false);
          return;
        }

        const token = await user.getIdToken();
        const res = await fetch('/.netlify/functions/admin-list-orders?limit=100', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (!res.ok) {
          throw new Error('Failed to fetch analytics orders');
        }

        const data = await res.json();
        setOrders(data.orders || []);
      } catch (err: any) {
        console.error('[AdminAnalyticsPage] Fetch error:', err);
        setError('Could not load order metrics.');
      } finally {
        setLoading(false);
      }
    }

    fetchOrders();
  }, []);

  // Compute real metrics
  const totalOrders = orders.length;
  const paidOrders = orders.filter((o) => o.paymentStatus === 'paid');
  const grossSales = paidOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const aov = paidOrders.length > 0 ? Math.round(grossSales / paidOrders.length) : 0;

  const pendingShipment = orders.filter(
    (o) => (o.orderStatus === 'confirmed' || o.orderStatus === 'placed') && !o.shippedAt
  ).length;

  const shippedCount = orders.filter((o) => o.orderStatus === 'shipped').length;
  const deliveredCount = orders.filter((o) => o.orderStatus === 'delivered').length;
  const cancelledCount = orders.filter((o) => o.orderStatus === 'cancelled').length;

  const codOrders = orders.filter((o) => o.paymentMethod === 'cod').length;
  const onlineOrders = orders.filter((o) => o.paymentMethod === 'razorpay' || o.paymentMethod === 'online').length;

  // Bestselling items tally
  const productSalesMap: Record<string, { name: string; count: number; revenue: number }> = {};
  for (const o of orders) {
    if (o.lines) {
      for (const line of o.lines) {
        if (!productSalesMap[line.name]) {
          productSalesMap[line.name] = { name: line.name, count: 0, revenue: 0 };
        }
        productSalesMap[line.name].count += line.quantity;
        productSalesMap[line.name].revenue += line.quantity * line.unitPrice;
      }
    }
  }

  const topProducts = Object.values(productSalesMap)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return (
    <AdminLayout>
      <div className="space-y-8 font-sans">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E7DCEB]">
          <div>
            <span className="text-[10px] uppercase tracking-[0.25em] text-[#6F6475] font-medium block">
              SARINE ATELIER COMMERCE
            </span>
            <h1 className="font-serif text-2xl sm:text-3xl text-[#302438] font-normal mt-0.5">
              Business Intelligence & Sales Overview
            </h1>
          </div>
          <span className="text-xs text-[#6F6475] bg-white px-3 py-1.5 border border-[#E7DCEB] rounded-xs font-mono">
            {orders.length} Total Registered Records
          </span>
        </div>

        {error && (
          <div className="p-4 bg-[#DC2626]/5 border border-[#DC2626]/30 text-xs text-[#DC2626] rounded-xs">
            {error}
          </div>
        )}

        {/* 4 Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Gross Sales */}
          <div className="bg-white p-5 border border-[#E7DCEB] rounded-xs shadow-2xs space-y-2">
            <div className="flex items-center justify-between text-[#6F6475]">
              <span className="text-xs uppercase tracking-wider font-medium">Realized Gross Sales</span>
              <TrendingUp size={16} className="text-[#563568]" />
            </div>
            <div className="font-serif text-2xl sm:text-3xl font-medium text-[#302438]">
              {formatInr(grossSales)}
            </div>
            <p className="text-[11px] text-[#6F6475]">Across {paidOrders.length} verified paid transactions</p>
          </div>

          {/* Average Order Value */}
          <div className="bg-white p-5 border border-[#E7DCEB] rounded-xs shadow-2xs space-y-2">
            <div className="flex items-center justify-between text-[#6F6475]">
              <span className="text-xs uppercase tracking-wider font-medium">Average Order Value</span>
              <DollarSign size={16} className="text-[#563568]" />
            </div>
            <div className="font-serif text-2xl sm:text-3xl font-medium text-[#302438]">
              {formatInr(aov)}
            </div>
            <p className="text-[11px] text-[#6F6475]">Per successful order</p>
          </div>

          {/* Pending Shipments */}
          <div className="bg-white p-5 border border-[#E7DCEB] rounded-xs shadow-2xs space-y-2">
            <div className="flex items-center justify-between text-[#6F6475]">
              <span className="text-xs uppercase tracking-wider font-medium">Awaiting Dispatch</span>
              <Clock size={16} className="text-amber-600" />
            </div>
            <div className="font-serif text-2xl sm:text-3xl font-medium text-[#302438]">
              {pendingShipment}
            </div>
            <p className="text-[11px] text-[#6F6475]">Confirmed orders needing courier slips</p>
          </div>

          {/* Delivered Rate */}
          <div className="bg-white p-5 border border-[#E7DCEB] rounded-xs shadow-2xs space-y-2">
            <div className="flex items-center justify-between text-[#6F6475]">
              <span className="text-xs uppercase tracking-wider font-medium">Delivered to Customer</span>
              <CheckCircle2 size={16} className="text-emerald-700" />
            </div>
            <div className="font-serif text-2xl sm:text-3xl font-medium text-[#302438]">
              {deliveredCount}
            </div>
            <p className="text-[11px] text-[#6F6475]">{shippedCount} currently in transit</p>
          </div>
        </div>

        {/* 2-Column Insight: Fulfilment Pipeline + Payment Channel Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Fulfilment Pipeline Breakdown (6 cols) */}
          <div className="lg:col-span-6 bg-white p-6 border border-[#E7DCEB] rounded-xs shadow-2xs space-y-5">
            <h3 className="font-serif text-lg text-[#302438]">Fulfilment Lifecycle</h3>
            <div className="space-y-3 text-xs font-sans">
              <div className="flex items-center justify-between p-3 bg-[#FAF5FC] border border-[#E7DCEB] rounded-xs">
                <span className="flex items-center gap-2 text-[#302438]">
                  <Clock size={14} className="text-amber-600" />
                  <span>Awaiting Atelier Packing</span>
                </span>
                <span className="font-medium font-mono text-sm">{pendingShipment}</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-[#FAF5FC] border border-[#E7DCEB] rounded-xs">
                <span className="flex items-center gap-2 text-[#302438]">
                  <Truck size={14} className="text-[#563568]" />
                  <span>Shipped (With Courier)</span>
                </span>
                <span className="font-medium font-mono text-sm">{shippedCount}</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-[#FAF5FC] border border-[#E7DCEB] rounded-xs">
                <span className="flex items-center gap-2 text-[#302438]">
                  <CheckCircle2 size={14} className="text-emerald-700" />
                  <span>Delivered Successfully</span>
                </span>
                <span className="font-medium font-mono text-sm">{deliveredCount}</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-[#FAF5FC] border border-[#E7DCEB] rounded-xs">
                <span className="flex items-center gap-2 text-[#302438]">
                  <XCircle size={14} className="text-[#DC2626]" />
                  <span>Cancelled Orders</span>
                </span>
                <span className="font-medium font-mono text-sm">{cancelledCount}</span>
              </div>
            </div>
          </div>

          {/* Payment Method Distribution (6 cols) */}
          <div className="lg:col-span-6 bg-white p-6 border border-[#E7DCEB] rounded-xs shadow-2xs space-y-5">
            <h3 className="font-serif text-lg text-[#302438]">Payment Distribution</h3>
            <div className="space-y-4 text-xs font-sans">
              <div className="p-4 bg-[#F7F0FA] border border-[#E7DCEB] rounded-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-[#302438] flex items-center gap-2">
                    <CreditCard size={15} className="text-[#563568]" />
                    <span>Razorpay Online (UPI, Cards, NetBanking)</span>
                  </span>
                  <span className="font-mono font-medium">{onlineOrders} orders</span>
                </div>
                <div className="w-full bg-[#E7DCEB] h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-[#563568] h-full"
                    style={{ width: `${totalOrders > 0 ? (onlineOrders / totalOrders) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>

              <div className="p-4 bg-[#F7F0FA] border border-[#E7DCEB] rounded-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-[#302438] flex items-center gap-2">
                    <Banknote size={15} className="text-[#6F6475]" />
                    <span>Cash on Delivery (COD)</span>
                  </span>
                  <span className="font-mono font-medium">{codOrders} orders</span>
                </div>
                <div className="w-full bg-[#E7DCEB] h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-[#B69ACF] h-full"
                    style={{ width: `${totalOrders > 0 ? (codOrders / totalOrders) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Top Demanded Pieces */}
        <div className="bg-white p-6 border border-[#E7DCEB] rounded-xs shadow-2xs">
          <h3 className="font-serif text-lg text-[#302438] mb-4">Top Ordered Jewellery Pieces</h3>
          {topProducts.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-[#F7F0FA] text-[#6F6475] uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="p-3">Jewellery Name</th>
                    <th className="p-3 text-center">Units Ordered</th>
                    <th className="p-3 text-right">Revenue Generated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7DCEB]">
                  {topProducts.map((p) => (
                    <tr key={p.name} className="hover:bg-[#FAF5FC]">
                      <td className="p-3 font-medium text-[#302438]">{p.name}</td>
                      <td className="p-3 text-center font-mono">{p.count}</td>
                      <td className="p-3 text-right font-medium text-[#302438]">{formatInr(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-[#6F6475] py-4">No order items recorded yet.</p>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};
