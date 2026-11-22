import React, { useCallback, useEffect, useState } from "react";
import { AdminLayout } from "../../components/admin/AdminLayout";
import {
  Activity, AlertCircle, ChevronLeft, ChevronRight, Clock3,
  Download, RefreshCw, Search, ShieldCheck, Users
} from "lucide-react";

const API_BASE = (
  import.meta.env.VITE_HOSTINGER_API_BASE_URL ||
  (import.meta.env.DEV ? "/api" : "https://lavender-goldfish-844589.hostingersite.com/api")
).replace(/\/+$/, "");

interface ActivityEntry {
  id: number;
  adminId: string;
  adminName: string;
  adminEmail: string;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  method: string;
  route: string;
  statusCode: number;
  createdAt: string;
}
interface ActivityResponse {
  activities: ActivityEntry[];
  summary: { total: number; last24Hours: number; administrators: number };
  page: number;
  limit: number;
  totalPages: number;
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata"
      }).format(date) + " IST"
    : "Time unavailable";
}
function csvCell(value: unknown): string {
  let text = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
function exportCsv(rows: ActivityEntry[]) {
  const headers = ["Timestamp (IST)", "Administrator", "Email", "Action", "Entity", "Record ID", "Summary", "Method", "Route", "HTTP Status"];
  const lines = [
    headers,
    ...rows.map(row => [
      formatTimestamp(row.createdAt), row.adminName, row.adminEmail, row.action,
      row.entityType, row.entityId || "", row.summary, row.method, row.route, row.statusCode
    ])
  ].map(row => row.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF", lines], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "sarine-admin-activity-" + new Date().toISOString().slice(0, 10) + ".csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export const AdminActivityPage: React.FC = () => {
  const [data, setData] = useState<ActivityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [entityType, setEntityType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ page: String(page), limit: "25" });
      if (search) query.set("search", search);
      if (entityType) query.set("entityType", entityType);
      if (from) query.set("from", from);
      if (to) query.set("to", to);
      const response = await fetch(API_BASE + "/admin/activity?" + query.toString(), {
        credentials: "include", cache: "no-store", headers: { Accept: "application/json" }
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Activity log could not be loaded (" + response.status + ").");
      if (!Array.isArray(body.activities) || !body.summary) throw new Error("The activity service returned an incomplete response.");
      setData(body as ActivityResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Activity log could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [page, search, entityType, from, to]);

  useEffect(() => { void load(); }, [load]);

  const applySearch = (event: React.FormEvent) => {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };
  const updateEntity = (value: string) => { setEntityType(value); setPage(1); };
  const updateFrom = (value: string) => { setFrom(value); setPage(1); };
  const updateTo = (value: string) => { setTo(value); setPage(1); };

  return (
    <AdminLayout>
      <div className="max-w-7xl space-y-6">
        <header className="flex flex-col gap-3 border-b border-[#E7DCEB] pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-[#8E769E]">Governance · Security · Accountability</p>
            <h1 className="font-serif text-2xl text-[#302438] sm:text-3xl">Admin Activity & Audit Log</h1>
            <p className="mt-1 text-xs text-[#705E7B]">A chronological record of successful administrative changes and sign-in activity.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#E7DCEB] bg-white px-4 text-xs text-[#563568] disabled:opacity-50">
              <RefreshCw size={14} className={loading ? "animate-spin" : ""}/> Refresh
            </button>
            <button type="button" onClick={() => data && exportCsv(data.activities)} disabled={!data?.activities.length} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#563568] px-4 text-xs font-medium text-white disabled:opacity-40">
              <Download size={14}/> Export current page
            </button>
          </div>
        </header>

        {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700"><AlertCircle size={15} className="mt-0.5 shrink-0"/>{error}</div>}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-[#EDE4F0] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-[#817487]">Recorded events <Activity size={16}/></div>
            <p className="mt-2 font-serif text-2xl tabular-nums text-[#302438]">{data?.summary.total.toLocaleString("en-IN") ?? "—"}</p>
            <p className="mt-1 text-[10px] text-[#8B7598]">Matching the selected filters</p>
          </div>
          <div className="rounded-xl border border-[#EDE4F0] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-[#817487]">Last 24 hours <Clock3 size={16}/></div>
            <p className="mt-2 font-serif text-2xl tabular-nums text-[#302438]">{data?.summary.last24Hours.toLocaleString("en-IN") ?? "—"}</p>
            <p className="mt-1 text-[10px] text-[#8B7598]">Within the selected filters</p>
          </div>
          <div className="rounded-xl border border-[#EDE4F0] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-[#817487]">Administrators <Users size={16}/></div>
            <p className="mt-2 font-serif text-2xl tabular-nums text-[#302438]">{data?.summary.administrators.toLocaleString("en-IN") ?? "—"}</p>
            <p className="mt-1 text-[10px] text-[#8B7598]">With activity in this filtered view</p>
          </div>
        </div>

        <section className="rounded-xl border border-[#EDE4F0] bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2"><Search size={15} className="text-[#704A83]"/><h2 className="font-serif text-base text-[#302438]">Find an activity</h2></div>
          <form onSubmit={applySearch} className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <label className="text-[10px] text-[#705E7B] xl:col-span-2">Search administrator, action or record
              <div className="mt-1 flex gap-2">
                <input value={searchInput} onChange={event => setSearchInput(event.target.value)} placeholder="Name, order number, product…" className="min-h-11 min-w-0 flex-1 rounded-lg border border-[#E7DCEB] bg-[#FAF7FB] px-3 text-xs text-[#302438]"/>
                <button type="submit" className="min-h-11 rounded-lg bg-[#563568] px-4 text-xs font-medium text-white">Search</button>
              </div>
            </label>
            <label className="text-[10px] text-[#705E7B]">Area
              <select value={entityType} onChange={event => updateEntity(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-[#E7DCEB] bg-[#FAF7FB] px-3 text-xs text-[#302438]">
                <option value="">All areas</option>
                <option value="product">Products</option><option value="category">Categories</option>
                <option value="order">Orders</option><option value="inventory">Inventory</option>
                <option value="coupon">Coupons</option><option value="customer">Customers</option>
                <option value="return">Returns</option><option value="storefront">Storefront</option>
                <option value="admin session">Admin sessions</option>
              </select>
            </label>
            <label className="text-[10px] text-[#705E7B]">From (IST)
              <input type="date" value={from} max={to || undefined} onChange={event => updateFrom(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-[#E7DCEB] bg-[#FAF7FB] px-3 text-xs text-[#302438]"/>
            </label>
            <label className="text-[10px] text-[#705E7B]">To (IST)
              <input type="date" value={to} min={from || undefined} onChange={event => updateTo(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-[#E7DCEB] bg-[#FAF7FB] px-3 text-xs text-[#302438]"/>
            </label>
          </form>
          <div className="mt-3 flex justify-end">
            <button type="button" onClick={() => { setSearchInput(""); setSearch(""); setEntityType(""); setFrom(""); setTo(""); setPage(1); }} className="min-h-10 px-2 text-[11px] text-[#704A83] underline underline-offset-2">Clear filters</button>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-[#EDE4F0] bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F0E8F3] px-4 py-4">
            <div><h2 className="font-serif text-lg text-[#302438]">Activity history</h2><p className="mt-0.5 text-[10px] text-[#8B7598]">Newest events first · timestamps displayed in India Standard Time</p></div>
            <span className="rounded-full bg-[#F7F0FA] px-3 py-1 text-[10px] text-[#563568]">Page {data?.page ?? page} of {data?.totalPages ?? 1}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead className="bg-[#FAF7FB] text-[10px] uppercase tracking-wider text-[#817487]">
                <tr><th className="px-4 py-3 font-semibold">Date & time</th><th className="px-4 py-3 font-semibold">Administrator</th><th className="px-4 py-3 font-semibold">Activity</th><th className="px-4 py-3 font-semibold">Area / record</th><th className="px-4 py-3 font-semibold">Result</th></tr>
              </thead>
              <tbody className="divide-y divide-[#F0E8F3]">
                {loading && !data ? <tr><td colSpan={5} className="px-4 py-12 text-center text-[#8B7598]">Loading secure activity history…</td></tr>
                : data?.activities.length ? data.activities.map(item => (
                  <tr key={item.id} className="align-top hover:bg-[#FCFAFD]">
                    <td className="whitespace-nowrap px-4 py-3 text-[#514657]">{formatTimestamp(item.createdAt)}</td>
                    <td className="px-4 py-3"><p className="font-medium text-[#302438]">{item.adminName}</p><p className="mt-0.5 text-[10px] text-[#8B7598]">{item.adminEmail}</p></td>
                    <td className="px-4 py-3"><p className="font-medium capitalize text-[#302438]">{item.action.replace(/_/g, " ")}</p><p className="mt-1 max-w-sm text-[10px] leading-5 text-[#8B7598]">{item.summary}</p></td>
                    <td className="px-4 py-3"><p className="capitalize text-[#514657]">{item.entityType}</p>{item.entityId && <p className="mt-1 font-mono text-[10px] text-[#8B7598]">{item.entityId}</p>}</td>
                    <td className="px-4 py-3"><span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-700"><ShieldCheck size={12}/> {item.statusCode}</span></td>
                  </tr>
                )) : <tr><td colSpan={5} className="px-4 py-12 text-center"><Activity size={22} className="mx-auto mb-2 text-[#B69ACF]"/><p className="text-sm text-[#514657]">{loading ? "Refreshing activity…" : "No activity found for these filters."}</p><p className="mt-1 text-[10px] text-[#8B7598]">Successful admin changes and sign-ins are recorded after this feature is deployed.</p></td></tr>}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-[#F0E8F3] px-4 py-3">
            <p className="text-[10px] text-[#8B7598]">{data ? `Showing ${data.activities.length} of ${data.summary.total.toLocaleString("en-IN")} matching events` : "Activity data unavailable"}</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setPage(value => Math.max(1, value - 1))} disabled={page <= 1 || loading} className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-[#E7DCEB] px-3 text-xs text-[#563568] disabled:opacity-40"><ChevronLeft size={14}/> Previous</button>
              <button type="button" onClick={() => setPage(value => Math.min(data?.totalPages || 1, value + 1))} disabled={!data || page >= data.totalPages || loading} className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-[#E7DCEB] px-3 text-xs text-[#563568] disabled:opacity-40">Next <ChevronRight size={14}/></button>
            </div>
          </div>
        </section>

        <div className="flex items-start gap-2 rounded-xl border border-[#EDE4F0] bg-[#FAF7FB] p-4 text-[10px] leading-5 text-[#705E7B]">
          <ShieldCheck size={15} className="mt-0.5 shrink-0 text-[#704A83]"/>
          <p><strong className="text-[#563568]">Privacy and retention:</strong> the log stores administrator identity, action, affected record reference, route and timestamp. Passwords, session tokens, payment credentials and customer address/phone details are not copied into audit records. Events begin when this version is deployed; earlier activity is not reconstructed.</p>
        </div>
      </div>
    </AdminLayout>
  );
};
