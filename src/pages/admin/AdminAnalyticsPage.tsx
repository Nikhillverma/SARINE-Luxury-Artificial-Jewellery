import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AdminLayout } from "../../components/admin/AdminLayout";
import { formatInr } from "../../utils/currency";
import { BarChart3, Download, RefreshCw, IndianRupee, ShoppingBag, Package, RotateCcw, AlertTriangle, Boxes, TrendingUp } from "lucide-react";

const API_BASE = (
  import.meta.env.VITE_HOSTINGER_API_BASE_URL ||
  (import.meta.env.DEV ? "/api" : "https://lavender-goldfish-844589.hostingersite.com/api")
).replace(/\/+$/, "");

interface Report {
  range: { from: string; to: string; timezone: string };
  summary: { totalOrders: number; paidOrders: number; netRevenue: number; refunds: number; averagePaidOrderValue: number; unpaidOrders: number; cancelledOrders: number };
  daily: { date: string; orders: number; revenue: number }[];
  orderStatuses: { label: string; count: number }[];
  payments: { label: string; count: number; revenue: number }[];
  topProducts: { productId: string; productName: string; unitsSold: number; itemSales: number }[];
  categories: { category: string; unitsSold: number; itemSales: number }[];
  inventory: { productId: string; productName: string; category: string; status: string; stock: number; price: number; costPrice: number | null }[];
}

function istDate(daysAgo = 0): string {
  const date = new Date(Date.now() + 330 * 60_000);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}
function shiftDate(value: string, days: number): string {
  const date = new Date(value + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(value + "T00:00:00Z"));
}
function percentChange(current: number, previous: number): number | null {
  if (!Number.isFinite(previous) || previous === 0) return current === 0 ? 0 : null;
  return (current - previous) / Math.abs(previous) * 100;
}
async function fetchReport(from: string, to: string): Promise<Report> {
  const query = new URLSearchParams({ from, to });
  const response = await fetch(API_BASE + "/admin/analytics?" + query, { credentials: "include", cache: "no-store", headers: { Accept: "application/json" } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Analytics request failed (" + response.status + ").");
  if (!body || !body.summary || !Array.isArray(body.daily) || !Array.isArray(body.inventory)) throw new Error("The analytics service returned an incomplete report.");
  return body as Report;
}

function Metric({ label, value, note, icon: Icon, change }: { label: string; value: string; note: string; icon: React.ElementType; change?: number | null }) {
  return <div className="bg-white border border-[#EDE4F0] rounded-xl p-4 sm:p-5 shadow-sm min-w-0">
    <div className="flex justify-between items-center gap-2"><span className="text-[10px] sm:text-[11px] uppercase tracking-wider text-[#817487]">{label}</span><span className="w-9 h-9 shrink-0 rounded-lg bg-[#F7F0FA] text-[#704A83] flex items-center justify-center"><Icon size={17}/></span></div>
    <p className="font-serif text-2xl sm:text-[27px] text-[#302438] mt-3 tabular-nums break-words">{value}</p>
    <div className="flex flex-wrap items-center gap-1.5 mt-1"><p className="text-[10px] text-[#8B7598]">{note}</p>
      {change !== undefined && <span className={"text-[10px] font-semibold " + (change === null ? "text-[#8B7598]" : change >= 0 ? "text-emerald-700" : "text-rose-700")}>{change === null ? "No prior baseline" : (change >= 0 ? "↑ " : "↓ ") + Math.abs(change).toFixed(1) + "% vs prior"}</span>}
    </div>
  </div>;
}
function Panel({ title, subtitle, children, className = "" }: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return <section className={"bg-white border border-[#EDE4F0] rounded-xl p-4 sm:p-5 min-w-0 " + className}>
    <div className="mb-4"><h2 className="font-serif text-lg text-[#302438]">{title}</h2>{subtitle && <p className="text-[10px] text-[#8B7598] mt-1">{subtitle}</p>}</div>{children}
  </section>;
}
function Bars({ rows, label, value, money = false, empty }: { rows: { label: string; value: number }[]; label: string; value: string; money?: boolean; empty: string }) {
  const max = Math.max(1, ...rows.map(row => row.value));
  return rows.length ? <div className="space-y-3">{rows.map((row,index)=><div key={row.label + index}>
    <div className="flex justify-between gap-3 text-[11px]"><span className="truncate text-[#514657]">{row.label}</span><strong className="shrink-0 text-[#302438]">{money ? formatInr(row.value) : row.value.toLocaleString("en-IN")}</strong></div>
    <div className="h-2.5 rounded-full bg-[#F3ECF6] overflow-hidden mt-1.5"><div className={"h-full rounded-full " + (index % 2 ? "bg-[#B69ACF]" : "bg-[#80609A]")} style={{ width: (row.value > 0 ? Math.max(1.5, row.value / max * 100) : 0) + "%" }}/></div>
  </div>)}</div> : <p className="py-6 text-center text-xs text-[#8B7598]">{empty}</p>;
}
function Table({ title, headers, rows, empty }: { title: string; headers: string[]; rows: (string | number)[][]; empty: string }) {
  return <Panel title={title}><div className="overflow-x-auto -mx-1"><table className="w-full min-w-[460px] text-left text-xs">
    <thead className="bg-[#FAF7FB] text-[10px] uppercase tracking-wider text-[#817487]"><tr>{headers.map(h=><th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr></thead>
    <tbody className="divide-y divide-[#F0E8F3]">{rows.length ? rows.map((row,i)=><tr key={i}>{row.map((v,j)=><td key={j} className="px-4 py-3 text-[#514657]">{v}</td>)}</tr>) : <tr><td colSpan={headers.length} className="px-4 py-8 text-center text-[#8B7598]">{empty}</td></tr>}</tbody>
  </table></div></Panel>;
}

export const AdminAnalyticsPage: React.FC = () => {
  const [from, setFrom] = useState(istDate(29));
  const [to, setTo] = useState(istDate());
  const [preset, setPreset] = useState("30");
  const [compareEnabled, setCompareEnabled] = useState(true);
  const [report, setReport] = useState<Report | null>(null);
  const [comparison, setComparison] = useState<Report | null>(null);
  const [comparisonError, setComparisonError] = useState("");
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const applyPreset = (days: number) => { setFrom(istDate(days - 1)); setTo(istDate()); setPreset(String(days)); };
  const loadReport = useCallback(async () => {
    if (!from || !to || from > to || to > istDate()) { setError("Please choose a valid date range that does not include future dates."); return; }
    setLoading(true); setError(""); setComparisonError("");
    try {
      const current = await fetchReport(from, to);
      setReport(current); setLastUpdated(new Date()); setComparison(null);
      if (compareEnabled) {
        const days = Math.round((new Date(to + "T00:00:00Z").getTime() - new Date(from + "T00:00:00Z").getTime()) / 86400000) + 1;
        const previousTo = shiftDate(from, -1);
        const previousFrom = shiftDate(previousTo, -(days - 1));
        try { setComparison(await fetchReport(previousFrom, previousTo)); }
        catch (err) { setComparisonError(err instanceof Error ? err.message : "Previous-period comparison is unavailable."); }
      }
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to load analytics."); }
    finally { setLoading(false); }
  }, [from, to, compareEnabled]);
  useEffect(() => { void loadReport(); }, [loadReport]);

  const comparisons = useMemo(() => {
    if (!report || !comparison) return null;
    return {
      revenue: percentChange(report.summary.netRevenue, comparison.summary.netRevenue),
      orders: percentChange(report.summary.totalOrders, comparison.summary.totalOrders),
      aov: percentChange(report.summary.averagePaidOrderValue, comparison.summary.averagePaidOrderValue)
    };
  }, [report, comparison]);

  const inventoryStats = useMemo(() => {
    if (!report) return null;
    const known = report.inventory.filter(row => row.costPrice !== null && Number.isFinite(Number(row.costPrice)) && Number(row.costPrice) >= 0);
    return {
      products: report.inventory.length,
      low: report.inventory.filter(row => row.status === "active" && row.stock > 0 && row.stock <= 5).length,
      out: report.inventory.filter(row => row.status === "active" && row.stock <= 0).length,
      value: known.reduce((sum,row) => sum + Number(row.costPrice) * Math.max(0, Number(row.stock) || 0), 0),
      known: known.length,
      missing: report.inventory.length - known.length
    };
  }, [report]);

  const exportWorkbook = async () => {
    setExporting(true); setError("");
    try {
      const query = new URLSearchParams({ from, to });
      const response = await fetch(API_BASE + "/admin/analytics/export?" + query, { credentials: "include", cache: "no-store" });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Excel export failed (" + response.status + ").");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = "sarine-analytics-" + from + "-to-" + to + ".xls";
      document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
    } catch (err) { setError(err instanceof Error ? err.message : "Excel export failed."); }
    finally { setExporting(false); }
  };

  const dailyMax = Math.max(1, ...(report?.daily.map(day => day.revenue) || [1]));
  const peak = report?.daily.reduce((best,day) => day.revenue > best.revenue ? day : best, report.daily[0] || {date:"",orders:0,revenue:0});
  const categoryRows = (report?.categories || []).slice().sort((a,b)=>b.itemSales-a.itemSales).slice(0,8).map(row=>({label:row.category,value:row.itemSales}));
  const statusRows = (report?.orderStatuses || []).slice().sort((a,b)=>b.count-a.count).map(row=>({label:row.label,value:row.count}));
  const paymentCount = report?.payments.reduce((sum,row)=>sum+row.count,0) || 0;

  return <AdminLayout>
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">
      <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
        <div><p className="text-[10px] uppercase tracking-[0.22em] text-[#8B7598]">SARINE Business Intelligence</p>
          <h1 className="font-serif text-2xl sm:text-3xl text-[#302438] mt-1">Analytics & Reports</h1>
          <p className="text-xs text-[#817487] mt-1">Live Hostinger MariaDB reporting · India Standard Time</p>
          {lastUpdated && <p className="text-[10px] text-[#8B7598] mt-1">Last successful refresh: {lastUpdated.toLocaleTimeString("en-IN",{timeZone:"Asia/Kolkata",hour:"numeric",minute:"2-digit"})} IST</p>}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-[10px] text-[#817487]">From <input type="date" value={from} max={to} onChange={e=>{setFrom(e.target.value);setPreset("custom");}} className="block min-h-11 mt-1 px-3 rounded-lg border border-[#E7DCEB] bg-white text-xs text-[#302438]"/></label>
          <label className="text-[10px] text-[#817487]">To <input type="date" value={to} min={from} max={istDate()} onChange={e=>{setTo(e.target.value);setPreset("custom");}} className="block min-h-11 mt-1 px-3 rounded-lg border border-[#E7DCEB] bg-white text-xs text-[#302438]"/></label>
          <button onClick={()=>void loadReport()} disabled={loading} className="min-h-11 px-3 rounded-lg border border-[#E7DCEB] bg-white text-xs text-[#563568] inline-flex items-center gap-2 disabled:opacity-60"><RefreshCw size={14} className={loading?"animate-spin":""}/> Refresh</button>
          <button onClick={()=>void exportWorkbook()} disabled={!report || exporting} className="min-h-11 px-3 rounded-lg bg-[#563568] text-white text-xs inline-flex items-center gap-2 disabled:opacity-50"><Download size={14}/>{exporting?"Preparing…":"Export Excel"}</button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] text-[#817487] mr-1">Quick range</span>
        {[7,30,90].map(days=><button key={days} onClick={()=>applyPreset(days)} aria-pressed={preset===String(days)} className={"min-h-10 px-3 rounded-lg border text-[11px] font-medium " + (preset===String(days) ? "bg-[#563568] border-[#563568] text-white" : "bg-white border-[#E7DCEB] text-[#705E7B]")}>Last {days} days</button>)}
        <label className="inline-flex items-center gap-2 min-h-10 px-3 rounded-lg border border-[#E7DCEB] bg-white text-[11px] text-[#705E7B] ml-auto"><input type="checkbox" checked={compareEnabled} onChange={e=>setCompareEnabled(e.target.checked)} className="accent-[#563568]"/> Compare previous period</label>
      </div>

      {error && <div role="alert" className="p-3 rounded-xl border border-red-200 bg-red-50 text-xs text-red-800">{error} {report && "The last successful report remains visible."}</div>}
      {loading && <div className="text-[11px] text-[#8B7598] flex items-center gap-2"><RefreshCw size={13} className="animate-spin"/> Updating report…</div>}
      {!report && loading && <div className="bg-white rounded-xl border border-[#EDE4F0] p-10 text-center text-xs text-[#8B7598]">Loading verified store reports…</div>}

      {report && <>
        <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-[#8B7598]"><span>Current: {formatDate(report.range.from)} – {formatDate(report.range.to)} ({report.range.timezone})</span>{comparison && <span>Previous: {formatDate(comparison.range.from)} – {formatDate(comparison.range.to)}</span>}</div>
        {comparisonError && <p role="status" className="text-[10px] text-amber-700">Previous-period comparison unavailable: {comparisonError}. Current-period figures are unaffected.</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <Metric label="Net Revenue" value={formatInr(report.summary.netRevenue)} note="After recorded refunds" icon={IndianRupee} change={compareEnabled ? comparisons?.revenue ?? null : undefined}/>
          <Metric label="Total Orders" value={report.summary.totalOrders.toLocaleString("en-IN")} note={report.summary.paidOrders + " paid / settled"} icon={ShoppingBag} change={compareEnabled ? comparisons?.orders ?? null : undefined}/>
          <Metric label="Average Order Value" value={formatInr(report.summary.averagePaidOrderValue)} note="Net revenue ÷ paid orders" icon={BarChart3} change={compareEnabled ? comparisons?.aov ?? null : undefined}/>
          <Metric label="Refunds Recorded" value={formatInr(report.summary.refunds)} note={report.summary.cancelledOrders + " cancelled · " + report.summary.unpaidOrders + " unpaid/failed"} icon={RotateCcw}/>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <Panel title="Daily Revenue Trend" subtitle="Net paid revenue by calendar day · IST" className="xl:col-span-2">
            {report.daily.length ? <div className="space-y-3">
              <div className="flex justify-between text-[10px] text-[#8B7598]"><span>{formatDate(report.daily[0].date)}</span><span>{formatDate(report.daily[report.daily.length-1].date)}</span></div>
              <div className="flex items-end gap-1 h-36 sm:h-44 border-b border-[#EDE4F0]">{report.daily.map(day=><div key={day.date} title={day.date + ": " + formatInr(day.revenue) + " · " + day.orders + " orders"} className="flex-1 min-w-0 h-full flex items-end group"><div className="w-full rounded-t-sm bg-[#A88ABB] group-hover:bg-[#563568] transition-colors" style={{height:(day.revenue>0?Math.max(3,day.revenue/dailyMax*100):0)+"%"}}/></div>)}</div>
              <div className="flex flex-wrap justify-between gap-2 text-[10px] text-[#817487]"><span>{report.daily.reduce((sum,day)=>sum+day.orders,0).toLocaleString("en-IN")} orders across daily buckets</span><span>Peak: {peak?.date ? formatDate(peak.date) : "—"} · {formatInr(peak?.revenue || 0)}</span></div>
            </div> : <p className="py-6 text-center text-xs text-[#8B7598]">No daily data in this period.</p>}
          </Panel>
          <Panel title="Payment Mix" subtitle="Order count share and net revenue">
            {report.payments.length ? <div className="space-y-4">{report.payments.map((payment,index)=>{
              const share=paymentCount ? payment.count/paymentCount*100 : 0;
              return <div key={payment.label}><div className="flex justify-between gap-2 text-[11px]"><span className="font-medium text-[#514657]">{payment.label}</span><strong className="text-[#302438]">{payment.count} orders</strong></div>
                <div className="h-2 rounded-full bg-[#F3ECF6] overflow-hidden mt-2"><div className={index%2===0?"h-full bg-[#80609A]":"h-full bg-[#B69ACF]"} style={{width:share+"%"}}/></div>
                <div className="flex justify-between text-[10px] text-[#8B7598] mt-1"><span>{share.toFixed(1)}% of orders</span><span>{formatInr(payment.revenue)}</span></div>
              </div>;
            })}</div> : <p className="py-6 text-center text-xs text-[#8B7598]">No payment data for this period.</p>}
          </Panel>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Panel title="Category Performance" subtitle="Paid item sales, excluding shipping"><Bars rows={categoryRows} label="category" value="itemSales" money empty="No category sales in this period."/></Panel>
          <Panel title="Order Status Mix" subtitle="Order counts in the selected period"><Bars rows={statusRows} label="status" value="count" empty="No order status data."/></Panel>
        </div>

        <Table title="Top-Selling Products" headers={["Product","Units sold","Item sales"]} rows={report.topProducts.slice(0,10).map(x=>[x.productName,x.unitsSold.toLocaleString("en-IN"),formatInr(x.itemSales)])} empty="No paid product sales in this period."/>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <Metric label="Catalogue Products" value={String(inventoryStats?.products ?? 0)} note="Current inventory snapshot" icon={Package}/>
          <Metric label="Low Stock" value={String(inventoryStats?.low ?? 0)} note="Active products · 1–5 units" icon={AlertTriangle}/>
          <Metric label="Out of Stock" value={String(inventoryStats?.out ?? 0)} note="Active products with zero units" icon={Boxes}/>
          <Metric label="Estimated Stock Cost" value={formatInr(inventoryStats?.value ?? 0)} note={(inventoryStats?.known ?? 0) + " products with cost recorded"} icon={TrendingUp}/>
        </div>
        <Panel title="Inventory & Stock Valuation" subtitle="Current snapshot only · not historical stock balance">
          <div className="flex flex-wrap gap-4 mb-3 text-[10px] text-[#8B7598]"><span>{inventoryStats?.missing ?? 0} products missing cost price</span><span>Cost estimate = current stock × recorded unit cost</span></div>
          <div className="overflow-x-auto -mx-1"><table className="w-full min-w-[680px] text-left text-xs">
            <thead className="bg-[#FAF7FB] text-[10px] uppercase tracking-wider text-[#817487]"><tr>{["Product","Category","Status","Stock","Selling price","Cost price"].map(x=><th key={x} className="px-3 py-3">{x}</th>)}</tr></thead>
            <tbody className="divide-y divide-[#F0E8F3]">{report.inventory.length ? report.inventory.map(row=><tr key={row.productId}><td className="px-3 py-3 text-[#302438]">{row.productName}</td><td className="px-3 py-3">{row.category}</td><td className="px-3 py-3">{row.status}</td><td className="px-3 py-3 tabular-nums">{row.stock}</td><td className="px-3 py-3">{formatInr(row.price)}</td><td className="px-3 py-3">{row.costPrice==null?"Not set":formatInr(row.costPrice)}</td></tr>) : <tr><td colSpan={6} className="px-3 py-8 text-center text-[#8B7598]">No catalogue products found.</td></tr>}</tbody>
          </table></div>
        </Panel>
        <p className="text-[10px] text-[#8B7598] leading-relaxed">Revenue includes paid online orders and COD orders only after delivery, less recorded refunds. Product/category sales use paid order line-item subtotals and exclude shipping. Stock cost is estimated using current stock × recorded cost price; products without cost price are excluded. Customer cohorts, repeat-purchase rate, lifetime value and coupon-attributed revenue are not exposed by the current analytics API and are not estimated.</p>
      </>}
    </div>
  </AdminLayout>;
};
