import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Save } from 'lucide-react';
import { inventorySettingsService } from '../../services/hostinger/inventorySettingsService';

interface InventoryAlertSettingsProps {
  threshold: number;
  onSaved: (threshold: number) => void;
}

export const InventoryAlertSettings: React.FC<InventoryAlertSettingsProps> = ({ threshold, onSaved }) => {
  const [value, setValue] = useState(String(threshold));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  React.useEffect(() => setValue(String(threshold)), [threshold]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 10000) {
      setError('Enter a whole number from 0 to 10,000.');
      setNotice('');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const result = await inventorySettingsService.save(parsed);
      onSaved(result.threshold);
      setNotice('Low-stock alert threshold saved to Hostinger MariaDB.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the threshold.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="bg-white border border-[#E7DCEB] rounded-xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle size={17} className="text-[#80609A]" />
        <div>
          <h2 className="font-serif text-lg text-[#302438]">Low-stock alert settings</h2>
          <p className="text-[11px] text-[#8B7598]">Choose when a product should appear in Inventory Watch and low-stock filters.</p>
        </div>
      </div>
      <form onSubmit={save} className="flex flex-col sm:flex-row sm:items-end gap-3">
        <label className="block text-xs text-[#5D5068] flex-1">
          Alert when stock is at or below
          <input type="number" min="0" max="10000" step="1" required value={value} onChange={event => setValue(event.target.value)} className="mt-1.5 w-full max-w-xs min-h-11 px-3 bg-[#FAF5FC] border border-[#E7DCEB] rounded-lg text-sm text-[#302438]" />
          <span className="block mt-1 text-[10px] text-[#8E769E]">0 means only zero-stock items meet the threshold. Maximum 10,000 units.</span>
        </label>
        <button type="submit" disabled={saving || value === String(threshold)} className="inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-lg bg-[#563568] text-white text-xs font-semibold disabled:opacity-50">
          <Save size={14} />{saving ? 'Saving…' : 'Save threshold'}
        </button>
      </form>
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
      {notice && <p role="status" className="flex items-center gap-2 text-xs text-emerald-700"><CheckCircle2 size={14}/>{notice}</p>}
    </section>
  );
};
