import React, { useEffect, useMemo, useState } from "react";
import { adminProductService } from "../../services";
import type { Product } from "../../types/product";
import { hostingerStorefrontService, type ExploreNowConfig } from "../../services/hostinger/hostingerStorefrontService";

const EMPTY: ExploreNowConfig = { version: 1, productIds: [], displayCount: 8, configured: false };
const DISPLAY_COUNTS = [4, 6, 8, 10, 12, 16, 20, 24];
const MAX_PRODUCTS = 100;

export const ExploreNowManager: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [collection, setCollection] = useState<"" | "artificial" | "demi-fine">("");
  const [draft, setDraft] = useState<ExploreNowConfig>(EMPTY);
  const [published, setPublished] = useState<ExploreNowConfig>(EMPTY);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const byId = useMemo(() => new Map(products.map(product => [product.id, product])), [products]);
  const selected = draft.productIds.map(id => byId.get(id)).filter((product): product is Product => Boolean(product));
  const missing = draft.productIds.filter(id => !byId.has(id));
  const available = products.filter(product => product.status === "active" && product.stock > 0 &&
    !draft.productIds.includes(product.id) &&
    (!search.trim() || product.name.toLowerCase().includes(search.trim().toLowerCase()) || product.slug.toLowerCase().includes(search.trim().toLowerCase())));
  const unchanged = JSON.stringify(draft) === JSON.stringify(published);

  const load = async (isCancelled: () => boolean = () => false) => {
    setLoading(true); setError("");
    try {
      const [catalogue, config] = await Promise.all([adminProductService.getProducts(), hostingerStorefrontService.getExploreNow(collection || undefined)]);
      if (isCancelled()) return;
      setProducts(collection ? catalogue.filter(product => product.productCollection === collection) : catalogue); setDraft(config.draft); setPublished(config.published);
    } catch (e) { if (!isCancelled()) setError(e instanceof Error ? e.message : "Could not load Explore Now settings."); }
    finally { if (!isCancelled()) setLoading(false); }
  };
  useEffect(() => { let cancelled = false; setProducts([]); setDraft(EMPTY); setPublished(EMPTY); void load(() => cancelled); return () => { cancelled = true; }; }, [collection]);

  const update = (productIds: string[], displayCount = draft.displayCount) => {
    setDraft({ version: 1, productIds, displayCount, configured: productIds.length > 0 });
    setMessage("");
  };
  const toggle = (id: string) => update(draft.productIds.includes(id) ? draft.productIds.filter(item => item !== id) : [...draft.productIds, id]);
  const save = async () => {
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await hostingerStorefrontService.saveExploreNow(draft, collection || undefined);
      setDraft(result.draft); setMessage("Explore Now draft saved. The live homepage is unchanged until you publish.");
    } catch (e) { setError(e instanceof Error ? e.message : "Draft could not be saved."); }
    finally { setBusy(false); }
  };
  const publish = async () => {
    setBusy(true); setError(""); setMessage("");
    try {
      await hostingerStorefrontService.saveExploreNow(draft, collection || undefined);
      const result = await hostingerStorefrontService.publishExploreNow(collection || undefined);
      setDraft(result.published); setPublished(result.published);
      setMessage("Explore Now published. The homepage will randomly select from this eligible product pool on each visit.");
    } catch (e) { setError(e instanceof Error ? e.message : "Explore Now could not be published."); }
    finally { setBusy(false); }
  };

  return <section className="bg-white border rounded-2xl p-5 space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="font-semibold text-[#2C1838]">Explore Now</h2>
        <p className="mt-1 text-xs text-gray-500">Choose the eligible products, then set how many appear in a clean, non-carousel grid. The storefront shuffles this pool on each visit.</p>
        <label className="mt-3 block max-w-xs space-y-1 text-xs font-medium text-[#563568]">Homepage version<select value={collection} disabled={loading || busy} onChange={event => setCollection(event.target.value as "" | "artificial" | "demi-fine")} className="w-full rounded-lg border border-[#E7DCEB] bg-white p-2.5 text-sm"><option value="">Home (existing global selection)</option><option value="artificial">Artificial</option><option value="demi-fine">Demi-Fine</option></select></label>
      </div>
      <span className={unchanged ? "text-xs rounded-full px-3 py-1 bg-green-50 text-green-700" : "text-xs rounded-full px-3 py-1 bg-amber-50 text-amber-700"}>{unchanged ? "Published version" : "Unpublished changes"}</span>
    </div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {message && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{message}</p>}
    {loading ? <p className="text-sm text-gray-500">Loading product catalogue…</p> : <>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium text-[#302438]">Products to display
          <select value={draft.displayCount} onChange={e => update(draft.productIds, Number(e.target.value))} className="mt-1 block min-h-11 w-full rounded-lg border p-3 text-sm">
            {DISPLAY_COUNTS.map(count => <option key={count} value={count}>{count} products</option>)}
          </select>
          <span className="mt-1 block text-xs font-normal text-gray-500">The actual number is capped by the number of eligible products selected and currently in stock.</span>
        </label>
        <div className="rounded-lg border border-[#E7DCEB] bg-[#FBF8FC] p-3">
          <p className="text-sm font-medium text-[#302438]">Eligible pool</p>
          <p className="mt-1 text-lg font-semibold text-[#563568]">{draft.productIds.length} <span className="text-xs font-normal text-gray-500">/ {MAX_PRODUCTS} selected</span></p>
          <p className="text-xs text-gray-500">At least {draft.displayCount} eligible items are recommended to keep the selection varied.</p>
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-3">
          <div><h3 className="text-sm font-medium">Add eligible products</h3><p className="text-xs text-gray-500">Only active, in-stock products can be selected.</p></div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by product name…" aria-label="Search products" className="min-h-11 w-full rounded-lg border p-3 text-sm" />
          <div className="max-h-[420px] space-y-2 overflow-y-auto">
            {available.map(product => <label key={product.id} className="flex min-h-[72px] cursor-pointer items-center gap-3 rounded-xl border p-2 hover:bg-[#FBF8FC]">
              <img src={product.images?.[0] || "/images/product-placeholder.png"} alt="" className="h-14 w-12 rounded-lg bg-[#F7F0FA] object-cover" />
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{product.name}</span><span className="block text-xs text-gray-500">₹{product.price.toLocaleString("en-IN")} · Stock {product.stock}</span></span>
              <input type="checkbox" checked={false} disabled={busy || draft.productIds.length >= MAX_PRODUCTS} onChange={() => toggle(product.id)} aria-label={"Add " + product.name} className="h-5 w-5 accent-[#563568]" />
            </label>)}
            {!available.length && <p className="rounded-xl border p-4 text-xs text-gray-500">{search ? "No matching available products." : "No additional active, in-stock products available."}</p>}
          </div>
        </div>
        <div className="space-y-3">
          <div><h3 className="text-sm font-medium">Selected eligible pool</h3><p className="text-xs text-gray-500">Every visit shows a random sample from this pool, up to your display count.</p></div>
          <div className="max-h-[420px] space-y-2 overflow-y-auto">
            {draft.productIds.map(id => { const product = byId.get(id); const active = product?.status === "active" && (product.stock ?? 0) > 0; return <article key={id} className="flex items-center gap-3 rounded-xl border p-2">
              {product && <img src={product.images?.[0] || "/images/product-placeholder.png"} alt="" className="h-14 w-12 rounded-lg bg-[#F7F0FA] object-cover" />}
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{product?.name || "Product no longer found"}</p><p className={active ? "text-xs text-green-700" : "text-xs text-amber-700"}>{active && product ? "₹" + product.price.toLocaleString("en-IN") + " · In stock" : "Currently unavailable; excluded from the live grid"}</p></div>
              <button type="button" disabled={busy} onClick={() => toggle(id)} className="min-h-11 rounded-lg border border-red-200 px-3 text-xs text-red-700">Remove</button>
            </article>; })}
            {!draft.productIds.length && <p className="rounded-xl border p-4 text-xs text-gray-500">Select products from the catalogue to build the rotation pool.</p>}
            {missing.length > 0 && <p className="text-xs text-amber-700">{missing.length} selected product(s) are missing from the catalogue. Remove them before publishing.</p>}
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-[#E7DCEB] bg-[#FBF8FC] p-3 text-xs text-gray-600">Preview: a maximum of <strong>{draft.displayCount}</strong> products will appear per visit. The order and selection are randomized from the published pool; product details, stock and pricing remain sourced from the catalogue.</div>
    </>}
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={busy || loading || missing.length > 0} onClick={() => void save()} className="min-h-11 rounded-lg border px-4 py-2 text-sm disabled:opacity-50">{busy ? "Saving…" : "Save draft"}</button>
      <button type="button" disabled={busy || loading || missing.length > 0 || draft.productIds.length === 0} onClick={() => void publish()} className="min-h-11 rounded-lg bg-[#563568] px-4 py-2 text-sm text-white disabled:opacity-50">{busy ? "Publishing…" : "Publish Explore Now"}</button>
      <button type="button" disabled={busy || loading} onClick={() => void load()} className="min-h-11 rounded-lg border px-4 py-2 text-sm disabled:opacity-50">Reload</button>
      <a href="/" target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-lg border px-4 py-2 text-sm">Preview storefront</a>
    </div>
  </section>;
};
