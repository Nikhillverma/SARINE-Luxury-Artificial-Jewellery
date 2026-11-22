/**
 * AdminInventoryPage for SARINE.
 * Centralized atelier stock and inventory manager.
 * Displays live physical stock on hand, low-stock warnings, and status controls.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { categoryService, adminProductService } from '../../services';
import { Product, JEWELLERY_TYPE_LABELS } from '../../types/product';
import type { InventoryMovement } from '../../services/interfaces';
import { Category } from '../../types/category';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { InventoryAlertSettings } from '../../components/admin/InventoryAlertSettings';
import { ProductInventoryAlertControl } from '../../components/admin/ProductInventoryAlertControl';
import { inventorySettingsService } from '../../services/hostinger/inventorySettingsService';
import { formatInr } from '../../utils/currency';
import {
  Package,
  Search,
  CheckCircle2,
  Edit2,
  Plus,
  Minus
} from 'lucide-react';

const DEFAULT_LOW_STOCK_THRESHOLD = 5;

function getInventoryCostValue(product: Product): number | null {
  if (product.costPrice == null || String(product.costPrice).trim() === '') return null;
  const unitCost = Number(product.costPrice);
  const units = Number(product.stock);
  if (!Number.isFinite(unitCost) || unitCost < 0 || !Number.isFinite(units) || units < 0) return null;
  return unitCost * units;
}

export const AdminInventoryPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [lowStockThreshold, setLowStockThreshold] = useState(DEFAULT_LOW_STOCK_THRESHOLD);
  const [productThresholds, setProductThresholds] = useState<Record<string, number>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState<'name' | 'stock-low' | 'stock-high' | 'value-high' | 'value-low'>('name');
  const [page, setPage] = useState(1);
  const [movementSearch, setMovementSearch] = useState('');
  const [movementFrom, setMovementFrom] = useState('');
  const [movementTo, setMovementTo] = useState('');
  const [movementPage, setMovementPage] = useState(1);
  const [movementTotal, setMovementTotal] = useState(0);
  const [movementLoading, setMovementLoading] = useState(false);
  const [movementError, setMovementError] = useState<string | null>(null);
  const [movementRefreshKey, setMovementRefreshKey] = useState(0);
  const MOVEMENT_PAGE_SIZE = 25;
  const PAGE_SIZE = 25;

  // Stock Adjustment Modal / State
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [stockDelta, setStockDelta] = useState<number>(0);
  const [adjustmentReason, setAdjustmentReason] = useState<string>('Restock from Atelier');
  const [adjustSuccess, setAdjustSuccess] = useState<string | null>(null);
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [savingAdjustment, setSavingAdjustment] = useState(false);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [cats, prods, alertSettings] = await Promise.all([
          categoryService.getCategories({ activeOnly: false }),
          adminProductService.getProducts(),
          inventorySettingsService.get()
        ]);
        setCategories(cats);
        setProducts(prods);
        setLowStockThreshold(alertSettings.threshold);
        setProductThresholds(alertSettings.productThresholds || {});
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
      const effectiveThreshold = productThresholds[p.id] ?? lowStockThreshold;
      if (stockFilter === 'low' && (p.stock < 0 || p.stock > effectiveThreshold)) {
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
  }, [products, searchTerm, selectedCategory, statusFilter, stockFilter, lowStockThreshold, productThresholds]);

  useEffect(() => { setPage(1); }, [searchTerm, selectedCategory, statusFilter, stockFilter]);

  const sortedProducts = useMemo(() => [...filteredProducts].sort((a, b) => {
    const nameOrder = a.name.localeCompare(b.name);
    if (sortOrder === 'stock-low') return Number(a.stock) - Number(b.stock) || nameOrder;
    if (sortOrder === 'stock-high') return Number(b.stock) - Number(a.stock) || nameOrder;
    if (sortOrder === 'value-high' || sortOrder === 'value-low') {
      const aValue = getInventoryCostValue(a);
      const bValue = getInventoryCostValue(b);
      // Keep products without a recorded cost price at the bottom in either direction.
      if (aValue == null && bValue == null) return nameOrder;
      if (aValue == null) return 1;
      if (bValue == null) return -1;
      return (sortOrder === 'value-high' ? bValue - aValue : aValue - bValue) || nameOrder;
    }
    return nameOrder;
  }), [filteredProducts, sortOrder]);
  const totalPages = Math.max(1, Math.ceil(sortedProducts.length / PAGE_SIZE));
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  const visibleProducts = sortedProducts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => {
    setMovementPage(1);
  }, [movementSearch, movementFrom, movementTo]);

  useEffect(() => {
    let active = true;
    setMovementLoading(true);
    setMovementError(null);
    adminProductService.getInventoryMovements({
      page: movementPage,
      limit: MOVEMENT_PAGE_SIZE,
      search: movementSearch,
      from: movementFrom,
      to: movementTo
    }).then(result => {
      if (!active) return;
      setMovements(result.movements);
      setMovementTotal(result.total);
    }).catch(error => {
      if (active) setMovementError(error instanceof Error ? error.message : 'Inventory history could not be loaded.');
    }).finally(() => {
      if (active) setMovementLoading(false);
    });
    return () => { active = false; };
  }, [movementPage, movementSearch, movementFrom, movementTo, movementRefreshKey]);

  const movementTotalPages = Math.max(1, Math.ceil(movementTotal / MOVEMENT_PAGE_SIZE));
  const exportMovementCsv = () => {
    const columns = ['Date & Time (IST)', 'Movement Type', 'Product', 'SKU', 'Variant', 'Previous Stock', 'Quantity Change', 'New Stock', 'Reason', 'Updated By', 'Admin Email', 'Unit Cost Snapshot INR', 'Previous Stock Cost INR', 'New Stock Cost INR'];
    const cell = (value: unknown) => {
      const raw = String(value ?? '');
      const safe = ['=', '+', '-', '@', String.fromCharCode(9), String.fromCharCode(13)].includes(raw.charAt(0)) ? "'" + raw : raw;
      return '"' + safe.replace(/"/g, '""') + '"';
    };
    const rows = movements.map(movement => [
      new Date(movement.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      movement.movementType === 'variant' ? 'Variant' : 'Product',
      movement.productName, movement.sku, movement.variantLabel || '',
      movement.previousStock, movement.quantityDelta, movement.newStock,
      movement.reason, movement.adminName, movement.adminEmail,
      movement.costPriceSnapshot ?? '', movement.previousStockCostValue ?? '', movement.newStockCostValue ?? ''
    ]);
    const csv = [columns, ...rows].map(row => row.map(cell).join(',')).join('\\r\\n');
    const blob = new Blob(['\\uFEFF', csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sarine-inventory-movements-page-${movementPage}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  };
  const estimatedCostValue = products.reduce((sum, product) => sum + (Number.isFinite(product.costPrice) ? (product.costPrice || 0) * Math.max(0, product.stock) : 0), 0);
  const costCoverage = products.filter(product => Number.isFinite(product.costPrice) && (product.costPrice || 0) > 0).length;
  const exportInventoryCsv = () => {
    const columns = ['Product ID (used as SKU)', 'Product Name', 'Catalogue ID', 'Category ID', 'Jewellery Type', 'Status', 'Selling Price INR', 'Cost Price INR', 'Stock Units', 'Low Stock Threshold', 'Stock Value at Cost INR', 'Image URLs'];
    const cell = (value: unknown) => {
      const raw = String(value ?? '');
      const safe = ['=', '+', '-', '@', String.fromCharCode(9), String.fromCharCode(13)].includes(raw.charAt(0)) ? `'${raw}` : raw;
      return `"${safe.replace(/"/g, '""')}"`;
    };
    const rows = sortedProducts.map(product => [product.id, product.name, product.id, product.categoryId, product.jewelleryType, product.status, product.price, product.costPrice ?? '', product.stock, productThresholds[product.id] ?? lowStockThreshold, product.costPrice ? product.costPrice * Math.max(0, product.stock) : '', (product.images || []).join(' | ')]);
    const csv = [columns, ...rows].map(row => row.map(cell).join(',')).join('\r\n');
    const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sarine-inventory-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  };
  const lowStockCount = products.filter((p) => p.status === 'active' && p.stock >= 0 && p.stock <= (productThresholds[p.id] ?? lowStockThreshold)).length;
  const outOfStockCount = products.filter((p) => p.status === 'active' && p.stock <= 0).length;
  const totalStockUnits = products.reduce((sum, p) => sum + (p.stock || 0), 0);

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingProduct || savingAdjustment) return;

    const newStock = Math.max(0, adjustingProduct.stock + stockDelta);
    setSavingAdjustment(true);
    setAdjustError(null);
    setAdjustSuccess(null);

    try {
      // Persist the stock change and audit record atomically through the Hostinger API.
      const movement = await adminProductService.adjustStock(
        adjustingProduct.id,
        stockDelta,
        adjustmentReason
      );

      setProducts((prev) => prev.map((product) =>
        product.id === movement.productId ? { ...product, stock: movement.newStock } : product
      ));
      setMovementPage(1);
      setMovementRefreshKey(previous => previous + 1);
      setAdjustSuccess(`Recorded ${adjustingProduct.name} stock adjustment in inventory history: ${newStock} units.`);
      setAdjustingProduct(null);
      setStockDelta(0);
    } catch (err) {
      setAdjustError(
        err instanceof Error ? err.message : 'Stock could not be saved. Please try again.'
      );
    } finally {
      setSavingAdjustment(false);
    }
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

        <InventoryAlertSettings threshold={lowStockThreshold} onSaved={setLowStockThreshold} />

        {/* Feedback Alert */}
        {adjustError && (
          <div role="alert" className="p-3 bg-red-50 border border-red-200 text-xs text-red-800 rounded-xs">
            {adjustError}
          </div>
        )}

        {adjustSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 rounded-xs flex items-center gap-2">
            <CheckCircle2 size={15} />
            <span>{adjustSuccess}</span>
          </div>
        )}

        {/* Inventory health summary */}
        <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
          <div className="bg-white p-4 border border-[#E7DCEB] rounded-xs shadow-2xs space-y-1"><span className="text-[10px] uppercase tracking-wider text-[#6F6475]">Loaded catalogue</span><div className="font-serif text-2xl text-[#302438]">{products.length}</div><p className="text-[10px] text-[#6F6475]">{products.filter(p => p.status === 'active').length} active designs</p></div>

          <div className="bg-white p-4 border border-[#E7DCEB] rounded-xs shadow-2xs space-y-1"><span className="text-[10px] uppercase tracking-wider text-[#6F6475]">Low stock</span><div className="font-serif text-2xl text-amber-700">{lowStockCount}</div><p className="text-[10px] text-[#6F6475]">At or below configured threshold</p></div>

          <div className="bg-white p-4 border border-[#E7DCEB] rounded-xs shadow-2xs space-y-1"><span className="text-[10px] uppercase tracking-wider text-[#6F6475]">Out of stock</span><div className="font-serif text-2xl text-red-700">{outOfStockCount}</div><p className="text-[10px] text-[#6F6475]">Active designs with no units</p></div>
          <div className="bg-white p-4 border border-[#E7DCEB] rounded-xs shadow-2xs space-y-1"><span className="text-[10px] uppercase tracking-wider text-[#6F6475]">Physical units</span><div className="font-serif text-2xl text-[#302438]">{totalStockUnits.toLocaleString('en-IN')}</div><p className="text-[10px] text-[#6F6475]">Sum of loaded product stock</p></div>
          <div className="bg-white p-4 border border-[#E7DCEB] rounded-xs shadow-2xs space-y-1"><span className="text-[10px] uppercase tracking-wider text-[#6F6475]">Estimated cost value</span><div className="font-serif text-xl text-[#302438]">{formatInr(estimatedCostValue)}</div><p className="text-[10px] text-[#6F6475]">Cost recorded for {costCoverage}/{products.length} loaded designs</p></div>
        </div>
        <p className="text-[11px] text-[#6F6475]">Figures reflect currently loaded product records. Cost valuation excludes designs without a recorded cost price and is not a selling-price valuation.</p>

        {/* Controls Bar: Search & Filters */}
        <div className="bg-white p-4 border border-[#E7DCEB] rounded-xs shadow-2xs flex flex-wrap items-center justify-between gap-4">
          <div className="relative flex-1 min-w-[240px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6F6475]" />
            <input
              type="text"
              aria-label="Search inventory by product, SKU, or category"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by piece title, SKU, or category..."
              className="w-full pl-9 pr-3 py-2 bg-[#F7F0FA] border border-[#E7DCEB] rounded-xs text-xs text-[#302438] focus:outline-none focus:border-[#563568]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs">
            {/* Category Select */}
            <select
              aria-label="Filter inventory by category"
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
              aria-label="Filter inventory by product status"
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
              aria-label="Filter inventory by stock level"
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value)}
              className="py-2 px-3 bg-[#F7F0FA] border border-[#E7DCEB] rounded-xs focus:outline-none text-[#302438]"
            >
              <option value="all">All Stock Levels</option>
              <option value="low">Low Stock Only (product threshold)</option>
              <option value="out">Out of Stock Only</option>
              <option value="in">In Stock Only</option>
            </select>
          </div>
          <label className="text-[11px] text-[#6F6475]">Sort products<select value={sortOrder} onChange={event => { setSortOrder(event.target.value as typeof sortOrder); setPage(1); }} className="mt-1 block min-h-10 px-3 bg-[#F7F0FA] border border-[#E7DCEB] rounded-xs text-xs text-[#302438]"><option value="name">Name A–Z</option><option value="stock-low">Stock: lowest first</option><option value="stock-high">Stock: highest first</option><option value="value-high">Inventory cost value: highest first</option><option value="value-low">Inventory cost value: lowest first</option></select></label>
        </div>

        {/* Inventory Table */}
        <div className="bg-white border border-[#E7DCEB] rounded-xs shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-[#F7F0FA] text-[#6F6475] uppercase tracking-wider text-[11px] border-b border-[#E7DCEB]">
                <tr>
                  <th className="p-3">Piece Details</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Selling Price</th>
                  <th className="p-3">Unit Cost</th>
                  <th className="p-3 text-right">Inventory Cost Value</th>
                  <th className="p-3 text-center">Stock on Hand</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Low-stock Alert</th>
                  <th className="p-3 text-right">Inventory Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7DCEB]">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-[#6F6475]">
                      Loading inventory records...
                    </td>
                  </tr>
                ) : filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-[#6F6475]">
                      No jewellery pieces match your search or filter criteria.
                    </td>
                  </tr>
                ) : (
                  visibleProducts.map((p) => {
                    const effectiveThreshold = productThresholds[p.id] ?? lowStockThreshold;
                    const isLow = p.stock > 0 && p.stock <= effectiveThreshold;
                    const isOut = p.stock <= 0;

                    return (
                      <tr key={p.id} className="hover:bg-[#FAF5FC] transition-colors">
                        {/* Piece preview */}
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-14 bg-[#F7F0FA] border border-[#E7DCEB] rounded-xs overflow-hidden shrink-0">
                              {p.images?.[0] ? (
                                <img src={p.images[0]} alt={p.name} loading="lazy" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-[#B69ACF]" aria-label="No product image"><Package size={18} /></div>
                              )}
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

                        {/* Cost price and total stock value */}
                        <td className="p-3 text-[#6F6475]">{p.costPrice == null ? <span className="text-amber-700">Not set</span> : formatInr(Number(p.costPrice))}</td>
                        <td className="p-3 text-right font-medium text-[#302438]">{getInventoryCostValue(p) == null ? <span className="text-amber-700">Not available</span> : formatInr(getInventoryCostValue(p) as number)}</td>

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

                        {/* Product-specific low-stock threshold */}
                        <td className="p-3">
                          <ProductInventoryAlertControl
                            productId={p.id}
                            globalThreshold={lowStockThreshold}
                            savedThreshold={productThresholds[p.id]}
                            onSaved={(productId, threshold) => setProductThresholds(previous => {
                              const next = { ...previous };
                              if (threshold === null) delete next[productId];
                              else next[productId] = threshold;
                              return next;
                            })}
                          />
                        </td>

                        {/* Action: Stock adjustment */}
                        <td className="p-3 text-right">
                          {p.variants?.length ? (
                            <Link to="/admin/products" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#563568] text-[#563568] hover:bg-[#F7F0FA] rounded-xs transition-colors text-xs font-medium">
                              Manage Variants
                            </Link>
                          ) : (
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
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#6F6475]"><span>Showing {sortedProducts.length ? (page - 1) * PAGE_SIZE + 1 : 0}–{Math.min(page * PAGE_SIZE, sortedProducts.length)} of {sortedProducts.length} matching designs</span><div className="flex items-center gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="min-h-10 px-3 border border-[#E7DCEB] rounded-xs disabled:opacity-40">Previous</button><span>Page {page} of {totalPages}</span><button type="button" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="min-h-10 px-3 border border-[#E7DCEB] rounded-xs disabled:opacity-40">Next</button></div></div>

        {/* Complete inventory movement and cost-valuation history */}
        <section className="bg-white border border-[#E7DCEB] rounded-xs shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-[#E7DCEB] space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h2 className="font-serif text-xl text-[#302438]">Inventory Movement & Valuation History</h2><p className="text-[11px] text-[#6F6475] mt-1">Complete searchable product and variant stock ledger, including checkout deductions and admin adjustments.</p></div>
              <button type="button" onClick={exportMovementCsv} disabled={movements.length === 0 || movementLoading} className="min-h-10 px-3 border border-[#563568] text-[#563568] rounded-xs text-xs font-medium disabled:opacity-40">Export current page CSV</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2"><input value={movementSearch} onChange={event => setMovementSearch(event.target.value)} placeholder="Search product, SKU, variant, reason or admin" aria-label="Search inventory movements" className="min-h-10 px-3 border border-[#E7DCEB] bg-[#F7F0FA] rounded-xs text-xs"/><label className="text-[10px] text-[#6F6475]">From (IST)<input type="date" value={movementFrom} max={movementTo || undefined} onChange={event => setMovementFrom(event.target.value)} className="mt-1 block w-full min-h-10 px-3 border border-[#E7DCEB] bg-[#F7F0FA] rounded-xs text-xs"/></label><label className="text-[10px] text-[#6F6475]">To (IST)<input type="date" value={movementTo} min={movementFrom || undefined} onChange={event => setMovementTo(event.target.value)} className="mt-1 block w-full min-h-10 px-3 border border-[#E7DCEB] bg-[#F7F0FA] rounded-xs text-xs"/></label></div>
            <p className="text-[10px] text-[#6F6475]">{movementTotal.toLocaleString('en-IN')} matching recorded movements · Page {movementPage} of {movementTotalPages} · 25 per page</p>
            {movementError && <p role="alert" className="text-xs text-red-700">{movementError}</p>}
            <p className="text-[10px] text-[#6F6475]">Cost snapshots are recorded from this upgrade onward using the unit cost stored at each movement. Older movements without a recorded cost remain marked unavailable; no historical cost is invented.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-[#F7F0FA] text-[#6F6475] uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3">Date & Time (IST)</th><th className="p-3">Piece / Variant</th>
                  <th className="p-3">Previous</th><th className="p-3">Change</th>
                  <th className="p-3">New Balance</th><th className="p-3">Unit Cost Snapshot</th>
                  <th className="p-3">Value Before</th><th className="p-3">Value After</th>
                  <th className="p-3">Reason</th><th className="p-3">Updated By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7DCEB]">
                {movementLoading ? (
                  <tr><td colSpan={10} className="p-6 text-center text-[#6F6475]">Loading complete inventory history…</td></tr>
                ) : movements.length === 0 ? (
                  <tr><td colSpan={10} className="p-6 text-center text-[#6F6475]">No recorded movements match these filters.</td></tr>
                ) : movements.map((movement) => (
                  <tr key={movement.id + (movement.movementType || 'product')}>
                    <td className="p-3 whitespace-nowrap text-[#6F6475]">{new Date(movement.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })}</td>
                    <td className="p-3"><span className="font-medium text-[#302438]">{movement.productName}</span><span className="block text-[10px] text-[#6F6475] font-mono">{movement.sku} · {movement.movementType === 'variant' ? movement.variantLabel || 'Variant' : 'Product'}</span></td>
                    <td className="p-3 font-mono">{movement.previousStock}</td>
                    <td className={`p-3 font-mono font-semibold ${movement.quantityDelta > 0 ? 'text-emerald-700' : 'text-red-700'}`}>{movement.quantityDelta > 0 ? '+' : ''}{movement.quantityDelta}</td>
                    <td className="p-3 font-mono font-semibold">{movement.newStock}</td>
                    <td className="p-3 whitespace-nowrap">{movement.costPriceSnapshot == null ? <span className="text-amber-700">Not recorded</span> : formatInr(Number(movement.costPriceSnapshot))}</td>
                    <td className="p-3 whitespace-nowrap">{movement.previousStockCostValue == null ? '—' : formatInr(Number(movement.previousStockCostValue))}</td>
                    <td className="p-3 whitespace-nowrap">{movement.newStockCostValue == null ? '—' : formatInr(Number(movement.newStockCostValue))}</td>
                    <td className="p-3 min-w-[180px]">{movement.reason}</td>
                    <td className="p-3"><span className="block">{movement.adminName}</span><span className="text-[10px] text-[#6F6475]">{movement.adminEmail}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 border-t border-[#E7DCEB] text-xs text-[#6F6475]">
            <span>Showing {movementTotal ? (movementPage - 1) * MOVEMENT_PAGE_SIZE + 1 : 0}–{Math.min(movementPage * MOVEMENT_PAGE_SIZE, movementTotal)} of {movementTotal} movements</span>
            <div className="flex items-center gap-2"><button type="button" disabled={movementPage <= 1 || movementLoading} onClick={() => setMovementPage(page => Math.max(1, page - 1))} className="min-h-10 px-3 border border-[#E7DCEB] rounded-xs disabled:opacity-40">Previous</button><span>Page {movementPage} of {movementTotalPages}</span><button type="button" disabled={movementPage >= movementTotalPages || movementLoading} onClick={() => setMovementPage(page => Math.min(movementTotalPages, page + 1))} className="min-h-10 px-3 border border-[#E7DCEB] rounded-xs disabled:opacity-40">Next</button></div>
          </div>
        </section>

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
                    disabled={savingAdjustment || stockDelta === 0}
                    className="px-5 py-2 bg-[#563568] text-white hover:bg-[#A184BD] font-medium rounded-xs transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {savingAdjustment ? 'Saving…' : 'Confirm Stock Update'}
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
