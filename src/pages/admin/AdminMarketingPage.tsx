import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AdminLayout } from "../../components/admin/AdminLayout";
import { formatInr } from "../../utils/currency";
import {
  createMarketingCoupon, deleteMarketingCoupon, listMarketingCoupons,
  setMarketingCouponStatus, updateMarketingCoupon,
  type CouponInput, type MarketingCoupon
} from "../../services/hostinger/hostingerMarketingService";
import { Plus, RefreshCw, Tag, Pause, Play, Pencil, Trash2, X, Save, Search, Download, Filter, Ticket, Clock3, CheckCircle2, AlertTriangle } from "lucide-react";

type CouponState = "all" | "active" | "scheduled" | "paused" | "expired" | "exhausted";
type SortMode = "newest" | "expiry-soon" | "expiry-late" | "most-used" | "least-used" | "discount-high" | "code";
const PAGE_SIZE = 25;

function localDateTime(daysAhead = 30): string {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}
function toLocalInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}
function getCouponState(coupon: MarketingCoupon): Exclude<CouponState, "all"> {
  const now = Date.now();
  const start = coupon.startsAt ? new Date(coupon.startsAt).getTime() : null;
  const end = new Date(coupon.expiresAt).getTime();
  if (!coupon.enabled || coupon.status === "paused") return "paused";
  if (Number.isFinite(end) && end <= now) return "expired";
  if (start !== null && Number.isFinite(start) && start > now) return "scheduled";
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) return "exhausted";
  return "active";
}
function csvCell(value: unknown): string {
  let text = String(value ?? "");
  if (/^[\s\u0000-\u001f]*[=+\-@]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
function exportCoupons(coupons: MarketingCoupon[]) {
  const rows: unknown[][] = [
    ["Coupon code", "Discount type", "Discount value", "Maximum discount INR", "Minimum order INR", "Used count", "Usage limit", "Uses per customer", "Starts at", "Expires at", "Effective status"],
    ...coupons.map(c => [c.code, c.discountType, c.discountValue, c.maxDiscount ?? "", c.minOrder, c.usedCount, c.usageLimit ?? "Unlimited", c.perCustomerLimit, c.startsAt ?? "", c.expiresAt, getCouponState(c)])
  ];
  const csv = rows.map(row => row.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = "sarine-coupon-report.csv";
  document.body.appendChild(anchor); anchor.click(); anchor.remove();
  URL.revokeObjectURL(url);
}
const blankForm = (): CouponInput => ({
  code: "", discountType: "percentage", discountValue: 15, minOrder: 1999,
  maxDiscount: 1000, usageLimit: null, perCustomerLimit: 1,
  startsAt: null, expiresAt: localDateTime(30), status: "paused"
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
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<CouponState>("all");
  const [sort, setSort] = useState<SortMode>("newest");
  const [page, setPage] = useState(1);

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
      startsAt: toLocalInput(coupon.startsAt),
      expiresAt: toLocalInput(coupon.expiresAt),
      status: coupon.enabled ? "active" : "paused"
    });
    setError(null); setNotice(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const visibleCoupons = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return coupons.filter(coupon => {
      const state = getCouponState(coupon);
      const matchesSearch = !needle || coupon.code.toLowerCase().includes(needle) || coupon.discountType.includes(needle);
      return matchesSearch && (statusFilter === "all" || state === statusFilter);
    }).sort((a, b) => {
      if (sort === "expiry-soon") return new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime();
      if (sort === "expiry-late") return new Date(b.expiresAt).getTime() - new Date(a.expiresAt).getTime();
      if (sort === "most-used") return b.usedCount - a.usedCount;
      if (sort === "least-used") return a.usedCount - b.usedCount;
      if (sort === "discount-high") return (b.discountType === "percentage" ? b.discountValue : 0) - (a.discountType === "percentage" ? a.discountValue : 0);
      if (sort === "code") return a.code.localeCompare(b.code);
      return new Date(b.startsAt || b.expiresAt).getTime() - new Date(a.startsAt || a.expiresAt).getTime();
    });
  }, [coupons, search, statusFilter, sort]);
  const pageCount = Math.max(1, Math.ceil(visibleCoupons.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageCoupons = visibleCoupons.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  useEffect(() => { setPage(1); }, [search, statusFilter, sort]);

  const stateCounts = useMemo(() => {
    const counts = { active: 0, scheduled: 0, paused: 0, expired: 0, exhausted: 0 };
    coupons.forEach(coupon => { counts[getCouponState(coupon)] += 1; });
    return counts;
  }, [coupons]);
  const totalUses = coupons.reduce((sum, coupon) => sum + Math.max(0, Number(coupon.usedCount) || 0), 0);
  const usedLimited = coupons.filter(c => c.usageLimit !== null);
  const remainingUses = usedLimited.reduce((sum, c) => sum + Math.max(0, c.usageLimit! - c.usedCount), 0);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const code = form.code.trim().toUpperCase();
    const startsAt = form.startsAt ? new Date(form.startsAt).getTime() : null;
    const expiresAt = new Date(form.expiresAt).getTime();
    if (!/^[A-Z0-9_-]{3,40}$/.test(code)) { setError("Use 3–40 characters: letters, numbers, hyphens or underscores."); return; }
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) { setError("Choose an expiry date and time in the future."); return; }
    if (startsAt !== null && (!Number.isFinite(startsAt) || startsAt >= expiresAt)) { setError("The start date must be earlier than the expiry date."); return; }
    if (!Number.isFinite(form.discountValue) || form.discountValue <= 0 || (form.discountType === "percentage" && form.discountValue > 100)) { setError("Enter a valid discount (1–100% or a positive fixed amount)."); return; }
    if (!Number.isFinite(form.minOrder) || form.minOrder < 0 || !Number.isInteger(form.perCustomerLimit) || form.perCustomerLimit < 1) { setError("Check the minimum order and per-customer usage limit."); return; }
    if (form.usageLimit !== null && (!Number.isInteger(form.usageLimit) || form.usageLimit < 1)) { setError("Total usage limit must be a positive whole number or left unlimited."); return; }
    if (form.maxDiscount !== null && (!Number.isFinite(form.maxDiscount) || form.maxDiscount <= 0)) { setError("Maximum discount must be a positive amount or left blank."); return; }
    const duplicate = coupons.some(c => c.code.toUpperCase() === code && c.id !== editing?.id);
    if (duplicate) { setError("That coupon code already exists. Choose a unique code."); return; }
    const isLiveChange = form.status === "active" && (!editing || !editing.enabled || editing.code !== code || editing.discountValue !== form.discountValue || editing.discountType !== form.discountType || editing.expiresAt !== new Date(form.expiresAt).toISOString());
    if (isLiveChange && !window.confirm(editing ? "Save these changes to an enabled coupon? Customers may receive the updated offer immediately." : "Create this coupon as active? Customers may be able to use it as soon as its start time arrives.")) return;
    setSaving(true); setError(null); setNotice(null);
    try {
      const payload = { ...form, code, startsAt: form.startsAt || null };
      if (editing) await updateMarketingCoupon(editing.id, payload);
      else await createMarketingCoupon(payload);
      setNotice(editing ? "Coupon updated successfully." : "Coupon created successfully.");
      setEditing(null); setShowForm(false); setForm(blankForm()); await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not save coupon."); }
    finally { setSaving(false); }
  };

  const toggle = async (coupon: MarketingCoupon) => {
    const nextStatus = coupon.enabled ? "paused" : "active";
    if (!window.confirm(coupon.enabled ? `Pause ${coupon.code}? Customers will no longer be able to redeem it.` : `Activate ${coupon.code}? Customers may redeem it immediately if its schedule and limits allow.`)) return;
    setError(null); setNotice(null);
    try {
      await setMarketingCouponStatus(coupon.id, nextStatus);
      setNotice(`${coupon.code} ${nextStatus === "paused" ? "paused" : "activated"}.`);
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not update coupon."); }
  };
  const remove = async (coupon: MarketingCoupon) => {
    if (coupon.usedCount > 0) { setError(`${coupon.code} has redemption history. Pause it instead; historical coupon usage must be preserved.`); return; }
    if (!window.confirm(`Permanently delete ${coupon.code}? This is only appropriate when it has no order history.`)) return;
    setError(null); setNotice(null);
    try { await deleteMarketingCoupon(coupon.id); setNotice(`${coupon.code} deleted.`); await refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not delete coupon."); }
  };
  const clearFilters = () => { setSearch(""); setStatusFilter("all"); setSort("newest"); };
  const hasFilters = Boolean(search || statusFilter !== "all" || sort !== "newest");

  return (
    <AdminLayout>
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-[#8E769E]">Growth & retention</p>
            <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-[#2C1838]">Marketing & Coupons</h1>
            <p className="mt-1 text-xs sm:text-sm text-[#705E7B]">Manage discount codes, redemption limits and offer validity from one workspace.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => void refresh()} disabled={loading} className="inline-flex min-h-11 items-center gap-2 px-3 border border-[#E7DCEB] rounded-xl text-xs disabled:opacity-50"><RefreshCw size={14} className={loading ? "animate-spin" : ""}/> Refresh</button>
            <button onClick={() => exportCoupons(visibleCoupons)} disabled={loading || visibleCoupons.length === 0} className="inline-flex min-h-11 items-center gap-2 px-3 border border-[#E7DCEB] rounded-xl text-xs disabled:opacity-40"><Download size={14}/> Export CSV</button>
            <button onClick={startCreate} className="inline-flex min-h-11 items-center gap-2 px-4 bg-[#563568] text-white rounded-xl text-xs font-semibold"><Plus size={15}/> Create coupon</button>
          </div>
        </div>
        {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">{notice}</div>}
        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</div>}

        <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
          <div className="bg-white border border-[#EADFF0] rounded-2xl p-4"><div className="flex items-center gap-2 text-xs text-[#705E7B]"><Ticket size={14}/> Total coupons</div><div className="font-serif text-2xl mt-2 tabular-nums">{coupons.length}</div><p className="text-[10px] text-[#8E769E] mt-1">Loaded coupon records</p></div>
          <div className="bg-white border border-[#EADFF0] rounded-2xl p-4"><div className="flex items-center gap-2 text-xs text-[#705E7B]"><CheckCircle2 size={14}/> Active</div><div className="font-serif text-2xl mt-2 tabular-nums">{stateCounts.active}</div><p className="text-[10px] text-[#8E769E] mt-1">Currently redeemable by schedule</p></div>
          <div className="bg-white border border-[#EADFF0] rounded-2xl p-4"><div className="flex items-center gap-2 text-xs text-[#705E7B]"><Clock3 size={14}/> Scheduled</div><div className="font-serif text-2xl mt-2 tabular-nums">{stateCounts.scheduled}</div><p className="text-[10px] text-[#8E769E] mt-1">Enabled, start time is future</p></div>
          <div className="bg-white border border-[#EADFF0] rounded-2xl p-4"><div className="flex items-center gap-2 text-xs text-[#705E7B]"><Pause size={14}/> Paused / expired</div><div className="font-serif text-2xl mt-2 tabular-nums">{stateCounts.paused + stateCounts.expired}</div><p className="text-[10px] text-[#8E769E] mt-1">{stateCounts.paused} paused · {stateCounts.expired} expired</p></div>
          <div className="bg-white border border-[#EADFF0] rounded-2xl p-4"><div className="flex items-center gap-2 text-xs text-[#705E7B]"><Tag size={14}/> Redemptions</div><div className="font-serif text-2xl mt-2 tabular-nums">{totalUses.toLocaleString("en-IN")}</div><p className="text-[10px] text-[#8E769E] mt-1">{stateCounts.exhausted} exhausted · {remainingUses.toLocaleString("en-IN")} remaining on limited coupons</p></div>
        </div>
        <div className="rounded-xl border border-[#E7DCEB] bg-[#FAF5FC] p-3 text-[11px] text-[#705E7B] flex items-start gap-2"><AlertTriangle size={15} className="shrink-0 mt-0.5"/>Metrics and CSV are based on the coupons returned by the existing admin API. Redemption totals are coupon usage counts, not attributed revenue or discount value; order-level coupon analytics are not exposed by the current service.</div>

        {(showForm || coupons.length === 0) && (
          <form onSubmit={submit} className="bg-white border border-[#EADFF0] rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between"><div><h2 className="font-semibold text-sm text-[#2C1838]">{editing ? `Edit ${editing.code}` : "Create a coupon"}</h2><p className="text-[11px] text-[#8E769E] mt-1">New coupons default to paused so you can review them before activation.</p></div><button type="button" onClick={() => { setEditing(null); setShowForm(false); setForm(blankForm()); }} aria-label="Close coupon form" className="min-h-10 min-w-10 grid place-items-center text-xs text-[#705E7B]"><X size={16}/></button></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <label className="text-xs text-[#705E7B]">Coupon code<input required minLength={3} maxLength={40} pattern="[A-Za-z0-9_-]{3,40}" value={form.code} onChange={e=>setForm(v=>({...v,code:e.target.value.toUpperCase()}))} placeholder="SARINE15" className="mt-1 w-full min-h-11 rounded-lg border border-[#E7DCEB] p-2.5 text-sm uppercase"/></label>
              <label className="text-xs text-[#705E7B]">Discount type<select value={form.discountType} onChange={e=>setForm(v=>({...v,discountType:e.target.value as CouponInput["discountType"],maxDiscount:e.target.value==="fixed"?null:v.maxDiscount}))} className="mt-1 w-full min-h-11 rounded-lg border border-[#E7DCEB] p-2.5 text-sm"><option value="percentage">Percentage (%)</option><option value="fixed">Fixed amount (₹)</option></select></label>
              <label className="text-xs text-[#705E7B]">Discount value<input required type="number" min="1" max={form.discountType==="percentage"?100:1000000} step="1" value={form.discountValue} onChange={e=>setForm(v=>({...v,discountValue:Number(e.target.value)}))} className="mt-1 w-full min-h-11 rounded-lg border border-[#E7DCEB] p-2.5 text-sm"/></label>
              <label className="text-xs text-[#705E7B]">Minimum order (₹)<input type="number" min="0" step="1" value={form.minOrder} onChange={e=>setForm(v=>({...v,minOrder:Number(e.target.value)}))} className="mt-1 w-full min-h-11 rounded-lg border border-[#E7DCEB] p-2.5 text-sm"/></label>
              {form.discountType==="percentage" && <label className="text-xs text-[#705E7B]">Maximum discount cap (₹, optional)<input type="number" min="1" step="1" value={form.maxDiscount ?? ""} onChange={e=>setForm(v=>({...v,maxDiscount:e.target.value===""?null:Number(e.target.value)}))} className="mt-1 w-full min-h-11 rounded-lg border border-[#E7DCEB] p-2.5 text-sm"/></label>}
              <label className="text-xs text-[#705E7B]">Total usage limit (blank = unlimited)<input type="number" min="1" step="1" value={form.usageLimit ?? ""} onChange={e=>setForm(v=>({...v,usageLimit:e.target.value===""?null:Number(e.target.value)}))} className="mt-1 w-full min-h-11 rounded-lg border border-[#E7DCEB] p-2.5 text-sm"/></label>
              <label className="text-xs text-[#705E7B]">Uses per customer<input required type="number" min="1" max="1000" step="1" value={form.perCustomerLimit} onChange={e=>setForm(v=>({...v,perCustomerLimit:Number(e.target.value)}))} className="mt-1 w-full min-h-11 rounded-lg border border-[#E7DCEB] p-2.5 text-sm"/></label>
              <label className="text-xs text-[#705E7B]">Starts at (optional)<input type="datetime-local" value={form.startsAt ?? ""} onChange={e=>setForm(v=>({...v,startsAt:e.target.value||null}))} className="mt-1 w-full min-h-11 rounded-lg border border-[#E7DCEB] p-2.5 text-sm"/></label>
              <label className="text-xs text-[#705E7B]">Expires at<input required type="datetime-local" value={form.expiresAt} min={form.startsAt || undefined} onChange={e=>setForm(v=>({...v,expiresAt:e.target.value}))} className="mt-1 w-full min-h-11 rounded-lg border border-[#E7DCEB] p-2.5 text-sm"/></label>
              <label className="text-xs text-[#705E7B]">Status<select value={form.status} onChange={e=>setForm(v=>({...v,status:e.target.value as CouponInput["status"]}))} className="mt-1 w-full min-h-11 rounded-lg border border-[#E7DCEB] p-2.5 text-sm"><option value="paused">Paused (recommended)</option><option value="active">Active (requires confirmation)</option></select></label>
            </div>
            <div className="flex flex-wrap justify-end gap-2"><button type="button" onClick={()=>{setEditing(null);setShowForm(false);setForm(blankForm());}} className="min-h-11 px-4 border border-[#E7DCEB] rounded-lg text-xs">Cancel</button><button disabled={saving} className="min-h-11 inline-flex items-center gap-2 px-4 bg-[#563568] text-white rounded-lg text-xs font-semibold disabled:opacity-50"><Save size={14}/>{saving?"Saving...":editing?"Save changes":"Create coupon"}</button></div>
          </form>
        )}

        <section className="bg-white border border-[#EADFF0] rounded-2xl overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-[#F1E8F4] flex flex-col sm:flex-row sm:items-center gap-2"><div className="flex items-center gap-2"><Tag size={16} className="text-[#563568]"/><h2 className="font-semibold text-sm">Coupon ledger</h2></div><span className="text-xs text-[#8E769E] sm:ml-auto">{visibleCoupons.length} matching · {coupons.length} loaded</span></div>
          <div className="p-3 border-b border-[#F1E8F4] grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
            <label className="relative sm:col-span-2 xl:col-span-2"><span className="sr-only">Search coupons</span><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E769E]"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search coupon code…" className="w-full min-h-11 pl-9 pr-3 border border-[#E7DCEB] rounded-lg text-xs"/></label>
            <label className="text-[10px] text-[#705E7B]"><span className="sr-only">Filter by status</span><select aria-label="Filter by coupon status" value={statusFilter} onChange={e=>setStatusFilter(e.target.value as CouponState)} className="w-full min-h-11 px-3 border border-[#E7DCEB] rounded-lg bg-white text-xs"><option value="all">All statuses</option><option value="active">Active</option><option value="scheduled">Scheduled</option><option value="paused">Paused</option><option value="expired">Expired</option><option value="exhausted">Usage limit reached</option></select></label>
            <label className="text-[10px] text-[#705E7B]"><span className="sr-only">Sort coupons</span><select aria-label="Sort coupons" value={sort} onChange={e=>setSort(e.target.value as SortMode)} className="w-full min-h-11 px-3 border border-[#E7DCEB] rounded-lg bg-white text-xs"><option value="newest">Recently scheduled</option><option value="expiry-soon">Expiry: soonest</option><option value="expiry-late">Expiry: latest</option><option value="most-used">Most redeemed</option><option value="least-used">Least redeemed</option><option value="discount-high">Highest percentage</option><option value="code">Code A–Z</option></select></label>
          </div>
          {loading ? <div className="p-10 text-center text-xs text-[#8E769E]">Loading coupon records…</div> :
            coupons.length===0 ? <div className="p-10 text-center text-xs text-[#8E769E]">No coupons yet. Create your first coupon above.</div> :
            visibleCoupons.length===0 ? <div className="p-10 text-center text-xs text-[#8E769E]"><Filter size={22} className="mx-auto mb-2"/>No coupons match these filters.<button onClick={clearFilters} className="block mx-auto mt-2 text-[#563568] underline">Clear filters</button></div> :
            <div className="overflow-x-auto"><table className="w-full text-left text-xs min-w-[920px]">
              <thead className="bg-[#FAF5FC] text-[10px] uppercase tracking-wide text-[#8E769E]"><tr><th className="p-3">Code / offer</th><th className="p-3">Minimum order</th><th className="p-3">Redemptions</th><th className="p-3">Validity</th><th className="p-3">Status</th><th className="p-3 text-right">Actions</th></tr></thead>
              <tbody className="divide-y divide-[#F5EDF8]">{pageCoupons.map(c=>{
                const state=getCouponState(c);
                const stateClass=state==="active"?"bg-emerald-50 text-emerald-700":state==="scheduled"?"bg-blue-50 text-blue-700":state==="paused"?"bg-amber-50 text-amber-700":state==="exhausted"?"bg-orange-50 text-orange-700":"bg-[#F3E8FF] text-[#78469C]";
                return <tr key={c.id} className="hover:bg-[#FCFAFD]">
                  <td className="p-3"><div className="font-mono font-bold text-[#563568]">{c.code}</div><div className="mt-1 text-[#705E7B]">{c.discountType==="percentage"?c.discountValue+"%":formatInr(c.discountValue)} off{c.maxDiscount!==null&&c.discountType==="percentage"?` · cap ${formatInr(c.maxDiscount)}`:""}</div><div className="text-[10px] text-[#8E769E]">{c.perCustomerLimit} use{c.perCustomerLimit===1?"":"s"} per customer</div></td>
                  <td className="p-3">{formatInr(c.minOrder)}</td>
                  <td className="p-3 tabular-nums">{c.usedCount.toLocaleString("en-IN")}{c.usageLimit!==null?` / ${c.usageLimit.toLocaleString("en-IN")}`:" / Unlimited"}{c.usageLimit!==null&&<div className="mt-1 h-1.5 w-24 rounded-full bg-[#F1E8F4] overflow-hidden"><div className="h-full bg-[#8E6AA2]" style={{width:`${Math.min(100,Math.max(0,c.usedCount/c.usageLimit*100))}%`}}/></div>}</td>
                  <td className="p-3"><div>From {c.startsAt?new Date(c.startsAt).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"}):"immediately"}</div><div className="text-[10px] text-[#8E769E] mt-1">Until {new Date(c.expiresAt).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"})}</div></td>
                  <td className="p-3"><span className={`inline-flex px-2 py-1 rounded-full text-[10px] ${stateClass}`}>{state}</span></td>
                  <td className="p-3"><div className="flex justify-end gap-2">
                    <button aria-label={`Edit ${c.code}`} title="Edit coupon" onClick={()=>startEdit(c)} className="min-h-10 min-w-10 grid place-items-center rounded-lg border border-[#E7DCEB]"><Pencil size={13}/></button>
                    <button aria-label={c.enabled?`Pause ${c.code}`:`Activate ${c.code}`} title={c.enabled?"Pause coupon":"Activate coupon"} onClick={()=>void toggle(c)} className="min-h-10 min-w-10 grid place-items-center rounded-lg border border-[#E7DCEB]">{c.enabled?<Pause size={13}/>:<Play size={13}/>}</button>
                    <button aria-label={`Delete ${c.code}`} title="Delete coupon" onClick={()=>void remove(c)} disabled={c.usedCount>0} className="min-h-10 min-w-10 grid place-items-center rounded-lg border border-[#E7DCEB] text-red-600 disabled:opacity-30 disabled:cursor-not-allowed"><Trash2 size={13}/></button>
                  </div></td>
                </tr>;
              })}</tbody>
            </table></div>}
          {!loading && visibleCoupons.length>0 && <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 border-t border-[#F1E8F4]"><p className="text-[10px] text-[#8E769E]">Showing {(currentPage-1)*PAGE_SIZE+1}–{Math.min(currentPage*PAGE_SIZE,visibleCoupons.length)} of {visibleCoupons.length} matching coupons</p><div className="flex items-center gap-2"><button disabled={currentPage<=1} onClick={()=>setPage(p=>Math.max(1,p-1))} className="min-h-10 px-3 border border-[#E7DCEB] rounded-lg text-xs disabled:opacity-40">Previous</button><span className="text-xs tabular-nums text-[#705E7B]">Page {currentPage} / {pageCount}</span><button disabled={currentPage>=pageCount} onClick={()=>setPage(p=>Math.min(pageCount,p+1))} className="min-h-10 px-3 border border-[#E7DCEB] rounded-lg text-xs disabled:opacity-40">Next</button></div></div>}
        </section>
        <p className="text-[11px] text-[#8E769E]">Discounts are revalidated against live MariaDB product prices during order creation. Redemption revenue and discount totals are not displayed because the current coupon service does not expose order-level attribution. Coupons with redemption history cannot be deleted; pause them instead.</p>
      </div>
    </AdminLayout>
  );
};
