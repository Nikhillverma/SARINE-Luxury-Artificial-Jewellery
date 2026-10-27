/**
 * AdminInventoryPage for SARINE.
 * Centralized atelier stock and inventory manager.
 * Displays live physical stock on hand, low-stock warnings, and status controls.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { productService, categoryService } from '../../services';
import { Product, isInStock, JEWELLERY_TYPE_LABELS } from '../../types/product';
import { Category } from '../../types/category';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { formatInr } from '../../utils/currency';
import {
  Package,
  Search,
  SlidersHorizontal,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Edit2,
  RefreshCw,
  Plus,
  Minus
} from 'lucide-react';

const LOW_STOCK_THRESHOLD = 5;

export const AdminInventoryPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState('all');

  // Stock Adjustment Modal / State
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [stockDelta, setStockDelta] = useState<number>(0);
  const [adjustmentReason, setAdjustmentReason] = useState<string>('Restock from Atelier');
  const [adjustSuccess, setAdjustSuccess] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [cats, prods] = await Promise.all([
          categoryService.getCategories({ activeOnly: false }),
          productService.getProducts({ sortBy: 'newest', inStockOnly: false, includeAll: true })
        ]);
        setCategories(cats);
        setProducts(prods);
      } catch (err) {
        console.error('[AdminInventoryPage] Failed to load inventory:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesId = p.id.toLowerCase().includes(q);
        const matchesType = p.jewelleryType.toLowerCase().includes(q);
        if (!matchesName && !matchesId && !matchesType) return false;
      }
      if (selectedCategory !== 'all' && p.categoryId !== selectedCategory) {
        return false;
      }
      if (statusFilter !== 'all' && p.status !== statusFilter) {
        return false;
      }
      if (stockFilter === 'low' && (p.stock <= 0 || p.stock > LOW_STOCK_THRESHOLD)) {
        return false;
      }
      if (stockFilter === 'out' && p.stock > 0) {
        return false;
      }
      if (stockFilter === 'in' && p.stock <= 0) {
        return false;
      }
      return true;
    });
  }, [products, searchTerm, selectedCategory, statusFilter, stockFilter]);

  const lowStockCount = products.filter((p) => p.status === 'active' && p.stock > 0 && p.stock <= LOW_STOCK_THRESHOLD).length;
  const outOfStockCount = products.filter((p) => p.status === 'active' && p.stock <= 0).length;
  const totalStockUnits = products.reduce((sum, p) => sum + (p.stock || 0), 0);

  const handleAdjustStock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingProduct) return;

    const newStock = Math.max(0, adjustingProduct.stock + stockDelta);
    setProducts((prev) =>
      prev.map((p) => (p.id === adjustingProduct.id ? { ...p, stock: newStock } : p))
    );

    setAdjustSuccess(`Updated ${adjustingProduct.name} stock to ${newStock} (${adjustmentReason}).`);
    setTimeout(() => setAdjustSuccess(null), 4000);
    setAdjustingProduct(null);
    setStockDelta(0);
  };

  return (
    <AdminLayout>
      <div className="space-y-6 font-sans">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E7DCEB]">
          <div>
            <span className="text-[10px] uppercase tracking-[0.25em] text-[#6F6475] font-medium block">
              SARINE ATELIER WAREHOUSE
            </span>
            <h1 className="font-serif text-2xl sm:text-3xl text-[#302438] font-normal mt-0.5">
              Inventory & Physical Stock Control
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs bg-white px-3 py-1.5 border border-[#E7DCEB] rounded-xs font-mono">
              {totalStockUnits} Total Physical Units
            </span>
          </div>
        </div>

        {/* Feedback Alert */}
        {adjustSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 rounded-xs flex items-center gap-2">
            <CheckCircle2 size={15} />
            <span>{adjustSuccess}</span>
          </div>
        )}

        {/* 3 Metric Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-4 border border-[#E7DCEB] rounded-xs shadow-2xs space-y-1">
            <span className="text-xs text-[#6F6475] uppercase tracking-wider font-medium">Catalogue Pieces</span>
            <div className="font-serif text-2xl text-[#302438]">{products.length} Designs</div>
            <p className="text-[11px] text-[#6F6475]">{products.filter((p) => p.status === 'active').length} active in public storefront</p>
          </div>

          <div className="bg-white p-4 border border-[#E7DCEB] rounded-xs shadow-2xs space-y-1">
            <span className="text-xs text-[#6F6475] uppercase tracking-wider font-medium flex items-center gap-1.5">
              <AlertTriangle size={13} className="text-amber-600" />
              <span>Low Stock Alert (&le; {LOW_STOCK_THRESHOLD} units)</span>
            </span>
            <div className="font-serif text-2xl text-amber-700">{lowStockCount} Items</div>
            <p className="text-[11px] text-[#6F6475]">Needs atelier crafting restock</p>
          </div>

          <div className="bg-white p-4 border border-[#E7DCEB] rounded-xs shadow-2xs space-y-1">
            <span className="text-xs text-[#6F6475] uppercase tracking-wider font-medium flex items-center gap-1.5">
              <XCircle size={13} className="text-[#DC2626]" />
              <span>Out of Stock</span>
            </span>
            <div className="font-serif text-2xl text-[#DC2626]">{outOfStockCount} Items</div>
            <p className="text-[11px] text-[#6F6475]">Displaying 'Awaiting Atelier' badge</p>
          </div>
        </div>

        {/* Controls Bar: Search & Filters */}
        <div className="bg-white p-4 border border-[#E7DCEB] rounded-xs shadow-2xs flex flex-wrap items-center justify-between gap-4">
          <div className="relative flex-1 min-w-[240px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6F6475]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by piece title, SKU, or category..."
              className="w-full pl-9 pr-3 py-2 bg-[#F7F0FA] border border-[#E7DCEB] rounded-xs text-xs text-[#302438] focus:outline-none focus:border-[#563568]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs">
            {/* Category Select */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="py-2 px-3 bg-[#F7F0FA] border border-[#E7DCEB] rounded-xs focus:outline-none text-[#302438]"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            {/* Status Select */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="py-2 px-3 bg-[#F7F0FA] border border-[#E7DCEB] rounded-xs focus:outline-none text-[#302438]"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="draft">Draft Only</option>
              <option value="archived">Archived</option>
            </select>

            {/* Stock Level Select */}
            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value)}
              className="py-2 px-3 bg-[#F7F0FA] border border-[#E7DCEB] rounded-xs focus:outline-none text-[#302438]"
            >
              <option value="all">All Stock Levels</option>
              <option value="low">Low Stock Only (&le; 5)</option>
              <option value="out">Out of Stock Only</option>
              <option value="in">In Stock Only</option>
            </select>
          </div>
        </div>

        {/* Inventory Table */}
        <div className="bg-white border border-[#E7DCEB] rounded-xs shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-[#F7F0FA] text-[#6F6475] uppercase tracking-wider text-[11px] border-b border-[#E7DCEB]">
                <tr>
                  <th className="p-3">Piece Details</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Price</th>
                  <th className="p-3 text-center">Stock on Hand</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Inventory Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7DCEB]">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-[#6F6475]">
                      Loading inventory records...
                    </td>
                  </tr>
                ) : filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-[#6F6475]">
                      No jewellery pieces match your search or filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((p) => {
                    const isLow = p.stock > 0 && p.stock <= LOW_STOCK_THRESHOLD;
                    const isOut = p.stock <= 0;

                    return (
                      <tr key={p.id} className="hover:bg-[#FAF5FC] transition-colors">
                        {/* Piece preview */}
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-14 bg-[#F7F0FA] border border-[#E7DCEB] rounded-xs overflow-hidden shrink-0">
                              <img
                                src={p.images[0] || 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=800&q=80'}
                                alt={p.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="min-w-0">
                              <span className="font-medium text-[#302438] block truncate max-w-[220px]">
                                {p.name}
                              </span>
                              <span className="text-[11px] text-[#6F6475] font-mono">
                                SKU: {p.id.toUpperCase()}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Category */}
                        <td className="p-3 text-[#6F6475]">
                          {JEWELLERY_TYPE_LABELS[p.jewelleryType] || p.jewelleryType}
                        </td>

                        {/* Price */}
                        <td className="p-3 font-medium text-[#302438]">
                          {formatInr(p.price)}
                        </td>

                        {/* Stock On Hand */}
                        <td className="p-3 text-center">
                          <span
                            className={`font-mono text-sm font-semibold px-2.5 py-1 rounded-xs inline-block ${
                              isOut
                                ? 'bg-red-50 text-[#DC2626] border border-red-200'
                                : isLow
                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                : 'bg-[#FAF5FC] text-[#302438] border border-[#E7DCEB]'
                            }`}
                          >
                            {p.stock}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="p-3">
                          <span
                            className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-xs font-medium ${
                              p.status === 'active'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : 'bg-gray-100 text-gray-700 border border-gray-200'
                            }`}
                          >
                            {p.status}
                          </span>
                        </td>

                        {/* Action: Stock adjustment */}
                        <td className="p-3 text-right">
                          <button
                            onClick={() => {
                              setAdjustingProduct(p);
                              setStockDelta(0);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#563568] text-[#563568] hover:bg-[#563568] hover:text-white rounded-xs transition-colors cursor-pointer text-xs font-medium"
                          >
                            <Edit2 size={12} />
                            <span>Adjust Stock</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Adjust Stock Modal */}
        {adjustingProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              onClick={() => setAdjustingProduct(null)}
              className="fixed inset-0 bg-[#302438]/50 backdrop-blur-xs"
            />
            <div className="relative bg-white w-full max-w-md p-6 border border-[#E7DCEB] rounded-xs shadow-2xl z-10 space-y-4">
              <div className="pb-3 border-b border-[#E7DCEB]">
                <h3 className="font-serif text-lg text-[#302438]">Adjust Atelier Stock</h3>
                <p className="text-xs text-[#6F6475] mt-0.5">{adjustingProduct.name}</p>
              </div>

              <form onSubmit={handleAdjustStock} className="space-y-4 text-xs font-sans">
                <div className="flex items-center justify-between p-3 bg-[#FAF5FC] border border-[#E7DCEB] rounded-xs">
                  <span>Current Physical Stock:</span>
                  <span className="font-mono font-semibold text-base">{adjustingProduct.stock} units</span>
                </div>

                <div>
                  <label className="block text-[#6F6475] mb-1 font-medium">Quantity Adjustment (+ or -)</label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setStockDelta((d) => d - 1)}
                      className="w-9 h-9 flex items-center justify-center border border-[#E7DCEB] rounded-xs hover:bg-[#F7F0FA] text-base"
                    >
                      <Minus size={14} />
                    </button>
                    <input
                      type="number"
                      value={stockDelta}
                      onChange={(e) => setStockDelta(parseInt(e.target.value, 10) || 0)}
                      className="flex-1 p-2 text-center font-mono font-semibold text-sm bg-[#F7F0FA] border border-[#E7DCEB] rounded-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setStockDelta((d) => d + 1)}
                      className="w-9 h-9 flex items-center justify-center border border-[#E7DCEB] rounded-xs hover:bg-[#F7F0FA] text-base"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  <p className="text-[11px] text-[#6F6475] mt-1">
                    New resulting balance: <span className="font-mono font-semibold text-[#302438]">{Math.max(0, adjustingProduct.stock + stockDelta)} units</span>
                  </p>
                </div>

                <div>
                  <label className="block text-[#6F6475] mb-1 font-medium">Reason for Inventory Adjustment</label>
                  <select
                    value={adjustmentReason}
                    onChange={(e) => setAdjustmentReason(e.target.value)}
                    className="w-full p-2 bg-[#F7F0FA] border border-[#E7DCEB] rounded-xs focus:outline-none"
                  >
                    <option value="Restock from Atelier">Restock from Atelier</option>
                    <option value="Damaged / Inspection Pull">Damaged / Inspection Pull</option>
                    <option value="Inventory Physical Reconciliation">Inventory Physical Reconciliation</option>
                    <option value="Customer Return Restored">Customer Return Restored</option>
                  </select>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustingProduct(null)}
                    className="px-4 py-2 border border-[#E7DCEB] text-[#6F6475] rounded-xs hover:bg-[#F7F0FA]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-[#563568] text-white hover:bg-[#A184BD] font-medium rounded-xs transition-colors"
                  >
                    Confirm Stock Update
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};
