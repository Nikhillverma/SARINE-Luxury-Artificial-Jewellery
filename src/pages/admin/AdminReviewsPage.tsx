import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { hostingerStorefrontService, type ProductReview } from '../../services/hostinger/hostingerStorefrontService';
import { Check, MessageSquare, RefreshCw, Star, X } from 'lucide-react';

type ReviewFilter = 'pending' | 'approved' | 'rejected' | 'all';

const FILTERS: { value: ReviewFilter; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All reviews' }
];

function formatReviewDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });
}

export const AdminReviewsPage: React.FC = () => {
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [filter, setFilter] = useState<ReviewFilter>('pending');
  const [replies, setReplies] = useState<Record<string, string>>({});
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
    all: reviews.length
  }), [reviews]);

  const visibleReviews = useMemo(
    () => filter === 'all' ? reviews : reviews.filter(review => review.status === filter),
    [filter, reviews]
  );

  const moderate = async (review: ProductReview, status: ProductReview['status']) => {
    setSavingId(review.id);
    setError('');
    setNotice('');
    try {
      await hostingerStorefrontService.moderateReview(review.id, status, replies[review.id] || '');
      setReviews(current => current.map(item => item.id === review.id
        ? { ...item, status, adminReply: (replies[review.id] || '').trim() }
        : item));
      setNotice(status === 'approved' ? 'Review approved and eligible to appear on its product page.'
        : status === 'rejected' ? 'Review rejected and kept off the storefront.'
        : 'Review saved as pending.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The review could not be updated.');
    } finally {
      setSavingId(null);
    }
  };

  const saveReply = async (review: ProductReview) => {
    await moderate(review, review.status);
  };

  return (
    <AdminLayout>
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-[#2C1838]">Reviews & Ratings</h1>
            <p className="text-xs sm:text-sm text-[#705E7B] mt-1">Moderate verified-purchase reviews before they appear on the storefront.</p>
          </div>
          <button onClick={() => void load()} disabled={loading} className="inline-flex items-center justify-center gap-2 px-3 py-2 border border-[#E7DCEB] bg-white rounded-xl text-xs disabled:opacity-50">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''}/> Refresh
          </button>
        </div>

        {notice && <div role="status" className="p-3 rounded-xl bg-[#F2FBF5] text-[#166534] text-xs">{notice}</div>}
        {error && <div role="alert" className="p-3 rounded-xl bg-red-50 text-red-700 text-xs">{error}</div>}

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          {FILTERS.map(item => (
            <button key={item.value} onClick={() => setFilter(item.value)}
              className={`text-left rounded-2xl border p-4 transition-colors ${filter === item.value ? 'border-[#563568] bg-[#F7F0FA]' : 'border-[#EADFF0] bg-white hover:bg-[#FAF5FC]'}`}>
              <span className="block text-[11px] text-[#705E7B]">{item.label}</span>
              <span className="block mt-1 text-2xl font-semibold text-[#2C1838] tabular-nums">{counts[item.value]}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="bg-white border border-[#EADFF0] rounded-2xl p-10 text-center text-sm text-[#8E769E]">Loading customer reviews…</div>
        ) : visibleReviews.length === 0 ? (
          <div className="bg-white border border-[#EADFF0] rounded-2xl p-10 text-center">
            <MessageSquare size={28} className="mx-auto text-[#B69ACF] mb-3"/>
            <h2 className="font-serif text-lg text-[#2C1838]">No {filter === 'all' ? '' : filter + ' '}reviews found</h2>
            <p className="text-xs text-[#8E769E] mt-1">Customer reviews submitted from product pages will appear here for moderation.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {visibleReviews.map(review => (
              <article key={review.id} className="bg-white border border-[#EADFF0] rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-semibold text-sm text-[#2C1838]">{review.productName || 'Product unavailable'}</h2>
                      <span className={`text-[10px] px-2 py-1 rounded-full capitalize ${review.status === 'approved' ? 'bg-green-50 text-green-700' : review.status === 'rejected' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{review.status}</span>
                      {review.verified && <span className="text-[10px] text-[#563568] bg-[#F7F0FA] px-2 py-1 rounded-full">Verified purchase</span>}
                    </div>
                    <p className="text-[11px] text-[#8E769E] mt-1">Order {review.orderNumber || '—'} · {formatReviewDate(review.date)}</p>
                  </div>
                  <div className="flex items-center gap-1 text-amber-500" aria-label={`${review.rating} out of 5 stars`}>
                    {Array.from({ length: 5 }, (_, index) => <Star key={index} size={15} fill={index < review.rating ? 'currentColor' : 'none'} />)}
                    <span className="ml-1 text-xs font-semibold text-[#2C1838]">{review.rating}/5</span>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-[#2C1838]">{review.title || 'Customer review'}</p>
                  <p className="text-sm text-[#5D5068] whitespace-pre-wrap mt-1 leading-relaxed">{review.comment}</p>
                  <p className="text-[11px] text-[#8E769E] mt-2">{review.name}{review.email ? ` · ${review.email}` : ''}</p>
                </div>

                {review.imageUrls?.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {review.imageUrls.map((url, index) => (
                      <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="block w-20 h-20 rounded-xl overflow-hidden border border-[#EADFF0]" aria-label={`Open customer photo ${index + 1}`}>
                        <img src={url} alt={`Customer review photo ${index + 1}`} className="w-full h-full object-cover"/>
                      </a>
                    ))}
                  </div>
                )}

                <div className="border-t border-[#F0E8F3] pt-4 space-y-2">
                  <label className="block text-[11px] font-semibold text-[#5D5068]" htmlFor={`review-reply-${review.id}`}>Public admin reply (optional)</label>
                  <textarea id={`review-reply-${review.id}`} value={replies[review.id] ?? ''}
                    onChange={event => setReplies(current => ({ ...current, [review.id]: event.target.value }))}
                    maxLength={1000} rows={2} placeholder="Write a helpful response to the customer…"
                    className="w-full rounded-xl border border-[#E7DCEB] bg-[#FFFEFF] p-3 text-xs text-[#302438] outline-none focus:border-[#563568]"/>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-[10px] text-[#9E8AA8]">{(replies[review.id] || '').length}/1000 characters</span>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => void saveReply(review)} disabled={savingId === review.id}
                        className="inline-flex items-center gap-1.5 px-3 py-2 border border-[#E7DCEB] rounded-lg text-xs text-[#563568] disabled:opacity-50">
                        <MessageSquare size={13}/> Save reply
                      </button>
                      <button onClick={() => void moderate(review, 'rejected')} disabled={savingId === review.id || review.status === 'rejected'}
                        className="inline-flex items-center gap-1.5 px-3 py-2 border border-red-200 text-red-700 rounded-lg text-xs disabled:opacity-50">
                        <X size={13}/> Reject
                      </button>
                      <button onClick={() => void moderate(review, 'approved')} disabled={savingId === review.id || review.status === 'approved'}
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#563568] text-white rounded-lg text-xs disabled:opacity-50">
                        <Check size={13}/> Approve & publish
                      </button>
                    </div>
                  </div>
                  {savingId === review.id && <p className="text-[11px] text-[#8E769E]">Saving review…</p>}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};
