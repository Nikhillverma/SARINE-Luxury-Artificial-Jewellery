import React, { useEffect, useMemo, useState } from "react";
import { hostingerStorefrontService, type HomepageLayout, type ExploreNowConfig } from "../../services/hostinger/hostingerStorefrontService";
import { adminProductService } from "../../services";
import type { Product } from "../../types/product";

const sectionLabels: Record<string, { title: string; description: string }> = {
  hero: { title: "Hero Banner", description: "The first homepage feature. Banner artwork and slides are edited in the Hero Banners controls below." },
  categories: { title: "Shop by Category Carousel", description: "Swipe or tap through active jewellery categories. Adjust the number of cards shown on desktop." },
  "shop-by-gender": { title: "Shop by Gender", description: "The two independently managed For Her and For Him image tiles." },
  "new-arrivals": { title: "New Arrivals Carousel", description: "Swipe, drag or use arrows to browse newest products. Adjust desktop card count." },
  "best-sellers": { title: "Best Sellers Carousel", description: "Swipe, drag or use arrows to browse genuine best sellers. Adjust desktop card count." },
  "curated-favourites": { title: "Curated Favourites Carousel", description: "Swipe, drag or use arrows through your manually selected products. Adjust desktop card count." },
  occasions: { title: "Shop by Occasion Carousel", description: "Swipe, drag or use arrows through occasion cards. Adjust desktop card count." },
  "explore-now": { title: "Explore Now — Product Grid", description: "A fresh random product selection on every visit. Manage the eligible product pool and display count below." },
  price: { title: "Shop by Price", description: "The four preset price-navigation links." },
  "our-story": { title: "Our Story", description: "Brand story, image and three brand pillars." },
  editorial: { title: "Editorial Collection", description: "Uses the separate Editorial Collection content controls below." },
  "care-guide": { title: "Jewellery Care Guide", description: "The jewellery care and storage guidance section." },
  "stay-in-touch": { title: "Stay in Touch", description: "The final customer-care and contact invitation section." }
};

const adjustableCarousels = new Set(["categories", "new-arrivals", "best-sellers", "curated-favourites", "occasions"]);
const defaultExplore: ExploreNowConfig = { version: 1, productIds: [], displayCount: 8, configured: false };

const defaultLayout: HomepageLayout = {
  version: 1,
  sections: ["hero", ...Object.keys(sectionLabels).filter(id => id !== "hero")]
    .map((id, sortOrder) => ({ id, enabled: true, sortOrder, ...(adjustableCarousels.has(id) ? { carouselEnabled: true, cardsPerView: 5 } : {}) }))
};

function mergeKnownSections(layout: HomepageLayout): HomepageLayout {
  const existing = Array.isArray(layout?.sections) ? layout.sections : [];
  const knownOrder = new Map(defaultLayout.sections.map((section, index) => [section.id, index]));
  const merged = existing.map(section => adjustableCarousels.has(section.id)
    ? { ...section, carouselEnabled: section.carouselEnabled !== false, cardsPerView: section.cardsPerView ?? 5 }
    : section);
  const existingIds = new Set(merged.map(section => section.id));

  // Add sections introduced by newer releases beside their canonical neighbours,
  // without disturbing the order an administrator has already customised.
  for (const addition of defaultLayout.sections.filter(section => !existingIds.has(section.id))) {
    const canonicalIndex = knownOrder.get(addition.id) ?? Number.MAX_SAFE_INTEGER;
    const insertAt = merged.findIndex(section => (knownOrder.get(section.id) ?? Number.MAX_SAFE_INTEGER) > canonicalIndex);
    if (insertAt === -1) merged.push(addition);
    else merged.splice(insertAt, 0, addition);
  }

  return { version: 1, sections: merged.map((section, sortOrder) => ({ ...section, sortOrder })) };
}

export const HomepageSectionManager: React.FC = () => {
  const [collection, setCollection] = useState<"shared" | "artificial" | "demi-fine">("shared");
  const [draft, setDraft] = useState<HomepageLayout>(defaultLayout);
  const [published, setPublished] = useState<HomepageLayout>(defaultLayout);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [exploreDraft, setExploreDraft] = useState<ExploreNowConfig>(defaultExplore);
  const [explorePublished, setExplorePublished] = useState<ExploreNowConfig>(defaultExplore);
  const [products, setProducts] = useState<Product[]>([]);
  const [exploreBusy, setExploreBusy] = useState(false);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [previewVersion, setPreviewVersion] = useState(0);
  const [previewSnapshot, setPreviewSnapshot] = useState<HomepageLayout | null>(null);
  const [showPublishConfirmation, setShowPublishConfirmation] = useState(false);

  const ordered = useMemo(() => [...draft.sections].sort((a, b) => a.sortOrder - b.sortOrder), [draft]);
  const isPublished = JSON.stringify(draft) === JSON.stringify(published);
  const hasPreviewedCurrentDraft = previewSnapshot !== null && JSON.stringify(draft) === JSON.stringify(previewSnapshot);
  const sectionChanges = useMemo(() => {
    const before = new Map(published.sections.map(section => [section.id, section]));
    const after = new Map(draft.sections.map(section => [section.id, section]));
    const changes: string[] = [];
    for (const section of draft.sections) {
      const previous = before.get(section.id);
      const label = sectionLabels[section.id]?.title || section.id;
      if (!previous) { changes.push(`${label}: added`); continue; }
      if (previous.sortOrder !== section.sortOrder) changes.push(`${label}: position changed`);
      if (previous.enabled !== section.enabled) changes.push(`${label}: ${section.enabled ? "shown" : "hidden"}`);
      if (adjustableCarousels.has(section.id) && previous.carouselEnabled !== section.carouselEnabled) changes.push(`${label}: carousel ${section.carouselEnabled === false ? "off" : "on"}`);
      if (adjustableCarousels.has(section.id) && (previous.cardsPerView ?? 5) !== (section.cardsPerView ?? 5)) changes.push(`${label}: desktop cards ${previous.cardsPerView ?? 5} → ${section.cardsPerView ?? 5}`);
    }
    for (const section of published.sections) if (!after.has(section.id)) changes.push(`${sectionLabels[section.id]?.title || section.id}: removed`);
    return changes;
  }, [draft, published]);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [result, explore, catalogue] = await Promise.all([
        hostingerStorefrontService.getHomepageLayout(collection === "shared" ? undefined : collection),
        hostingerStorefrontService.getExploreNow(),
        adminProductService.getProducts()
      ]);
      setDraft(mergeKnownSections(result.draft));
      setPublished(mergeKnownSections(result.published));
      setPreviewSnapshot(null);
      setShowPublishConfirmation(false);
      setExploreDraft(explore.draft);
      setExplorePublished(explore.published);
      setProducts(catalogue);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load homepage layout settings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [collection]);

  const updateSections = (next: HomepageLayout["sections"]) => {
    setDraft({ version: 1, sections: next.map((section, sortOrder) => ({ ...section, sortOrder })) });
    setMessage("");
  };

  const move = (index: number, direction: -1 | 1) => {
    const next = [...ordered];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    updateSections(next);
  };

  const toggle = (id: string, enabled: boolean) => {
    updateSections(ordered.map(section => section.id === id ? { ...section, enabled } : section));
  };

  const updateCardsPerView = (id: string, cardsPerView: number) => {
    updateSections(ordered.map(section => section.id === id ? { ...section, cardsPerView } : section));
  };

  const updateCarouselEnabled = (id: string, carouselEnabled: boolean) => {
    updateSections(ordered.map(section => section.id === id ? { ...section, carouselEnabled } : section));
  };

  const save = async (): Promise<boolean> => {
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await hostingerStorefrontService.saveHomepageLayout(draft, collection === "shared" ? undefined : collection);
      const saved = mergeKnownSections(result.draft);
      setDraft(saved);
      setPreviewSnapshot(saved);
      setMessage("Draft saved. Customers will continue seeing the currently published homepage until you publish.");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Homepage layout draft could not be saved.");
      return false;
    } finally { setBusy(false); }
  };

  const saveAndRefreshPreview = async () => {
    if (await save()) setPreviewVersion(value => value + 1);
  };

  const saveExplore = async (publishAfterSave: boolean) => {
    setExploreBusy(true); setError(""); setMessage("");
    try {
      const saved = await hostingerStorefrontService.saveExploreNow({ ...exploreDraft, configured: exploreDraft.productIds.length > 0 });
      if (publishAfterSave) {
        const result = await hostingerStorefrontService.publishExploreNow();
        setExplorePublished(result.published); setExploreDraft(result.published);
        setMessage("Explore Now settings published successfully.");
      } else { setExploreDraft(saved.draft); setMessage("Explore Now draft saved. Publish it when ready."); }
    } catch (e) { setError(e instanceof Error ? e.message : "Explore Now settings could not be saved."); }
    finally { setExploreBusy(false); }
  };

  const requestPublish = () => {
    if (!hasPreviewedCurrentDraft) {
      setError("Save draft & refresh preview before publishing. This ensures you review the exact layout version that will go live.");
      return;
    }
    setError("");
    setShowPublishConfirmation(true);
  };

  const publish = async () => {
    setBusy(true); setError(""); setMessage(""); setShowPublishConfirmation(false);
    try {
      const result = await hostingerStorefrontService.publishHomepageLayout(collection === "shared" ? undefined : collection);
      const live = mergeKnownSections(result.published);
      setPublished(live);
      setDraft(live);
      setPreviewSnapshot(live);
      setMessage(`${collection === "shared" ? "Shared" : collection === "artificial" ? "Artificial" : "Demi-Fine"} homepage layout published successfully.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Homepage layout could not be published.");
    } finally { setBusy(false); }
  };

  return <section className="bg-white border rounded-2xl p-5 space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="font-semibold text-[#2C1838]">Homepage Sections</h2>
        <p className="text-xs text-gray-500 mt-1">Reorder homepage sections, control visibility, and adjust carousel layouts. Each collection can have its own layout; new collection layouts inherit Shared settings until saved separately.</p>
      </div>
      <span className={isPublished ? "text-xs rounded-full px-3 py-1 bg-green-50 text-green-700" : "text-xs rounded-full px-3 py-1 bg-amber-50 text-amber-700"}>
        {isPublished ? "Published version" : "Unpublished changes"}
      </span>
    </div>
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#E7DCEB] bg-[#F7F0FA]/50 p-3">
      <label className="text-xs font-medium text-[#302438]" htmlFor="homepage-layout-collection">Homepage version</label>
      <select id="homepage-layout-collection" value={collection} disabled={busy || loading} onChange={event => { setCollection(event.target.value as typeof collection); setMessage(""); }} className="rounded-lg border border-[#E7DCEB] bg-white px-3 py-2 text-sm text-[#563568]">
        <option value="shared">Shared (both collections)</option>
        <option value="artificial">Artificial</option>
        <option value="demi-fine">Demi-Fine</option>
      </select>
      <span className="text-xs text-[#6F6475]">{collection === "shared" ? "Changes apply to the shared homepage layout." : `This ${collection === "artificial" ? "Artificial" : "Demi-Fine"} layout starts from Shared settings until you save a collection-specific draft.`}</span>
    </div>
    <div className="rounded-xl border border-[#E7DCEB] bg-white p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h3 className="text-sm font-semibold text-[#302438]">Responsive homepage preview</h3>
          <p className="mt-1 text-xs text-[#6F6475]">Preview the saved draft layout in a desktop or mobile viewport. Save your latest section changes first to refresh this preview.</p></div>
        <div className="flex gap-2" role="group" aria-label="Preview size">
          <button type="button" aria-pressed={previewMode === "desktop"} onClick={() => setPreviewMode("desktop")} className={`rounded-lg border px-3 py-2 text-xs ${previewMode === "desktop" ? "border-[#563568] bg-[#F7F0FA] text-[#563568]" : "border-[#E7DCEB] text-[#6F6475]"}`}>Desktop</button>
          <button type="button" aria-pressed={previewMode === "mobile"} onClick={() => setPreviewMode("mobile")} className={`rounded-lg border px-3 py-2 text-xs ${previewMode === "mobile" ? "border-[#563568] bg-[#F7F0FA] text-[#563568]" : "border-[#E7DCEB] text-[#6F6475]"}`}>Mobile</button>
        </div>
      </div>
      <div className="flex justify-center overflow-x-auto rounded-lg bg-[#F1EDF3] p-3">
        <div className={previewMode === "mobile" ? "w-[390px] max-w-full shrink-0 overflow-hidden rounded-xl border border-[#DCCDE5] bg-white shadow-sm" : "w-full min-w-[320px] overflow-hidden rounded-xl border border-[#DCCDE5] bg-white shadow-sm"}>
          <iframe key={previewVersion + "-" + collection + "-" + previewMode}
            title={`SARINE ${collection} homepage ${previewMode} draft preview`}
            src={`/?range=${collection === "shared" ? "home" : collection}&adminPreview=1&previewCollection=${collection}`}
            className="block w-full border-0 bg-white" style={{ height: previewMode === "mobile" ? "760px" : "760px" }}
            loading="lazy" />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={busy || loading} onClick={() => void saveAndRefreshPreview()} className="rounded-lg bg-[#563568] px-4 py-2 text-xs font-medium text-white disabled:opacity-50">Save draft & refresh preview</button>
        <span className="text-[11px] text-[#6F6475]">{hasPreviewedCurrentDraft ? "Preview is up to date with this saved draft." : "Preview needs refreshing after any draft changes. Customers continue seeing the published layout."}</span>
      </div>
    </div>
    {error && <p role="alert" className="text-sm text-red-700 bg-red-50 rounded-lg p-3">{error}</p>}
    {message && <p role="status" className="text-sm text-green-800 bg-green-50 rounded-lg p-3">{message}</p>}
    {loading ? <p className="text-sm text-gray-500">Loading homepage layout…</p> : <div className="space-y-2">
      {ordered.map((section, index) => {
        const info = sectionLabels[section.id] || { title: section.id, description: "" };
        return <article key={section.id} className="flex flex-wrap items-center gap-3 border rounded-xl p-3">
          <div className="flex flex-col gap-1">
            <button type="button" disabled={busy || index === 0} onClick={() => move(index, -1)} aria-label={`Move ${info.title} up`} className="border rounded px-2 py-1 text-xs disabled:opacity-30">↑</button>
            <button type="button" disabled={busy || index === ordered.length - 1} onClick={() => move(index, 1)} aria-label={`Move ${info.title} down`} className="border rounded px-2 py-1 text-xs disabled:opacity-30">↓</button>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[#302438]">{index + 1}. {info.title}</p>
            <p className="text-xs text-gray-500">{info.description}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {adjustableCarousels.has(section.id) && <>
              <label className="flex items-center gap-2 text-xs text-gray-600">
                Carousel
                <input type="checkbox" checked={section.carouselEnabled !== false} disabled={busy} onChange={event => updateCarouselEnabled(section.id, event.target.checked)} className="h-4 w-4" />
                <span>{section.carouselEnabled === false ? "Off — grid layout" : "On — swipe & arrows"}</span>
              </label>
              <label className="flex items-center gap-2 text-xs text-gray-600">
                Desktop cards
                <select aria-label={`Desktop cards for ${info.title}`} value={section.cardsPerView ?? 5} disabled={busy} onChange={event => updateCardsPerView(section.id, Number(event.target.value))} className="rounded-lg border border-[#E7DCEB] bg-white px-2 py-1.5 text-xs text-[#302438]">
                  {[2, 3, 4, 5, 6, 7, 8].map(count => <option key={count} value={count}>{count}</option>)}
                </select>
              </label>
            </>}
            <label className="flex items-center gap-2 text-xs font-medium">
              <input type="checkbox" checked={section.enabled} disabled={busy} onChange={event => toggle(section.id, event.target.checked)} className="h-4 w-4" />
              Visible
            </label>
          </div>
        </article>;
      })}
    </div>}
    <div className="rounded-xl border border-[#E7DCEB] bg-[#F7F0FA]/60 p-4 space-y-3">
      <div><h3 className="text-sm font-semibold text-[#302438]">Explore Now — Product Selection</h3>
      <p className="mt-1 text-xs text-[#6F6475]">Choose the products eligible for random display. The order is shuffled for each homepage visit. Curated Favourites remains completely separate.</p></div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs font-medium text-[#302438]">Products initially shown
          <select value={exploreDraft.displayCount} disabled={exploreBusy || loading} onChange={e => setExploreDraft(v => ({ ...v, displayCount: Number(e.target.value) }))} className="ml-2 rounded-lg border border-[#E7DCEB] bg-white px-3 py-2">
            {[4,6,8,10,12,16,20,24].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <span className="text-xs text-[#6F6475]">{exploreDraft.productIds.length} selected / {products.filter(p => p.status === "active" && p.stock > 0).length} active in-stock products</span>
      </div>
      <div className="max-h-72 overflow-y-auto rounded-lg border border-[#E7DCEB] bg-white divide-y divide-[#F0E8F3]">
        {products.filter(p => p.status === "active" && p.stock > 0).map(product => (
          <label key={product.id} className="flex items-center gap-3 px-3 py-2.5 text-xs">
            <input type="checkbox" checked={exploreDraft.productIds.includes(product.id)} disabled={exploreBusy || loading || (!exploreDraft.productIds.includes(product.id) && exploreDraft.productIds.length >= 100)} onChange={e => setExploreDraft(v => ({ ...v, productIds: e.target.checked ? [...v.productIds, product.id] : v.productIds.filter(id => id !== product.id) }))} className="h-4 w-4 accent-[#563568]" />
            <span className="min-w-0 flex-1 truncate text-[#302438]">{product.name}</span>
            <span className="text-[#6F6475]">₹{product.price.toLocaleString("en-IN")}</span>
          </label>
        ))}
        {!products.some(p => p.status === "active" && p.stock > 0) && <p className="p-4 text-xs text-gray-500">No active, in-stock products are available to select.</p>}
      </div>
      <p className="text-[11px] text-[#6F6475]">Only active, in-stock products are eligible. Up to 100 products can be selected. The homepage displays up to the configured count; there is no expand button.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={exploreBusy || loading} onClick={() => void saveExplore(false)} className="rounded-lg border border-[#DCCDE5] bg-white px-4 py-2 text-xs font-medium text-[#563568]">Save Explore Now draft</button>
        <button type="button" disabled={exploreBusy || loading} onClick={() => void saveExplore(true)} className="rounded-lg bg-[#563568] px-4 py-2 text-xs font-medium text-white">{exploreBusy ? "Saving…" : "Publish Explore Now"}</button>
        <span className="self-center text-[11px] text-[#6F6475]">{JSON.stringify(exploreDraft) === JSON.stringify(explorePublished) ? "Published settings" : "Unpublished Explore Now changes"}</span>
      </div>
    </div>
    <div className="rounded-xl border border-[#E7DCEB] bg-white p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[#302438]">Draft vs published comparison</h3>
        <span className="text-xs text-[#6F6475]">{sectionChanges.length} change(s)</span>
      </div>
      {sectionChanges.length ? <ul className="space-y-1 text-xs text-[#6F6475]">{sectionChanges.map((change, index) => <li key={index}>• {change}</li>)}</ul> : <p className="text-xs text-[#6F6475]">The selected layout draft matches its published version.</p>}
      <p className="text-[11px] text-[#6F6475]">This comparison covers section order, visibility and carousel settings for the selected homepage layout. It does not include Explore Now or separate Homepage Content settings.</p>
    </div>
    {showPublishConfirmation && <div className="rounded-xl border-2 border-[#B69ACF] bg-[#F7F0FA] p-4 space-y-3" role="alertdialog" aria-labelledby="homepage-publish-confirm-title" aria-describedby="homepage-publish-confirm-description">
      <h3 id="homepage-publish-confirm-title" className="text-sm font-semibold text-[#302438]">Confirm homepage publication</h3>
      <p id="homepage-publish-confirm-description" className="text-xs text-[#6F6475]">You are about to publish the <strong>{collection === "shared" ? "Shared (both collections)" : collection === "artificial" ? "Artificial" : "Demi-Fine"}</strong> homepage section layout. This will replace the currently published section order, visibility and carousel settings for this version.</p>
      <p className="text-xs text-[#6F6475]">{sectionChanges.length ? `${sectionChanges.length} change(s) will go live.` : "No differences from the current published layout."} The preview was refreshed from this saved draft.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => void publish()} className="rounded-lg bg-[#563568] px-4 py-2 text-xs font-medium text-white disabled:opacity-50">Confirm and publish this version</button>
        <button type="button" disabled={busy} onClick={() => setShowPublishConfirmation(false)} className="rounded-lg border border-[#DCCDE5] bg-white px-4 py-2 text-xs text-[#563568]">Cancel</button>
      </div>
    </div>}
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={busy || loading} onClick={() => void save()} className="px-4 py-2 rounded-lg border text-sm disabled:opacity-50">{busy ? "Saving…" : "Save draft"}</button>
      <button type="button" disabled={busy || loading || !hasPreviewedCurrentDraft} onClick={requestPublish} className="px-4 py-2 rounded-lg bg-[#563568] text-white text-sm disabled:opacity-50">{busy ? "Publishing…" : "Review & publish homepage"}</button>
      <button type="button" disabled={busy || loading} onClick={() => void load()} className="px-4 py-2 rounded-lg border text-sm disabled:opacity-50">Reload</button>
      <a href="/" target="_blank" rel="noreferrer" className="px-4 py-2 rounded-lg border text-sm">Preview storefront</a>
    </div>
  </section>;
};
