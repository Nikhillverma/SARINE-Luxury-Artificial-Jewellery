import React, { useEffect, useMemo, useState } from "react";
import { adminProductService } from "../../services";
import type { Product } from "../../types/product";
import { hostingerStorefrontService, type CuratedFavouritesConfig, type EditorialSchedule, type EditorialScheduleStatus } from "../../services/hostinger/hostingerStorefrontService";

const emptyConfig: CuratedFavouritesConfig = { version: 1, productIds: [], configured: false };
const MAX_PRODUCTS = 12;
type Collection = "" | "artificial" | "demi-fine";
type PreviewMode = "desktop" | "tablet" | "mobile";

function toLocalDateTimeInput(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "";
}
function localDateTimeToUtc(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
function collectionLabel(collection: Collection): string {
  return collection === "" ? "Shared (shown in both collections)" : collection === "artificial" ? "Artificial" : "Demi-Fine";
}

export const CuratedFavouritesManager: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [collection, setCollection] = useState<Collection>("");
  const [draft, setDraft] = useState<CuratedFavouritesConfig>(emptyConfig);
  const [published, setPublished] = useState<CuratedFavouritesConfig>(emptyConfig);
  const [savedPreview, setSavedPreview] = useState<CuratedFavouritesConfig | null>(null);
  const [inheritedFrom, setInheritedFrom] = useState<"shared" | null>(null);
  const [schedule, setSchedule] = useState<EditorialSchedule | null>(null);
  const [scheduleStatus, setScheduleStatus] = useState<EditorialScheduleStatus>("none");
  const [scheduleCollection, setScheduleCollection] = useState<"shared" | "artificial" | "demi-fine" | null>(null);
  const [scheduleStartLocal, setScheduleStartLocal] = useState("");
  const [scheduleEndLocal, setScheduleEndLocal] = useState("");
  const [showPublishReview, setShowPublishReview] = useState(false);
  const [showScheduleReview, setShowScheduleReview] = useState(false);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("desktop");
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
  const savedPreviewIsCurrent = Boolean(savedPreview && JSON.stringify(savedPreview) === JSON.stringify(draft));
  const addedIds = draft.productIds.filter(id => !published.productIds.includes(id));
  const removedIds = published.productIds.filter(id => !draft.productIds.includes(id));
  const reordered = !addedIds.length && !removedIds.length && draft.productIds.some((id, index) => published.productIds[index] !== id);
  const changes = addedIds.length + removedIds.length + (reordered ? 1 : 0);
  const previewIds = savedPreview?.productIds || [];
  const previewProducts = previewIds.map(id => productById.get(id)).filter((product): product is Product => Boolean(product && product.status === "active" && product.stock > 0));
  const inheritedSharedSchedule = Boolean(schedule && scheduleCollection === "shared" && collection !== "");
  const previewWidth = previewMode === "mobile" ? "max-w-[390px]" : previewMode === "tablet" ? "max-w-[768px]" : "max-w-none";

  const load = async (isCancelled: () => boolean = () => false) => {
    setLoading(true); setError(""); setMessage("");
    try {
      const [catalogue, config] = await Promise.all([
        adminProductService.getProducts(),
        hostingerStorefrontService.getCuratedFavourites(collection || undefined)
      ]);
      if (isCancelled()) return;
      setProducts(collection ? catalogue.filter(product => product.productCollection === collection) : catalogue);
      setDraft(config.draft);
      setPublished(config.published);
      setSavedPreview(null);
      setInheritedFrom(config.inheritedFrom || null);
      setSchedule(config.schedule || null);
      setScheduleStatus(config.scheduleStatus || "none");
      setScheduleCollection(config.scheduleCollection || null);
      setScheduleStartLocal(toLocalDateTimeInput(config.schedule?.startsAtUtc));
      setScheduleEndLocal(toLocalDateTimeInput(config.schedule?.endsAtUtc));
      setShowPublishReview(false);
      setShowScheduleReview(false);
    } catch (e) {
      if (!isCancelled()) setError(e instanceof Error ? e.message : "Could not load Curated Favourites.");
    } finally { if (!isCancelled()) setLoading(false); }
  };

  useEffect(() => {
    let cancelled = false;
    setProducts([]); setDraft(emptyConfig); setPublished(emptyConfig); setSavedPreview(null);
    void load(() => cancelled);
    return () => { cancelled = true; };
  }, [collection]);

  const updateIds = (productIds: string[]) => {
    setDraft({ version: 1, productIds, configured: true });
    setMessage(""); setShowPublishReview(false); setShowScheduleReview(false);
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
    setBusy(true); setError(""); setMessage(""); setShowPublishReview(false); setShowScheduleReview(false);
    try {
      const result = await hostingerStorefrontService.saveCuratedFavourites(draft, collection || undefined);
      setDraft(result.draft);
      setSavedPreview(result.draft);
      setMessage("Draft saved. The preview now shows this exact saved product selection; customers still see the published version.");
    } catch (e) { setError(e instanceof Error ? e.message : "Draft could not be saved."); }
    finally { setBusy(false); }
  };

  const publish = async () => {
    if (!savedPreviewIsCurrent || missingIds.length) return;
    setBusy(true); setError(""); setMessage(""); setShowPublishReview(false);
    try {
      const result = await hostingerStorefrontService.publishCuratedFavourites(collection || undefined);
      setDraft(result.published);
      setPublished(result.published);
      setSavedPreview(result.published);
      setSchedule(null); setScheduleStatus("none"); setScheduleCollection(null);
      setScheduleStartLocal(""); setScheduleEndLocal("");
      setMessage("Curated Favourites published successfully for " + collectionLabel(collection) + ".");
    } catch (e) { setError(e instanceof Error ? e.message : "Curated Favourites could not be published."); }
    finally { setBusy(false); }
  };

  const reviewSchedule = () => {
    if (!savedPreviewIsCurrent || missingIds.length) { setError("Save the current product selection and refresh its preview before scheduling."); return; }
    const start = localDateTimeToUtc(scheduleStartLocal);
    const end = scheduleEndLocal ? localDateTimeToUtc(scheduleEndLocal) : null;
    if (!start || new Date(start).getTime() <= Date.now()) { setError("Choose a valid future publication date and time."); return; }
    if (scheduleEndLocal && (!end || new Date(end).getTime() <= new Date(start).getTime())) { setError("Expiry must be later than the publication time."); return; }
    setError(""); setShowScheduleReview(true);
  };

  const confirmSchedule = async () => {
    const start = localDateTimeToUtc(scheduleStartLocal);
    const end = scheduleEndLocal ? localDateTimeToUtc(scheduleEndLocal) : null;
    if (!start) return;
    setBusy(true); setError(""); setMessage(""); setShowScheduleReview(false);
    try {
      const result = await hostingerStorefrontService.scheduleCuratedFavourites(start, end, collection || undefined);
      setSchedule(result.schedule);
      setScheduleStatus(result.scheduleStatus);
      setScheduleCollection(result.scheduleCollection || null);
      setScheduleStartLocal(toLocalDateTimeInput(result.schedule.startsAtUtc));
      setScheduleEndLocal(toLocalDateTimeInput(result.schedule.endsAtUtc));
      setMessage("A saved " + collectionLabel(collection) + " selection has been scheduled. Later draft edits will not change this scheduled version.");
    } catch (e) { setError(e instanceof Error ? e.message : "Curated Favourites could not be scheduled."); }
    finally { setBusy(false); }
  };

  const cancelSchedule = async () => {
    if (!window.confirm(inheritedSharedSchedule
      ? "Clear the Shared Curated Favourites schedule? This removes the scheduled selection for both collections."
      : "Clear this scheduled Curated Favourites selection?")) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await hostingerStorefrontService.cancelCuratedFavouritesSchedule(collection || undefined);
      setSchedule(result.schedule || null);
      setScheduleStatus(result.scheduleStatus || "none");
      setScheduleCollection(result.scheduleCollection || null);
      setScheduleStartLocal(""); setScheduleEndLocal("");
      setShowScheduleReview(false);
      setMessage("The scheduled Curated Favourites selection was cleared.");
    } catch (e) { setError(e instanceof Error ? e.message : "Schedule could not be cancelled."); }
    finally { setBusy(false); }
  };

  const tabClass = (active: boolean) => "rounded-lg px-3 py-2 text-xs font-medium " + (active ? "bg-[#563568] text-white" : "border border-[#E7DCEB] bg-white text-[#563568]");

  return <section className="bg-white border rounded-2xl p-5 space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="font-semibold text-[#2C1838]">Curated Favourites</h2>
        <p className="text-xs text-gray-500 mt-1">Choose up to {MAX_PRODUCTS} active, in-stock products and arrange the exact order customers see.</p>
        <label className="mt-3 block max-w-xs space-y-1 text-xs font-medium text-[#563568]">Homepage version
          <select value={collection} disabled={loading || busy} onChange={event => setCollection(event.target.value as Collection)} className="w-full rounded-lg border border-[#E7DCEB] bg-white p-2.5 text-sm">
            <option value="">Shared (shown in both collections)</option><option value="artificial">Artificial</option><option value="demi-fine">Demi-Fine</option>
          </select>
        </label>
        {inheritedFrom === "shared" && collection && <p className="mt-2 text-xs text-[#7B6485]">This version currently inherits the Shared selection. Saving or publishing here creates an independent {collectionLabel(collection)} version.</p>}
      </div>
      <span className={isPublished ? "text-xs rounded-full px-3 py-1 bg-green-50 text-green-700" : "text-xs rounded-full px-3 py-1 bg-amber-50 text-amber-700"}>{isPublished ? "Published version" : "Unpublished changes"}</span>
    </div>
    {error && <p role="alert" className="text-sm text-red-700 bg-red-50 rounded-lg p-3">{error}</p>}
    {message && <p role="status" className="text-sm text-green-800 bg-green-50 rounded-lg p-3">{message}</p>}

    {loading ? <p className="text-sm text-gray-500">Loading product catalogue…</p> : <>
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="space-y-3">
          <div><h3 className="text-sm font-medium text-[#302438]">Add products</h3><p className="text-xs text-gray-500">Only active products with stock are available to add.</p></div>
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search products by name…" className="w-full border rounded-lg p-3 text-sm" aria-label="Search products" />
          <div className="max-h-[420px] overflow-y-auto space-y-2">
            {availableProducts.length ? availableProducts.map(product => <article key={product.id} className="flex items-center gap-3 border rounded-xl p-2">
              <img src={product.images?.[0] || "/images/product-placeholder.png"} alt="" className="w-14 h-16 rounded-lg object-cover bg-[#F7F0FA]" />
              <div className="min-w-0 flex-1"><p className="text-sm font-medium truncate">{product.name}</p><p className="text-xs text-gray-500">₹{product.price.toLocaleString("en-IN")} · Stock: {product.stock}</p></div>
              <button type="button" disabled={busy || draft.productIds.length >= MAX_PRODUCTS} onClick={() => add(product.id)} className="rounded-lg bg-[#563568] text-white px-3 py-2 text-xs disabled:opacity-40">Add</button>
            </article>) : <p className="text-xs text-gray-500 border rounded-xl p-4">{search ? "No matching available products." : "No additional active, in-stock products available."}</p>}
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2"><div><h3 className="text-sm font-medium text-[#302438]">Selected collection</h3><p className="text-xs text-gray-500">Move items up or down to set their display order.</p></div><span className="text-xs text-gray-500 tabular-nums">{draft.productIds.length}/{MAX_PRODUCTS}</span></div>
          <div className="space-y-2">
            {draft.productIds.map((id, index) => {
              const product = productById.get(id);
              const available = Boolean(product && product.status === "active" && product.stock > 0);
              return <article key={id} className="flex items-center gap-3 border rounded-xl p-2">
                {product ? <img src={product.images?.[0] || "/images/product-placeholder.png"} alt="" className="w-14 h-16 rounded-lg object-cover bg-[#F7F0FA]" /> : <div className="w-14 h-16 rounded-lg bg-gray-100" />}
                <div className="min-w-0 flex-1"><p className="text-sm font-medium truncate">{product?.name || "Product no longer found"}</p><p className={available ? "text-xs text-green-700" : "text-xs text-amber-700"}>{available && product ? "₹" + product.price.toLocaleString("en-IN") + " · Stock: " + product.stock : product ? "Unavailable · " + product.status + ", stock " + product.stock : "Unavailable · product missing"}</p></div>
                <div className="flex flex-col gap-1"><button type="button" aria-label="Move product up" disabled={busy || index === 0} onClick={() => move(index, -1)} className="border rounded px-2 py-1 text-xs disabled:opacity-30">↑</button><button type="button" aria-label="Move product down" disabled={busy || index === draft.productIds.length - 1} onClick={() => move(index, 1)} className="border rounded px-2 py-1 text-xs disabled:opacity-30">↓</button></div>
                <button type="button" disabled={busy} onClick={() => remove(id)} className="border border-red-200 text-red-700 rounded-lg px-2 py-2 text-xs">Remove</button>
              </article>;
            })}
            {draft.productIds.length === 0 && <p className="text-xs text-gray-500 border rounded-xl p-4">No products selected yet. Add products from the catalogue.</p>}
            {missingIds.length > 0 && <p className="text-xs text-amber-700">{missingIds.length} selected product(s) are no longer in the product catalogue. Remove them before publishing.</p>}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[#E7DCEB] bg-[#FBF8FC] p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-sm font-medium text-[#302438]">Responsive saved preview</h3><p className="text-xs text-gray-500">Preview uses the saved draft snapshot, not unsaved changes.</p></div><div className="flex gap-1">{(["desktop", "tablet", "mobile"] as PreviewMode[]).map(mode => <button key={mode} type="button" onClick={() => setPreviewMode(mode)} className={tabClass(previewMode === mode)}>{mode[0].toUpperCase() + mode.slice(1)}</button>)}</div></div>
        {!savedPreviewIsCurrent && <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">Preview needs refreshing after draft changes. Customers continue seeing the published selection.</p>}
        <div className={"mx-auto w-full " + previewWidth + " transition-all"}>
          <div className="rounded-lg border border-[#E5D9EA] bg-white p-3">
            <div className={"grid gap-3 " + (previewMode === "mobile" ? "grid-cols-2" : previewMode === "tablet" ? "grid-cols-3" : "grid-cols-4")}>
              {previewProducts.map((product, index) => <article key={product.id} className="min-w-0">
                <img src={product.images?.[0] || "/images/product-placeholder.png"} alt={product.name} className="w-full aspect-[3/4] rounded-lg object-cover bg-[#F0E6F4]" />
                <p className="mt-2 text-xs font-medium text-[#302438] line-clamp-2">{index + 1}. {product.name}</p><p className="text-xs text-gray-500">₹{product.price.toLocaleString("en-IN")}</p>
              </article>)}
            </div>
            {savedPreview && previewProducts.length === 0 && <p className="text-xs text-gray-500">No active, in-stock products in this saved selection.</p>}
            {!savedPreview && <p className="text-xs text-gray-500">Save draft & refresh preview to inspect the exact saved selection.</p>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2"><button type="button" disabled={busy || loading} onClick={() => void save()} className="rounded-lg bg-[#563568] px-4 py-2 text-xs font-medium text-white disabled:opacity-50">Save draft & refresh preview</button></div>
      </div>

      <div className="rounded-xl border border-[#E7DCEB] p-4 space-y-2">
        <h3 className="text-sm font-semibold text-[#302438]">Draft vs published comparison</h3>
        {isPublished ? <p className="text-xs text-green-700">The selected version matches its published selection.</p> : <div className="space-y-1 text-xs text-[#6F6475]"><p>{addedIds.length} product(s) added · {removedIds.length} removed{reordered ? " · display order changed" : ""}</p>{addedIds.length > 0 && <p>Added: {addedIds.map(id => productById.get(id)?.name || id).join(", ")}</p>}{removedIds.length > 0 && <p>Removed: {removedIds.map(id => productById.get(id)?.name || id).join(", ")}</p>}</div>}
        <p className="text-[11px] text-gray-500">Comparison covers selected product IDs and their display order. It does not modify product details or Explore Now.</p>
        {savedPreviewIsCurrent ? <p className="text-xs text-green-700">Saved preview is up to date.</p> : <p className="text-xs text-amber-700">Save draft & refresh preview before reviewing publication or scheduling.</p>}
      </div>

      <div className="rounded-xl border border-[#E7DCEB] p-4 space-y-3">
        <div><h3 className="text-sm font-semibold text-[#302438]">Scheduled Curated Favourites</h3><p className="mt-1 text-xs text-gray-500">Uses your local time zone. The saved product selection becomes active at the start time; the previous published selection returns at expiry. Later draft edits do not change an existing schedule.</p></div>
        <p className="text-xs font-medium text-[#563568]">{scheduleStatus === "scheduled" ? "Scheduled — waiting to go live" : scheduleStatus === "published" ? "Scheduled selection is currently live" : scheduleStatus === "expired" ? "Schedule expired — previous selection restored" : "Not scheduled"}</p>
        {schedule && <p className="text-xs text-gray-600">Start: {new Date(schedule.startsAtUtc).toLocaleString()}{schedule.endsAtUtc ? " · Expiry: " + new Date(schedule.endsAtUtc).toLocaleString() : " · No expiry"}</p>}
        {inheritedSharedSchedule && <p className="rounded-lg bg-[#F7F0FA] p-3 text-xs text-[#563568]">This schedule is inherited from Shared and applies to both collections. Manage or reschedule it from Shared. You may cancel it here for both collections.</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium text-[#302438]">Publish date & time (local)<input type="datetime-local" value={scheduleStartLocal} disabled={busy || loading || inheritedSharedSchedule} onChange={event => setScheduleStartLocal(event.target.value)} className="mt-1 w-full rounded-lg border border-[#E7DCEB] bg-white px-3 py-2 text-sm" /></label>
          <label className="block text-xs font-medium text-[#302438]">Expiry date & time (optional)<input type="datetime-local" value={scheduleEndLocal} disabled={busy || loading || inheritedSharedSchedule} onChange={event => setScheduleEndLocal(event.target.value)} className="mt-1 w-full rounded-lg border border-[#E7DCEB] bg-white px-3 py-2 text-sm" /></label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy || loading || !savedPreviewIsCurrent || missingIds.length > 0 || inheritedSharedSchedule} onClick={reviewSchedule} className="rounded-lg bg-[#563568] px-4 py-2 text-xs font-medium text-white disabled:opacity-50">{scheduleStatus === "scheduled" ? "Review reschedule" : "Review schedule"}</button>
          {schedule && <button type="button" disabled={busy || loading} onClick={() => void cancelSchedule()} className="rounded-lg border border-[#DCCDE5] bg-white px-4 py-2 text-xs text-[#563568]">{inheritedSharedSchedule ? "Cancel Shared schedule (both collections)" : "Cancel schedule"}</button>}
        </div>
      </div>

      {showScheduleReview && <div className="rounded-xl border-2 border-[#B69ACF] bg-[#F7F0FA] p-4 space-y-3" role="alertdialog" aria-labelledby="curated-schedule-title">
        <h3 id="curated-schedule-title" className="text-sm font-semibold text-[#302438]">Confirm scheduled Curated Favourites</h3>
        <p className="text-xs text-[#6F6475]">Schedule the saved <strong>{collectionLabel(collection)}</strong> selection of <strong>{draft.productIds.length} product(s)</strong> for <strong>{new Date(scheduleStartLocal).toLocaleString()}</strong>{scheduleEndLocal ? <> until <strong>{new Date(scheduleEndLocal).toLocaleString()}</strong>.</> : " with no expiry."}</p>
        <div className="flex gap-2"><button type="button" disabled={busy} onClick={() => void confirmSchedule()} className="rounded-lg bg-[#563568] px-4 py-2 text-xs font-medium text-white">Confirm schedule</button><button type="button" disabled={busy} onClick={() => setShowScheduleReview(false)} className="rounded-lg border border-[#DCCDE5] bg-white px-4 py-2 text-xs">Cancel</button></div>
      </div>}

      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy || loading || missingIds.length > 0 || !savedPreviewIsCurrent} onClick={() => setShowPublishReview(true)} className="px-4 py-2 rounded-lg bg-[#563568] text-white text-sm disabled:opacity-50">Review & publish collection</button>
        <button type="button" disabled={busy || loading} onClick={() => void load()} className="px-4 py-2 rounded-lg border text-sm disabled:opacity-50">Reload</button>
        <a href="/" target="_blank" rel="noreferrer" className="px-4 py-2 rounded-lg border text-sm">Preview storefront</a>
      </div>
      {showPublishReview && <div className="rounded-xl border-2 border-[#B69ACF] bg-[#F7F0FA] p-4 space-y-3" role="alertdialog" aria-labelledby="curated-publish-title">
        <h3 id="curated-publish-title" className="text-sm font-semibold text-[#302438]">Review publication</h3>
        <p className="text-xs text-[#6F6475]">You are publishing the saved <strong>{collectionLabel(collection)}</strong> Curated Favourites selection with <strong>{draft.productIds.length} product(s)</strong>. {changes ? `${changes} comparison change(s) are included.` : "The saved selection matches the current published version."} This will not change product details, product images, or Explore Now.</p>
        <div className="flex gap-2"><button type="button" disabled={busy} onClick={() => void publish()} className="rounded-lg bg-[#563568] px-4 py-2 text-xs font-medium text-white">Confirm and publish</button><button type="button" disabled={busy} onClick={() => setShowPublishReview(false)} className="rounded-lg border border-[#DCCDE5] bg-white px-4 py-2 text-xs">Cancel</button></div>
      </div>}
    </>}
  </section>;
};
