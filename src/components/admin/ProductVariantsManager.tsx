import React, { useEffect, useState } from 'react';
import { X, Plus, Trash2, RefreshCw, Save, PackagePlus } from 'lucide-react';
import type { Product, ProductVariant } from '../../types/product';
import type { ProductVariantDraft } from '../../services/interfaces';
import { adminProductService } from '../../services';

interface ProductVariantsManagerProps {
  product: Product;
  onClose: () => void;
  onSaved: (stock: number) => void;
}

const REASONS = [
  'Restock from Atelier',
  'Damaged / Inspection Pull',
  'Inventory Physical Reconciliation',
  'Customer Return Restored'
];

function blankVariant(index: number): ProductVariantDraft {
  return {
    option1Name: 'Size',
    option1Value: '',
    option2Name: '',
    option2Value: '',
    sku: '',
    price: null,
    compareAtPrice: null,
    stock: 0,
    status: 'active',
    sortOrder: index
  };
}

function toDraft(variant: ProductVariant): ProductVariantDraft {
  return {
    id: variant.id,
    option1Name: variant.option1Name,
    option1Value: variant.option1Value,
    option2Name: variant.option2Name || '',
    option2Value: variant.option2Value || '',
    sku: variant.sku,
    price: variant.price ?? null,
    compareAtPrice: variant.compareAtPrice ?? null,
    stock: variant.stock,
    status: variant.status,
    sortOrder: variant.sortOrder
  };
}

export const ProductVariantsManager: React.FC<ProductVariantsManagerProps> = ({ product, onClose, onSaved }) => {
  const [variants, setVariants] = useState<ProductVariantDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [delta, setDelta] = useState('1');
  const [reason, setReason] = useState(REASONS[0]);
  const [adjusting, setAdjusting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await adminProductService.getProductVariants(product.id);
      setVariants(rows.map(toDraft));
      setDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load product variants.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [product.id]);

  const update = (index: number, changes: Partial<ProductVariantDraft>) => {
    setVariants(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item));
    setDirty(true);
    setNotice('');
  };

  const save = async () => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      if (!variants.length) throw new Error('Add at least one variant to enable variant-based purchasing.');
      const normalized = variants.map((item, index) => ({
        ...item,
        sku: item.sku.trim().toUpperCase(),
        option1Name: item.option1Name.trim(),
        option1Value: item.option1Value.trim(),
        option2Name: item.option2Name?.trim() || '',
        option2Value: item.option2Value?.trim() || '',
        sortOrder: index
      }));
      const result = await adminProductService.saveProductVariants(product.id, normalized);
      setVariants(result.variants.map(toDraft));
      setDirty(false);
      setNotice('Variant options saved. Parent product stock now reflects the total active variant stock.');
      onSaved(result.stock);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Variants could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const adjustStock = async (variant: ProductVariantDraft) => {
    if (!variant.id || dirty || adjusting) return;
    const amount = Number(delta);
    if (!Number.isSafeInteger(amount) || amount === 0) {
      setError('Enter a non-zero whole-number stock adjustment.');
      return;
    }
    setAdjusting(true);
    setError('');
    setNotice('');
    try {
      const result = await adminProductService.adjustVariantStock(variant.id, amount, reason);
      setNotice(`${variant.sku}: stock updated to ${result.movement.newStock}. Inventory movement recorded.`);
      setAdjustingId(null);
      setDelta('1');
      await load();
      onSaved(result.productStock);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Variant stock could not be adjusted.');
    } finally {
      setAdjusting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-3 sm:p-6">
      <section role="dialog" aria-modal="true" aria-labelledby="variant-manager-title" className="w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#E7DCEB] bg-white p-5">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#8E769E]">Catalogue options & inventory</p>
            <h2 id="variant-manager-title" className="mt-1 font-serif text-xl text-[#2C1838]">Product Variants</h2>
            <p className="mt-1 text-xs text-[#705E7B]">{product.name}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close variant manager" className="rounded-lg p-2 hover:bg-[#F7F0FA]"><X size={18}/></button>
        </header>

        <div className="space-y-4 p-5">
          <div className="rounded-xl border border-[#D9C8E2] bg-[#FAF5FC] p-3 text-xs text-[#563568]">
            Each combination has its own SKU and stock. Variant price and MRP are optional overrides; blank prices inherit the parent product price. Parent stock is automatically calculated from active variants.
            <p className="mt-1 text-[#705E7B]">When adding the first variants, enter the correct opening stock for each option. Existing product stock is not automatically distributed.</p>
          </div>

          {notice && <div role="status" className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800">{notice}</div>}
          {error && <div role="alert" className="rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}</div>}

          {loading ? (
            <div className="py-12 text-center text-xs text-[#705E7B]"><RefreshCw size={18} className="mx-auto mb-2 animate-spin"/>Loading variants…</div>
          ) : (
            <div className="space-y-4">
              {variants.map((variant, index) => (
                <article key={variant.id || `new-${index}`} className="rounded-xl border border-[#E7DCEB] p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <strong className="text-xs text-[#2C1838]">Variant {index + 1}</strong>
                    <div className="flex items-center gap-2">
                      <select value={variant.status} onChange={event => update(index, { status: event.target.value as 'active' | 'inactive' })} className="min-h-9 rounded-lg border border-[#E7DCEB] bg-white px-2 text-xs">
                        <option value="active">Active</option><option value="inactive">Inactive</option>
                      </select>
                      <button type="button" onClick={() => { setVariants(current => current.filter((_, itemIndex) => itemIndex !== index)); setDirty(true); }} className="rounded-lg p-2 text-red-600 hover:bg-red-50" aria-label="Remove variant (will be archived)"><Trash2 size={15}/></button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <label className="text-[11px] text-[#705E7B]">Option name<input value={variant.option1Name} onChange={event => update(index, { option1Name: event.target.value })} placeholder="Size" maxLength={60} className="mt-1 min-h-10 w-full rounded-lg border border-[#E7DCEB] px-3 text-sm text-[#302438]"/></label>
                    <label className="text-[11px] text-[#705E7B]">Option value<input value={variant.option1Value} onChange={event => update(index, { option1Value: event.target.value })} placeholder="6 / Small / Gold" maxLength={100} className="mt-1 min-h-10 w-full rounded-lg border border-[#E7DCEB] px-3 text-sm text-[#302438]"/></label>
                    <label className="text-[11px] text-[#705E7B]">Second option name<input value={variant.option2Name || ''} onChange={event => update(index, { option2Name: event.target.value })} placeholder="Colour (optional)" maxLength={60} className="mt-1 min-h-10 w-full rounded-lg border border-[#E7DCEB] px-3 text-sm text-[#302438]"/></label>
                    <label className="text-[11px] text-[#705E7B]">Second option value<input value={variant.option2Value || ''} onChange={event => update(index, { option2Value: event.target.value })} placeholder="Rose Gold" maxLength={100} className="mt-1 min-h-10 w-full rounded-lg border border-[#E7DCEB] px-3 text-sm text-[#302438]"/></label>
                    <label className="text-[11px] text-[#705E7B]">Variant SKU<input value={variant.sku} onChange={event => update(index, { sku: event.target.value.toUpperCase() })} placeholder="SAR-RING-06-GD" maxLength={100} className="mt-1 min-h-10 w-full rounded-lg border border-[#E7DCEB] px-3 font-mono text-xs text-[#302438]"/></label>
                    <label className="text-[11px] text-[#705E7B]">Selling price override (₹)<input type="number" min="0" step="0.01" value={variant.price ?? ''} onChange={event => update(index, { price: event.target.value === '' ? null : Number(event.target.value) })} placeholder={String(product.price)} className="mt-1 min-h-10 w-full rounded-lg border border-[#E7DCEB] px-3 text-sm text-[#302438]"/></label>
                    <label className="text-[11px] text-[#705E7B]">MRP override (₹)<input type="number" min="0" step="0.01" value={variant.compareAtPrice ?? ''} onChange={event => update(index, { compareAtPrice: event.target.value === '' ? null : Number(event.target.value) })} placeholder={product.compareAtPrice == null ? 'Optional' : String(product.compareAtPrice)} className="mt-1 min-h-10 w-full rounded-lg border border-[#E7DCEB] px-3 text-sm text-[#302438]"/></label>
                    <label className="text-[11px] text-[#705E7B]">Opening stock {variant.id ? '(managed below)' : '(initial units)'}<input type="number" min="0" step="1" value={variant.stock} disabled={Boolean(variant.id)} onChange={event => update(index, { stock: Number(event.target.value) })} className="mt-1 min-h-10 w-full rounded-lg border border-[#E7DCEB] px-3 text-sm text-[#302438] disabled:bg-[#F7F0FA]"/></label>
                  </div>

                  {variant.id && (
                    <div className="mt-3 border-t border-[#F0E8F3] pt-3">
                      {adjustingId === variant.id ? (
                        <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-4">
                          <label className="text-[11px] text-[#705E7B]">Stock change (+/-)<input type="number" step="1" value={delta} onChange={event => setDelta(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-[#E7DCEB] px-3 text-sm"/></label>
                          <label className="text-[11px] text-[#705E7B]">Reason<select value={reason} onChange={event => setReason(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-[#E7DCEB] bg-white px-2 text-xs">{REASONS.map(item => <option key={item}>{item}</option>)}</select></label>
                          <button type="button" disabled={adjusting || dirty} onClick={() => void adjustStock(variant)} className="min-h-10 rounded-lg bg-[#563568] px-4 text-xs font-semibold text-white disabled:opacity-50">{adjusting ? 'Recording…' : 'Record adjustment'}</button>
                          <button type="button" onClick={() => setAdjustingId(null)} className="min-h-10 rounded-lg border border-[#E7DCEB] px-4 text-xs">Cancel</button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="text-[#705E7B]">Current audited stock: <strong className="text-[#2C1838]">{variant.stock}</strong></span>
                          <button type="button" disabled={dirty} onClick={() => { setAdjustingId(variant.id || null); setDelta('1'); }} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-[#D9C8E2] px-3 text-[#563568] disabled:opacity-40"><PackagePlus size={14}/> Adjust stock</button>
                        </div>
                      )}
                    </div>
                  )}
                </article>
              ))}

              <button type="button" onClick={() => { setVariants(current => [...current, blankVariant(current.length)]); setDirty(true); }} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-dashed border-[#B69ACF] px-4 text-xs font-semibold text-[#563568]"><Plus size={15}/> Add variant</button>
            </div>
          )}
        </div>

        <footer className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-[#E7DCEB] bg-white p-4">
          <span className="text-[11px] text-[#705E7B]">{variants.length} configured option{variants.length === 1 ? '' : 's'} · {variants.filter(item => item.status === 'active').length} active</span>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="min-h-10 rounded-lg border border-[#E7DCEB] px-4 text-xs">Close</button>
            <button type="button" disabled={loading || saving || !dirty} onClick={() => void save()} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#563568] px-5 text-xs font-semibold text-white disabled:opacity-50"><Save size={14}/>{saving ? 'Saving…' : 'Save variants'}</button>
          </div>
        </footer>
      </section>
    </div>
  );
};
