import React, { useEffect, useMemo, useState } from "react";
import { hostingerStorefrontService, type HomepageLayout, type ExploreNowConfig } from "../../services/hostinger/hostingerStorefrontService";
import { adminProductService } from "../../services";
import type { Product } from "../../types/product";

const sectionLabels: Record<string, { title: string; description: string }> = {
  hero: { title: "Hero Banner", description: "The first homepage feature. Banner artwork and slides are edited in the Hero Banners controls below." },
  categories: { title: "Shop by Category Carousel", description: "Swipe or tap through active jewellery categories. Adjust the number of cards shown on desktop." },
  "new-arrivals": { title: "New Arrivals Carousel", description: "Swipe, drag or use arrows to browse newest products. Adjust desktop card count." },
  "best-sellers": { title: "Best Sellers Carousel", description: "Swipe, drag or use arrows to browse genuine best sellers. Adjust desktop card count." },
  "curated-favourites": { title: "Curated Favourites Carousel", description: "Swipe, drag or use arrows through your manually selected products. Adjust desktop card count." },
  occasions: { title: "Shop by Occasion Carousel", description: "Swipe, drag or use arrows through occasion cards. Adjust desktop card count." },
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
  const existingIds = new Set(existing.map(section => section.id));
  const maxOrder = existing.reduce((max, section) => Math.max(max, Number(section.sortOrder) || 0), -1);
  const additions = defaultLayout.sections.filter(section => !existingIds.has(section.id));
  const merged = [...existing.map(section => adjustableCarousels.has(section.id)
    ? { ...section, carouselEnabled: section.carouselEnabled !== false, cardsPerView: section.cardsPerView ?? 5 }
    : section), ...additions];
  const occasionIndex = merged.findIndex(section => section.id === "occasions");
  const exploreIndex = merged.findIndex(section => section.id === "explore-now");
  if (occasionIndex >= 0 && exploreIndex >= 0 && exploreIndex !== occasionIndex + 1) {
    const [explore] = merged.splice(exploreIndex, 1);
    merged.splice(occasionIndex + 1, 0, explore);
  }
  return { version: 1, sections: merged.map((section, sortOrder) => ({ ...section, sortOrder })) };
}

export const HomepageSectionManager: React.FC = () => {
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

  const ordered = useMemo(() => [...draft.sections].sort((a, b) => a.sortOrder - b.sortOrder), [draft]);
  const isPublished = JSON.stringify(draft) === JSON.stringify(published);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [result, explore, catalogue] = await Promise.all([
        hostingerStorefrontService.getHomepageLayout(),
        hostingerStorefrontService.getExploreNow(),
        adminProductService.getProducts()
      ]);
      setDraft(mergeKnownSections(result.draft));
      setPublished(mergeKnownSections(result.published));
      setExploreDraft(explore.draft);
      setExplorePublished(explore.published);
      setProducts(catalogue);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load homepage layout settings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

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

  const save = async () => {
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await hostingerStorefrontService.saveHomepageLayout(draft);
      setDraft(result.draft);
      setMessage("Draft saved. Customers will continue seeing the currently published homepage until you publish.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Homepage layout draft could not be saved.");
    } finally { setBusy(false); }
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

  const publish = async () => {
    setBusy(true); setError(""); setMessage("");
    try {
      await hostingerStorefrontService.saveHomepageLayout(draft);
      const result = await hostingerStorefrontService.publishHomepageLayout();
      setPublished(result.published);
      setDraft(result.published);
      setMessage("Homepage layout published successfully.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Homepage layout could not be published.");
    } finally { setBusy(false); }
  };

  return <section className="bg-white border rounded-2xl p-5 space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="font-semibold text-[#2C1838]">Carousel Features</h2>
        <p className="text-xs text-gray-500 mt-1">Control every homepage section here: reorder it, show or hide it, switch each carousel on or off, and choose 2–8 desktop cards per view. Save a draft, then publish your changes.</p>
      </div>
      <span className={isPublished ? "text-xs rounded-full px-3 py-1 bg-green-50 text-green-700" : "text-xs rounded-full px-3 py-1 bg-amber-50 text-amber-700"}>
        {isPublished ? "Published version" : "Unpublished changes"}
      </span>
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
      <p className="text-[11px] text-[#6F6475]">Only active, in-stock products are eligible. Up to 100 products can be selected. View More reveals the remaining selected products from that visit's randomized list.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={exploreBusy || loading} onClick={() => void saveExplore(false)} className="rounded-lg border border-[#DCCDE5] bg-white px-4 py-2 text-xs font-medium text-[#563568]">Save Explore Now draft</button>
        <button type="button" disabled={exploreBusy || loading} onClick={() => void saveExplore(true)} className="rounded-lg bg-[#563568] px-4 py-2 text-xs font-medium text-white">{exploreBusy ? "Saving…" : "Publish Explore Now"}</button>
        <span className="self-center text-[11px] text-[#6F6475]">{JSON.stringify(exploreDraft) === JSON.stringify(explorePublished) ? "Published settings" : "Unpublished Explore Now changes"}</span>
      </div>
    </div>
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={busy || loading} onClick={() => void save()} className="px-4 py-2 rounded-lg border text-sm disabled:opacity-50">{busy ? "Saving…" : "Save draft"}</button>
      <button type="button" disabled={busy || loading} onClick={() => void publish()} className="px-4 py-2 rounded-lg bg-[#563568] text-white text-sm disabled:opacity-50">{busy ? "Publishing…" : "Publish homepage"}</button>
      <button type="button" disabled={busy || loading} onClick={() => void load()} className="px-4 py-2 rounded-lg border text-sm disabled:opacity-50">Reload</button>
      <a href="/" target="_blank" rel="noreferrer" className="px-4 py-2 rounded-lg border text-sm">Preview storefront</a>
    </div>
  </section>;
};
