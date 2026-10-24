/**
 * Contact Us page for SARINE.
 * Provides transparent atelier contact details, support hours, WhatsApp assistance,
 * and a client-side inquiry form with reply time commitment.
 */

import React, { useState } from 'react';
import { PolicyLayout } from '../components/PolicyLayout';
import { Mail, Phone, MapPin, Clock, MessageSquare, Send, CheckCircle2 } from 'lucide-react';

export const ContactPage: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim() || !formData.message.trim()) {
      return;
    }
    // Client-side only per brief; server integration planned for future release
    setSubmitted(true);
  };

  return (
    <PolicyLayout
      title="Contact Atelier Concierge"
      subtitle="Have an inquiry about an order, styling advice, or assistance with our jewellery? Our dedicated concierge team is here to assist you."
      categoryName="Help & Support"
    >
      <div className="space-y-12">
        {/* Contact Info Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-10 border-b border-[#E7DCEB]">
          {/* Email */}
          <div className="p-5 bg-white border border-[#E7DCEB] rounded-xs flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-[#563568] text-white flex items-center justify-center shrink-0 mt-0.5">
              <Mail size={18} className="text-[#D9B8A0]" />
            </div>
            <div>
              <h3 className="text-xs uppercase tracking-widest text-[#302438] font-semibold font-sans">
                Electronic Mail
              </h3>
              <p className="text-xs text-[#6F6475] mt-1 font-sans">
                For order updates, returns, or bespoke questions
              </p>
              <a
                href="mailto:care@sarinejewelry.com"
                className="text-sm text-[#563568] font-medium hover:text-[#A184BD] transition-colors mt-2 inline-block font-sans underline decoration-[#B69ACF]/50 underline-offset-4"
              >
                care@sarinejewelry.com
              </a>
            </div>
          </div>

          {/* Phone & WhatsApp */}
          <div className="p-5 bg-white border border-[#E7DCEB] rounded-xs flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-[#563568] text-white flex items-center justify-center shrink-0 mt-0.5">
              <Phone size={18} className="text-[#D9B8A0]" />
            </div>
            <div>
              <h3 className="text-xs uppercase tracking-widest text-[#302438] font-semibold font-sans">
                Phone & WhatsApp
              </h3>
              <p className="text-xs text-[#6F6475] mt-1 font-sans">
                Direct phone support & WhatsApp messaging
              </p>
              <a
                href="tel:+919876543210"
                className="text-sm text-[#563568] font-medium hover:text-[#A184BD] transition-colors mt-2 inline-block font-sans"
              >
                +91 98765 43210
              </a>
            </div>
          </div>

          {/* Business Address */}
          <div className="p-5 bg-white border border-[#E7DCEB] rounded-xs flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-[#563568] text-white flex items-center justify-center shrink-0 mt-0.5">
              <MapPin size={18} className="text-[#D9B8A0]" />
            </div>
            <div>
              <h3 className="text-xs uppercase tracking-widest text-[#302438] font-semibold font-sans">
                Atelier & Studio
              </h3>
              <p className="text-xs text-[#6F6475] mt-1 font-sans">
                Registered office & fulfillment studio
              </p>
              <address className="not-italic text-xs text-[#302438] mt-2 font-sans leading-relaxed">
                SARINE Atelier<br />
                Plot No. 42, Atelier Row, Sector 28<br />
                Gurugram, Haryana 122002, India
              </address>
            </div>
          </div>

          {/* Support Hours */}
          <div className="p-5 bg-white border border-[#E7DCEB] rounded-xs flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-[#563568] text-white flex items-center justify-center shrink-0 mt-0.5">
              <Clock size={18} className="text-[#D9B8A0]" />
            </div>
            <div>
              <h3 className="text-xs uppercase tracking-widest text-[#302438] font-semibold font-sans">
                Concierge Hours
              </h3>
              <p className="text-xs text-[#6F6475] mt-1 font-sans">
                Client support availability (IST)
              </p>
              <p className="text-xs text-[#302438] mt-2 font-sans leading-relaxed">
                Monday to Saturday: 10:00 AM – 6:00 PM IST<br />
                <span className="text-[#6F6475]">Closed on Sundays and National Holidays</span>
              </p>
            </div>
          </div>
        </div>

        {/* Contact Form Section */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare size={16} className="text-[#563568]" />
            <h2 className="font-serif text-2xl text-[#302438]">
              Send an Inquiry
            </h2>
          </div>
          <p className="text-xs text-[#6F6475] font-sans mb-6">
            Please fill in your details below. We reply to all inquiries within <strong className="font-semibold text-[#302438]">24–48 hours</strong> during business days.
          </p>

          {submitted ? (
            <div className="bg-[#FAF5FC] border border-[#B69ACF] p-8 text-center space-y-4 rounded-xs">
              <div className="w-12 h-12 rounded-full bg-[#563568] text-[#D9B8A0] flex items-center justify-center mx-auto">
                <CheckCircle2 size={24} />
              </div>
              <h3 className="font-serif text-xl text-[#302438]">
                Message Received
              </h3>
              <p className="text-xs text-[#6F6475] max-w-md mx-auto font-sans leading-relaxed">
                Thank you for reaching out to SARINE. Our concierge team has noted your message and will review it promptly. We reply within 24–48 business hours at <strong className="text-[#302438]">{formData.email}</strong>.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSubmitted(false);
                  setFormData({ name: '', email: '', phone: '', subject: '', message: '' });
                }}
                className="text-xs uppercase tracking-wider text-[#563568] hover:text-[#A184BD] font-medium font-sans underline underline-offset-4 cursor-pointer"
              >
                Send Another Message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="contact-name" className="block text-xs uppercase tracking-wider text-[#6F6475] mb-1 font-sans">
                    Full Name <span className="text-[#563568]">*</span>
                  </label>
                  <input
                    id="contact-name"
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter your name"
                    className="w-full bg-[#F7F0FA] border border-[#E7DCEB] px-3.5 py-2.5 text-xs text-[#302438] placeholder:text-[#9E90A2] rounded-xs focus:outline-none focus:border-[#B69ACF] focus:ring-1 focus:ring-[#80609A]"
                  />
                </div>

                <div>
                  <label htmlFor="contact-email" className="block text-xs uppercase tracking-wider text-[#6F6475] mb-1 font-sans">
                    Email Address <span className="text-[#563568]">*</span>
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="e.g. name@example.com"
                    className="w-full bg-[#F7F0FA] border border-[#E7DCEB] px-3.5 py-2.5 text-xs text-[#302438] placeholder:text-[#9E90A2] rounded-xs focus:outline-none focus:border-[#B69ACF] focus:ring-1 focus:ring-[#80609A]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="contact-phone" className="block text-xs uppercase tracking-wider text-[#6F6475] mb-1 font-sans">
                    Phone / WhatsApp (Optional)
                  </label>
                  <input
                    id="contact-phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+91 XXXXX XXXXX"
                    className="w-full bg-[#F7F0FA] border border-[#E7DCEB] px-3.5 py-2.5 text-xs text-[#302438] placeholder:text-[#9E90A2] rounded-xs focus:outline-none focus:border-[#B69ACF] focus:ring-1 focus:ring-[#80609A]"
                  />
                </div>

                <div>
                  <label htmlFor="contact-subject" className="block text-xs uppercase tracking-wider text-[#6F6475] mb-1 font-sans">
                    Inquiry Topic
                  </label>
                  <input
                    id="contact-subject"
                    type="text"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    placeholder="e.g. Order Tracking, Sizing, Care"
                    className="w-full bg-[#F7F0FA] border border-[#E7DCEB] px-3.5 py-2.5 text-xs text-[#302438] placeholder:text-[#9E90A2] rounded-xs focus:outline-none focus:border-[#B69ACF] focus:ring-1 focus:ring-[#80609A]"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="contact-message" className="block text-xs uppercase tracking-wider text-[#6F6475] mb-1 font-sans">
                  Your Message <span className="text-[#563568]">*</span>
                </label>
                <textarea
                  id="contact-message"
                  required
                  rows={5}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="How can our concierge assist you?"
                  className="w-full bg-[#F7F0FA] border border-[#E7DCEB] p-3.5 text-xs text-[#302438] placeholder:text-[#9E90A2] rounded-xs focus:outline-none focus:border-[#B69ACF] focus:ring-1 focus:ring-[#80609A] resize-none"
                />
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <span className="text-[11px] text-[#6F6475] font-sans">
                  We reply within 24–48 hours during business hours.
                </span>
                <button
                  type="submit"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 bg-[#563568] text-white text-xs uppercase tracking-[0.2em] font-medium hover:bg-[#A184BD] transition-colors font-sans rounded-xs cursor-pointer"
                >
                  <Send size={14} />
                  <span>Send Inquiry</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </PolicyLayout>
  );
};
