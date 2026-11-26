import React, { useEffect, useMemo, useState } from "react";
import { adminProductService } from "../../services";
import type { Product } from "../../types/product";
import { hostingerStorefrontService, type CuratedFavouritesConfig } from "../../services/hostinger/hostingerStorefrontService";

const emptyConfig: CuratedFavouritesConfig = { version: 1, productIds: [], configured: false };
const MAX_PRODUCTS = 12;

export const CuratedFavouritesManager: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [collection, setCollection] = useState<"" | "artificial" | "demi-fine">("");
  const [draft, setDraft] = useState<CuratedFavouritesConfig>(emptyConfig);
  const [published, setPublished] = useState<CuratedFavouritesConfig>(emptyConfig);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const productById = useMemo(() => new Map(products.map(product => [product.id, product])), [products]);
  const selectedProducts = draft.productIds.map(id => productById.get(id)).filter((product): product is Product => Boolean(product));
  const missingIds = draft.productIds.filter(id => !productById.has(id));
  const availableProducts = products.filter(product =>
    product.status === "active" && product.stock > 0 &&
    !draft.productIds.includes(product.id) &&
    (!search.trim() || product.name.toLowerCase().includes(search.trim().toLowerCase()) || product.slug.toLowerCase().includes(search.trim().toLowerCase()))
  );
  const isPublished = JSON.stringify(draft) === JSON.stringify(published);

  const load = async (isCancelled: () => boolean = () => false) => {
    setLoading(true); setError("");
    try {
      const [catalogue, config] = await Promise.all([
        adminProductService.getProducts(),
        hostingerStorefrontService.getCuratedFavourites(collection || undefined)
      ]);
      if (isCancelled()) return;
      setProducts(collection ? catalogue.filter(product => product.productCollection === collection) : catalogue);
      setDraft(config.draft);
      setPublished(config.published);
    } catch (e) {
      if (!isCancelled()) setError(e instanceof Error ? e.message : "Could not load Curated Favourites.");
    } finally { if (!isCancelled()) setLoading(false); }
  };

  useEffect(() => { let cancelled = false; setProducts([]); setDraft(emptyConfig); setPublished(emptyConfig); void load(() => cancelled); return () => { cancelled = true; }; }, [collection]);

  const updateIds = (productIds: string[]) => {
    setDraft({ version: 1, productIds, configured: true });
    setMessage("");
  };

  const add = (id: string) => {
    if (draft.productIds.length >= MAX_PRODUCTS || draft.productIds.includes(id)) return;
    updateIds([...draft.productIds, id]);
  };

  const remove = (id: string) => updateIds(draft.productIds.filter(item => item !== id));

  const move = (index: number, direction: -1 | 1) => {
    const next = [...draft.productIds];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    updateIds(next);
  };

  const save = async () => {
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await hostingerStorefrontService.saveCuratedFavourites(draft, collection || undefined);
      setDraft(result.draft);
      setMessage("Curated Favourites draft saved. The live homepage is unchanged until you publish.");
    } catch (e) { setError(e instanceof Error ? e.message : "Draft could not be saved."); }
    finally { setBusy(false); }
  };

  const publish = async () => {
    setBusy(true); setError(""); setMessage("");
    try {
      await hostingerStorefrontService.saveCuratedFavourites(draft, collection || undefined);
      const result = await hostingerStorefrontService.publishCuratedFavourites(collection || undefined);
      setDraft(result.published);
      setPublished(result.published);
      setMessage("Curated Favourites published. The homepage now uses this manual selection.");
    } catch (e) { setError(e instanceof Error ? e.message : "Curated Favourites could not be published."); }
    finally { setBusy(false); }
  };

  return <section className="bg-white border rounded-2xl p-5 space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="font-semibold text-[#2C1838]">Curated Favourites</h2>
        <p className="text-xs text-gray-500 mt-1">Choose up to {MAX_PRODUCTS} active, in-stock products and arrange the exact order customers see.</p>
        <label className="mt-3 block max-w-xs space-y-1 text-xs font-medium text-[#563568]">Homepage version<select value={collection} onChange={event => setCollection(event.target.value as "" | "artificial" | "demi-fine")} className="w-full rounded-lg border border-[#E7DCEB] bg-white p-2.5 text-sm"><option value="">Home (existing global curation)</option><option value="artificial">Artificial</option><option value="demi-fine">Demi-Fine</option></select></label>
      </div>
      <span className={isPublished ? "text-xs rounded-full px-3 py-1 bg-green-50 text-green-700" : "text-xs rounded-full px-3 py-1 bg-amber-50 text-amber-700"}>
        {isPublished ? "Published version" : "Unpublished changes"}
      </span>
    </div>
    {error && <p role="alert" className="text-sm text-red-700 bg-red-50 rounded-lg p-3">{error}</p>}
    {message && <p role="status" className="text-sm text-green-800 bg-green-50 rounded-lg p-3">{message}</p>}
    {loading ? <p className="text-sm text-gray-500">Loading product catalogue…</p> : <>
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-medium text-[#302438]">Add products</h3>
            <p className="text-xs text-gray-500">Only active products with stock are available to add.</p>
          </div>
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search products by name…" className="w-full border rounded-lg p-3 text-sm" aria-label="Search products" />
          <div className="max-h-[420px] overflow-y-auto space-y-2">
            {availableProducts.length ? availableProducts.map(product => <article key={product.id} className="flex items-center gap-3 border rounded-xl p-2">
              <img src={product.images?.[0] || "/images/product-placeholder.png"} alt="" className="w-14 h-16 rounded-lg object-cover bg-[#F7F0FA]" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{product.name}</p>
                <p className="text-xs text-gray-500">₹{product.price.toLocaleString("en-IN")} · Stock: {product.stock}</p>
              </div>
              <button type="button" disabled={busy || draft.productIds.length >= MAX_PRODUCTS} onClick={() => add(product.id)} className="rounded-lg bg-[#563568] text-white px-3 py-2 text-xs disabled:opacity-40">Add</button>
            </article>) : <p className="text-xs text-gray-500 border rounded-xl p-4">{search ? "No matching available products." : "No additional active, in-stock products available."}</p>}
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div><h3 className="text-sm font-medium text-[#302438]">Selected collection</h3><p className="text-xs text-gray-500">Move items up or down to set their display order.</p></div>
            <span className="text-xs text-gray-500 tabular-nums">{draft.productIds.length}/{MAX_PRODUCTS}</span>
          </div>
          <div className="space-y-2">
            {draft.productIds.map((id, index) => {
              const product = productById.get(id);
              const available = Boolean(product && product.status === "active" && product.stock > 0);
              return <article key={id} className="flex items-center gap-3 border rounded-xl p-2">
                {product ? <img src={product.images?.[0] || "/images/product-placeholder.png"} alt="" className="w-14 h-16 rounded-lg object-cover bg-[#F7F0FA]" /> : <div className="w-14 h-16 rounded-lg bg-gray-100" />}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{product?.name || "Product no longer found"}</p>
                  <p className={available ? "text-xs text-green-700" : "text-xs text-amber-700"}>{available && product ? "₹" + product.price.toLocaleString("en-IN") + " · Stock: " + product.stock : product ? "Unavailable · " + product.status + ", stock " + product.stock : "Unavailable · product missing"}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <button type="button" aria-label="Move product up" disabled={busy || index === 0} onClick={() => move(index, -1)} className="border rounded px-2 py-1 text-xs disabled:opacity-30">↑</button>
                  <button type="button" aria-label="Move product down" disabled={busy || index === draft.productIds.length - 1} onClick={() => move(index, 1)} className="border rounded px-2 py-1 text-xs disabled:opacity-30">↓</button>
                </div>
                <button type="button" disabled={busy} onClick={() => remove(id)} className="border border-red-200 text-red-700 rounded-lg px-2 py-2 text-xs">Remove</button>
              </article>;
            })}
            {draft.productIds.length === 0 && <p className="text-xs text-gray-500 border rounded-xl p-4">No products selected yet. Add products from the catalogue.</p>}
            {missingIds.length > 0 && <p className="text-xs text-amber-700">{missingIds.length} selected product(s) are no longer in the product catalogue. Remove them before publishing.</p>}
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-[#E7DCEB] bg-[#FBF8FC] p-4 space-y-3">
        <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-medium text-[#302438]">Storefront preview</h3><span className="text-xs text-gray-500">Selected order</span></div>
        {selectedProducts.filter(product => product.status === "active" && product.stock > 0).length ? <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
          {selectedProducts.filter(product => product.status === "active" && product.stock > 0).map((product, index) => <div key={product.id} className="min-w-0">
            <img src={product.images?.[0] || "/images/product-placeholder.png"} alt={product.name} className="w-full aspect-[3/4] rounded-lg object-cover bg-[#F0E6F4]" />
            <p className="text-xs font-medium text-[#302438] truncate mt-2">{index + 1}. {product.name}</p>
            <p className="text-xs text-gray-500">₹{product.price.toLocaleString("en-IN")}</p>
          </div>)}
        </div> : <p className="text-xs text-gray-500">Your selected products will appear here when they are active and in stock.</p>}
      </div>
    </>}
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={busy || loading || missingIds.length > 0} onClick={() => void save()} className="px-4 py-2 rounded-lg border text-sm disabled:opacity-50">{busy ? "Saving…" : "Save draft"}</button>
      <button type="button" disabled={busy || loading || missingIds.length > 0} onClick={() => void publish()} className="px-4 py-2 rounded-lg bg-[#563568] text-white text-sm disabled:opacity-50">{busy ? "Publishing…" : "Publish collection"}</button>
      <button type="button" disabled={busy || loading} onClick={() => void load()} className="px-4 py-2 rounded-lg border text-sm disabled:opacity-50">Reload</button>
      <a href="/" target="_blank" rel="noreferrer" className="px-4 py-2 rounded-lg border text-sm">Preview storefront</a>
    </div>
  </section>;
};
