import React, { useState } from 'react';
import { PolicyLayout } from '../components/PolicyLayout';
import { CheckCircle2, MessageSquare, Send } from 'lucide-react';
import { hostingerContactInquiryService } from '../services/hostinger/hostingerContactInquiryService';

const EMPTY_FORM = { name: '', email: '', phone: '', subject: '', message: '', website: '' };

export const ContactPage: React.FC = () => {
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const update = (field: keyof typeof EMPTY_FORM, value: string) => {
    setFormData(current => ({ ...current, [field]: value }));
    setError('');
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await hostingerContactInquiryService.submit(formData);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Your message could not be submitted. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PolicyLayout
      title="Contact SARINE"
      subtitle="Send our team a message about an order, a product, or any other question. Please include your order number when your enquiry is about a purchase."
      categoryName="Help & Support"
    >
      <div className="max-w-3xl mx-auto">
        {submitted ? (
          <div className="bg-[#FAF5FC] border border-[#B69ACF] p-8 sm:p-10 text-center space-y-4 rounded-xs">
            <div className="w-12 h-12 rounded-full bg-[#563568] text-white flex items-center justify-center mx-auto">
              <CheckCircle2 size={24} />
            </div>
            <h2 className="font-serif text-2xl text-[#302438]">Your message has been recorded</h2>
            <p className="text-sm text-[#6F6475] max-w-lg mx-auto leading-relaxed">
              Thank you for contacting SARINE. Your enquiry is saved securely for our team to review. Keep a copy of your message and order number for reference.
            </p>
            <button type="button" onClick={() => { setFormData(EMPTY_FORM); setSubmitted(false); }} className="min-h-11 px-6 text-xs uppercase tracking-wider text-[#563568] underline underline-offset-4">
              Send another enquiry
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5 bg-white border border-[#E7DCEB] p-5 sm:p-8 rounded-xs">
            <div className="flex items-center gap-2 mb-1">
              <MessageSquare size={17} className="text-[#563568]" />
              <h2 className="font-serif text-2xl text-[#302438]">Send an enquiry</h2>
            </div>
            <p className="text-xs text-[#6F6475]">Fields marked with * are required. Your contact details are used only to review and respond to this enquiry.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block text-xs text-[#6F6475]">Full name *
                <input required minLength={2} maxLength={120} autoComplete="name" value={formData.name} onChange={e => update('name', e.target.value)} className="mt-1.5 w-full min-h-11 border border-[#E7DCEB] bg-[#F7F0FA] px-3.5 text-sm text-[#302438] focus:outline-none focus:border-[#563568]" placeholder="Your name" />
              </label>
              <label className="block text-xs text-[#6F6475]">Email address *
                <input required type="email" maxLength={254} autoComplete="email" value={formData.email} onChange={e => update('email', e.target.value)} className="mt-1.5 w-full min-h-11 border border-[#E7DCEB] bg-[#F7F0FA] px-3.5 text-sm text-[#302438] focus:outline-none focus:border-[#563568]" placeholder="you@example.com" />
              </label>
              <label className="block text-xs text-[#6F6475]">Phone / WhatsApp (optional)
                <input type="tel" maxLength={24} autoComplete="tel" value={formData.phone} onChange={e => update('phone', e.target.value)} className="mt-1.5 w-full min-h-11 border border-[#E7DCEB] bg-[#F7F0FA] px-3.5 text-sm text-[#302438] focus:outline-none focus:border-[#563568]" placeholder="+91" />
              </label>
              <label className="block text-xs text-[#6F6475]">Subject (optional)
                <input maxLength={160} value={formData.subject} onChange={e => update('subject', e.target.value)} className="mt-1.5 w-full min-h-11 border border-[#E7DCEB] bg-[#F7F0FA] px-3.5 text-sm text-[#302438] focus:outline-none focus:border-[#563568]" placeholder="Order, product, returns…" />
              </label>
            </div>
            <label className="block text-xs text-[#6F6475]">Your message *
              <textarea required minLength={10} maxLength={5000} rows={6} value={formData.message} onChange={e => update('message', e.target.value)} className="mt-1.5 w-full border border-[#E7DCEB] bg-[#F7F0FA] p-3.5 text-sm text-[#302438] focus:outline-none focus:border-[#563568] resize-y" placeholder="How can we help?" />
            </label>
            <label aria-hidden="true" className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden">
              Website
              <input tabIndex={-1} autoComplete="off" value={formData.website} onChange={e => update('website', e.target.value)} />
            </label>
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <p className="text-[11px] text-[#8A7B90]">Please do not include payment card details or passwords.</p>
              <button type="submit" disabled={submitting} className="min-h-12 px-7 inline-flex items-center justify-center gap-2 bg-[#563568] hover:bg-[#6C4781] text-white text-xs uppercase tracking-[0.16em] disabled:opacity-50">
                <Send size={14} /> {submitting ? 'Submitting…' : 'Submit enquiry'}
              </button>
            </div>
          </form>
        )}
      </div>
    </PolicyLayout>
  );
};
