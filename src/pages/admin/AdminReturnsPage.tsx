import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { formatInr } from '../../utils/currency';
import { hostingerAdminReturnsService, type AdminReturnRequest, type AdminRefundRequest, type ReturnStatus } from '../../services/hostinger/hostingerAdminReturnsService';
import { RefreshCw, Search, RotateCcw, IndianRupee, Clock, AlertTriangle, Save, ShieldCheck } from 'lucide-react';

type QueueTab = 'returns' | 'refunds';
const STATUS_OPTIONS: Array<{ value: ReturnStatus; label: string }> = [
  { value: 'pending', label: 'Pending review' }, { value: 'under_review', label: 'Under review' },
  { value: 'approved', label: 'Approved' }, { value: 'rejected', label: 'Rejected' },
  { value: 'item_received', label: 'Item received' }, { value: 'inspection_passed', label: 'Inspection passed' },
  { value: 'inspection_failed', label: 'Inspection failed' }, { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' }
];
function dateLabel(value: string | null) {
  if (!value) return 'Date not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date not recorded';
  return new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).format(date);
}
function ReturnCard({ item, onSaved }: { item: AdminReturnRequest; onSaved: () => void }) {
  const [status, setStatus] = useState<ReturnStatus>(STATUS_OPTIONS.some(option => option.value === item.status) ? item.status as ReturnStatus : 'pending');
  const [notes, setNotes] = useState(item.resolutionNotes || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const save = async () => {
    setSaving(true); setError(''); setSuccess('');
    try { await hostingerAdminReturnsService.updateReturn(item.id, status, notes); setSuccess('Request updated.'); onSaved(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not update request.'); }
    finally { setSaving(false); }
  };
  return (
    <article className="bg-white border border-[#EADFF0] rounded-2xl p-4 sm:p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-[#563568]">{item.orderNumber}</h3><span className="px-2 py-1 rounded-full bg-[#F4EDF8] text-[#563568] text-[10px] uppercase">{item.requestType}</span><span className="px-2 py-1 rounded-full bg-[#FAF5FC] text-[#705E7B] text-[10px]">{item.status.replaceAll('_', ' ')}</span></div>
          <p className="text-xs text-[#302438] mt-2">{item.customer.name} · {item.customer.email}</p>
          <p className="text-[11px] text-[#8E769E] mt-1">{item.customer.phone || 'Phone not provided'} · Submitted {dateLabel(item.createdAt)}</p>
        </div>
        <div className="text-left sm:text-right"><div className="text-[10px] uppercase tracking-wider text-[#8E769E]">Order value</div><div className="font-serif text-xl text-[#302438]">{formatInr(item.order.total)}</div><div className="text-[10px] text-[#705E7B]">{item.order.paymentMethod} · {item.order.paymentStatus}</div></div>
      </div>
      <div className="rounded-xl bg-[#FAF5FC] p-3 space-y-1"><p className="text-[10px] uppercase tracking-wider text-[#8E769E]">Customer reason</p><p className="text-xs text-[#302438]">{item.reason}</p>{item.notes && <p className="text-xs text-[#705E7B] whitespace-pre-wrap">{item.notes}</p>}</div>
      <div className="grid grid-cols-1 sm:grid-cols-[220px_1fr] gap-3">
        <label className="text-[10px] uppercase tracking-wider text-[#705E7B]">Request status<select value={status} onChange={e => setStatus(e.target.value as ReturnStatus)} className="mt-1.5 w-full rounded-lg border border-[#E7DCEB] bg-white p-2.5 text-xs normal-case tracking-normal text-[#302438]">{STATUS_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label className="text-[10px] uppercase tracking-wider text-[#705E7B]">Resolution / internal notes<textarea value={notes} onChange={e => setNotes(e.target.value)} maxLength={2000} rows={2} placeholder="Record inspection outcome or next steps…" className="mt-1.5 w-full rounded-lg border border-[#E7DCEB] bg-white p-2.5 text-xs normal-case tracking-normal text-[#302438]" /></label>
      </div>
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}{success && <p role="status" className="text-xs text-green-700">{success}</p>}
      <div className="flex justify-end"><button onClick={() => void save()} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[#563568] px-4 py-2.5 text-xs font-medium text-white disabled:opacity-50"><Save size={13}/>{saving ? 'Saving…' : 'Save request'}</button></div>
    </article>
  );
}
function RefundCard({ item }: { item: AdminRefundRequest }) {
  const latest = item.latestPaymentEvent ? ' · latest: ' + item.latestPaymentEvent + ' (' + dateLabel(item.latestPaymentEventAt) + ')' : '';
  return (
    <article className="bg-white border border-[#EADFF0] rounded-2xl p-4 sm:p-5 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div><div className="flex items-center gap-2"><h3 className="font-semibold text-[#563568]">{item.orderNumber}</h3><span className="px-2 py-1 rounded-full bg-amber-50 text-amber-800 text-[10px]">Refund required</span></div><p className="text-xs text-[#302438] mt-2">{item.customer.name} · {item.customer.email}</p><p className="text-[11px] text-[#8E769E] mt-1">{item.customer.phone || 'Phone not provided'} · {item.paymentMethod} · payment {item.paymentStatus}</p></div>
        <div className="sm:text-right"><div className="text-[10px] uppercase tracking-wider text-[#8E769E]">Amount requested</div><div className="font-serif text-2xl text-[#302438]">{formatInr(item.amountRequested)}</div></div>
      </div>
      {item.cancellationReason && <p className="text-xs text-[#705E7B]">Reason: {item.cancellationReason}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-xl bg-[#FAF5FC] p-3 text-[11px] text-[#705E7B]"><div>Order date: {dateLabel(item.createdAt)}</div><div>Cancellation date: {dateLabel(item.cancelledAt)}</div><div>Razorpay payment reference: <span className="font-mono break-all">{item.razorpayPaymentId || 'Not available'}</span></div><div>Payment events recorded: {item.paymentEventCount}{latest}</div></div>
      <p className="text-[11px] text-amber-800 flex items-start gap-2"><AlertTriangle size={14} className="shrink-0 mt-0.5"/>This is a refund-required/requested record, not proof of a completed refund. Verify the actual refund in Razorpay or the bank before recording it as paid.</p>
    </article>
  );
}
export const AdminReturnsPage: React.FC = () => {
  const [tab, setTab] = useState<QueueTab>('returns');
  const [returns, setReturns] = useState<AdminReturnRequest[]>([]);
  const [refunds, setRefunds] = useState<AdminRefundRequest[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const data = await hostingerAdminReturnsService.getQueue(search); setReturns(data.returns); setRefunds(data.refundRequests); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not load Returns & Refunds.'); }
    finally { setLoading(false); }
  }, [search]);
  useEffect(() => { void load(); }, [load]);
  const pendingReturns = useMemo(() => returns.filter(item => !['resolved', 'closed', 'rejected'].includes(item.status)).length, [returns]);
  return (
    <AdminLayout>
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"><div><p className="text-[10px] uppercase tracking-[0.22em] text-[#8E769E]">After-sales service</p><h1 className="font-serif text-2xl sm:text-3xl text-[#302438]">Returns & Refunds</h1><p className="text-xs text-[#705E7B] mt-1">Review customer return requests and monitor orders flagged for refunds.</p></div><button onClick={() => void load()} disabled={loading} className="inline-flex items-center justify-center gap-2 px-3 py-2 border border-[#E7DCEB] rounded-xl text-xs disabled:opacity-50"><RefreshCw size={14} className={loading ? 'animate-spin' : ''}/> Refresh</button></div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3"><div className="bg-white border border-[#EADFF0] rounded-2xl p-4"><div className="flex items-center gap-2 text-xs text-[#705E7B]"><RotateCcw size={14}/> Return / exchange requests</div><div className="font-serif text-2xl mt-2">{returns.length}</div></div><div className="bg-white border border-[#EADFF0] rounded-2xl p-4"><div className="flex items-center gap-2 text-xs text-[#705E7B]"><Clock size={14}/> Requests needing review</div><div className="font-serif text-2xl mt-2">{pendingReturns}</div></div><div className="bg-white border border-[#EADFF0] rounded-2xl p-4"><div className="flex items-center gap-2 text-xs text-[#705E7B]"><IndianRupee size={14}/> Refund-required orders</div><div className="font-serif text-2xl mt-2">{refunds.length}</div></div></div>
        <div className="flex flex-col sm:flex-row gap-3"><div className="relative flex-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E769E]"/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search order number, customer or email…" className="w-full pl-9 pr-3 py-2.5 bg-white border border-[#E7DCEB] rounded-xl text-xs outline-none focus:border-[#563568]"/></div><div className="flex gap-2"><button onClick={() => setTab('returns')} className={'px-4 py-2.5 rounded-xl text-xs ' + (tab === 'returns' ? 'bg-[#563568] text-white' : 'bg-white border border-[#E7DCEB] text-[#563568]')}>Return requests</button><button onClick={() => setTab('refunds')} className={'px-4 py-2.5 rounded-xl text-xs ' + (tab === 'refunds' ? 'bg-[#563568] text-white' : 'bg-white border border-[#E7DCEB] text-[#563568]')}>Refund queue</button></div></div>
        <div className="rounded-xl border border-[#E7DCEB] bg-[#FAF5FC] p-3 text-[11px] text-[#705E7B] flex items-start gap-2"><ShieldCheck size={15} className="shrink-0 mt-0.5"/>This module never changes historical orders or sends a payment. Refund completion must be verified from the payment provider; a payment event alone is not treated as a refund receipt.</div>
        {error && <div role="alert" className="p-3 rounded-xl bg-red-50 text-red-700 text-xs">{error}</div>}
        {loading ? <div className="bg-white border border-[#EADFF0] rounded-2xl p-10 text-center text-xs text-[#8E769E]">Loading live records from MariaDB…</div> :
          tab === 'returns' ? (returns.length ? <div className="space-y-3">{returns.map(item => <ReturnCard key={item.id} item={item} onSaved={() => void load()}/>)}</div> :
            <div className="bg-white border border-[#EADFF0] rounded-2xl p-10 text-center"><RotateCcw size={24} className="mx-auto text-[#8E769E]"/><h2 className="font-serif text-xl text-[#302438] mt-3">No return requests recorded</h2><p className="text-xs text-[#705E7B] mt-2">New requests will appear here when the customer return-request form is connected to the MariaDB returns table.</p></div>) :
          (refunds.length ? <div className="space-y-3">{refunds.map(item => <RefundCard key={item.orderNumber} item={item}/>)}</div> :
            <div className="bg-white border border-[#EADFF0] rounded-2xl p-10 text-center"><IndianRupee size={24} className="mx-auto text-[#8E769E]"/><h2 className="font-serif text-xl text-[#302438] mt-3">No refund-required orders</h2><p className="text-xs text-[#705E7B] mt-2">Orders flagged for refund handling will appear here.</p></div>)}
      </div>
    </AdminLayout>
  );
};
