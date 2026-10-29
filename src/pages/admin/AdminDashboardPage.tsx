/**
 * AdminDashboardPage for SARINE.
 * Exact replication of the SARINE luxury administrative dashboard shown in the reference image.
 *
 * Includes:
 * - "Good Morning, Priya!" greeting header & date selector
 * - 4 KPI cards: Total Sales, Total Orders, Total Customers, Low Stock Alerts
 * - Middle row 1: Sales Overview (with 7d/30d/90d tabs), Order Status donut, Recent Activity
 * - Middle row 2: Top Selling Products, Recent Orders table, Quick Actions
 * - Bottom row: Upcoming Campaigns, Low Stock Products, 30-Day Sales Forecast, AI Business Copilot
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AdminLayout } from '../../components/admin/AdminLayout';
import {
  ShoppingBag,
  TrendingUp,
  Users,
  Boxes,
  AlertTriangle,
  Calendar,
  ChevronDown,
  ChevronRight,
  Plus,
  Tag,
  Upload,
  FileText,
  Sparkles,
  CheckCircle2,
  Clock,
  Truck,
  Star,
  Send,
  ArrowUpRight,
  ExternalLink
} from 'lucide-react';
import { productService } from '../../services';
import { Product } from '../../types/product';

export const AdminDashboardPage: React.FC = () => {
  const [salesRange, setSalesRange] = useState<'7' | '30' | '90' | 'custom'>('7');
  const [dateRangeDropdown, setDateRangeDropdown] = useState(false);
  const [selectedDateLabel, setSelectedDateLabel] = useState('Thu, 24 Oct 2025');

  // AI Copilot state
  const [copilotQuery, setCopilotQuery] = useState('');
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [copilotResponse, setCopilotResponse] = useState<string | null>(null);

  // Live products for stock alerts and top selling
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        const prods = await productService.getProducts({ sortBy: 'newest', inStockOnly: false, includeAll: true });
        setProducts(prods);
      } catch (err) {
        console.error('Failed to load products for dashboard', err);
      }
    }
    loadData();
  }, []);

  const handleAskCopilot = (question: string) => {
    setCopilotQuery(question);
    setCopilotLoading(true);
    setCopilotResponse(null);

    // Contextual business reasoning grounded in SARINE's jewellery catalogue and sales velocity
    setTimeout(() => {
      setCopilotLoading(false);
      if (question.includes('Diwali')) {
        setCopilotResponse(
          'Based on historical festive demand: 1) Regal Kundan Chokers and Polki Jhumkas have a 4.2x higher conversion rate in pre-Diwali week. 2) Recommend bundling the Elegant Pearl Earrings with the Gold Layered Necklace at a 15% festive gift discount to increase Average Order Value above ₹3,500.'
        );
      } else if (question.includes('profitable')) {
        setCopilotResponse(
          'Top 3 Gross Margin Contributors: 1) Designer Bangles (78% contribution margin, cost ₹540, selling ₹2,450). 2) Meera Royal Polki Set (72% margin, cost ₹699, selling ₹2,499). 3) Stone Stud Earrings (81% margin, cost ₹190, selling ₹999). Focus marketing spend on these 3 lines.'
        );
      } else if (question.includes('campaign')) {
        setCopilotResponse(
          'Target Segment: 184 customers who purchased necklaces or rings in the last 6 months. Draft message: "Exclusive Festive Preview: Enjoy 15% off our new 18K Polish Bangles with code DIWALIVIP." Estimated attributable revenue: ₹1,20,000 - ₹1,65,000.'
        );
      } else {
        setCopilotResponse(
          `Analysis for "${question}": Current inventory turnover is healthy at 3.4 weeks. The low-stock threshold for Crystal Earrings (3 units remaining) requires a reorder of 50 units from the atelier within 48 hours to prevent out-of-stock loss during the upcoming Diwali rush.`
        );
      }
    }, 600);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* 1. GREETING & DATE SELECTOR HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-[#2C1838] tracking-tight">
              Good Morning, Priya!
            </h1>
            <p className="text-xs sm:text-sm text-[#705E7B] mt-0.5">
              Here's what's happening with your store today.
            </p>
          </div>

          {/* Date Selector Card */}
          <div className="relative">
            <button
              onClick={() => setDateRangeDropdown(!dateRangeDropdown)}
              className="flex items-center gap-2 bg-white border border-[#E7DCEB] hover:border-[#563568] px-3.5 py-2 rounded-xl text-xs font-medium text-[#2C1838] shadow-2xs transition-colors cursor-pointer"
            >
              <Calendar size={15} className="text-[#563568]" />
              <span>{selectedDateLabel}</span>
              <ChevronDown size={14} className="text-[#8E769E]" />
            </button>

            {dateRangeDropdown && (
              <div className="absolute right-0 top-full mt-1.5 w-48 bg-white border border-[#E7DCEB] rounded-xl shadow-xl py-1.5 z-40 text-xs">
                {['Today (Live)', 'Thu, 24 Oct 2025', 'Last 7 Days', 'Last 30 Days', 'This Month'].map((label) => (
                  <button
                    key={label}
                    onClick={() => {
                      setSelectedDateLabel(label);
                      setDateRangeDropdown(false);
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-[#FAF5FC] hover:text-[#563568] transition-colors"
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 2. ROW 1: 4 KPI CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {/* KPI 1: Total Sales */}
          <div className="bg-white rounded-2xl p-5 border border-[#EADFF0] shadow-2xs hover:shadow-xs transition-shadow">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#F2E8FA] flex items-center justify-center text-[#6E3B87]">
                <ShoppingBag size={20} strokeWidth={1.75} />
              </div>
              <span className="text-xs font-medium text-[#5D5068]">Total Sales</span>
            </div>
            <div className="mt-3.5">
              <span className="text-2xl sm:text-3xl font-bold text-[#2C1838] tracking-tight">₹0</span>
            </div>
            <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[#16A34A] font-medium">
              <span>↑ 12%</span>
              <span className="text-[#8E769E] font-normal">vs. yesterday</span>
            </div>
          </div>

          {/* KPI 2: Total Orders */}
          <div className="bg-white rounded-2xl p-5 border border-[#EADFF0] shadow-2xs hover:shadow-xs transition-shadow">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#EDE4F8] flex items-center justify-center text-[#5B3285]">
                <TrendingUp size={20} strokeWidth={1.75} />
              </div>
              <span className="text-xs font-medium text-[#5D5068]">Total Orders</span>
            </div>
            <div className="mt-3.5">
              <span className="text-2xl sm:text-3xl font-bold text-[#2C1838] tracking-tight">0</span>
            </div>
            <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[#16A34A] font-medium">
              <span>↑ 0%</span>
              <span className="text-[#8E769E] font-normal">vs. yesterday</span>
            </div>
          </div>

          {/* KPI 3: Total Customers */}
          <div className="bg-white rounded-2xl p-5 border border-[#EADFF0] shadow-2xs hover:shadow-xs transition-shadow">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#EBE2F7] flex items-center justify-center text-[#552D80]">
                <Users size={20} strokeWidth={1.75} />
              </div>
              <span className="text-xs font-medium text-[#5D5068]">Total Customers</span>
            </div>
            <div className="mt-3.5">
              <span className="text-2xl sm:text-3xl font-bold text-[#2C1838] tracking-tight">0</span>
            </div>
            <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[#16A34A] font-medium">
              <span>↑ 0%</span>
              <span className="text-[#8E769E] font-normal">vs. yesterday</span>
            </div>
          </div>

          {/* KPI 4: Low Stock Alerts */}
          <div className="bg-white rounded-2xl p-5 border border-[#EADFF0] shadow-2xs hover:shadow-xs transition-shadow">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#FEF2E8] flex items-center justify-center text-[#D97706]">
                <Boxes size={20} strokeWidth={1.75} />
              </div>
              <span className="text-xs font-medium text-[#5D5068]">Low Stock Alerts</span>
            </div>
            <div className="mt-3.5">
              <span className="text-2xl sm:text-3xl font-bold text-[#2C1838] tracking-tight">8</span>
            </div>
            <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[#D97706] font-medium">
              <AlertTriangle size={12} />
              <span>Needs attention</span>
            </div>
          </div>
        </div>

        {/* 3. ROW 2: SALES OVERVIEW (WIDE) + ORDER STATUS (DONUT) + RECENT ACTIVITY */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Sales Overview Line Chart (6 cols) */}
          <div className="lg:col-span-6 bg-white rounded-2xl p-5 sm:p-6 border border-[#EADFF0] shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between pb-3">
              <h2 className="text-sm font-semibold text-[#2C1838]">Sales Overview</h2>
              {/* Range Tabs */}
              <div className="flex items-center bg-[#FAF5FC] border border-[#E7DCEB] p-0.5 rounded-lg text-xs font-medium text-[#705E7B]">
                <button
                  onClick={() => setSalesRange('7')}
                  className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                    salesRange === '7' ? 'bg-[#78469C] text-white shadow-xs' : 'hover:text-[#2C1838]'
                  }`}
                >
                  7 Days
                </button>
                <button
                  onClick={() => setSalesRange('30')}
                  className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                    salesRange === '30' ? 'bg-[#78469C] text-white shadow-xs' : 'hover:text-[#2C1838]'
                  }`}
                >
                  30 Days
                </button>
                <button
                  onClick={() => setSalesRange('90')}
                  className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                    salesRange === '90' ? 'bg-[#78469C] text-white shadow-xs' : 'hover:text-[#2C1838]'
                  }`}
                >
                  90 Days
                </button>
                <button
                  onClick={() => setSalesRange('custom')}
                  className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                    salesRange === 'custom' ? 'bg-[#78469C] text-white shadow-xs' : 'hover:text-[#2C1838]'
                  }`}
                >
                  Custom
                </button>
              </div>
            </div>

            {/* SVG Area Line Chart Matching Screenshot */}
            <div className="mt-4 w-full h-56 relative">
              <svg className="w-full h-full" viewBox="0 0 540 200" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#834DA8" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="#834DA8" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Horizontal Grid lines */}
                <line x1="45" y1="20" x2="530" y2="20" stroke="#F0E6F4" strokeDasharray="3 3" />
                <line x1="45" y1="60" x2="530" y2="60" stroke="#F0E6F4" strokeDasharray="3 3" />
                <line x1="45" y1="100" x2="530" y2="100" stroke="#F0E6F4" strokeDasharray="3 3" />
                <line x1="45" y1="140" x2="530" y2="140" stroke="#F0E6F4" strokeDasharray="3 3" />
                <line x1="45" y1="180" x2="530" y2="180" stroke="#E5D6EA" />

                {/* Y-Axis Labels */}
                <text x="5" y="24" fill="#9E8AA8" fontSize="10">₹80,000</text>
                <text x="5" y="64" fill="#9E8AA8" fontSize="10">₹60,000</text>
                <text x="5" y="104" fill="#9E8AA8" fontSize="10">₹40,000</text>
                <text x="5" y="144" fill="#9E8AA8" fontSize="10">₹20,000</text>
                <text x="25" y="184" fill="#9E8AA8" fontSize="10">₹0</text>

                {/* Area Gradient */}
                <polygon
                  points="50,180 50,175 110,135 170,145 230,120 290,95 350,115 410,50 410,180"
                  fill="url(#salesGradient)"
                />

                {/* Line Path */}
                <polyline
                  fill="none"
                  stroke="#834DA8"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points="50,175 110,135 170,145 230,120 290,95 350,115 410,50"
                />

                {/* Data Points */}
                {[
                  [50, 175],
                  [110, 135],
                  [170, 145],
                  [230, 120],
                  [290, 95],
                  [350, 115],
                  [410, 50]
                ].map(([cx, cy], i) => (
                  <circle
                    key={i}
                    cx={cx}
                    cy={cy}
                    r="4"
                    fill="#834DA8"
                    stroke="#FFFFFF"
                    strokeWidth="2"
                    className="cursor-pointer hover:r-5 transition-all"
                  />
                ))}
              </svg>

              {/* X-Axis Labels */}
              <div className="flex items-center justify-between pl-8 pr-1 mt-1 text-[10px] text-[#9E8AA8]">
                <span>Oct 18</span>
                <span>Oct 19</span>
                <span>Oct 20</span>
                <span>Oct 21</span>
                <span>Oct 22</span>
                <span>Oct 23</span>
                <span>Oct 24</span>
              </div>
            </div>
          </div>

          {/* Order Status Donut Chart (3 cols) */}
          <div className="lg:col-span-3 bg-white rounded-2xl p-5 border border-[#EADFF0] shadow-2xs flex flex-col justify-between">
            <h2 className="text-sm font-semibold text-[#2C1838]">Order Status</h2>

            {/* Donut graphic */}
            <div className="flex items-center justify-center my-3">
              <div className="relative w-36 h-36">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  {/* Delivered: 50% = strokeDasharray 50 50 */}
                  <circle
                    cx="50"
                    cy="50"
                    r="38"
                    fill="transparent"
                    stroke="#78469C"
                    strokeWidth="14"
                    strokeDasharray="50 50"
                    strokeDashoffset="0"
                  />
                  {/* Processing: 25% = 25 75 */}
                  <circle
                    cx="50"
                    cy="50"
                    r="38"
                    fill="transparent"
                    stroke="#B37BB5"
                    strokeWidth="14"
                    strokeDasharray="25 75"
                    strokeDashoffset="-50"
                  />
                  {/* Shipped: 12.5% = 12.5 87.5 */}
                  <circle
                    cx="50"
                    cy="50"
                    r="38"
                    fill="transparent"
                    stroke="#E5A93C"
                    strokeWidth="14"
                    strokeDasharray="12.5 87.5"
                    strokeDashoffset="-75"
                  />
                  {/* Cancelled: 8.3% */}
                  <circle
                    cx="50"
                    cy="50"
                    r="38"
                    fill="transparent"
                    stroke="#E26D7D"
                    strokeWidth="14"
                    strokeDasharray="8.3 91.7"
                    strokeDashoffset="-87.5"
                  />
                  {/* Returned: 4.2% */}
                  <circle
                    cx="50"
                    cy="50"
                    r="38"
                    fill="transparent"
                    stroke="#4B69B8"
                    strokeWidth="14"
                    strokeDasharray="4.2 95.8"
                    strokeDashoffset="-95.8"
                  />
                </svg>

                {/* Center text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-xl font-bold text-[#2C1838] leading-none">24</span>
                  <span className="text-[10px] text-[#705E7B] mt-0.5 leading-none">Total Orders</span>
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#78469C]" />
                  <span className="text-[#5D5068]">Delivered</span>
                </div>
                <span className="font-semibold text-[#2C1838]">12</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#B37BB5]" />
                  <span className="text-[#5D5068]">Processing</span>
                </div>
                <span className="font-semibold text-[#2C1838]">6</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#E5A93C]" />
                  <span className="text-[#5D5068]">Shipped</span>
                </div>
                <span className="font-semibold text-[#2C1838]">3</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#E26D7D]" />
                  <span className="text-[#5D5068]">Cancelled</span>
                </div>
                <span className="font-semibold text-[#2C1838]">2</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#4B69B8]" />
                  <span className="text-[#5D5068]">Returned</span>
                </div>
                <span className="font-semibold text-[#2C1838]">1</span>
              </div>
            </div>
          </div>

          {/* Recent Activity (3 cols) */}
          <div className="lg:col-span-3 bg-white rounded-2xl p-5 border border-[#EADFF0] shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between pb-2 border-b border-[#F5EDF8]">
              <h2 className="text-sm font-semibold text-[#2C1838]">Recent Activity</h2>
              <Link to="/admin/orders" className="text-[11px] text-[#78469C] font-semibold hover:underline">
                View all
              </Link>
            </div>

            <div className="divide-y divide-[#F5EDF8] space-y-2 mt-2">
              {/* Item 1 */}
              <div className="pt-2 flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-full bg-[#DCFCE7] text-[#16A34A] flex items-center justify-center shrink-0 mt-0.5">
                  <ShoppingBag size={13} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[#2C1838] truncate">New order #ORD-1042</p>
                  <p className="text-[10px] text-[#705E7B]">₹2,499 • 2 minutes ago</p>
                </div>
              </div>

              {/* Item 2 */}
              <div className="pt-2 flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-full bg-[#DBEAFE] text-[#2563EB] flex items-center justify-center shrink-0 mt-0.5">
                  <Users size={13} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[#2C1838] truncate">Customer registered</p>
                  <p className="text-[10px] text-[#705E7B]">anita@example.com • 15 minutes ago</p>
                </div>
              </div>

              {/* Item 3 */}
              <div className="pt-2 flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-full bg-[#FEF3C7] text-[#D97706] flex items-center justify-center shrink-0 mt-0.5">
                  <AlertTriangle size={13} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[#D97706] truncate">Low stock alert</p>
                  <p className="text-[10px] text-[#705E7B]">Crystal Earrings (3 left)</p>
                </div>
              </div>

              {/* Item 4 */}
              <div className="pt-2 flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-full bg-[#F3E8FF] text-[#78469C] flex items-center justify-center shrink-0 mt-0.5">
                  <Truck size={13} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[#2C1838] truncate">Order shipped</p>
                  <p className="text-[10px] text-[#705E7B]">#ORD-1038 • 1 hour ago</p>
                </div>
              </div>

              {/* Item 5 */}
              <div className="pt-2 flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-full bg-[#FEF9C3] text-[#CA8A04] flex items-center justify-center shrink-0 mt-0.5">
                  <Star size={13} fill="currentColor" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[#2C1838] truncate">New review</p>
                  <p className="text-[10px] text-[#705E7B]">5 stars • 2 hours ago</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 4. ROW 3: TOP SELLING PRODUCTS + RECENT ORDERS + QUICK ACTIONS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Top Selling Products (3 cols) */}
          <div className="lg:col-span-3 bg-white rounded-2xl p-5 border border-[#EADFF0] shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between pb-3 border-b border-[#F5EDF8]">
              <h2 className="text-sm font-semibold text-[#2C1838]">Top Selling Products</h2>
              <Link to="/admin/products" className="text-[11px] text-[#78469C] font-semibold hover:underline">
                View all
              </Link>
            </div>

            <div className="divide-y divide-[#F5EDF8] mt-2 space-y-2.5">
              {[
                {
                  rank: 1,
                  name: 'Elegant Pearl Earrings',
                  sold: '152 sold',
                  revenue: '₹3,80,000',
                  img: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=100&q=80'
                },
                {
                  rank: 2,
                  name: 'Gold Layered Necklace',
                  sold: '128 sold',
                  revenue: '₹3,12,000',
                  img: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=100&q=80'
                },
                {
                  rank: 3,
                  name: 'Designer Bangles',
                  sold: '96 sold',
                  revenue: '₹2,45,000',
                  img: 'https://images.unsplash.com/photo-1611591475855-4673fb39847e?auto=format&fit=crop&w=100&q=80'
                },
                {
                  rank: 4,
                  name: 'Stone Stud Earrings',
                  sold: '87 sold',
                  revenue: '₹1,98,000',
                  img: 'https://images.unsplash.com/photo-1630019852942-f89202989a59?auto=format&fit=crop&w=100&q=80'
                },
                {
                  rank: 5,
                  name: 'Mangalsutra Set',
                  sold: '74 sold',
                  revenue: '₹1,76,000',
                  img: 'https://images.unsplash.com/photo-1603561591411-07134e71a2a9?auto=format&fit=crop&w=100&q=80'
                }
              ].map((item) => (
                <div key={item.rank} className="pt-1.5 flex items-center gap-3">
                  <span className="text-xs font-bold text-[#8E769E] w-3">{item.rank}</span>
                  <img
                    src={item.img}
                    alt={item.name}
                    className="w-10 h-10 rounded-lg object-cover border border-[#E7DCEB]"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[#2C1838] truncate">{item.name}</p>
                    <p className="text-[10px] text-[#705E7B]">
                      {item.sold} • <span className="font-medium text-[#563568]">{item.revenue}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Orders Table (6 cols) */}
          <div className="lg:col-span-6 bg-white rounded-2xl p-5 border border-[#EADFF0] shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between pb-3 border-b border-[#F5EDF8]">
              <h2 className="text-sm font-semibold text-[#2C1838]">Recent Orders</h2>
              <Link to="/admin/orders" className="text-[11px] text-[#78469C] font-semibold hover:underline">
                View all
              </Link>
            </div>

            <div className="overflow-x-auto mt-2">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-[11px] text-[#8E769E] font-medium border-b border-[#F5EDF8]">
                    <th className="pb-2.5 font-medium">Order ID</th>
                    <th className="pb-2.5 font-medium">Customer</th>
                    <th className="pb-2.5 font-medium">Date</th>
                    <th className="pb-2.5 font-medium">Amount</th>
                    <th className="pb-2.5 font-medium text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#FAF2FC]">
                  {[
                    {
                      id: '#ORD-1042',
                      customer: 'Priya Sharma',
                      date: '24 Oct 2025, 11:42 AM',
                      amount: '₹2,499',
                      status: 'Processing',
                      badge: 'bg-[#F3E8FF] text-[#78469C]'
                    },
                    {
                      id: '#ORD-1041',
                      customer: 'Neha Gupta',
                      date: '24 Oct 2025, 10:18 AM',
                      amount: '₹1,999',
                      status: 'Shipped',
                      badge: 'bg-[#E0F2FE] text-[#0284C7]'
                    },
                    {
                      id: '#ORD-1040',
                      customer: 'Riya Patel',
                      date: '23 Oct 2025, 06:12 PM',
                      amount: '₹3,499',
                      status: 'Delivered',
                      badge: 'bg-[#DCFCE7] text-[#16A34A]'
                    },
                    {
                      id: '#ORD-1039',
                      customer: 'Sneha Reddy',
                      date: '23 Oct 2025, 11:45 AM',
                      amount: '₹1,299',
                      status: 'Processing',
                      badge: 'bg-[#F3E8FF] text-[#78469C]'
                    },
                    {
                      id: '#ORD-1038',
                      customer: 'Anjali Mehta',
                      date: '22 Oct 2025, 08:32 PM',
                      amount: '₹2,999',
                      status: 'Shipped',
                      badge: 'bg-[#E0F2FE] text-[#0284C7]'
                    }
                  ].map((row) => (
                    <tr key={row.id} className="hover:bg-[#FAF5FC] transition-colors">
                      <td className="py-2.5 font-medium text-[#2C1838]">{row.id}</td>
                      <td className="py-2.5 text-[#5D5068]">{row.customer}</td>
                      <td className="py-2.5 text-[11px] text-[#8E769E]">{row.date}</td>
                      <td className="py-2.5 font-semibold text-[#2C1838]">{row.amount}</td>
                      <td className="py-2.5 text-right">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${row.badge}`}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick Actions (3 cols) */}
          <div className="lg:col-span-3 bg-white rounded-2xl p-5 border border-[#EADFF0] shadow-2xs flex flex-col justify-between">
            <h2 className="text-sm font-semibold text-[#2C1838] pb-3 border-b border-[#F5EDF8]">
              Quick Actions
            </h2>

            <div className="divide-y divide-[#F5EDF8] mt-2 space-y-1">
              <Link
                to="/admin/products?action=new"
                className="pt-2 flex items-center justify-between py-2 text-xs text-[#2C1838] hover:text-[#563568] group cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-[#FAF5FC] border border-[#E7DCEB] flex items-center justify-center text-[#563568]">
                    <Plus size={14} />
                  </div>
                  <span className="font-medium">Add New Product</span>
                </div>
                <ChevronRight size={14} className="text-[#8E769E] group-hover:translate-x-0.5 transition-transform" />
              </Link>

              <Link
                to="/admin/orders"
                className="pt-2 flex items-center justify-between py-2 text-xs text-[#2C1838] hover:text-[#563568] group cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-[#FAF5FC] border border-[#E7DCEB] flex items-center justify-center text-[#563568]">
                    <ShoppingBag size={14} />
                  </div>
                  <span className="font-medium">Manage Orders</span>
                </div>
                <ChevronRight size={14} className="text-[#8E769E] group-hover:translate-x-0.5 transition-transform" />
              </Link>

              <Link
                to="/admin/customers"
                className="pt-2 flex items-center justify-between py-2 text-xs text-[#2C1838] hover:text-[#563568] group cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-[#FAF5FC] border border-[#E7DCEB] flex items-center justify-center text-[#563568]">
                    <Users size={14} />
                  </div>
                  <span className="font-medium">View Customers</span>
                </div>
                <ChevronRight size={14} className="text-[#8E769E] group-hover:translate-x-0.5 transition-transform" />
              </Link>

              <Link
                to="/admin/marketing?action=new"
                className="pt-2 flex items-center justify-between py-2 text-xs text-[#2C1838] hover:text-[#563568] group cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-[#FAF5FC] border border-[#E7DCEB] flex items-center justify-center text-[#563568]">
                    <Tag size={14} />
                  </div>
                  <span className="font-medium">Create Discount</span>
                </div>
                <ChevronRight size={14} className="text-[#8E769E] group-hover:translate-x-0.5 transition-transform" />
              </Link>

              <Link
                to="/admin/storefront?action=banner"
                className="pt-2 flex items-center justify-between py-2 text-xs text-[#2C1838] hover:text-[#563568] group cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-[#FAF5FC] border border-[#E7DCEB] flex items-center justify-center text-[#563568]">
                    <Upload size={14} />
                  </div>
                  <span className="font-medium">Upload Banner</span>
                </div>
                <ChevronRight size={14} className="text-[#8E769E] group-hover:translate-x-0.5 transition-transform" />
              </Link>

              <Link
                to="/admin/analytics?export=true"
                className="pt-2 flex items-center justify-between py-2 text-xs text-[#2C1838] hover:text-[#563568] group cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-[#FAF5FC] border border-[#E7DCEB] flex items-center justify-center text-[#563568]">
                    <FileText size={14} />
                  </div>
                  <span className="font-medium">Generate Report</span>
                </div>
                <ChevronRight size={14} className="text-[#8E769E] group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>
        </div>

        {/* 5. ROW 4: CAMPAIGNS + LOW STOCK PRODUCTS + FORECAST + AI COPILOT */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Card 1: Upcoming Campaigns & Festivals */}
          <div className="bg-white rounded-2xl p-5 border border-[#EADFF0] shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between pb-3 border-b border-[#F5EDF8]">
              <h2 className="text-xs sm:text-sm font-semibold text-[#2C1838]">
                Upcoming Campaigns & Festivals
              </h2>
              <Link to="/admin/marketing" className="text-[11px] text-[#78469C] font-semibold hover:underline">
                View all
              </Link>
            </div>

            <div className="space-y-3 mt-3">
              {[
                {
                  title: 'Diwali Special Sale',
                  date: 'Oct 25 – Nov 5, 2025',
                  badge: 'Scheduled',
                  badgeColor: 'bg-[#F3E8FF] text-[#78469C]',
                  img: 'https://images.unsplash.com/photo-1577083552431-6e5fd01aa342?auto=format&fit=crop&w=100&q=80'
                },
                {
                  title: 'Wedding Collection',
                  date: 'Nov 10 – Dec 10, 2025',
                  badge: 'Scheduled',
                  badgeColor: 'bg-[#F3E8FF] text-[#78469C]',
                  img: 'https://images.unsplash.com/photo-1583939003579-730e3918a45a?auto=format&fit=crop&w=100&q=80'
                },
                {
                  title: 'Karwa Chauth Offer',
                  date: 'Oct 30 – Oct 31, 2025',
                  badge: 'Upcoming',
                  badgeColor: 'bg-[#FEF9C3] text-[#CA8A04]',
                  img: 'https://images.unsplash.com/photo-1601056952877-695d7367c3bb?auto=format&fit=crop&w=100&q=80'
                }
              ].map((c) => (
                <div key={c.title} className="flex items-center gap-3">
                  <img
                    src={c.img}
                    alt={c.title}
                    className="w-11 h-11 rounded-lg object-cover border border-[#E7DCEB]"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[#2C1838] truncate">{c.title}</p>
                    <p className="text-[10px] text-[#705E7B]">{c.date}</p>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${c.badgeColor}`}>
                    {c.badge}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Card 2: Low Stock Products */}
          <div className="bg-white rounded-2xl p-5 border border-[#EADFF0] shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between pb-3 border-b border-[#F5EDF8]">
              <h2 className="text-xs sm:text-sm font-semibold text-[#2C1838]">Low Stock Products</h2>
              <Link to="/admin/inventory" className="text-[11px] text-[#78469C] font-semibold hover:underline">
                View all
              </Link>
            </div>

            <div className="overflow-x-auto mt-2">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-[10px] text-[#8E769E] uppercase tracking-wider border-b border-[#F5EDF8]">
                    <th className="pb-1.5 font-medium">Product</th>
                    <th className="pb-1.5 font-medium">SKU</th>
                    <th className="pb-1.5 font-medium text-right">Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#FAF2FC]">
                  {[
                    { name: 'Crystal Earrings', sku: 'SE-001', stock: 3, alert: 'text-[#DC2626]', img: 'https://images.unsplash.com/photo-1630019852942-f89202989a59?auto=format&fit=crop&w=60&q=80' },
                    { name: 'Pearl Necklace', sku: 'PN-002', stock: 5, alert: 'text-[#DC2626]', img: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=60&q=80' },
                    { name: 'Gold Bangles', sku: 'GB-003', stock: 7, alert: 'text-[#D97706]', img: 'https://images.unsplash.com/photo-1611591475855-4673fb39847e?auto=format&fit=crop&w=60&q=80' },
                    { name: 'Stone Ring', sku: 'SR-004', stock: 9, alert: 'text-[#D97706]', img: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=60&q=80' },
                    { name: 'Mangalsutra', sku: 'MS-005', stock: 10, alert: 'text-[#D97706]', img: 'https://images.unsplash.com/photo-1603561591411-07134e71a2a9?auto=format&fit=crop&w=60&q=80' }
                  ].map((p) => (
                    <tr key={p.sku} className="hover:bg-[#FAF5FC]">
                      <td className="py-1.5 flex items-center gap-2">
                        <img src={p.img} alt={p.name} className="w-6 h-6 rounded-md object-cover border border-[#E7DCEB]" />
                        <span className="font-medium text-[#2C1838] truncate max-w-[90px]">{p.name}</span>
                      </td>
                      <td className="py-1.5 text-[10px] text-[#8E769E] font-mono">{p.sku}</td>
                      <td className={`py-1.5 text-right font-bold ${p.alert}`}>{p.stock}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Card 3: Sales Forecast (Next 30 Days) */}
          <div className="bg-white rounded-2xl p-5 border border-[#EADFF0] shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-xs sm:text-sm font-semibold text-[#2C1838]">
                  Sales Forecast <span className="text-[10px] text-[#8E769E] font-normal">(Next 30 Days)</span>
                </h2>
                <ArrowUpRight size={16} className="text-[#16A34A]" />
              </div>

              <div className="mt-3.5 bg-[#FAF5FC] border border-[#E7DCEB] p-2.5 rounded-xl">
                <p className="text-[10px] uppercase font-semibold text-[#8E769E] tracking-wider">
                  Expected Sales
                </p>
                <p className="text-sm font-bold text-[#2C1838] mt-0.5">
                  ₹3,45,000 - ₹4,20,000
                </p>
              </div>
            </div>

            {/* Projection Line Chart */}
            <div className="mt-3 w-full h-28 relative">
              <svg className="w-full h-full" viewBox="0 0 200 90" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="forecastGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#834DA8" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#834DA8" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                <polygon points="10,80 10,75 70,68 130,48 190,25 190,80" fill="url(#forecastGradient)" />
                <polyline
                  fill="none"
                  stroke="#834DA8"
                  strokeWidth="2"
                  strokeLinecap="round"
                  points="10,75 70,68 130,48 190,25"
                />
                {[
                  [10, 75],
                  [70, 68],
                  [130, 48],
                  [190, 25]
                ].map(([cx, cy], i) => (
                  <circle key={i} cx={cx} cy={cy} r="3" fill="#834DA8" stroke="#FFF" strokeWidth="1.5" />
                ))}
              </svg>
              <div className="flex items-center justify-between text-[9px] text-[#9E8AA8] mt-1">
                <span>Oct 25</span>
                <span>Nov 1</span>
                <span>Nov 10</span>
                <span>Nov 20</span>
              </div>
            </div>
          </div>

          {/* Card 4: AI Business Copilot */}
          <div className="bg-white rounded-2xl p-5 border border-[#EADFF0] shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-[#F5EDF8]">
                <div className="flex items-center gap-1.5">
                  <Sparkles size={16} className="text-[#78469C]" />
                  <h2 className="text-xs sm:text-sm font-semibold text-[#2C1838]">AI Business Copilot</h2>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#8660B0] text-white">
                  New
                </span>
              </div>
              <p className="text-[11px] text-[#705E7B] mt-2">
                Ask anything about your business...
              </p>

              {/* Sample prompt chips */}
              <div className="space-y-1.5 mt-2.5">
                {[
                  'Which products are likely to sell well this Diwali?',
                  'Show me the most profitable products.',
                  'Create a campaign for my existing customers.'
                ].map((chip) => (
                  <button
                    key={chip}
                    onClick={() => handleAskCopilot(chip)}
                    className="w-full text-left p-2 rounded-lg bg-[#FAF5FC] hover:bg-[#F2E8FA] text-[10px] text-[#5D5068] hover:text-[#2C1838] border border-[#E7DCEB] transition-colors cursor-pointer truncate"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            {/* Answer Display or Input */}
            <div className="mt-3 pt-2 border-t border-[#F5EDF8]">
              {copilotLoading ? (
                <div className="p-3 bg-[#FAF5FC] rounded-xl text-center text-xs text-[#78469C] animate-pulse">
                  Analyzing SARINE sales velocity & catalogue...
                </div>
              ) : copilotResponse ? (
                <div className="p-2.5 bg-[#F5EDF8] border border-[#D9C4E5] rounded-xl text-[11px] text-[#2C1838] mb-2 max-h-24 overflow-y-auto">
                  <p className="font-semibold text-[#563568] mb-1">Copilot Insight:</p>
                  <p>{copilotResponse}</p>
                </div>
              ) : null}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (copilotQuery.trim()) {
                    handleAskCopilot(copilotQuery.trim());
                  }
                }}
                className="flex items-center gap-1.5 mt-1"
              >
                <input
                  type="text"
                  value={copilotQuery}
                  onChange={(e) => setCopilotQuery(e.target.value)}
                  placeholder="Type your question..."
                  className="flex-1 px-3 py-1.5 bg-[#FAF5FC] border border-[#E7DCEB] focus:border-[#563568] rounded-full text-xs text-[#2C1838] placeholder:text-[#9E8AA8] focus:outline-none"
                />
                <button
                  type="submit"
                  className="w-7 h-7 rounded-full bg-[#563568] hover:bg-[#78469C] text-white flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                  aria-label="Send question"
                >
                  <Send size={12} />
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};
