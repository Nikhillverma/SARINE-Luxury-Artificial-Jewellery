import React, { useCallback, useEffect, useState } from "react";
import { AdminLayout } from "../../components/admin/AdminLayout";
import { formatInr } from "../../utils/currency";
import {
  createMarketingCoupon, deleteMarketingCoupon, listMarketingCoupons,
  setMarketingCouponStatus, updateMarketingCoupon,
  type CouponInput, type MarketingCoupon
} from "../../services/hostinger/hostingerMarketingService";
import { Plus, RefreshCw, Tag, Pause, Play, Pencil, Trash2, X, Save } from "lucide-react";

function localDateTime(daysAhead = 30): string {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

const blankForm = (): CouponInput => ({
  code: "", discountType: "percentage", discountValue: 15, minOrder: 1999,
  maxDiscount: 1000, usageLimit: null, perCustomerLimit: 1,
  startsAt: null, expiresAt: localDateTime(30), status: "active"
});

export const AdminMarketingPage: React.FC = () => {
  const [coupons, setCoupons] = useState<MarketingCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<MarketingCoupon | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CouponInput>(blankForm());

  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try { setCoupons(await listMarketingCoupons()); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not load coupons."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const startCreate = () => { setEditing(null); setForm(blankForm()); setShowForm(true); setError(null); setNotice(null); };
  const startEdit = (coupon: MarketingCoupon) => {
    setEditing(coupon);
    setShowForm(true);
    setForm({
      code: coupon.code, discountType: coupon.discountType, discountValue: coupon.discountValue,
      minOrder: coupon.minOrder, maxDiscount: coupon.maxDiscount, usageLimit: coupon.usageLimit,
      perCustomerLimit: coupon.perCustomerLimit,
      startsAt: coupon.startsAt ? new Date(coupon.startsAt).toISOString().slice(0, 16) : null,
      expiresAt: new Date(coupon.expiresAt).toISOString().slice(0, 16),
      status: coupon.enabled ? "active" : "paused"
    });
    setError(null); setNotice(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setError(null); setNotice(null);
    try {
      const payload = { ...form, code: form.code.trim().toUpperCase(), startsAt: form.startsAt || null };
      if (editing) await updateMarketingCoupon(editing.id, payload);
      else await createMarketingCoupon(payload);
      setNotice(editing ? "Coupon updated successfully." : "Coupon created successfully.");
      setEditing(null); setShowForm(false); setForm(blankForm()); await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not save coupon."); }
    finally { setSaving(false); }
  };

  const toggle = async (coupon: MarketingCoupon) => {
    setError(null); setNotice(null);
    try {
      await setMarketingCouponStatus(coupon.id, coupon.enabled ? "paused" : "active");
      setNotice(`${coupon.code} ${coupon.enabled ? "paused" : "activated"}.`);
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not update coupon."); }
  };

  const remove = async (coupon: MarketingCoupon) => {
    if (!window.confirm(`Delete coupon ${coupon.code}? This is allowed only when it has no order history.`)) return;
    setError(null); setNotice(null);
    try { await deleteMarketingCoupon(coupon.id); setNotice(`${coupon.code} deleted.`); await refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not delete coupon."); }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-[#2C1838]">Marketing & Coupons</h1>
            <p className="mt-1 text-xs sm:text-sm text-[#705E7B]">Create real discount codes, schedule validity and control redemption limits.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => void refresh()} className="inline-flex items-center gap-2 px-3 py-2 border border-[#E7DCEB] rounded-xl text-xs"><RefreshCw size={14}/> Refresh</button>
            <button onClick={startCreate} className="inline-flex items-center gap-2 px-4 py-2 bg-[#563568] text-white rounded-xl text-xs font-semibold"><Plus size={15}/> Create coupon</button>
          </div>
        </div>

        {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">{notice}</div>}
        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</div>}

        {(showForm || coupons.length === 0) && (
          <form onSubmit={submit} className="bg-white border border-[#EADFF0] rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm text-[#2C1838]">{editing ? `Edit ${editing.code}` : "Create a coupon"}</h2>
              <button type="button" onClick={() => { setEditing(null); setShowForm(false); setForm(blankForm()); }} className="text-xs text-[#705E7B]"><X size={16}/></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <label className="text-xs text-[#705E7B]">Coupon code
                <input required minLength={3} maxLength={40} value={form.code} onChange={e=>setForm(v=>({...v,code:e.target.value.toUpperCase()}))} placeholder="SARINE15" className="mt-1 w-full rounded-lg border border-[#E7DCEB] p-2.5 text-sm uppercase"/>
              </label>
              <label className="text-xs text-[#705E7B]">Discount type
                <select value={form.discountType} onChange={e=>setForm(v=>({...v,discountType:e.target.value as CouponInput["discountType"],maxDiscount:e.target.value==="fixed"?null:v.maxDiscount}))} className="mt-1 w-full rounded-lg border border-[#E7DCEB] p-2.5 text-sm"><option value="percentage">Percentage (%)</option><option value="fixed">Fixed amount (₹)</option></select>
              </label>
              <label className="text-xs text-[#705E7B]">Discount value
                <input required type="number" min="1" max={form.discountType==="percentage"?100:1000000} step="1" value={form.discountValue} onChange={e=>setForm(v=>({...v,discountValue:Number(e.target.value)}))} className="mt-1 w-full rounded-lg border border-[#E7DCEB] p-2.5 text-sm"/>
              </label>
              <label className="text-xs text-[#705E7B]">Minimum order (₹)
                <input type="number" min="0" step="1" value={form.minOrder} onChange={e=>setForm(v=>({...v,minOrder:Number(e.target.value)}))} className="mt-1 w-full rounded-lg border border-[#E7DCEB] p-2.5 text-sm"/>
              </label>
              {form.discountType==="percentage" && <label className="text-xs text-[#705E7B]">Maximum discount cap (₹, optional)
                <input type="number" min="1" step="1" value={form.maxDiscount ?? ""} onChange={e=>setForm(v=>({...v,maxDiscount:e.target.value===""?null:Number(e.target.value)}))} className="mt-1 w-full rounded-lg border border-[#E7DCEB] p-2.5 text-sm"/>
              </label>}
              <label className="text-xs text-[#705E7B]">Total usage limit (blank = unlimited)
                <input type="number" min="1" step="1" value={form.usageLimit ?? ""} onChange={e=>setForm(v=>({...v,usageLimit:e.target.value===""?null:Number(e.target.value)}))} className="mt-1 w-full rounded-lg border border-[#E7DCEB] p-2.5 text-sm"/>
              </label>
              <label className="text-xs text-[#705E7B]">Uses per customer
                <input required type="number" min="1" max="1000" step="1" value={form.perCustomerLimit} onChange={e=>setForm(v=>({...v,perCustomerLimit:Number(e.target.value)}))} className="mt-1 w-full rounded-lg border border-[#E7DCEB] p-2.5 text-sm"/>
              </label>
              <label className="text-xs text-[#705E7B]">Starts at (optional)
                <input type="datetime-local" value={form.startsAt ?? ""} onChange={e=>setForm(v=>({...v,startsAt:e.target.value||null}))} className="mt-1 w-full rounded-lg border border-[#E7DCEB] p-2.5 text-sm"/>
              </label>
              <label className="text-xs text-[#705E7B]">Expires at
                <input required type="datetime-local" value={form.expiresAt} onChange={e=>setForm(v=>({...v,expiresAt:e.target.value}))} className="mt-1 w-full rounded-lg border border-[#E7DCEB] p-2.5 text-sm"/>
              </label>
              <label className="text-xs text-[#705E7B]">Status
                <select value={form.status} onChange={e=>setForm(v=>({...v,status:e.target.value as CouponInput["status"]}))} className="mt-1 w-full rounded-lg border border-[#E7DCEB] p-2.5 text-sm"><option value="active">Active</option><option value="paused">Paused</option></select>
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={()=>{setEditing(null);setShowForm(false);setForm(blankForm());}} className="px-4 py-2 border border-[#E7DCEB] rounded-lg text-xs">Cancel</button>
              <button disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 bg-[#563568] text-white rounded-lg text-xs font-semibold disabled:opacity-50"><Save size={14}/>{saving?"Saving...":editing?"Save changes":"Create coupon"}</button>
            </div>
          </form>
        )}

        <section className="bg-white border border-[#EADFF0] rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-[#F1E8F4] flex items-center gap-2"><Tag size={16} className="text-[#563568]"/><h2 className="font-semibold text-sm">Coupon ledger</h2><span className="ml-auto text-xs text-[#8E769E]">{coupons.length} total</span></div>
          {loading ? <div className="p-10 text-center text-xs text-[#8E769E]">Loading coupon records...</div> :
            coupons.length===0 ? <div className="p-10 text-center text-xs text-[#8E769E]">No coupons yet. Create your first coupon above.</div> :
            <div className="overflow-x-auto"><table className="w-full text-left text-xs min-w-[850px]">
              <thead className="bg-[#FAF5FC] text-[10px] uppercase tracking-wide text-[#8E769E]"><tr><th className="p-3">Code</th><th className="p-3">Offer</th><th className="p-3">Minimum</th><th className="p-3">Uses</th><th className="p-3">Expires</th><th className="p-3">Status</th><th className="p-3 text-right">Actions</th></tr></thead>
              <tbody className="divide-y divide-[#F5EDF8]">{coupons.map(c=><tr key={c.id}>
                <td className="p-3 font-mono font-bold text-[#563568]">{c.code}</td>
                <td className="p-3">{c.discountType==="percentage"?c.discountValue+"%":formatInr(c.discountValue)} off{c.maxDiscount!==null&&c.discountType==="percentage"?` (cap ${formatInr(c.maxDiscount)})`:""}</td>
                <td className="p-3">{formatInr(c.minOrder)}</td>
                <td className="p-3">{c.usedCount}{c.usageLimit!==null?` / ${c.usageLimit}`:" / ∞"}</td>
                <td className="p-3">{new Date(c.expiresAt).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"})}</td>
                <td className="p-3"><span className={`px-2 py-1 rounded-full text-[10px] ${c.status==="active"?"bg-emerald-50 text-emerald-700":c.status==="paused"?"bg-amber-50 text-amber-700":"bg-[#F3E8FF] text-[#78469C]"}`}>{c.status}</span></td>
                <td className="p-3"><div className="flex justify-end gap-2">
                  <button title="Edit coupon" onClick={()=>startEdit(c)} className="p-2 rounded-lg border border-[#E7DCEB]"><Pencil size={13}/></button>
                  <button title={c.enabled?"Pause coupon":"Activate coupon"} onClick={()=>void toggle(c)} className="p-2 rounded-lg border border-[#E7DCEB]">{c.enabled?<Pause size={13}/>:<Play size={13}/>}</button>
                  <button title="Delete coupon" onClick={()=>void remove(c)} className="p-2 rounded-lg border border-[#E7DCEB] text-red-600"><Trash2 size={13}/></button>
                </div></td>
              </tr>)}</tbody>
            </table></div>}
        </section>
        <p className="text-[11px] text-[#8E769E]">Discounts are revalidated against live MariaDB product prices during order creation. Coupons with order history cannot be deleted; pause them instead.</p>
      </div>
    </AdminLayout>
  );
};
