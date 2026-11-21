import React, { useCallback, useEffect, useState } from 'react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { hostingerContactInquiryService, type AdminContactInquiry, type ContactInquiryStatus } from '../../services/hostinger/hostingerContactInquiryService';
import { Mail, MessageSquare, Phone, RefreshCw, Search, Save } from 'lucide-react';

const STATUS_OPTIONS: Array<{ value: ContactInquiryStatus; label: string }> = [
  { value: 'new', label: 'New' }, { value: 'reviewed', label: 'Reviewed' }, { value: 'closed', label: 'Closed' }
];
function dateLabel(value: string | null) {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
}
function InquiryCard({ item, onSaved }: { item: AdminContactInquiry; onSaved: () => void }) {
  const [status, setStatus] = useState<ContactInquiryStatus>(item.status);
  const [note, setNote] = useState(item.adminNote || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const save = async () => {
    setSaving(true); setError(''); setSuccess('');
    try { await hostingerContactInquiryService.updateAdminInquiry(item.id, status, note); setSuccess('Enquiry updated.'); onSaved(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not update enquiry.'); }
    finally { setSaving(false); }
  };
  return (
    <article className="bg-white border border-[#E7DCEB] rounded-xl p-4 sm:p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-[#563568]">{item.subject || 'Customer enquiry'}</h3><span className="rounded-full bg-[#F7F0FA] px-2.5 py-1 text-[10px] uppercase tracking-wider text-[#563568]">{item.status}</span></div>
          <p className="mt-2 text-sm text-[#302438]">{item.name}</p>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#705E7B]">
            <a className="inline-flex items-center gap-1.5 underline underline-offset-2" href={'mailto:' + item.email}><Mail size={13} />{item.email}</a>
            {item.phone && <a className="inline-flex items-center gap-1.5 underline underline-offset-2" href={'tel:' + item.phone}><Phone size={13} />{item.phone}</a>}
          </div>
          <p className="mt-2 text-[11px] text-[#8E769E]">Received {dateLabel(item.createdAt)}</p>
        </div>
        <span className="text-[10px] text-[#8E769E]">Enquiry #{item.id}</span>
      </div>
      <div className="rounded-lg bg-[#FAF5FC] p-4">
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-[#302438]">{item.message}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-[190px_1fr] gap-3">
        <label className="text-[10px] uppercase tracking-wider text-[#705E7B]">Status
          <select value={status} onChange={e => setStatus(e.target.value as ContactInquiryStatus)} className="mt-1.5 w-full min-h-10 rounded-lg border border-[#E7DCEB] bg-white p-2.5 text-xs normal-case tracking-normal text-[#302438]">{STATUS_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
        </label>
        <label className="text-[10px] uppercase tracking-wider text-[#705E7B]">Internal note
          <textarea value={note} onChange={e => setNote(e.target.value)} maxLength={1000} rows={2} placeholder="Record follow-up or resolution details…" className="mt-1.5 w-full rounded-lg border border-[#E7DCEB] bg-white p-2.5 text-xs normal-case tracking-normal text-[#302438]" />
        </label>
      </div>
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
      {success && <p role="status" className="text-xs text-emerald-700">{success}</p>}
      <div className="flex justify-end"><button type="button" onClick={() => void save()} disabled={saving} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#563568] px-4 py-2 text-xs font-medium text-white disabled:opacity-50"><Save size={14} />{saving ? 'Saving…' : 'Save update'}</button></div>
    </article>
  );
}
export const AdminContactInquiriesPage: React.FC = () => {
  const [items, setItems] = useState<AdminContactInquiry[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const result = await hostingerContactInquiryService.getAdminInquiries(status, search); setItems(result.inquiries); setCounts(result.counts); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not load customer enquiries.'); }
    finally { setLoading(false); }
  }, [status, search]);
  useEffect(() => { void load(); }, [load]);
  return (
    <AdminLayout>
      <main className="min-h-screen bg-[#F8F3FA] p-4 sm:p-7 lg:p-9 space-y-6">
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div><p className="text-[10px] uppercase tracking-[0.22em] text-[#8E769E]">Customer care</p><h1 className="mt-1 font-serif text-3xl text-[#302438]">Customer Enquiries</h1><p className="mt-2 text-xs text-[#705E7B]">Review messages submitted through the storefront contact form.</p></div>
          <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#DCCDE4] bg-white px-4 text-xs text-[#563568]"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} />Refresh</button>
        </header>
        <div className="grid grid-cols-3 gap-3">
          {STATUS_OPTIONS.map(option => <div key={option.value} className="rounded-xl border border-[#E7DCEB] bg-white p-3"><p className="text-[10px] uppercase tracking-wider text-[#8E769E]">{option.label}</p><p className="mt-1 font-serif text-2xl text-[#563568]">{counts[option.value] || 0}</p></div>)}
        </div>
        <section className="rounded-xl border border-[#E7DCEB] bg-white p-3 sm:p-4 flex flex-col sm:flex-row gap-3">
          <label className="relative flex-1"><Search size={15} className="absolute left-3 top-3 text-[#8E769E]" /><input aria-label="Search customer enquiries" value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void load(); }} placeholder="Search name, email, subject or message…" className="w-full min-h-10 rounded-lg border border-[#E7DCEB] pl-9 pr-3 text-xs text-[#302438]" /></label>
          <select aria-label="Filter enquiries by status" value={status} onChange={e => setStatus(e.target.value)} className="min-h-10 rounded-lg border border-[#E7DCEB] bg-white px-3 text-xs text-[#302438]"><option value="all">All enquiries</option>{STATUS_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
          <button type="button" onClick={() => void load()} className="min-h-10 rounded-lg bg-[#563568] px-5 text-xs text-white">Search</button>
        </section>
        <div className="rounded-lg border border-[#E7DCEB] bg-[#FAF5FC] p-3 text-xs text-[#705E7B]">Messages are stored in SARINE’s database for admin review. This panel does not send email replies automatically; use a verified contact channel when responding.</div>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}</p>}
        {loading ? <div className="py-16 text-center text-sm text-[#705E7B]">Loading enquiries…</div> : items.length ? <div className="space-y-4">{items.map(item => <InquiryCard key={item.id} item={item} onSaved={() => void load()} />)}</div> : <div className="rounded-xl border border-dashed border-[#DCCDE4] bg-white p-12 text-center"><MessageSquare size={28} className="mx-auto text-[#B69ACF]" /><h2 className="mt-3 font-serif text-xl text-[#563568]">No enquiries found</h2><p className="mt-1 text-xs text-[#8E769E]">New contact form submissions will appear here.</p></div>}
      </main>
    </AdminLayout>
  );
};
