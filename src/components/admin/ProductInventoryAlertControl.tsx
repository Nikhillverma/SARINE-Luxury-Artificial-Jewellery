import React, { useEffect, useState } from 'react';
import { CheckCircle2, Save, RotateCcw } from 'lucide-react';
import { inventorySettingsService } from '../../services/hostinger/inventorySettingsService';

interface ProductInventoryAlertControlProps {
  productId: string;
  globalThreshold: number;
  savedThreshold?: number;
  onSaved: (productId: string, threshold: number | null) => void;
}

export const ProductInventoryAlertControl: React.FC<ProductInventoryAlertControlProps> = ({
  productId, globalThreshold, savedThreshold, onSaved
}) => {
  const [value, setValue] = useState(savedThreshold === undefined ? String(globalThreshold) : String(savedThreshold));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    setValue(savedThreshold === undefined ? String(globalThreshold) : String(savedThreshold));
  }, [savedThreshold, globalThreshold]);

  const save = async () => {
    const threshold = Number(value);
    if (!Number.isInteger(threshold) || threshold < 0 || threshold > 10000) {
      setError('Enter a whole number from 0 to 10,000.');
      setNotice('');
      return;
    }
    setSaving(true); setError(''); setNotice('');
    try {
      const result = await inventorySettingsService.saveProductThreshold(productId, threshold);
      onSaved(productId, result.threshold);
      setNotice('Saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this product threshold.');
    } finally { setSaving(false); }
  };

  const reset = async () => {
    setSaving(true); setError(''); setNotice('');
    try {
      await inventorySettingsService.saveProductThreshold(productId, null);
      onSaved(productId, null);
      setValue(String(globalThreshold));
      setNotice('Using global default');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not restore the global threshold.');
    } finally { setSaving(false); }
  };

  const isCustom = savedThreshold !== undefined;
  return (
    <div className='min-w-[150px] space-y-1.5'>
      <div className='flex items-center gap-1.5'>
        <input
          aria-label='Product low-stock alert threshold'
          type='number' min='0' max='10000' step='1' value={value}
          onChange={event => { setValue(event.target.value); setNotice(''); }}
          className='w-20 min-h-9 px-2 border border-[#E7DCEB] rounded-md bg-[#FAF5FC] text-xs text-[#302438]'
        />
        <button type='button' onClick={() => void save()} disabled={saving || (isCustom && value === String(savedThreshold)) || (!isCustom && value === String(globalThreshold))}
          className='inline-flex items-center gap-1 min-h-9 px-2.5 rounded-md bg-[#563568] text-white text-[10px] font-semibold disabled:opacity-40'>
          <Save size={12} /> Save
        </button>
      </div>
      <div className='flex items-center gap-1.5 min-h-4'>
        <span className='text-[10px] text-[#806B8D]'>{isCustom ? 'Custom alert' : 'Global default'}</span>
        {isCustom && <button type='button' onClick={() => void reset()} disabled={saving} className='inline-flex items-center gap-1 text-[10px] text-[#704A83] underline disabled:opacity-40'><RotateCcw size={10} /> Reset</button>}
      </div>
      {notice && <p role='status' className='flex items-center gap-1 text-[10px] text-emerald-700'><CheckCircle2 size={11} />{notice}</p>}
      {error && <p role='alert' className='text-[10px] text-red-700'>{error}</p>}
    </div>
  );
};