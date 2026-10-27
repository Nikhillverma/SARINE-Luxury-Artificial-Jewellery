/**
 * AdminSettingsPage for SARINE.
 * Business and Storefront Configuration Console.
 * Allows store owners to manage shipping rules, promotional thresholds,
 * announcement bar banners, and customer support channels.
 */

import React, { useState, useEffect } from 'react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { SHIPPING_FLAT_FEE, FREE_SHIPPING_THRESHOLD, COD_ENABLED } from '../../config/store';
import { formatInr } from '../../utils/currency';
import {
  Settings,
  Truck,
  Sparkles,
  Save,
  CheckCircle2,
  AlertCircle,
  Phone,
  Mail,
  ShieldAlert
} from 'lucide-react';

const SETTINGS_STORAGE_KEY = 'sarine_admin_store_settings';

export const AdminSettingsPage: React.FC = () => {
  const [flatFee, setFlatFee] = useState<number>(SHIPPING_FLAT_FEE);
  const [freeThreshold, setFreeThreshold] = useState<number>(FREE_SHIPPING_THRESHOLD || 999);
  const [codActive, setCodActive] = useState<boolean>(COD_ENABLED);
  const [supportPhone, setSupportPhone] = useState<string>('+91 98765 43210');
  const [supportEmail, setSupportEmail] = useState<string>('care@sarine.in');
  const [announcementMsg, setAnnouncementMsg] = useState<string>(
    'Complimentary Express Delivery on orders across India'
  );
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.flatFee !== undefined) setFlatFee(parsed.flatFee);
        if (parsed.freeThreshold !== undefined) setFreeThreshold(parsed.freeThreshold);
        if (parsed.codActive !== undefined) setCodActive(parsed.codActive);
        if (parsed.supportPhone) setSupportPhone(parsed.supportPhone);
        if (parsed.supportEmail) setSupportEmail(parsed.supportEmail);
        if (parsed.announcementMsg) setAnnouncementMsg(parsed.announcementMsg);
      }
    } catch {
      // Ignore
    }
  }, []);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const config = {
      flatFee,
      freeThreshold,
      codActive,
      supportPhone,
      supportEmail,
      announcementMsg
    };
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(config));
      setSuccess('Storefront configuration saved successfully.');
      setTimeout(() => setSuccess(null), 3500);
    } catch (err) {
      console.error('Failed to persist store settings:', err);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6 font-sans max-w-4xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E7DCEB]">
          <div>
            <span className="text-[10px] uppercase tracking-[0.25em] text-[#6F6475] font-medium block">
              ATELIER CONFIGURATION
            </span>
            <h1 className="font-serif text-2xl sm:text-3xl text-[#302438] font-normal mt-0.5">
              Storefront & Business Settings
            </h1>
          </div>
        </div>

        {success && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 rounded-xs flex items-center gap-2">
            <CheckCircle2 size={15} />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSaveSettings} className="space-y-6">
          {/* Section 1: Shipping & Delivery Rules */}
          <div className="bg-white p-6 border border-[#E7DCEB] rounded-xs shadow-2xs space-y-4">
            <h3 className="font-serif text-base text-[#302438] flex items-center gap-2">
              <Truck size={16} className="text-[#563568]" />
              <span>Pan-India Logistics & Delivery</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-sans">
              <div>
                <label className="block text-[#6F6475] mb-1 font-medium">Standard Flat Shipping Fee (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={flatFee}
                  onChange={(e) => setFlatFee(parseInt(e.target.value, 10) || 0)}
                  className="w-full p-2.5 bg-[#F7F0FA] border border-[#E7DCEB] rounded-xs focus:outline-none"
                />
                <span className="text-[11px] text-[#6F6475] mt-1 block">Set 0 for uniform complimentary delivery</span>
              </div>

              <div>
                <label className="block text-[#6F6475] mb-1 font-medium">Free Shipping Minimum Threshold (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={freeThreshold}
                  onChange={(e) => setFreeThreshold(parseInt(e.target.value, 10) || 0)}
                  className="w-full p-2.5 bg-[#F7F0FA] border border-[#E7DCEB] rounded-xs focus:outline-none"
                />
                <span className="text-[11px] text-[#6F6475] mt-1 block">Orders equal or above this qualify for free shipping</span>
              </div>
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-2.5 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={codActive}
                  onChange={(e) => setCodActive(e.target.checked)}
                  className="accent-[#563568] rounded-xs cursor-pointer"
                />
                <div>
                  <span className="font-medium text-[#302438]">Enable Cash on Delivery (COD)</span>
                  <p className="text-[11px] text-[#6F6475]">Allow customers to select COD on checkout with delivery agent collection</p>
                </div>
              </label>
            </div>
          </div>

          {/* Section 2: Announcement Bar */}
          <div className="bg-white p-6 border border-[#E7DCEB] rounded-xs shadow-2xs space-y-4">
            <h3 className="font-serif text-base text-[#302438] flex items-center gap-2">
              <Sparkles size={16} className="text-[#563568]" />
              <span>Promotional Announcement Bar</span>
            </h3>

            <div className="text-xs font-sans">
              <label className="block text-[#6F6475] mb-1 font-medium">Active Header Message</label>
              <input
                type="text"
                value={announcementMsg}
                onChange={(e) => setAnnouncementMsg(e.target.value)}
                placeholder="e.g. Complimentary Express Delivery on all orders across India"
                className="w-full p-2.5 bg-[#F7F0FA] border border-[#E7DCEB] rounded-xs focus:outline-none"
              />
              <span className="text-[11px] text-[#6F6475] mt-1 block">Displayed on the top Deep Plum strip across all pages</span>
            </div>
          </div>

          {/* Section 3: Customer Care & Concierge */}
          <div className="bg-white p-6 border border-[#E7DCEB] rounded-xs shadow-2xs space-y-4">
            <h3 className="font-serif text-base text-[#302438] flex items-center gap-2">
              <Mail size={16} className="text-[#563568]" />
              <span>Customer Care Channels</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-sans">
              <div>
                <label className="block text-[#6F6475] mb-1 font-medium">Official Support Email</label>
                <input
                  type="email"
                  value={supportEmail}
                  onChange={(e) => setSupportEmail(e.target.value)}
                  className="w-full p-2.5 bg-[#F7F0FA] border border-[#E7DCEB] rounded-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[#6F6475] mb-1 font-medium">WhatsApp Concierge Phone</label>
                <input
                  type="text"
                  value={supportPhone}
                  onChange={(e) => setSupportPhone(e.target.value)}
                  className="w-full p-2.5 bg-[#F7F0FA] border border-[#E7DCEB] rounded-xs focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="py-3 px-8 bg-[#563568] hover:bg-[#A184BD] text-white text-xs uppercase tracking-[0.2em] font-medium rounded-xs transition-colors shadow-xs flex items-center gap-2 cursor-pointer"
            >
              <Save size={14} />
              <span>Save Business Settings</span>
            </button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
};
