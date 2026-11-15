import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { hostingerAdminCustomerService, type AdminCustomer, type AdminCustomerOrder } from '../../services/hostinger/hostingerAdminCustomerService';
import { formatInr } from '../../utils/currency';
import { Search, RefreshCw, Users, ShoppingBag, X, MapPin, Mail, Phone, Clock, ChevronLeft, ChevronRight } from 'lucide-react';

function formatDate(value: string | null) {
  if (!value) return 'Date not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date not recorded';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(date);
}

function customerSegment(customer: AdminCustomer) {
  if (customer.totalOrders >= 5 || customer.lifetimeSpend >= 10000) return 'High value';
  if (customer.totalOrders >= 2) return 'Repeat customer';
  return 'New customer';
}

export const AdminCustomersPage: React.FC = () => {
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');
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
      const result = await hostingerAdminCustomerService.getCustomers(search, nextOffset);
      setCustomers(result.customers);
      setTotal(result.total);
      setOffset(result.offset);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load customer records.');
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, [offset, search]);

  useEffect(() => { void load(0); }, [search]);

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

  const repeatCount = useMemo(() => customers.filter(c => c.totalOrders > 1).length, [customers]);
  const highValueCount = useMemo(() => customers.filter(c => customerSegment(c) === 'High value').length, [customers]);

  return (
    <AdminLayout>
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-[#8E769E]">Customer relationship records</p>
            <h1 className="font-serif text-2xl sm:text-3xl text-[#302438]">Customers</h1>
            <p className="text-xs text-[#705E7B] mt-1">Guest and registered buyers grouped by checkout email. Read-only order history from Hostinger MariaDB.</p>
          </div>
          <button onClick={() => void load(offset)} className="inline-flex items-center justify-center gap-2 px-3 py-2 border border-[#E7DCEB] rounded-xl text-xs">
            <RefreshCw size={14}/> Refresh
          </button>
        </div>

        {error && <div role="alert" className="p-3 rounded-xl bg-red-50 text-red-700 text-xs">{error}</div>}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white border border-[#EADFF0] rounded-2xl p-4">
            <div className="flex items-center gap-2 text-xs text-[#705E7B]"><Users size={15}/> Customers with orders</div>
            <div className="font-serif text-2xl mt-2">{total}</div>
          </div>
          <div className="bg-white border border-[#EADFF0] rounded-2xl p-4">
            <div className="flex items-center gap-2 text-xs text-[#705E7B]"><ShoppingBag size={15}/> Repeat buyers on this page</div>
            <div className="font-serif text-2xl mt-2">{repeatCount}</div>
          </div>
          <div className="bg-white border border-[#EADFF0] rounded-2xl p-4">
            <div className="flex items-center gap-2 text-xs text-[#705E7B]">High-value buyers on this page</div>
            <div className="font-serif text-2xl mt-2">{highValueCount}</div>
          </div>
        </div>

        <div className="bg-[#FAF5FC] border border-[#EADFF0] rounded-xl p-3 text-[11px] text-[#705E7B]">
          Paid lifetime totals reflect orders marked paid (and delivered COD). Refund-required amounts are shown separately as requests; they are not treated as completed refunds.
        </div>

        <div className="bg-white border border-[#EADFF0] rounded-2xl p-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E769E]"/>
            <input value={search} onChange={e => { setSearch(e.target.value); setOffset(0); }} placeholder="Search customer name, email or phone…" className="w-full pl-9 pr-3 py-2.5 bg-[#FAF5FC] border border-[#E7DCEB] rounded-xl text-xs outline-none focus:border-[#563568]"/>
          </div>
        </div>

        <div className="bg-white border border-[#EADFF0] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[760px]">
              <thead className="bg-[#FAF5FC] text-[#705E7B] uppercase text-[10px]">
                <tr><th className="p-3">Customer</th><th className="p-3">Contact</th><th className="p-3">Orders</th><th className="p-3">Paid lifetime total</th><th className="p-3">Segment</th><th className="p-3">Last order (IST)</th><th className="p-3 text-right">History</th></tr>
              </thead>
              <tbody className="divide-y divide-[#F5EDF8]">
                {loading ? <tr><td colSpan={7} className="p-10 text-center text-[#8E769E]">Loading live customer records…</td></tr> :
                customers.length === 0 ? <tr><td colSpan={7} className="p-10 text-center text-[#8E769E]">No matching customer orders found.</td></tr> :
                customers.map(customer => (
                  <tr key={customer.email} className="hover:bg-[#FAF5FC]">
                    <td className="p-3"><div className="font-semibold text-[#302438]">{customer.name}</div><div className="text-[10px] text-[#8E769E]">{customer.city}{customer.city && customer.state ? ', ' : ''}{customer.state}</div></td>
                    <td className="p-3"><div>{customer.email}</div><div className="text-[10px] text-[#8E769E]">{customer.phone || 'Phone not provided'}</div></td>
                    <td className="p-3 tabular-nums">{customer.totalOrders}</td>
                    <td className="p-3 font-semibold tabular-nums">{formatInr(customer.lifetimeSpend)}</td>
                    <td className="p-3"><span className="px-2 py-1 rounded-full bg-[#F4EDF8] text-[#563568] text-[10px]">{customerSegment(customer)}</span></td>
                    <td className="p-3">{formatDate(customer.lastOrderAt)}</td>
                    <td className="p-3 text-right"><button onClick={() => void openHistory(customer)} className="px-3 py-1.5 rounded-lg bg-[#563568] text-white text-[10px]">View history</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-[#F5EDF8] p-3 text-xs text-[#705E7B]">
            <span>Showing {total === 0 ? 0 : offset + 1}–{Math.min(offset + customers.length, total)} of {total}</span>
            <div className="flex gap-2">
              <button disabled={offset === 0 || loading} onClick={() => void load(Math.max(0, offset - 50))} className="inline-flex items-center gap-1 px-3 py-1.5 border border-[#E7DCEB] rounded-lg disabled:opacity-40"><ChevronLeft size={13}/> Previous</button>
              <button disabled={offset + customers.length >= total || loading} onClick={() => void load(offset + 50)} className="inline-flex items-center gap-1 px-3 py-1.5 border border-[#E7DCEB] rounded-lg disabled:opacity-40">Next <ChevronRight size={13}/></button>
            </div>
          </div>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-[70] flex justify-end bg-black/40" onClick={() => setSelected(null)}>
          <section role="dialog" aria-modal="true" aria-label="Customer order history" onClick={e => e.stopPropagation()} className="w-full max-w-xl h-full overflow-y-auto bg-[#FCF9FD] shadow-2xl">
            <div className="sticky top-0 bg-white border-b border-[#EADFF0] p-5 flex items-start justify-between gap-3">
              <div><p className="text-[10px] uppercase tracking-widest text-[#8E769E]">Customer order history</p><h2 className="font-serif text-xl text-[#302438] mt-1">{selected.name}</h2><p className="text-xs text-[#705E7B] mt-1">{selected.email}</p></div>
              <button onClick={() => setSelected(null)} aria-label="Close history" className="p-2 rounded-lg border border-[#E7DCEB]"><X size={16}/></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-white rounded-xl border border-[#EADFF0] p-4 space-y-2 text-xs">
                <div className="flex items-center gap-2"><Mail size={13}/>{selected.email}</div>
                <div className="flex items-center gap-2"><Phone size={13}/>{selected.phone || 'Phone not provided'}</div>
                <div className="flex items-center gap-2"><MapPin size={13}/>{[selected.city, selected.state].filter(Boolean).join(', ') || 'Location not available'}</div>
                <div className="flex items-center gap-2"><ShoppingBag size={13}/>{selected.totalOrders} orders · Paid lifetime total {formatInr(selected.lifetimeSpend)}</div>
              </div>
              {historyLoading ? <p className="py-10 text-center text-xs text-[#8E769E]">Loading order history…</p> :
               historyError ? <p role="alert" className="p-3 bg-red-50 text-red-700 rounded-lg text-xs">{historyError}</p> :
               history.length === 0 ? <p className="py-10 text-center text-xs text-[#8E769E]">No order history found.</p> :
               history.map(order => (
                 <article key={order.orderNumber} className="bg-white border border-[#EADFF0] rounded-xl p-4 space-y-3">
                   <div className="flex items-start justify-between gap-3"><div><div className="font-semibold text-[#563568]">{order.orderNumber}</div><div className="text-[10px] text-[#8E769E] flex items-center gap-1 mt-1"><Clock size={11}/>{formatDate(order.createdAt)}</div></div><div className="text-right"><div className="font-semibold">{formatInr(order.total)}</div><div className="text-[10px] text-[#705E7B] capitalize">{order.orderStatus.replace(/_/g, ' ')}</div></div></div>
                   <div className="text-[11px] text-[#705E7B] capitalize">{order.paymentMethod} · {order.paymentStatus}</div>
                   {order.refundNeeded && (
                     <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-900">
                       <div className="font-semibold">Refund required — not recorded as completed</div>
                       <div>{formatInr(order.refundAmount)} requested for this order. Verify settlement separately before marking it refunded.</div>
                     </div>
                   )}
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
