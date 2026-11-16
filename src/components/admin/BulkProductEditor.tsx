import React, { useMemo, useState } from "react";
import { X, CheckCircle2, AlertCircle } from "lucide-react";
import type { Product } from "../../types/product";
import type { Category } from "../../types/category";
import type { BulkProductUpdates, BulkProductUpdateResult } from "../../services/interfaces";

interface Props {
  products: Product[];
  categories: Category[];
  onApply: (updates: BulkProductUpdates) => Promise<BulkProductUpdateResult>;
  onClose: () => void;
}

export const BulkProductEditor: React.FC<Props> = ({ products, categories, onApply, onClose }) => {
  const [priceEnabled, setPriceEnabled] = useState(false);
  const [price, setPrice] = useState("");
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [comparePrice, setComparePrice] = useState("");
  const [categoryEnabled, setCategoryEnabled] = useState(false);
  const [categoryId, setCategoryId] = useState(categories[0]?.id || "");
  const [statusEnabled, setStatusEnabled] = useState(false);
  const [status, setStatus] = useState<"active" | "draft">("draft");
  const [review, setReview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<BulkProductUpdateResult | null>(null);

  const updates = useMemo<BulkProductUpdates>(() => {
    const value: BulkProductUpdates = {};
    if (priceEnabled) value.price = Number(price);
    if (compareEnabled) value.compareAtPrice = comparePrice.trim() === "" ? null : Number(comparePrice);
    if (categoryEnabled) value.categoryId = categoryId;
    if (statusEnabled) value.status = status;
    return value;
  }, [priceEnabled, price, compareEnabled, comparePrice, categoryEnabled, categoryId, statusEnabled, status]);

  const validate = () => {
    if (!Object.keys(updates).length) return "Choose at least one field to update.";
    if (priceEnabled && (!price.trim() || !Number.isFinite(Number(price)) || Number(price) < 0 || Number(price) > 99999999)) return "Enter a valid selling price.";
    if (compareEnabled && comparePrice.trim() !== "" && (!Number.isFinite(Number(comparePrice)) || Number(comparePrice) < 0 || Number(comparePrice) > 99999999)) return "Enter a valid comparison price, or leave it empty to clear it.";
    if (categoryEnabled && !categoryId) return "Choose a category.";
    return "";
  };

  const submit = async () => {
    const message = validate();
    if (message) { setError(message); return; }
    setSaving(true); setError("");
    try { setResult(await onApply(updates)); }
    catch (err) { setError(err instanceof Error ? err.message : "Bulk update failed. Please refresh before retrying."); }
    finally { setSaving(false); }
  };

  const selectedCategory = categories.find(item => item.id === categoryId)?.name || categoryId;
  return <section className="rounded-2xl border border-[#D9C8E2] bg-white p-4 sm:p-5 space-y-4">
    <div className="flex items-start justify-between gap-3">
      <div><h2 className="font-serif text-xl text-[#2C1838]">{result ? "Bulk update results" : review ? "Review bulk changes" : "Bulk product editor"}</h2>
        <p className="mt-1 text-xs text-[#806B8D]">{products.length} selected products · changes apply only to checked fields</p></div>
      <button onClick={onClose} aria-label="Close bulk editor" className="p-2"><X size={17}/></button>
    </div>
    {error && <div role="alert" className="rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}</div>}
    {result ? <>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-[#F2FBF5] p-3"><p className="text-[10px] uppercase text-[#47745A]">Updated</p><p className="mt-1 text-2xl font-semibold text-[#166534]">{result.summary.updated}</p></div>
        <div className="rounded-xl bg-[#FFF8EB] p-3"><p className="text-[10px] uppercase text-[#8B6B35]">Skipped</p><p className="mt-1 text-2xl font-semibold text-[#8B5A13]">{result.summary.skipped}</p></div>
      </div>
      <div className="max-h-56 overflow-y-auto rounded-xl border border-[#EADFF0] divide-y divide-[#F0E8F3]">
        {result.results.map(item => <div key={item.productId} className="flex items-start gap-2 px-3 py-2 text-xs">
          {item.status === "updated" ? <CheckCircle2 size={15} className="mt-0.5 text-green-700"/> : <AlertCircle size={15} className="mt-0.5 text-amber-700"/>}
          <span className="min-w-0 flex-1"><strong>{item.productName || item.productId}</strong><span className="block text-[#806B8D]">{item.message}</span></span>
        </div>)}
      </div>
      <button onClick={onClose} className="min-h-10 rounded-lg bg-[#563568] px-5 text-xs font-semibold text-white">Done</button>
    </> : !review ? <>
      <p className="text-[11px] text-[#806B8D]">Select only the fields you want to replace. Unchecked values remain untouched. Stock is excluded and must be changed through Inventory so movement history stays accurate.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex items-start gap-3 rounded-xl border border-[#EADFF0] p-3"><input type="checkbox" checked={priceEnabled} onChange={e=>setPriceEnabled(e.target.checked)} className="mt-1 accent-[#563568]"/><span className="flex-1"><strong className="block text-xs">Selling price (₹)</strong><input type="number" min="0" max="99999999" step="0.01" disabled={!priceEnabled} value={price} onChange={e=>setPrice(e.target.value)} placeholder="e.g. 1299" className="mt-2 min-h-10 w-full rounded-lg border border-[#E7DCEB] px-3 disabled:bg-gray-100"/></span></label>
        <label className="flex items-start gap-3 rounded-xl border border-[#EADFF0] p-3"><input type="checkbox" checked={compareEnabled} onChange={e=>setCompareEnabled(e.target.checked)} className="mt-1 accent-[#563568]"/><span className="flex-1"><strong className="block text-xs">Comparison price (₹)</strong><input type="number" min="0" max="99999999" step="0.01" disabled={!compareEnabled} value={comparePrice} onChange={e=>setComparePrice(e.target.value)} placeholder="Empty clears comparison price" className="mt-2 min-h-10 w-full rounded-lg border border-[#E7DCEB] px-3 disabled:bg-gray-100"/><small className="text-[10px] text-[#806B8D]">Must exceed each product's selling price.</small></span></label>
        <label className="flex items-start gap-3 rounded-xl border border-[#EADFF0] p-3"><input type="checkbox" checked={categoryEnabled} onChange={e=>setCategoryEnabled(e.target.checked)} className="mt-1 accent-[#563568]"/><span className="flex-1"><strong className="block text-xs">Category</strong><select disabled={!categoryEnabled} value={categoryId} onChange={e=>setCategoryId(e.target.value)} className="mt-2 min-h-10 w-full rounded-lg border border-[#E7DCEB] px-3 disabled:bg-gray-100">{categories.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></span></label>
        <label className="flex items-start gap-3 rounded-xl border border-[#EADFF0] p-3"><input type="checkbox" checked={statusEnabled} onChange={e=>setStatusEnabled(e.target.checked)} className="mt-1 accent-[#563568]"/><span className="flex-1"><strong className="block text-xs">Publication status</strong><select disabled={!statusEnabled} value={status} onChange={e=>setStatus(e.target.value as "active"|"draft")} className="mt-2 min-h-10 w-full rounded-lg border border-[#E7DCEB] px-3 disabled:bg-gray-100"><option value="draft">Draft / unpublished</option><option value="active">Active / published</option></select></span></label>
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t border-[#F0E8F3] pt-3"><button onClick={onClose} className="min-h-10 rounded-lg border border-[#E7DCEB] px-4 text-xs">Cancel</button><button onClick={()=>{const message=validate();setError(message);if(!message)setReview(true);}} className="min-h-10 rounded-lg bg-[#563568] px-4 text-xs font-semibold text-white">Review changes</button></div>
    </> : <>
      <div className="space-y-2 rounded-xl bg-[#FAF5FC] p-4 text-xs">
        <p><strong>Products selected:</strong> {products.length}</p>
        {priceEnabled && <p><strong>New selling price:</strong> ₹{Number(price).toLocaleString("en-IN")}</p>}
        {compareEnabled && <p><strong>Comparison price:</strong> {comparePrice.trim() ? "₹"+Number(comparePrice).toLocaleString("en-IN") : "Clear existing comparison prices"}</p>}
        {categoryEnabled && <p><strong>New category:</strong> {selectedCategory}</p>}
        {statusEnabled && <p><strong>Publication status:</strong> {status === "active" ? "Active / published" : "Draft / unpublished"}</p>}
      </div>
      <div className="max-h-44 overflow-y-auto rounded-xl border border-[#EADFF0] divide-y divide-[#F0E8F3]">{products.map(item=><div key={item.id} className="flex justify-between gap-3 px-3 py-2 text-xs"><span>{item.name}</span><span className="text-[#806B8D]">{item.status}</span></div>)}</div>
      <p className="text-[11px] text-[#806B8D]">Archived or missing products are skipped. Products whose comparison price would not exceed their selling price are skipped and identified in the results. No stock, orders or customer data is changed.</p>
      <div className="flex flex-wrap justify-end gap-2 border-t border-[#F0E8F3] pt-3"><button disabled={saving} onClick={()=>setReview(false)} className="min-h-10 rounded-lg border border-[#E7DCEB] px-4 text-xs">Back to edit</button><button disabled={saving} onClick={()=>void submit()} className="min-h-10 rounded-lg bg-[#563568] px-4 text-xs font-semibold text-white">{saving ? "Applying…" : "Confirm and apply changes"}</button></div>
    </>}
  </section>;
};
