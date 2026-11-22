import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { hostingerStorefrontService, type ProductReview } from '../../services/hostinger/hostingerStorefrontService';
import { Check, Download, Image as ImageIcon, MessageSquare, RefreshCw, Search, Star, X, ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react';

type ReviewFilter = 'pending' | 'approved' | 'rejected' | 'all';
type SortMode = 'newest' | 'oldest' | 'highest' | 'lowest';
const PAGE_SIZE = 12;
const FILTERS: { value: ReviewFilter; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All reviews' }
];

function reviewTime(value: string): number {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}
function formatReviewDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });
}
function csvCell(value: unknown): string {
  let text = String(value ?? '');
  const first = text.charCodeAt(0);
  if ([61, 43, 45, 64, 9, 13].includes(first)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
function downloadReviews(reviews: ProductReview[]) {
  const headers = ['Review ID', 'Product', 'Customer', 'Email', 'Rating', 'Title', 'Review', 'Status', 'Verified purchase', 'Order number', 'Admin reply', 'Submitted at'];
  const rows = reviews.map(review => [
    review.id, review.productName, review.name, review.email, review.rating, review.title,
    review.comment, review.status, review.verified ? 'Yes' : 'No', review.orderNumber,
    review.adminReply, review.date
  ]);
  const csv = [headers, ...rows].map(row => row.map(csvCell).join(',')).join(String.fromCharCode(13, 10));
  const blob = new Blob([String.fromCharCode(0xfeff), csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'sarine-customer-reviews.csv';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export const AdminReviewsPage: React.FC = () => {
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [filter, setFilter] = useState<ReviewFilter>('all');
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [ratingFilter, setRatingFilter] = useState('all');
  const [verifiedFilter, setVerifiedFilter] = useState('all');
  const [sort, setSort] = useState<SortMode>('newest');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await hostingerStorefrontService.getAdminReviews('all');
      setReviews(result.reviews);
      setReplies(Object.fromEntries(result.reviews.map(review => [review.id, review.adminReply || ''])));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reviews could not be loaded. Please check your admin session.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const counts = useMemo(() => ({
    pending: reviews.filter(review => review.status === 'pending').length,
    approved: reviews.filter(review => review.status === 'approved').length,
    rejected: reviews.filter(review => review.status === 'rejected').length,
    all: reviews.length,
    verified: reviews.filter(review => review.verified).length,
    average: reviews.length ? reviews.reduce((sum, review) => sum + (Number(review.rating) || 0), 0) / reviews.length : 0
  }), [reviews]);

  const filteredReviews = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    const from = dateFrom ? new Date(dateFrom + 'T00:00:00+05:30').getTime() : null;
    const to = dateTo ? new Date(dateTo + 'T23:59:59.999+05:30').getTime() : null;
    return reviews.filter(review => {
      if (filter !== 'all' && review.status !== filter) return false;
      if (ratingFilter !== 'all' && Number(review.rating) !== Number(ratingFilter)) return false;
      if (verifiedFilter === 'verified' && !review.verified) return false;
      if (verifiedFilter === 'unverified' && review.verified) return false;
      const timestamp = reviewTime(review.date);
      if (from !== null && timestamp < from) return false;
      if (to !== null && timestamp > to) return false;
      if (term && ![review.productName, review.name, review.email, review.title, review.comment, review.orderNumber]
        .some(value => String(value || '').toLocaleLowerCase().includes(term))) return false;
      return true;
    }).sort((a, b) => {
      if (sort === 'oldest') return reviewTime(a.date) - reviewTime(b.date);
      if (sort === 'highest') return b.rating - a.rating || reviewTime(b.date) - reviewTime(a.date);
      if (sort === 'lowest') return a.rating - b.rating || reviewTime(b.date) - reviewTime(a.date);
      return reviewTime(b.date) - reviewTime(a.date);
    });
  }, [reviews, filter, ratingFilter, verifiedFilter, dateFrom, dateTo, search, sort]);

  const totalPages = Math.max(1, Math.ceil(filteredReviews.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageReviews = filteredReviews.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [filter, ratingFilter, verifiedFilter, dateFrom, dateTo, search, sort]);

  const moderate = async (review: ProductReview, status: ProductReview['status']) => {
    if (status !== review.status) {
      const message = status === 'approved'
        ? 'Approve this customer review? It may become visible on the public product page.'
        : status === 'rejected'
          ? 'Reject this customer review? It will remain hidden from the storefront.'
          : 'Return this review to pending moderation?';
      if (!window.confirm(message)) return;
    }
    setSavingId(review.id);
    setError('');
    setNotice('');
    try {
      const reply = (replies[review.id] || '').trim();
      await hostingerStorefrontService.moderateReview(review.id, status, reply);
      setReviews(current => current.map(item => item.id === review.id
        ? { ...item, status, adminReply: reply }
        : item));
      setNotice(status === 'approved' ? 'Review approved. It is now eligible to appear on its product page.'
        : status === 'rejected' ? 'Review rejected and kept off the storefront.'
        : 'Review and reply saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The review could not be updated.');
    } finally {
      setSavingId(null);
    }
  };

  const resetFilters = () => {
    setSearch('');
    setRatingFilter('all');
    setVerifiedFilter('all');
    setDateFrom('');
    setDateTo('');
    setSort('newest');
    setFilter('pending');
  };

  return (
    <AdminLayout>
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#8E769E]">Customer voice</p>
            <h1 className="mt-1 font-serif text-2xl font-semibold text-[#2C1838] sm:text-3xl">Reviews & Ratings</h1>
            <p className="mt-1 text-xs text-[#705E7B] sm:text-sm">Review customer feedback, respond thoughtfully and control what appears on product pages.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => downloadReviews(filteredReviews)} disabled={!filteredReviews.length}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#E7DCEB] bg-white px-3 text-xs text-[#563568] disabled:opacity-40">
              <Download size={14}/> Export CSV
            </button>
            <button type="button" onClick={() => void load()} disabled={loading}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#E7DCEB] bg-white px-3 text-xs text-[#563568] disabled:opacity-50">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''}/> Refresh
            </button>
          </div>
        </div>

        {notice && <div role="status" className="rounded-xl bg-[#F2FBF5] p-3 text-xs text-[#166534]">{notice}</div>}
        {error && <div role="alert" className="rounded-xl bg-red-50 p-3 text-xs text-red-700">{error}</div>}

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {FILTERS.map(item => (
            <button key={item.value} type="button" onClick={() => setFilter(item.value)} aria-pressed={filter === item.value}
              className={`rounded-2xl border p-4 text-left transition-colors ${filter === item.value ? 'border-[#563568] bg-[#F7F0FA]' : 'border-[#EADFF0] bg-white hover:bg-[#FAF5FC]'}`}>
              <span className="block text-[11px] text-[#705E7B]">{item.label}</span>
              <span className="mt-1 block text-2xl font-semibold tabular-nums text-[#2C1838]">{counts[item.value]}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-[#EADFF0] bg-white p-3">
            <p className="text-[10px] text-[#8E769E]">Average rating · all reviews</p>
            <div className="mt-1 flex items-center gap-1.5"><Star size={16} fill="currentColor" className="text-amber-500"/><span className="text-xl font-semibold text-[#2C1838]">{counts.average.toFixed(1)}</span><span className="text-xs text-[#8E769E]">/ 5</span></div>
          </div>
          <div className="rounded-xl border border-[#EADFF0] bg-white p-3">
            <p className="text-[10px] text-[#8E769E]">Verified purchases</p>
            <p className="mt-1 text-xl font-semibold text-[#2C1838]">{counts.verified}</p>
          </div>
          <div className="col-span-2 rounded-xl border border-[#EADFF0] bg-white p-3 sm:col-span-1">
            <p className="text-[10px] text-[#8E769E]">Showing after filters</p>
            <p className="mt-1 text-xl font-semibold text-[#2C1838]">{filteredReviews.length}</p>
          </div>
        </div>

        <section aria-label="Review filters" className="space-y-3 rounded-2xl border border-[#EADFF0] bg-white p-3 sm:p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#563568]"><SlidersHorizontal size={15}/> Find and filter reviews</div>
          <label className="relative block">
            <Search size={15} className="absolute left-3 top-3.5 text-[#8E769E]"/>
            <input value={search} onChange={event => setSearch(event.target.value)} aria-label="Search reviews"
              placeholder="Search customer, email, product, order or review text…"
              className="min-h-11 w-full rounded-xl border border-[#E7DCEB] bg-[#FFFEFF] pl-9 pr-3 text-xs text-[#302438] outline-none focus:border-[#563568]"/>
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <label className="text-[10px] text-[#705E7B]">Rating
              <select value={ratingFilter} onChange={event => setRatingFilter(event.target.value)} className="mt-1 block min-h-11 w-full rounded-lg border border-[#E7DCEB] bg-white px-3 text-xs text-[#302438]">
                <option value="all">All ratings</option>{[5,4,3,2,1].map(value => <option key={value} value={value}>{value} stars</option>)}
              </select>
            </label>
            <label className="text-[10px] text-[#705E7B]">Purchase status
              <select value={verifiedFilter} onChange={event => setVerifiedFilter(event.target.value)} className="mt-1 block min-h-11 w-full rounded-lg border border-[#E7DCEB] bg-white px-3 text-xs text-[#302438]">
                <option value="all">All customers</option><option value="verified">Verified purchase</option><option value="unverified">Not verified</option>
              </select>
            </label>
            <label className="text-[10px] text-[#705E7B]">From date (IST)
              <input type="date" value={dateFrom} max={dateTo || undefined} onChange={event => setDateFrom(event.target.value)} className="mt-1 block min-h-11 w-full rounded-lg border border-[#E7DCEB] bg-white px-3 text-xs text-[#302438]"/>
            </label>
            <label className="text-[10px] text-[#705E7B]">To date (IST)
              <input type="date" value={dateTo} min={dateFrom || undefined} onChange={event => setDateTo(event.target.value)} className="mt-1 block min-h-11 w-full rounded-lg border border-[#E7DCEB] bg-white px-3 text-xs text-[#302438]"/>
            </label>
            <label className="text-[10px] text-[#705E7B]">Sort by
              <select value={sort} onChange={event => setSort(event.target.value as SortMode)} className="mt-1 block min-h-11 w-full rounded-lg border border-[#E7DCEB] bg-white px-3 text-xs text-[#302438]">
                <option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="highest">Highest rating</option><option value="lowest">Lowest rating</option>
              </select>
            </label>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] text-[#8E769E]">Filters apply to the reviews currently returned by the admin API.</p>
            <button type="button" onClick={resetFilters} className="min-h-10 rounded-lg px-3 text-xs font-medium text-[#563568] underline underline-offset-2">Clear filters</button>
          </div>
        </section>

        {loading ? (
          <div className="rounded-2xl border border-[#EADFF0] bg-white p-10 text-center text-sm text-[#8E769E]">Loading customer reviews…</div>
        ) : pageReviews.length === 0 ? (
          <div className="rounded-2xl border border-[#EADFF0] bg-white p-10 text-center">
            <MessageSquare size={28} className="mx-auto mb-3 text-[#B69ACF]"/>
            <h2 className="font-serif text-lg text-[#2C1838]">No matching reviews</h2>
            <p className="mt-1 text-xs text-[#8E769E]">{reviews.length ? 'Try adjusting your search or filters.' : 'Customer reviews submitted from product pages will appear here for moderation.'}</p>
            {reviews.length > 0 && <button type="button" onClick={resetFilters} className="mt-3 min-h-10 rounded-lg bg-[#563568] px-4 text-xs text-white">Clear filters</button>}
          </div>
        ) : (
          <div className="space-y-4">
            {pageReviews.map(review => (
              <article key={review.id} className="space-y-4 rounded-2xl border border-[#EADFF0] bg-white p-4 sm:p-5">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-semibold text-[#2C1838]">{review.productName || 'Product unavailable'}</h2>
                      <span className={`rounded-full px-2 py-1 text-[10px] capitalize ${review.status === 'approved' ? 'bg-green-50 text-green-700' : review.status === 'rejected' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{review.status}</span>
                      {review.verified && <span className="rounded-full bg-[#F7F0FA] px-2 py-1 text-[10px] text-[#563568]">Verified purchase</span>}
                    </div>
                    <p className="mt-1 break-all text-[11px] text-[#8E769E]">Order {review.orderNumber || '—'} · {formatReviewDate(review.date)}</p>
                  </div>
                  <div className="flex items-center gap-1 text-amber-500" aria-label={`${review.rating} out of 5 stars`}>
                    {Array.from({ length: 5 }, (_, index) => <Star key={index} size={15} fill={index < review.rating ? 'currentColor' : 'none'}/>)}
                    <span className="ml-1 text-xs font-semibold text-[#2C1838]">{review.rating}/5</span>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-[#2C1838]">{review.title || 'Customer review'}</p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-[#5D5068]">{review.comment}</p>
                  <p className="mt-2 break-all text-[11px] text-[#8E769E]">{review.name}{review.email ? ` · ${review.email}` : ''}</p>
                </div>

                {review.imageUrls?.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="mr-1 inline-flex items-center gap-1 text-[10px] text-[#8E769E]"><ImageIcon size={13}/> Customer photos</span>
                    {review.imageUrls.map((url, index) => (
                      <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="block h-20 w-20 overflow-hidden rounded-xl border border-[#EADFF0] focus:outline-none focus:ring-2 focus:ring-[#563568]" aria-label={`Open customer photo ${index + 1} in a new tab`}>
                        <img src={url} alt={`Customer review photo ${index + 1}`} loading="lazy" className="h-full w-full object-cover"/>
                      </a>
                    ))}
                  </div>
                )}

                <div className="space-y-2 border-t border-[#F0E8F3] pt-4">
                  <label className="block text-[11px] font-semibold text-[#5D5068]" htmlFor={`review-reply-${review.id}`}>Public admin reply (optional)</label>
                  <textarea id={`review-reply-${review.id}`} value={replies[review.id] ?? ''}
                    onChange={event => setReplies(current => ({ ...current, [review.id]: event.target.value }))}
                    maxLength={1000} rows={2} placeholder="Write a helpful response to the customer…"
                    className="w-full rounded-xl border border-[#E7DCEB] bg-[#FFFEFF] p-3 text-xs text-[#302438] outline-none focus:border-[#563568]"/>
                  <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                    <span className="text-[10px] text-[#9E8AA8]">{(replies[review.id] || '').length}/1000 characters</span>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => void moderate(review, review.status)} disabled={savingId === review.id}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-[#E7DCEB] px-3 text-xs text-[#563568] disabled:opacity-50">
                        <MessageSquare size={13}/> Save reply
                      </button>
                      <button type="button" onClick={() => void moderate(review, 'rejected')} disabled={savingId === review.id || review.status === 'rejected'}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-red-200 px-3 text-xs text-red-700 disabled:opacity-50">
                        <X size={13}/> Reject
                      </button>
                      <button type="button" onClick={() => void moderate(review, 'approved')} disabled={savingId === review.id || review.status === 'approved'}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-[#563568] px-3 text-xs text-white disabled:opacity-50">
                        <Check size={13}/> Approve & publish
                      </button>
                    </div>
                  </div>
                  {savingId === review.id && <p role="status" className="text-[11px] text-[#8E769E]">Saving review…</p>}
                </div>
              </article>
            ))}
          </div>
        )}

        {!loading && filteredReviews.length > 0 && (
          <div className="flex flex-col items-center justify-between gap-3 rounded-xl border border-[#EADFF0] bg-white p-3 sm:flex-row">
            <p className="text-[11px] text-[#8E769E]">Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredReviews.length)} of {filteredReviews.length} reviews</p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setPage(value => Math.max(1, value - 1))} disabled={currentPage === 1} aria-label="Previous page" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-[#E7DCEB] text-[#563568] disabled:opacity-40"><ChevronLeft size={17}/></button>
              <span className="min-w-20 text-center text-xs text-[#5D5068]">Page {currentPage} of {totalPages}</span>
              <button type="button" onClick={() => setPage(value => Math.min(totalPages, value + 1))} disabled={currentPage === totalPages} aria-label="Next page" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-[#E7DCEB] text-[#563568] disabled:opacity-40"><ChevronRight size={17}/></button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};
