import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { hostingerAdminCustomerService, type AdminCustomer, type AdminCustomerOrder, type AdminCustomerInsights } from '../../services/hostinger/hostingerAdminCustomerService';
import { formatInr } from '../../utils/currency';
import { Search, RefreshCw, Users, ShoppingBag, X, MapPin, Mail, Phone, Clock, ChevronLeft, ChevronRight, Download, Crown, UserRound, SlidersHorizontal } from 'lucide-react';

type SegmentFilter = 'all' | 'new' | 'repeat' | 'high-value';
type SortOption = 'recent' | 'oldest' | 'spend-high' | 'spend-low' | 'orders-high' | 'name';

function formatDate(value: string | null) {
  if (!value) return 'Date not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date not recorded';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true
  }).format(date);
}

function customerSegment(customer: AdminCustomer): SegmentFilter {
  if (customer.paidOrders >= 5 || customer.lifetimeSpend >= 10000) return 'high-value';
  if (customer.paidOrders >= 2) return 'repeat';
  return 'new';
}

function segmentLabel(segment: SegmentFilter) {
  if (segment === 'high-value') return 'VIP / High value';
  if (segment === 'repeat') return 'Repeat customer';
  return 'First-time buyer';
}

function csvCell(value: unknown) {
  let text = String(value ?? '');
  if (/^[\s\u0000-\u001f]*[-=+@]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}

function downloadCustomers(customers: AdminCustomer[]) {
  const headers = ['Customer name', 'Email', 'Phone', 'City', 'State', 'Total orders', 'Paid orders', 'Paid lifetime value (INR)', 'Average paid order value (INR)', 'Preferred collection', 'Segment', 'First order', 'Last order'];
  const rows = customers.map(customer => [
    customer.name, customer.email, customer.phone, customer.city, customer.state,
    customer.totalOrders, customer.paidOrders, customer.lifetimeSpend,
    Math.round(customer.averagePaidOrderValue),
    customer.preferredCollection || 'No paid product history',
    segmentLabel(customerSegment(customer)), customer.firstOrderAt || '', customer.lastOrderAt || ''
  ]);
  const csv = [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\\r\\n');
  const blob = new Blob(['\\uFEFF', csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'sarine-customers-current-page.csv';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export const AdminCustomersPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [insights, setInsights] = useState<AdminCustomerInsights | null>(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState(() => searchParams.get('search') || '');
  const [segment, setSegment] = useState<SegmentFilter>('all');
  const [sort, setSort] = useState<SortOption>('recent');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<AdminCustomer | null>(null);
  const [history, setHistory] = useState<AdminCustomerOrder[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');

  const load = useCallback(async (nextOffset = offset) => {
    setLoading(true);
    setError('');
    try {
      const [result, insightResult] = await Promise.all([
        hostingerAdminCustomerService.getCustomers(search, nextOffset),
        hostingerAdminCustomerService.getInsights()
      ]);
      setCustomers(result.customers);
      setInsights(insightResult);
      setTotal(result.total);
      setOffset(result.offset);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load customer records.');
      setCustomers([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [offset, search]);

  useEffect(() => { setSearch(searchParams.get('search') || ''); setOffset(0); }, [searchParams]);
  useEffect(() => { void load(0); }, [search]);

  const visibleCustomers = useMemo(() => {
    const filtered = customers.filter(customer => {
      const customerDate = customer.lastOrderAt ? new Date(customer.lastOrderAt) : null;
      const validDate = customerDate && !Number.isNaN(customerDate.getTime());
      if (segment !== 'all' && customerSegment(customer) !== segment) return false;
      if ((fromDate || toDate) && !validDate) return false;
      if (fromDate && validDate && customerDate!.getTime() < new Date(fromDate + 'T00:00:00').getTime()) return false;
      if (toDate && validDate && customerDate!.getTime() >= new Date(toDate + 'T00:00:00').getTime() + 86400000) return false;
      return true;
    });
    return filtered.sort((a, b) => {
      if (sort === 'spend-high') return b.lifetimeSpend - a.lifetimeSpend || a.name.localeCompare(b.name);
      if (sort === 'spend-low') return a.lifetimeSpend - b.lifetimeSpend || a.name.localeCompare(b.name);
      if (sort === 'orders-high') return b.totalOrders - a.totalOrders || a.name.localeCompare(b.name);
      if (sort === 'name') return a.name.localeCompare(b.name);
      const aDate = a.lastOrderAt ? new Date(a.lastOrderAt).getTime() : 0;
      const bDate = b.lastOrderAt ? new Date(b.lastOrderAt).getTime() : 0;
      return sort === 'oldest' ? aDate - bDate : bDate - aDate;
    });
  }, [customers, segment, sort, fromDate, toDate]);

  const openHistory = async (customer: AdminCustomer) => {
    setSelected(customer);
    setHistory([]);
    setHistoryError('');
    setHistoryLoading(true);
    try {
      const result = await hostingerAdminCustomerService.getCustomerOrders(customer.email);
      setHistory(result.orders);
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : 'Could not load this customer’s order history.');
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-[#8E769E]">Customer relationship management</p>
            <h1 className="font-serif text-2xl sm:text-3xl text-[#302438]">Customers</h1>
            <p className="text-xs text-[#705E7B] mt-1">Guest and registered buyers grouped by checkout email. Customer records and order history are read-only.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => downloadCustomers(visibleCustomers)} disabled={loading || visibleCustomers.length === 0} className="inline-flex min-h-11 items-center justify-center gap-2 px-3 border border-[#E7DCEB] rounded-xl text-xs disabled:opacity-40"><Download size={14}/> Export CSV</button>
            <button onClick={() => void load(offset)} disabled={loading} className="inline-flex min-h-11 items-center justify-center gap-2 px-3 border border-[#E7DCEB] rounded-xl text-xs disabled:opacity-40"><RefreshCw size={14} className={loading ? 'animate-spin' : ''}/> Refresh</button>
          </div>
        </div>

        {error && <div role="alert" className="p-3 rounded-xl bg-red-50 text-red-700 text-xs">{error}</div>}

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
          <div className="bg-white border border-[#EADFF0] rounded-2xl p-4">
            <div className="flex items-center gap-2 text-xs text-[#705E7B]"><Users size={15}/> Customers with orders</div>
            <div className="font-serif text-2xl mt-2 tabular-nums">{(insights?.summary.customers ?? total).toLocaleString('en-IN')}</div>
            <p className="text-[10px] text-[#8E769E] mt-1">All non-test customer emails</p>
          </div>
          <div className="bg-white border border-[#EADFF0] rounded-2xl p-4">
            <div className="flex items-center gap-2 text-xs text-[#705E7B]"><ShoppingBag size={15}/> Paying customers</div>
            <div className="font-serif text-2xl mt-2 tabular-nums">{(insights?.summary.payingCustomers ?? 0).toLocaleString('en-IN')}</div>
            <p className="text-[10px] text-[#8E769E] mt-1">At least one qualifying paid order</p>
          </div>
          <div className="bg-white border border-[#EADFF0] rounded-2xl p-4">
            <div className="flex items-center gap-2 text-xs text-[#705E7B]"><Crown size={15}/> Repeat customers</div>
            <div className="font-serif text-2xl mt-2 tabular-nums">{(insights?.summary.repeatCustomers ?? 0).toLocaleString('en-IN')}</div>
            <p className="text-[10px] text-[#8E769E] mt-1">Two or more qualifying paid orders</p>
          </div>
          <div className="bg-white border border-[#EADFF0] rounded-2xl p-4">
            <div className="flex items-center gap-2 text-xs text-[#705E7B]"><Crown size={15}/> VIP / High value</div>
            <div className="font-serif text-2xl mt-2 tabular-nums">{(insights?.summary.highValueCustomers ?? 0).toLocaleString('en-IN')}</div>
            <p className="text-[10px] text-[#8E769E] mt-1">Five paid orders or ₹10,000+ net spend</p>
          </div>
          <div className="bg-white border border-[#EADFF0] rounded-2xl p-4">
            <div className="flex items-center gap-2 text-xs text-[#705E7B]"><ShoppingBag size={15}/> Average paid order value</div>
            <div className="font-serif text-2xl mt-2 tabular-nums">{formatInr(insights?.summary.averagePaidOrderValue ?? 0)}</div>
            <p className="text-[10px] text-[#8E769E] mt-1">Net paid revenue ÷ qualifying paid orders</p>
          </div>
        </div>

        <div className="bg-[#FAF5FC] border border-[#EADFF0] rounded-xl p-3 text-[11px] text-[#705E7B]">
          All-time summary metrics use non-test Hostinger orders only. Paid spend excludes cancelled, returned and failed orders; COD counts only when delivered. Repeat and high-value segments use qualifying paid orders. Refund requests are not treated as completed refunds. Account creation date and marketing consent are not inferred.
        </div>

        <section className="bg-white border border-[#EADFF0] rounded-2xl p-4 space-y-3">
          <div>
            <h2 className="font-serif text-lg text-[#302438]">Collection preferences</h2>
            <p className="text-[10px] text-[#8E769E] mt-1">Based on units in qualifying paid orders; products without a collection assignment remain unassigned.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(['artificial', 'demi-fine', 'unassigned'] as const).map(collection => {
              const row = insights?.collectionPreferences.find(item => item.collection === collection);
              const label = collection === 'demi-fine' ? 'Demi-Fine' : collection === 'artificial' ? 'Artificial' : 'Unassigned';
              return <div key={collection} className="rounded-xl border border-[#EADFF0] bg-[#FAF5FC] p-3">
                <div className="text-xs font-semibold text-[#563568]">{label}</div>
                <div className="font-serif text-xl mt-2 tabular-nums">{(row?.customers ?? 0).toLocaleString('en-IN')} customers</div>
                <div className="text-[10px] text-[#705E7B] mt-1">{(row?.units ?? 0).toLocaleString('en-IN')} units · {formatInr(row?.itemSales ?? 0)} item sales</div>
              </div>;
            })}
          </div>
        </section>

        <div className="bg-white border border-[#EADFF0] rounded-2xl p-3 space-y-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E769E]"/>
            <input aria-label="Search customers by name, email, or phone" value={search} onChange={event => { setSearch(event.target.value); setOffset(0); }} placeholder="Search customer name, email or phone…" className="w-full min-h-11 pl-9 pr-3 py-2.5 bg-[#FAF5FC] border border-[#E7DCEB] rounded-xl text-xs outline-none focus:border-[#563568]"/>
          </div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-[#8E769E]"><SlidersHorizontal size={13}/> Refine this page</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
            <label className="text-[10px] text-[#705E7B]">Customer segment
              <select value={segment} onChange={event => setSegment(event.target.value as SegmentFilter)} className="mt-1 w-full min-h-11 rounded-lg border border-[#E7DCEB] bg-white px-3 text-xs text-[#302438]">
                <option value="all">All segments</option><option value="new">First-time buyers</option><option value="repeat">Repeat customers</option><option value="high-value">VIP / High value</option>
              </select>
            </label>
            <label className="text-[10px] text-[#705E7B]">Sort customers
              <select value={sort} onChange={event => setSort(event.target.value as SortOption)} className="mt-1 w-full min-h-11 rounded-lg border border-[#E7DCEB] bg-white px-3 text-xs text-[#302438]">
                <option value="recent">Most recent order</option><option value="oldest">Oldest order</option><option value="spend-high">Highest lifetime spend</option><option value="spend-low">Lowest lifetime spend</option><option value="orders-high">Most orders</option><option value="name">Customer name A–Z</option>
              </select>
            </label>
            <label className="text-[10px] text-[#705E7B]">Last order from
              <input type="date" value={fromDate} max={toDate || undefined} onChange={event => setFromDate(event.target.value)} className="mt-1 w-full min-h-11 rounded-lg border border-[#E7DCEB] bg-white px-3 text-xs text-[#302438]"/>
            </label>
            <label className="text-[10px] text-[#705E7B]">Last order to
              <input type="date" value={toDate} min={fromDate || undefined} onChange={event => setToDate(event.target.value)} className="mt-1 w-full min-h-11 rounded-lg border border-[#E7DCEB] bg-white px-3 text-xs text-[#302438]"/>
            </label>
          </div>
          {(segment !== 'all' || fromDate || toDate || sort !== 'recent') && <button onClick={() => { setSegment('all'); setFromDate(''); setToDate(''); setSort('recent'); }} className="text-xs text-[#563568] underline underline-offset-2">Clear filters and sorting</button>}
        </div>

        <div className="bg-white border border-[#EADFF0] rounded-2xl overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 border-b border-[#F5EDF8]">
            <div className="text-xs font-semibold text-[#302438]">Customer directory</div>
            <div className="text-[10px] text-[#8E769E]">Showing {visibleCustomers.length} filtered from {customers.length} loaded records</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[900px]">
              <thead className="bg-[#FAF5FC] text-[#705E7B] uppercase text-[10px]">
                <tr><th className="p-3">Customer</th><th className="p-3">Contact</th><th className="p-3">Orders</th><th className="p-3">Paid lifetime value</th><th className="p-3">Avg. paid order</th><th className="p-3">Preferred collection</th><th className="p-3">Segment</th><th className="p-3">Last order (IST)</th><th className="p-3 text-right">Profile</th></tr>
              </thead>
              <tbody className="divide-y divide-[#F5EDF8]">
                {loading ? <tr><td colSpan={9} className="p-10 text-center text-[#8E769E]">Loading live customer records…</td></tr> :
                visibleCustomers.length === 0 ? <tr><td colSpan={9} className="p-10 text-center text-[#8E769E]">No customers match these filters on this page.</td></tr> :
                visibleCustomers.map(customer => (
                  <tr key={customer.email} className="hover:bg-[#FAF5FC]">
                    <td className="p-3"><div className="font-semibold text-[#302438]">{customer.name}</div><div className="text-[10px] text-[#8E769E]">{customer.city}{customer.city && customer.state ? ', ' : ''}{customer.state}</div></td>
                    <td className="p-3"><div>{customer.email}</div><div className="text-[10px] text-[#8E769E]">{customer.phone || 'Phone not provided'}</div></td>
                    <td className="p-3 tabular-nums">{customer.totalOrders}<div className="text-[10px] text-[#8E769E]">{customer.paidOrders} paid</div></td>
                    <td className="p-3 font-semibold tabular-nums">{formatInr(customer.lifetimeSpend)}</td>
                    <td className="p-3 tabular-nums">{formatInr(customer.averagePaidOrderValue)}</td>
                    <td className="p-3 capitalize">{customer.preferredCollection ? customer.preferredCollection.replace('-', ' ') : 'No paid history'}</td>
                    <td className="p-3"><span className="inline-flex px-2 py-1 rounded-full bg-[#F4EDF8] text-[#563568] text-[10px]">{segmentLabel(customerSegment(customer))}</span></td>
                    <td className="p-3">{formatDate(customer.lastOrderAt)}</td>
                    <td className="p-3 text-right"><button onClick={() => void openHistory(customer)} className="min-h-10 px-3 rounded-lg bg-[#563568] text-white text-[10px]">View profile</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-[#F5EDF8] p-3 text-xs text-[#705E7B]">
            <span>Showing {total === 0 ? 0 : offset + 1}–{Math.min(offset + customers.length, total)} of {total}</span>
            <div className="flex gap-2">
              <button disabled={offset === 0 || loading} onClick={() => void load(Math.max(0, offset - 50))} className="inline-flex min-h-10 items-center gap-1 px-3 border border-[#E7DCEB] rounded-lg disabled:opacity-40"><ChevronLeft size={13}/> Previous</button>
              <button disabled={offset + customers.length >= total || loading} onClick={() => void load(offset + 50)} className="inline-flex min-h-10 items-center gap-1 px-3 border border-[#E7DCEB] rounded-lg disabled:opacity-40">Next <ChevronRight size={13}/></button>
            </div>
          </div>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-[70] flex justify-end bg-black/40" onClick={() => setSelected(null)}>
          <section role="dialog" aria-modal="true" aria-label="Customer profile and order history" onClick={event => event.stopPropagation()} className="w-full max-w-xl h-full overflow-y-auto bg-[#FCF9FD] shadow-2xl">
            <div className="sticky top-0 z-10 bg-white border-b border-[#EADFF0] p-5 flex items-start justify-between gap-3">
              <div><p className="text-[10px] uppercase tracking-widest text-[#8E769E]">Customer profile</p><h2 className="font-serif text-xl text-[#302438] mt-1">{selected.name}</h2><p className="text-xs text-[#705E7B] mt-1">{selected.email}</p></div>
              <button onClick={() => setSelected(null)} aria-label="Close customer profile" className="min-w-11 min-h-11 flex items-center justify-center rounded-lg border border-[#E7DCEB]"><X size={16}/></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-white rounded-xl border border-[#EADFF0] p-4 space-y-3 text-xs">
                <div className="flex items-center gap-2"><UserRound size={14}/>{selected.name}</div>
                <div className="flex items-center gap-2"><Mail size={14}/>{selected.email}</div>
                <div className="flex items-center gap-2"><Phone size={14}/>{selected.phone || 'Phone not provided'}</div>
                <div className="flex items-center gap-2"><MapPin size={14}/>{[selected.city, selected.state].filter(Boolean).join(', ') || 'Location not available'}</div>
                <div className="flex items-center gap-2"><ShoppingBag size={14}/>{selected.totalOrders} orders · {selected.paidOrders} qualifying paid</div>
                <div className="flex items-center gap-2"><Crown size={14}/>{segmentLabel(customerSegment(selected))}</div>
                <div className="flex items-center gap-2"><Clock size={14}/>First order: {formatDate(selected.firstOrderAt)}</div>
                <div className="flex items-center gap-2"><Clock size={14}/>Last order: {formatDate(selected.lastOrderAt)}</div>
                <div className="flex items-center gap-2"><ShoppingBag size={14}/>Average paid order: {formatInr(selected.averagePaidOrderValue)}</div>
                <div className="flex items-center gap-2"><Crown size={14}/>Preferred collection: {selected.preferredCollection ? selected.preferredCollection.replace('-', ' ') : 'No paid product history'}</div>
              </div>
              <h3 className="font-serif text-lg text-[#302438]">Order history</h3>
              {historyLoading ? <p className="py-10 text-center text-xs text-[#8E769E]">Loading order history…</p> :
               historyError ? <p role="alert" className="p-3 bg-red-50 text-red-700 rounded-lg text-xs">{historyError}</p> :
               history.length === 0 ? <p className="py-10 text-center text-xs text-[#8E769E]">No order history found.</p> :
               history.map(order => (
                 <article key={order.orderNumber} className="bg-white border border-[#EADFF0] rounded-xl p-4 space-y-3">
                   <div className="flex items-start justify-between gap-3"><div><div className="font-semibold text-[#563568]">{order.orderNumber}</div><div className="text-[10px] text-[#8E769E] flex items-center gap-1 mt-1"><Clock size={11}/>{formatDate(order.createdAt)}</div></div><div className="text-right"><div className="font-semibold">{formatInr(order.total)}</div><div className="text-[10px] text-[#705E7B] capitalize">{order.orderStatus.replace(/_/g, ' ')}</div></div></div>
                   <div className="text-[11px] text-[#705E7B] capitalize">{order.paymentMethod} · {order.paymentStatus}</div>
                   {order.refundNeeded && <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-900"><div className="font-semibold">Refund required — not recorded as completed</div><div>{formatInr(order.refundAmount)} requested for this order. Verify settlement separately before marking it refunded.</div></div>}
                   <ul className="border-t border-[#F5EDF8] pt-2 space-y-1 text-xs">{order.items.map((item, index) => <li key={index} className="flex justify-between gap-3"><span>{item.name} × {item.quantity}</span><span>{formatInr(item.unitPrice * item.quantity)}</span></li>)}</ul>
                 </article>
               ))}
            </div>
          </section>
        </div>
      )}
    </AdminLayout>
  );
};
