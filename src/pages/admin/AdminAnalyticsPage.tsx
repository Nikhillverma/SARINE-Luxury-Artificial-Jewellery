import React, { useCallback, useEffect, useState } from "react";
import { AdminLayout } from "../../components/admin/AdminLayout";
import { formatInr } from "../../utils/currency";
import { BarChart3, Download, RefreshCw, IndianRupee, ShoppingBag, Package, RotateCcw } from "lucide-react";

const API_BASE = (
  import.meta.env.VITE_HOSTINGER_API_BASE_URL ||
  (import.meta.env.DEV ? "/api" : "https://lavender-goldfish-844589.hostingersite.com/api")
).replace(/\/+$/, "");

interface Report {
  range: { from: string; to: string; timezone: string };
  summary: {
    totalOrders: number; paidOrders: number; netRevenue: number;
    refunds: number; averagePaidOrderValue: number; unpaidOrders: number; cancelledOrders: number;
  };
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

function Metric({ label, value, note, icon: Icon }: { label: string; value: string; note: string; icon: React.ElementType }) {
  return <div className="bg-white border border-[#EDE4F0] rounded-xl p-5 shadow-sm">
    <div className="flex justify-between items-center"><span className="text-[11px] uppercase tracking-wider text-[#817487]">{label}</span><span className="w-9 h-9 rounded-lg bg-[#F7F0FA] text-[#704A83] flex items-center justify-center"><Icon size={17}/></span></div>
    <p className="font-serif text-2xl text-[#302438] mt-4">{value}</p><p className="text-[11px] text-[#8B7598] mt-1">{note}</p>
  </div>;
}

function Table({ title, headers, rows, empty }: { title: string; headers: string[]; rows: (string | number)[][]; empty: string }) {
  return <section className="bg-white border border-[#EDE4F0] rounded-xl overflow-hidden">
    <div className="p-5 border-b border-[#F0E8F3]"><h2 className="font-serif text-lg text-[#302438]">{title}</h2></div>
    <div className="overflow-x-auto"><table className="w-full min-w-[460px] text-left text-xs">
      <thead className="bg-[#FAF7FB] text-[10px] uppercase tracking-wider text-[#817487]"><tr>{headers.map(h=><th key={h} className="px-5 py-3 font-semibold">{h}</th>)}</tr></thead>
      <tbody className="divide-y divide-[#F0E8F3]">{rows.length ? rows.map((row,i)=><tr key={i}>{row.map((v,j)=><td key={j} className="px-5 py-3 text-[#514657]">{v}</td>)}</tr>) : <tr><td colSpan={headers.length} className="px-5 py-8 text-center text-[#8B7598]">{empty}</td></tr>}</tbody>
    </table></div>
  </section>;
}

export const AdminAnalyticsPage: React.FC = () => {
  const [from, setFrom] = useState(istDate(29));
  const [to, setTo] = useState(istDate());
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  const loadReport = useCallback(async () => {
    if (!from || !to || from > to) { setError("Please choose a valid date range."); return; }
    setLoading(true); setError("");
    try {
      const query = new URLSearchParams({ from, to });
      const response = await fetch(`${API_BASE}/admin/analytics?${query}`, {
        credentials: "include", cache: "no-store", headers: { Accept: "application/json" }
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || `Analytics request failed (${response.status}).`);
      setReport(body as Report);
    } catch (err) {
      setReport(null); setError(err instanceof Error ? err.message : "Unable to load analytics.");
    } finally { setLoading(false); }
  }, [from, to]);

  useEffect(() => { void loadReport(); }, [loadReport]);

  const exportWorkbook = async () => {
    setExporting(true); setError("");
    try {
      const query = new URLSearchParams({ from, to });
      const response = await fetch(`${API_BASE}/admin/analytics/export?${query}`, {
        credentials: "include", cache: "no-store"
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `Excel export failed (${response.status}).`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `sarine-analytics-${from}-to-${to}.xls`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Excel export failed.");
    } finally { setExporting(false); }
  };

  const maxRevenue = Math.max(1, ...(report?.daily.map(d => d.revenue) || [1]));
  return <AdminLayout>
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div><p className="text-[10px] uppercase tracking-[0.22em] text-[#8B7598]">SARINE Business Intelligence</p>
          <h1 className="font-serif text-2xl sm:text-3xl text-[#302438] mt-1">Analytics & Reports</h1>
          <p className="text-xs text-[#817487] mt-1">Live reporting from Hostinger MariaDB · India Standard Time</p></div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-[10px] text-[#817487]">From <input type="date" value={from} max={to} onChange={e=>setFrom(e.target.value)} className="block min-h-10 mt-1 px-3 rounded-lg border border-[#E7DCEB] bg-white text-xs text-[#302438]"/></label>
          <label className="text-[10px] text-[#817487]">To <input type="date" value={to} min={from} max={istDate()} onChange={e=>setTo(e.target.value)} className="block min-h-10 mt-1 px-3 rounded-lg border border-[#E7DCEB] bg-white text-xs text-[#302438]"/></label>
          <button onClick={()=>void loadReport()} disabled={loading} className="min-h-10 px-3 rounded-lg border border-[#E7DCEB] bg-white text-xs text-[#563568] inline-flex items-center gap-2 disabled:opacity-60"><RefreshCw size={14} className={loading?"animate-spin":""}/> Refresh</button>
          <button onClick={()=>void exportWorkbook()} disabled={!report || exporting} className="min-h-10 px-3 rounded-lg bg-[#563568] text-white text-xs inline-flex items-center gap-2 disabled:opacity-50"><Download size={14}/>{exporting?"Preparing…":"Export Excel workbook"}</button>
        </div>
      </div>
      {error && <div role="alert" className="p-4 rounded-xl border border-red-200 bg-red-50 text-xs text-red-800">{error}</div>}
      {loading && !report && <div className="bg-white rounded-xl border border-[#EDE4F0] p-10 text-center text-xs text-[#8B7598]">Loading verified store reports…</div>}
      {report && <>
        <p className="text-[11px] text-[#8B7598]">Showing {report.range.from} to {report.range.to} ({report.range.timezone}). Revenue includes paid online orders and COD orders only after delivery, less recorded refunds.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <Metric label="Net Paid Revenue" value={formatInr(report.summary.netRevenue)} note="After recorded refunds" icon={IndianRupee}/>
          <Metric label="Total Orders" value={report.summary.totalOrders.toLocaleString("en-IN")} note={`${report.summary.paidOrders} paid / settled orders`} icon={ShoppingBag}/>
          <Metric label="Average Order Value" value={formatInr(report.summary.averagePaidOrderValue)} note="Net revenue ÷ paid orders" icon={BarChart3}/>
          <Metric label="Refunds Recorded" value={formatInr(report.summary.refunds)} note={`${report.summary.cancelledOrders} cancelled · ${report.summary.unpaidOrders} unpaid/failed`} icon={RotateCcw}/>
        </div>
        <section className="bg-white border border-[#EDE4F0] rounded-xl p-5">
          <div className="mb-4"><h2 className="font-serif text-lg text-[#302438]">Daily Revenue Trend</h2><p className="text-[11px] text-[#8B7598]">Net paid revenue by calendar day (IST)</p></div>
          {report.daily.length ? <div className="space-y-3">{report.daily.map(day=><div key={day.date} className="grid grid-cols-[76px_1fr_100px] items-center gap-3 text-[11px]">
            <span className="text-[#817487]">{new Date(day.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "UTC" })}</span><div className="h-3 rounded-full bg-[#F3ECF6] overflow-hidden"><div className="h-full rounded-full bg-[#80609A]" style={{width:`${Math.max(day.revenue ? 1 : 0, day.revenue/maxRevenue*100)}%`}}/></div><span className="text-right text-[#514657]">{formatInr(day.revenue)}</span>
          </div>)}</div> : <p className="text-xs text-[#8B7598] py-6 text-center">No orders in this date range.</p>}
        </section>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <Table title="Order Status Analysis" headers={["Status","Orders"]} rows={report.orderStatuses.map(x=>[x.label,x.count])} empty="No order statuses to report."/>
          <Table title="Payment Method Analysis" headers={["Method","Orders","Net revenue"]} rows={report.payments.map(x=>[x.label,x.count,formatInr(x.revenue)])} empty="No payment data to report."/>
          <Table title="Best-Selling Products" headers={["Product","Units","Item sales"]} rows={report.topProducts.slice(0,15).map(x=>[x.productName,x.unitsSold,formatInr(x.itemSales)])} empty="No paid product sales in this period."/>
          <Table title="Category Performance" headers={["Category","Units","Item sales"]} rows={report.categories.map(x=>[x.category,x.unitsSold,formatInr(x.itemSales)])} empty="No category sales in this period."/>
        </div>
        <Table title="Inventory & Stock Valuation" headers={["Product","Category","Status","Stock","Selling price","Cost price"]} rows={report.inventory.map(x=>[x.productName,x.category,x.status,x.stock,formatInr(x.price),x.costPrice == null ? "Not set" : formatInr(x.costPrice)])} empty="No catalogue products found."/>
        <p className="text-[10px] text-[#8B7598]">Inventory is a current snapshot, not a historical stock balance. Cost prices marked “Not set” are excluded from any cost/profit calculation. Product/category sales are based on paid order line items and use item subtotal, excluding shipping.</p>
      </>}
    </div>
  </AdminLayout>;
};
