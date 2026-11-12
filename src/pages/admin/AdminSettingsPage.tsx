import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { checkoutSettingsService, type CheckoutConfig } from '../../services/hostinger/checkoutSettingsService';
import { Save, RefreshCw, CheckCircle2, AlertCircle, Truck, ShieldCheck, LayoutTemplate } from 'lucide-react';

export const AdminSettingsPage: React.FC = () => {
  const [config, setConfig] = useState<CheckoutConfig>({
    shippingFlatFee: 99,
    freeShippingThreshold: 1999,
    codEnabled: true
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setConfig(await checkoutSettingsService.getAdminConfig());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Store settings could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const saved = await checkoutSettingsService.saveAdminConfig(config);
      setConfig(saved);
      setNotice('Checkout settings saved securely in Hostinger MariaDB and applied to new checkouts.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Settings could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-4xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-5 border-b border-[#E7DCEB]">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-[#8E769E]">Store configuration</p>
            <h1 className="font-serif text-2xl sm:text-3xl text-[#302438]">Settings & Security</h1>
            <p className="text-xs text-[#705E7B] mt-1">Persistent checkout and delivery rules used by both the storefront and order API.</p>
          </div>
          <button onClick={() => void load()} disabled={loading || saving} className="inline-flex items-center justify-center gap-2 px-3 py-2 border border-[#E7DCEB] rounded-xl text-xs disabled:opacity-50">
            <RefreshCw size={14}/> Refresh
          </button>
        </div>

        {error && <div role="alert" className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex gap-2"><AlertCircle size={15}/>{error}</div>}
        {notice && <div role="status" className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex gap-2"><CheckCircle2 size={15}/>{notice}</div>}

        <form onSubmit={save} className="space-y-5">
          <section className="bg-white rounded-2xl border border-[#EADFF0] p-5 sm:p-6 space-y-5">
            <div className="flex items-center gap-2"><Truck size={17} className="text-[#563568]"/><h2 className="font-serif text-lg">Shipping & delivery</h2></div>
            {loading ? <p className="text-xs text-[#8E769E] py-5">Loading saved settings…</p> : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="block text-xs text-[#5D5068]">
                    Standard shipping fee (₹)
                    <input type="number" min="0" max="5000" step="1" required value={config.shippingFlatFee} onChange={e => setConfig(current => ({ ...current, shippingFlatFee: Number(e.target.value) }))} className="mt-1.5 w-full p-3 bg-[#FAF5FC] border border-[#E7DCEB] rounded-xl text-sm text-[#302438]"/>
                    <span className="block mt-1 text-[10px] text-[#8E769E]">Applied when the order subtotal is below the free-shipping threshold.</span>
                  </label>
                  <label className="block text-xs text-[#5D5068]">
                    Free-shipping threshold (₹)
                    <input type="number" min="1" max="100000" step="1" required value={config.freeShippingThreshold} onChange={e => setConfig(current => ({ ...current, freeShippingThreshold: Number(e.target.value) }))} className="mt-1.5 w-full p-3 bg-[#FAF5FC] border border-[#E7DCEB] rounded-xl text-sm text-[#302438]"/>
                    <span className="block mt-1 text-[10px] text-[#8E769E]">Orders at or above this subtotal receive free shipping.</span>
                  </label>
                </div>
                <div className="p-4 bg-[#FAF5FC] border border-[#EADFF0] rounded-xl flex items-start gap-3">
                  <input id="cod-enabled" type="checkbox" checked={config.codEnabled} onChange={e => setConfig(current => ({ ...current, codEnabled: e.target.checked }))} className="mt-0.5 accent-[#563568]"/>
                  <label htmlFor="cod-enabled" className="text-xs">
                    <span className="font-semibold text-[#302438]">Enable Cash on Delivery (COD)</span>
                    <span className="block text-[10px] text-[#705E7B] mt-1">When disabled, COD is hidden at checkout and rejected by the server for new orders. Existing orders are not changed.</span>
                  </label>
                </div>
              </>
            )}
            <div className="pt-2 border-t border-[#F5EDF8] flex justify-end">
              <button type="submit" disabled={loading || saving} className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#563568] text-white rounded-xl text-xs font-semibold disabled:opacity-50">
                <Save size={14}/>{saving ? 'Saving…' : 'Save checkout settings'}
              </button>
            </div>
          </section>
        </form>

        <section className="bg-white rounded-2xl border border-[#EADFF0] p-5 sm:p-6 space-y-3">
          <div className="flex items-center gap-2"><LayoutTemplate size={17} className="text-[#563568]"/><h2 className="font-serif text-lg">Storefront content</h2></div>
          <p className="text-xs text-[#705E7B]">Homepage banners, the announcement bar and the Editorial Collection are managed separately in Storefront Studio.</p>
          <Link to="/admin/storefront" className="inline-flex items-center gap-2 px-4 py-2 border border-[#E7DCEB] rounded-xl text-xs text-[#563568]">Open Storefront Studio</Link>
        </section>

        <section className="bg-white rounded-2xl border border-[#EADFF0] p-5 sm:p-6 space-y-3">
          <div className="flex items-center gap-2"><ShieldCheck size={17} className="text-[#563568]"/><h2 className="font-serif text-lg">Admin session security</h2></div>
          <ul className="text-xs text-[#705E7B] list-disc pl-5 space-y-1.5">
            <li>Admin pages and management APIs require a valid Hostinger admin session.</li>
            <li>Admin sessions expire automatically after 8 hours.</li>
            <li>Sign out when using a shared or public computer.</li>
          </ul>
          <p className="text-[10px] text-[#8E769E]">Admin user and role management is not yet available in this panel.</p>
        </section>

        <section className="bg-[#FAF5FC] border border-[#EADFF0] rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-[#302438]">Customer support details</h2>
          <p className="text-xs text-[#705E7B] mt-1">No official support email or WhatsApp number has been configured here. Placeholder contact details are intentionally not shown or published.</p>
        </section>
      </div>
    </AdminLayout>
  );
};
