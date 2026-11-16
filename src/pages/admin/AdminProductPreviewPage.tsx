import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { fetchAdminProductPreview } from '../../services/hostinger/hostingerAdminProductService';
import type { Product, ProductVariant } from '../../types/product';
import { formatInr } from '../../utils/currency';
import { ArrowLeft, Eye, ShieldCheck, ShoppingBag, Package, AlertCircle } from 'lucide-react';

export const AdminProductPreviewPage: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    fetchAdminProductPreview(id)
      .then(item => {
        if (!current) return;
        setProduct(item);
        const firstAvailable = item.variants?.find(variant => variant.status === 'active');
        setSelectedVariantId(firstAvailable?.id || '');
      })
      .catch(err => {
        if (current) setError(err instanceof Error ? err.message : 'Could not load this private preview.');
      })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [id]);

  const variants = product?.variants || [];
  const selectedVariant = useMemo(
    () => variants.find(variant => variant.id === selectedVariantId && variant.status === 'active'),
    [variants, selectedVariantId]
  );
  const effectivePrice = selectedVariant?.price ?? product?.price ?? 0;
  const effectiveMrp = selectedVariant?.compareAtPrice ?? product?.compareAtPrice;
  const availableStock = selectedVariant ? selectedVariant.stock : product?.stock ?? 0;

  return (
    <AdminLayout>
      <div className="mx-auto w-full max-w-6xl space-y-5 pb-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link to="/admin/products" className="inline-flex items-center gap-2 text-xs text-[#705E7B] hover:text-[#563568]"><ArrowLeft size={14}/> Back to Products & Catalogue</Link>
            <h1 className="mt-3 font-serif text-2xl sm:text-3xl font-semibold text-[#2C1838]">Private Product Preview</h1>
            <p className="mt-1 text-xs text-[#705E7B]">Customer-style product review inside your secure Admin workspace.</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#D9C8E2] bg-[#F7F0FA] px-3 py-2 text-xs font-semibold text-[#563568]"><Eye size={14}/> Admin-only preview</div>
        </div>

        <div className="rounded-2xl border border-[#E6D9EC] bg-[#F7F0FA] p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 shrink-0 text-[#563568]" size={20}/>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#392247]">Private preview — purchasing is disabled</p>
              <p className="mt-1 text-xs leading-5 text-[#705E7B]">This view is available only to a signed-in SARINE administrator. It does not publish a draft, add anything to a bag, create an order, change stock, or submit customer activity. Archived products are not previewable.</p>
            </div>
          </div>
        </div>

        {loading ? <div className="rounded-2xl border border-[#EADFF0] bg-white p-12 text-center text-sm text-[#806B8D]">Loading secure preview…</div> :
        error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700"><div className="flex items-center gap-2 font-semibold"><AlertCircle size={17}/> Preview unavailable</div><p className="mt-2">{error}</p><Link to="/admin/products" className="mt-4 inline-block underline">Return to catalogue</Link></div> :
        product ? <>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <section className="space-y-3">
              <div className="overflow-hidden rounded-2xl border border-[#EADFF0] bg-white">
                {product.images?.length ? <img src={product.images[0]} alt={product.name} className="aspect-square w-full object-contain bg-[#FCF9FD]"/> :
                  <div className="flex aspect-square flex-col items-center justify-center gap-3 bg-[#FCF9FD] text-[#A18EAA]"><Package size={42}/><span className="text-xs">No product image uploaded</span></div>}
              </div>
              {product.images?.length > 1 && <div className="grid grid-cols-4 gap-2">{product.images.slice(1).map((image, index) => <img key={image + index} src={image} alt={product.name + ' view ' + (index + 2)} className="aspect-square w-full rounded-xl border border-[#EADFF0] bg-white object-contain"/>)}</div>}
            </section>

            <section className="space-y-4 rounded-2xl border border-[#EADFF0] bg-white p-5 sm:p-7">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${product.status === 'draft' ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'}`}>{product.status} product</span>
                <span className="rounded-full bg-[#F7F0FA] px-3 py-1 text-[10px] text-[#705E7B]">ID: {product.id}</span>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-[#9B83A7]">{product.jewelleryType || 'SARINE Jewellery'}</p>
                <h2 className="mt-2 font-serif text-3xl leading-tight text-[#302438]">{product.name}</h2>
                {product.shortDescription && <p className="mt-2 text-sm leading-6 text-[#806B8D]">{product.shortDescription}</p>}
              </div>
              <div className="flex items-baseline gap-3 border-y border-[#F0E8F3] py-4">
                <span className="text-2xl font-semibold text-[#563568]">{formatInr(effectivePrice)}</span>
                {effectiveMrp != null && effectiveMrp > effectivePrice && <span className="text-sm text-[#A18EAA] line-through">{formatInr(effectiveMrp)}</span>}
              </div>
              {product.description && <p className="whitespace-pre-line text-sm leading-7 text-[#66566F]">{product.description}</p>}

              {variants.length > 0 ? <div className="space-y-3">
                <div><h3 className="text-sm font-semibold text-[#392247]">Available options</h3><p className="mt-1 text-xs text-[#8E769E]">Select an active option to inspect its customer-facing price, SKU and availability.</p></div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {variants.map((variant: ProductVariant) => {
                    const active = variant.status === 'active';
                    const chosen = selectedVariantId === variant.id;
                    return <button key={variant.id} type="button" disabled={!active} onClick={() => setSelectedVariantId(variant.id)} className={`min-h-16 rounded-xl border p-3 text-left transition-colors ${chosen ? 'border-[#563568] bg-[#F7F0FA] ring-1 ring-[#563568]' : 'border-[#EADFF0] bg-white'} ${!active ? 'cursor-not-allowed opacity-50' : 'hover:border-[#B69ACF]'}`}>
                      <span className="flex items-center justify-between gap-2 text-xs font-semibold text-[#392247]"><span>{variant.label}</span><span className="text-[10px] uppercase">{active ? (variant.stock > 0 ? 'In stock' : 'Out of stock') : 'Inactive'}</span></span>
                      <span className="mt-1 block text-[10px] text-[#806B8D]">SKU: {variant.sku} · {formatInr(variant.price ?? product.price)}</span>
                      <span className="mt-1 block text-[10px] text-[#806B8D]">Stock: {variant.stock}</span>
                    </button>;
                  })}
                </div>
              </div> : <div className="rounded-xl bg-[#FCF9FD] p-3 text-xs text-[#705E7B]">Single-option product · Parent SKU / stock applies.</div>}

              <div className="rounded-xl border border-[#EADFF0] bg-[#FCF9FD] p-4">
                <div className="flex items-center justify-between text-xs"><span className="text-[#806B8D]">Selected SKU</span><strong className="font-mono text-[#392247]">{selectedVariant?.sku || 'Parent product'}</strong></div>
                <div className="mt-2 flex items-center justify-between text-xs"><span className="text-[#806B8D]">Available stock</span><strong className="text-[#392247]">{availableStock}</strong></div>
                <div className="mt-2 flex items-center justify-between text-xs"><span className="text-[#806B8D]">Availability</span><strong className={availableStock > 0 ? 'text-emerald-700' : 'text-amber-700'}>{availableStock > 0 ? 'In stock' : 'Out of stock'}</strong></div>
              </div>
              <button type="button" disabled className="flex min-h-12 w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-[#563568]/50 px-4 text-sm font-semibold text-white"><ShoppingBag size={16}/> Add to Bag — disabled in preview</button>
              <p className="text-center text-[10px] text-[#9B83A7]">No cart, checkout, wishlist, review or order actions are available in this preview.</p>
            </section>
          </div>

          <section className="rounded-2xl border border-[#EADFF0] bg-white p-5 sm:p-6">
            <h3 className="font-serif text-xl text-[#392247]">Product details & care</h3>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ['Base metal', product.baseMetal], ['Plating / finish', product.platingFinish],
                ['Stones / embellishments', product.stoneType], ['Closure', product.closureType],
                ['Category ID', product.categoryId], ['Collections', product.collectionSlugs?.join(', ')]
              ].filter((entry): entry is [string, string] => Boolean(entry[1])).map(([label, value]) => <div key={label} className="rounded-xl bg-[#FCF9FD] p-3"><p className="text-[10px] uppercase tracking-wider text-[#9B83A7]">{label}</p><p className="mt-1 text-sm text-[#392247]">{value}</p></div>)}
            </div>
            {product.tags?.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{product.tags.map(tag => <span key={tag} className="rounded-full bg-[#F7F0FA] px-3 py-1 text-[10px] text-[#705E7B]">#{tag}</span>)}</div>}
            {product.careInstructions?.length ? <div className="mt-5"><h4 className="text-xs font-semibold text-[#392247]">Care instructions</h4><ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 text-[#705E7B]">{product.careInstructions.map((item, index) => <li key={index}>{item}</li>)}</ul></div> : null}
          </section>
        </> : null}
      </div>
    </AdminLayout>
  );
};
