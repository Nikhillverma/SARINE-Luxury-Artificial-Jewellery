import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { formatInr } from '../../utils/currency';
import { hostingerAdminReturnsService, type AdminReturnRequest, type AdminRefundRequest, type AdminWebhookEvent, type ReturnStatus } from '../../services/hostinger/hostingerAdminReturnsService';
import { RefreshCw, Search, RotateCcw, IndianRupee, Clock, AlertTriangle, Save, ShieldCheck, Download, Filter, CheckCircle2, XCircle, PackageCheck } from 'lucide-react';

type QueueTab = 'returns' | 'refunds' | 'webhooks';
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
    if (status !== item.status && ['approved', 'rejected', 'resolved', 'closed'].includes(status) && !window.confirm('Confirm changing ' + item.orderNumber + ' to “' + status.replaceAll('_', ' ') + '”? This updates the return request record only; it does not issue a refund.')) return;
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
function RefundCard({ item, onSaved }: { item: AdminRefundRequest; onSaved: () => void }) {
  const payments = item.capturedPayments || [];
  const [paymentId, setPaymentId] = useState(payments[0]?.paymentId || item.razorpayPaymentId || '');
  const [amount, setAmount] = useState(Number(item.amountRequested || 0).toFixed(2));
  const [reason, setReason] = useState(item.cancellationReason || 'Approved customer refund');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const history = item.refundHistory || [];
  const unresolved = history.find(entry => ['unknown', 'submitting'].includes(entry.status));
  const pendingRecord = history.find(entry => entry.status === 'pending');
  const pending = Boolean(pendingRecord);

  const issueRefund = async () => {
    const rupees = Number(amount);
    if (!paymentId || !Number.isFinite(rupees) || rupees < 1 || !reason.trim()) {
      setError('Choose a captured payment, enter a valid amount and provide a reason.');
      return;
    }
    if (!window.confirm('Send a Razorpay refund of ' + formatInr(rupees) + ' for ' + item.orderNumber + '? This will contact the live payment gateway.')) return;
    setSaving(true); setError(''); setFeedback('');
    try {
      const result = await hostingerAdminReturnsService.createRefund({
        orderNumber: item.orderNumber, paymentId, amountPaise: Math.round(rupees * 100), reason: reason.trim()
      });
      setFeedback(result.message + ' Status: ' + result.status.replaceAll('_', ' ') + '.');
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refund request could not be completed.');
    } finally { setSaving(false); }
  };

  const reconcileRefund = async () => {
    if (!pendingRecord || !window.confirm('Fetch the current refund status directly from Razorpay for ' + item.orderNumber + '?')) return;
    setSaving(true); setError(''); setFeedback('');
    try {
      const result = await hostingerAdminReturnsService.reconcileRefund(pendingRecord.id);
      setFeedback(result.message);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Razorpay refund status could not be checked.');
    } finally { setSaving(false); }
  };

  const retryRefund = async () => {
    if (!unresolved || !window.confirm('Retry this exact refund using its original Razorpay idempotency key?')) return;
    setSaving(true); setError(''); setFeedback('');
    try {
      const result = await hostingerAdminReturnsService.retryRefund(unresolved.id);
      setFeedback(result.message + ' Status: ' + result.status.replaceAll('_', ' ') + '.');
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refund retry could not be completed.');
    } finally { setSaving(false); }
  };

  return (
    <article className="bg-white border border-[#EADFF0] rounded-2xl p-4 sm:p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div><div className="flex items-center gap-2"><h3 className="font-semibold text-[#563568]">{item.orderNumber}</h3><span className={'px-2 py-1 rounded-full text-[10px] ' + (item.refundRequired ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800')}>{item.refundRequired ? 'Refund required' : 'Refund reconciled'}</span></div><p className="text-xs text-[#302438] mt-2">{item.customer.name} · {item.customer.email}</p><p className="text-[11px] text-[#8E769E] mt-1">{item.customer.phone || 'Phone not provided'} · {item.paymentMethod} · payment {item.paymentStatus}</p></div>
        <div className="sm:text-right"><div className="text-[10px] uppercase tracking-wider text-[#8E769E]">Refund target</div><div className="font-serif text-2xl text-[#302438]">{formatInr(item.amountRequested)}</div></div>
      </div>
      {item.cancellationReason && <p className="text-xs text-[#705E7B]">Reason: {item.cancellationReason}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-xl bg-[#FAF5FC] p-3 text-[11px] text-[#705E7B]"><div>Order date: {dateLabel(item.createdAt)}</div><div>Cancellation date: {dateLabel(item.cancelledAt)}</div><div>Payment events recorded: {item.paymentEventCount}</div><div>Primary payment: <span className="font-mono break-all">{item.razorpayPaymentId || 'Not available'}</span></div></div>

      {history.length > 0 && <div className="space-y-2"><p className="text-[10px] uppercase tracking-wider text-[#8E769E]">Refund audit history</p>{history.map(entry => <div key={entry.id} className="rounded-xl border border-[#EADFF0] p-3 text-[11px] space-y-1"><div className="flex flex-wrap justify-between gap-2"><strong className="text-[#563568]">{formatInr(entry.amountPaise / 100)} · {entry.status.replaceAll('_', ' ')}</strong><span className="text-[#8E769E]">{dateLabel(entry.processedAt || entry.createdAt)}</span></div><div className="text-[#705E7B]">Payment: <span className="font-mono break-all">{entry.paymentId}</span></div>{entry.gatewayRefundId && <div className="text-[#705E7B]">Razorpay refund: <span className="font-mono break-all">{entry.gatewayRefundId}</span></div>}<div className="text-[#705E7B]">{entry.reason} · requested by {entry.requestedBy}</div>{entry.errorMessage && <p className="text-amber-800">{entry.errorMessage}</p>}</div>)}</div>}

      {!item.refundRequired && <p className="rounded-xl bg-emerald-50 p-3 text-[11px] text-emerald-900">No outstanding refund requirement. This case remains visible here for audit history.</p>}
      {unresolved && <div className="rounded-xl bg-amber-50 p-3 text-[11px] text-amber-900 space-y-2"><p>The gateway outcome is not yet confirmed. Do not create a new refund. Retry will reuse the original idempotency key and exact amount.</p><button onClick={() => void retryRefund()} disabled={saving} className="rounded-lg border border-amber-300 px-3 py-2 font-medium disabled:opacity-50">{saving ? 'Checking…' : 'Retry same refund safely'}</button></div>}
      {pending && <div className="rounded-xl bg-amber-50 p-3 text-[11px] text-amber-900 space-y-2"><p>A refund is pending at Razorpay. Do not submit another refund while this one is pending.</p><button onClick={() => void reconcileRefund()} disabled={saving} className="rounded-lg border border-amber-300 px-3 py-2 font-medium disabled:opacity-50">{saving ? 'Checking Razorpay…' : 'Refresh verified gateway status'}</button></div>}

      {item.refundRequired && !unresolved && !pending && <div className="rounded-xl border border-[#EADFF0] p-3 space-y-3">
        <p className="text-[10px] uppercase tracking-wider text-[#8E769E]">Issue a verified Razorpay refund</p>
        <label className="block text-[10px] uppercase tracking-wider text-[#705E7B]">Captured payment<select value={paymentId} onChange={e => setPaymentId(e.target.value)} className="mt-1.5 w-full rounded-lg border border-[#E7DCEB] bg-white p-2.5 text-xs normal-case tracking-normal text-[#302438]">{payments.map(payment => <option key={payment.paymentId} value={payment.paymentId}>{formatInr(payment.amountPaise / 100)} · {payment.paymentId} · {payment.eventStatus.replaceAll('_', ' ')}</option>)}</select></label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-[10px] uppercase tracking-wider text-[#705E7B]">Refund amount (₹)<input type="number" min="1" step="0.01" max={item.amountRequested} value={amount} onChange={e => setAmount(e.target.value)} className="mt-1.5 w-full rounded-lg border border-[#E7DCEB] bg-white p-2.5 text-xs normal-case tracking-normal text-[#302438]"/></label>
          <label className="text-[10px] uppercase tracking-wider text-[#705E7B]">Reason<input value={reason} onChange={e => setReason(e.target.value)} maxLength={500} className="mt-1.5 w-full rounded-lg border border-[#E7DCEB] bg-white p-2.5 text-xs normal-case tracking-normal text-[#302438]"/></label>
        </div>
        <div className="flex justify-end"><button onClick={() => void issueRefund()} disabled={saving || !payments.length} className="inline-flex items-center gap-2 rounded-lg bg-[#563568] px-4 py-2.5 text-xs font-medium text-white disabled:opacity-50"><IndianRupee size={13}/>{saving ? 'Contacting Razorpay…' : 'Issue refund'}</button></div>
        {!payments.length && <p className="text-[11px] text-amber-800">No captured payment is linked to this order yet. Reconcile the payment before issuing a refund.</p>}
      </div>}
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}{feedback && <p role="status" className="text-xs text-[#563568]">{feedback}</p>}
      <p className="text-[11px] text-amber-800 flex items-start gap-2"><AlertTriangle size={14} className="shrink-0 mt-0.5"/>Only a verified Razorpay “processed” response or matching signed refund webhook clears the refund requirement. Pending or uncertain outcomes remain open for reconciliation.</p>
    </article>
  );
}
function WebhookEventCard({ item }: { item: AdminWebhookEvent }) {
  const status = item.reconciliationStatus.replaceAll('_', ' ');
  const isMatched = ['matched', 'refund_processed', 'superseded_by_capture'].includes(item.reconciliationStatus);
  const refundOutcomeNeedsAction = ['failed', 'reversed'].includes(item.refundRecordStatus || '');
  return (
    <article className="bg-white border border-[#EADFF0] rounded-2xl p-4 sm:p-5 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-[#563568]">{item.eventType}</h3><span className={'px-2 py-1 rounded-full text-[10px] ' + (isMatched ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800')}>{status}</span></div><p className="text-[11px] text-[#8E769E] mt-2">Event {item.eventId} · {dateLabel(item.receivedAt)}</p></div>
        <div className="text-left sm:text-right"><div className="text-[10px] uppercase tracking-wider text-[#8E769E]">Gateway status</div><div className="text-sm font-medium text-[#302438]">{item.gatewayStatus || 'Not supplied'}</div>{item.amountPaise !== null && <div className="text-xs text-[#705E7B]">{formatInr(item.amountPaise / 100)}</div>}</div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-xl bg-[#FAF5FC] p-3 text-[11px] text-[#705E7B]">
        <div>SARINE order: <span className="font-semibold">{item.orderNumber || 'No matching order'}</span></div>
        <div>SARINE payment: {item.orderPaymentStatus || 'Not linked'} · {item.orderStatus || '—'}</div>
        <div>Gateway payment: <span className="font-mono break-all">{item.gatewayPaymentId || '—'}</span></div>
        <div>Gateway order: <span className="font-mono break-all">{item.gatewayOrderId || '—'}</span></div>
        {item.gatewayRefundId && <div>Gateway refund: <span className="font-mono break-all">{item.gatewayRefundId}</span></div>}{item.gatewayReceipt && <div>Refund receipt: <span className="font-mono break-all">{item.gatewayReceipt}</span></div>}{item.refundRecordStatus && <div>Refund ledger: {item.refundRecordStatus}</div>}
      </div>
      {refundOutcomeNeedsAction && <p className="text-[11px] text-amber-800 flex items-start gap-2"><AlertTriangle size={14} className="shrink-0 mt-0.5"/>Razorpay reports this refund as {item.refundRecordStatus}. The refund requirement remains open for review.</p>}
      {!isMatched && !item.refundRecordStatus && <p className="text-[11px] text-amber-800 flex items-start gap-2"><AlertTriangle size={14} className="shrink-0 mt-0.5"/>Review this event against Razorpay and SARINE records. This view does not alter payment or order status.</p>}
    </article>
  );
}
function csvCell(value: unknown) {
  let text = String(value ?? '');
  if (/^[\s\u0000-\u001f]*[=+\-@]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
function exportCsv(filename: string, rows: unknown[][]) {
  const csv = rows.map(row => row.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename;
  document.body.appendChild(anchor); anchor.click(); anchor.remove();
  URL.revokeObjectURL(url);
}
function withinDateRange(value: string | null, from: string, to: string) {
  if (!from && !to) return true;
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  if (from && date.getTime() < new Date(from + 'T00:00:00').getTime()) return false;
  if (to && date.getTime() >= new Date(to + 'T00:00:00').getTime() + 86400000) return false;
  return true;
}
type QueueStatus = 'all' | 'open' | 'pending' | 'approved' | 'rejected' | 'resolved' | 'refund-required' | 'refund-processed' | 'refund-pending' | 'refund-failed';
type SortMode = 'newest' | 'oldest' | 'amount-high' | 'amount-low';
export const AdminReturnsPage: React.FC = () => {
  const [tab, setTab] = useState<QueueTab>('returns');
  const [returns, setReturns] = useState<AdminReturnRequest[]>([]);
  const [refunds, setRefunds] = useState<AdminRefundRequest[]>([]);
  const [webhookEvents, setWebhookEvents] = useState<AdminWebhookEvent[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<QueueStatus>('all');
  const [sort, setSort] = useState<SortMode>('newest');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const [stale, setStale] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [data, webhookData] = await Promise.all([
        hostingerAdminReturnsService.getQueue(search),
        hostingerAdminReturnsService.getWebhookEvents()
      ]);
      setReturns(data.returns); setRefunds(data.refundRequests); setWebhookEvents(webhookData.events);
      setLastLoadedAt(new Date().toISOString()); setStale(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load Returns & Refunds.');
      setStale(true);
    } finally { setLoading(false); }
  }, [search]);
  useEffect(() => { void load(); }, [load]);

  const pendingReturns = returns.filter(item => !['resolved', 'closed', 'rejected'].includes(item.status)).length;
  const approvedReturns = returns.filter(item => ['approved', 'item_received', 'inspection_passed'].includes(item.status)).length;
  const rejectedReturns = returns.filter(item => item.status === 'rejected').length;
  const resolvedReturns = returns.filter(item => ['resolved', 'closed'].includes(item.status)).length;
  const refundRequiredCount = refunds.filter(item => item.refundRequired).length;
  const refundProcessedCount = refunds.filter(item => (item.refundHistory || []).some(entry => entry.status === 'processed')).length;
  const refundPendingCount = refunds.filter(item => (item.refundHistory || []).some(entry => ['pending', 'submitting', 'unknown'].includes(entry.status))).length;
  const refundFailedCount = refunds.filter(item => (item.refundHistory || []).some(entry => ['failed', 'reversed'].includes(entry.status))).length;
  const totalRefundRequested = refunds.filter(item => item.refundRequired).reduce((sum, item) => sum + Number(item.amountRequested || 0), 0);

  const visibleReturns = useMemo(() => returns.filter(item => {
    if (!withinDateRange(item.createdAt, fromDate, toDate)) return false;
    if (statusFilter === 'open') return !['resolved', 'closed', 'rejected'].includes(item.status);
    if (statusFilter === 'all') return true;
    if (statusFilter === 'refund-required' || statusFilter === 'refund-processed' || statusFilter === 'refund-pending' || statusFilter === 'refund-failed') return false;
    return item.status === statusFilter;
  }).sort((a, b) => {
    const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (sort === 'oldest') return aDate - bDate;
    if (sort === 'amount-high') return b.order.total - a.order.total;
    if (sort === 'amount-low') return a.order.total - b.order.total;
    return bDate - aDate;
  }), [returns, fromDate, toDate, statusFilter, sort]);

  const visibleRefunds = useMemo(() => refunds.filter(item => {
    if (!withinDateRange(item.createdAt, fromDate, toDate)) return false;
    const history = item.refundHistory || [];
    if (statusFilter === 'refund-required') return item.refundRequired;
    if (statusFilter === 'refund-processed') return history.some(entry => entry.status === 'processed');
    if (statusFilter === 'refund-pending') return history.some(entry => ['pending', 'submitting', 'unknown'].includes(entry.status));
    if (statusFilter === 'refund-failed') return history.some(entry => ['failed', 'reversed'].includes(entry.status));
    return statusFilter === 'all';
  }).sort((a, b) => {
    const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (sort === 'oldest') return aDate - bDate;
    if (sort === 'amount-high') return b.amountRequested - a.amountRequested;
    if (sort === 'amount-low') return a.amountRequested - b.amountRequested;
    return bDate - aDate;
  }), [refunds, fromDate, toDate, statusFilter, sort]);

  const visibleEvents = useMemo(() => webhookEvents.filter(item => withinDateRange(item.receivedAt, fromDate, toDate)).sort((a, b) => {
    const aDate = a.receivedAt ? new Date(a.receivedAt).getTime() : 0;
    const bDate = b.receivedAt ? new Date(b.receivedAt).getTime() : 0;
    return sort === 'oldest' ? aDate - bDate : bDate - aDate;
  }), [webhookEvents, fromDate, toDate, sort]);

  const clearFilters = () => { setStatusFilter('all'); setFromDate(''); setToDate(''); setSort('newest'); };
  const exportCurrent = () => {
    if (tab === 'returns') exportCsv('sarine-return-requests.csv', [
      ['Order number', 'Request type', 'Status', 'Customer', 'Email', 'Phone', 'Reason', 'Customer notes', 'Resolution notes', 'Order total INR', 'Payment method', 'Payment status', 'Created at'],
      ...visibleReturns.map(item => [item.orderNumber, item.requestType, item.status, item.customer.name, item.customer.email, item.customer.phone, item.reason, item.notes, item.resolutionNotes, item.order.total, item.order.paymentMethod, item.order.paymentStatus, item.createdAt])
    ]);
    else if (tab === 'refunds') exportCsv('sarine-refund-audit.csv', [
      ['Order number', 'Customer', 'Email', 'Refund required', 'Requested amount INR', 'Payment method', 'Payment status', 'Order status', 'Refund history status', 'Gateway refund ID', 'Payment ID', 'Reason', 'Created at'],
      ...visibleRefunds.map(item => [item.orderNumber, item.customer.name, item.customer.email, item.refundRequired, item.amountRequested, item.paymentMethod, item.paymentStatus, item.orderStatus, (item.refundHistory || []).map(h => h.status).join(' | '), (item.refundHistory || []).map(h => h.gatewayRefundId || '').join(' | '), item.razorpayPaymentId, item.cancellationReason, item.createdAt])
    ]);
    else exportCsv('sarine-payment-events.csv', [
      ['Event ID', 'Event type', 'Reconciliation status', 'Gateway status', 'Order number', 'Order payment status', 'Order status', 'Gateway payment ID', 'Gateway refund ID', 'Amount INR', 'Received at'],
      ...visibleEvents.map(item => [item.eventId, item.eventType, item.reconciliationStatus, item.gatewayStatus, item.orderNumber, item.orderPaymentStatus, item.orderStatus, item.gatewayPaymentId, item.gatewayRefundId, item.amountPaise === null ? '' : item.amountPaise / 100, item.receivedAt])
    ]);
  };
  const hasFilters = statusFilter !== 'all' || fromDate || toDate || sort !== 'newest';
  const tabCount = tab === 'returns' ? visibleReturns.length : tab === 'refunds' ? visibleRefunds.length : visibleEvents.length;

  return (
    <AdminLayout>
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div><p className="text-[10px] uppercase tracking-[0.22em] text-[#8E769E]">After-sales service</p><h1 className="font-serif text-2xl sm:text-3xl text-[#302438]">Returns & Refunds</h1><p className="text-xs text-[#705E7B] mt-1">One place to review return requests, track payment refunds and audit gateway events.</p></div>
          <div className="flex gap-2">
            <button onClick={exportCurrent} disabled={loading || tabCount === 0} className="inline-flex min-h-11 items-center justify-center gap-2 px-3 border border-[#E7DCEB] rounded-xl text-xs disabled:opacity-40"><Download size={14}/> Export CSV</button>
            <button onClick={() => void load()} disabled={loading} className="inline-flex min-h-11 items-center justify-center gap-2 px-3 border border-[#E7DCEB] rounded-xl text-xs disabled:opacity-50"><RefreshCw size={14} className={loading ? 'animate-spin' : ''}/> Refresh</button>
          </div>
        </div>
        {stale && <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-900">Showing the last successfully loaded snapshot. Refresh failed; these records may be out of date.{lastLoadedAt && ' Last successful load: ' + dateLabel(lastLoadedAt) + '.'}</div>}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <div className="bg-white border border-[#EADFF0] rounded-2xl p-4"><div className="flex items-center gap-2 text-xs text-[#705E7B]"><RotateCcw size={14}/> Return / exchange requests</div><div className="font-serif text-2xl mt-2 tabular-nums">{returns.length}</div><p className="text-[10px] text-[#8E769E] mt-1">Loaded search results</p></div>
          <div className="bg-white border border-[#EADFF0] rounded-2xl p-4"><div className="flex items-center gap-2 text-xs text-[#705E7B]"><Clock size={14}/> Awaiting resolution</div><div className="font-serif text-2xl mt-2 tabular-nums">{pendingReturns}</div><p className="text-[10px] text-[#8E769E] mt-1">{approvedReturns} approved / in inspection · {rejectedReturns} rejected · {resolvedReturns} resolved</p></div>
          <div className="bg-white border border-[#EADFF0] rounded-2xl p-4"><div className="flex items-center gap-2 text-xs text-[#705E7B]"><IndianRupee size={14}/> Refunds requiring action</div><div className="font-serif text-2xl mt-2 tabular-nums">{refundRequiredCount}</div><p className="text-[10px] text-[#8E769E] mt-1">{formatInr(totalRefundRequested)} requested amount · loaded records</p></div>
          <div className="bg-white border border-[#EADFF0] rounded-2xl p-4"><div className="flex items-center gap-2 text-xs text-[#705E7B]"><ShieldCheck size={14}/> Refund audit outcomes</div><div className="font-serif text-2xl mt-2 tabular-nums">{refundProcessedCount} processed</div><p className="text-[10px] text-[#8E769E] mt-1">{refundPendingCount} pending / uncertain · {refundFailedCount} failed / reversed</p></div>
        </div>
        <div className="rounded-xl border border-[#E7DCEB] bg-[#FAF5FC] p-3 text-[11px] text-[#705E7B] flex items-start gap-2"><ShieldCheck size={15} className="shrink-0 mt-0.5"/>Counts and exports are limited to the currently loaded search results (up to 100 per queue). Refund “processed” is shown only from the refund ledger's processed state; payment events alone do not prove settlement. No automatic or background refunds are issued.</div>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E769E]"/><input aria-label="Search returns and refunds by order number, customer, or email" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search order number, customer or email…" className="w-full min-h-11 pl-9 pr-3 py-2.5 bg-white border border-[#E7DCEB] rounded-xl text-xs outline-none focus:border-[#563568]"/></div>
          <div className="flex gap-2 overflow-x-auto">
            <button onClick={() => setTab('returns')} className={'min-h-11 whitespace-nowrap px-4 py-2.5 rounded-xl text-xs ' + (tab === 'returns' ? 'bg-[#563568] text-white' : 'bg-white border border-[#E7DCEB] text-[#563568]')}>Return requests ({returns.length})</button>
            <button onClick={() => setTab('refunds')} className={'min-h-11 whitespace-nowrap px-4 py-2.5 rounded-xl text-xs ' + (tab === 'refunds' ? 'bg-[#563568] text-white' : 'bg-white border border-[#E7DCEB] text-[#563568]')}>Refund queue ({refunds.length})</button>
            <button onClick={() => setTab('webhooks')} className={'min-h-11 whitespace-nowrap px-4 py-2.5 rounded-xl text-xs ' + (tab === 'webhooks' ? 'bg-[#563568] text-white' : 'bg-white border border-[#E7DCEB] text-[#563568]')}>Payment events ({webhookEvents.length})</button>
          </div>
        </div>
        <div className="bg-white border border-[#EADFF0] rounded-2xl p-3 space-y-3">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-[#8E769E]"><Filter size={13}/> Filters and sorting</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
            <label className="text-[10px] text-[#705E7B]">Status
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as QueueStatus)} className="mt-1 w-full min-h-11 rounded-lg border border-[#E7DCEB] bg-white px-3 text-xs text-[#302438]">
                <option value="all">All statuses</option>
                {tab === 'returns' ? <><option value="open">Open / awaiting resolution</option><option value="pending">Pending review</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="resolved">Resolved</option></> : tab === 'refunds' ? <><option value="refund-required">Refund required</option><option value="refund-processed">Processed</option><option value="refund-pending">Pending / uncertain</option><option value="refund-failed">Failed / reversed</option></> : <option value="open">All reconciliation events</option>}
              </select>
            </label>
            <label className="text-[10px] text-[#705E7B]">Sort by
              <select value={sort} onChange={e => setSort(e.target.value as SortMode)} className="mt-1 w-full min-h-11 rounded-lg border border-[#E7DCEB] bg-white px-3 text-xs text-[#302438]"><option value="newest">Newest first</option><option value="oldest">Oldest first</option>{tab !== 'webhooks' && <><option value="amount-high">Highest amount</option><option value="amount-low">Lowest amount</option></>}</select>
            </label>
            <label className="text-[10px] text-[#705E7B]">From date
              <input type="date" value={fromDate} max={toDate || undefined} onChange={e => setFromDate(e.target.value)} className="mt-1 w-full min-h-11 rounded-lg border border-[#E7DCEB] bg-white px-3 text-xs text-[#302438]"/>
            </label>
            <label className="text-[10px] text-[#705E7B]">To date
              <input type="date" value={toDate} min={fromDate || undefined} onChange={e => setToDate(e.target.value)} className="mt-1 w-full min-h-11 rounded-lg border border-[#E7DCEB] bg-white px-3 text-xs text-[#302438]"/>
            </label>
          </div>
          <div className="flex items-center justify-between gap-3"><p className="text-[10px] text-[#8E769E]">Showing {tabCount} matching records in the loaded snapshot.</p>{hasFilters && <button onClick={clearFilters} className="min-h-10 text-xs text-[#563568] underline underline-offset-2">Clear filters</button>}</div>
        </div>
        <div className="rounded-xl border border-[#E7DCEB] bg-[#FAF5FC] p-3 text-[11px] text-[#705E7B] flex items-start gap-2"><ShieldCheck size={15} className="shrink-0 mt-0.5"/>Return status changes update the request workflow only. Issuing a refund contacts Razorpay and always requires a separate explicit confirmation. Pending or uncertain gateway outcomes must be reconciled; never issue a duplicate refund.</div>
        {error && <div role="alert" className="p-3 rounded-xl bg-red-50 text-red-700 text-xs">{error}</div>}
        {loading ? <div className="bg-white border border-[#EADFF0] rounded-2xl p-10 text-center text-xs text-[#8E769E]">Loading live records from MariaDB…</div> :
          tab === 'returns' ? (visibleReturns.length ? <div className="space-y-3">{visibleReturns.map(item => <ReturnCard key={item.id} item={item} onSaved={() => void load()}/>)}</div> :
            <div className="bg-white border border-[#EADFF0] rounded-2xl p-10 text-center"><RotateCcw size={24} className="mx-auto text-[#8E769E]"/><h2 className="font-serif text-xl text-[#302438] mt-3">No matching return requests</h2><p className="text-xs text-[#705E7B] mt-2">Try clearing filters or searching a different order/customer.</p></div>) :
          tab === 'refunds' ? (visibleRefunds.length ? <div className="space-y-3">{visibleRefunds.map(item => <RefundCard key={item.orderNumber} item={item} onSaved={() => void load()}/>)}</div> :
            <div className="bg-white border border-[#EADFF0] rounded-2xl p-10 text-center"><IndianRupee size={24} className="mx-auto text-[#8E769E]"/><h2 className="font-serif text-xl text-[#302438] mt-3">No matching refund cases</h2><p className="text-xs text-[#705E7B] mt-2">Try clearing filters or searching a different order/customer.</p></div>) :
          (visibleEvents.length ? <div className="space-y-3">{visibleEvents.map(item => <WebhookEventCard key={item.eventId} item={item}/>)}</div> :
            <div className="bg-white border border-[#EADFF0] rounded-2xl p-10 text-center"><ShieldCheck size={24} className="mx-auto text-[#8E769E]"/><h2 className="font-serif text-xl text-[#302438] mt-3">No matching payment events</h2><p className="text-xs text-[#705E7B] mt-2">Try clearing filters or check again after new gateway events arrive.</p></div>)}
      </div>
    </AdminLayout>
  );
};
