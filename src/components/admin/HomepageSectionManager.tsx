import React, { useEffect, useMemo, useState } from "react";
import { hostingerStorefrontService, type HomepageLayout } from "../../services/hostinger/hostingerStorefrontService";

const sectionLabels: Record<string, { title: string; description: string }> = {
  categories: { title: "Shop by Category", description: "Your active jewellery categories, managed in Categories." },
  "new-arrivals": { title: "New Arrivals", description: "Newest active products with available stock." },
  "best-sellers": { title: "Best Sellers / Curated Favourites", description: "True sales ranking; when there are no qualifying launch sales, the existing curated fallback is shown." },
  occasions: { title: "Shop by Occasion", description: "Daily Wear, Festive, Wedding and Gifting discovery cards." },
  price: { title: "Shop by Price", description: "The four preset price-navigation links." },
  "our-story": { title: "Our Story", description: "Brand story, image and three brand pillars." },
  editorial: { title: "Editorial Collection", description: "Uses the separate Editorial Collection content controls below." }
};

const defaultLayout: HomepageLayout = {
  version: 1,
  sections: Object.keys(sectionLabels).map((id, sortOrder) => ({ id, enabled: true, sortOrder }))
};

export const HomepageSectionManager: React.FC = () => {
  const [draft, setDraft] = useState<HomepageLayout>(defaultLayout);
  const [published, setPublished] = useState<HomepageLayout>(defaultLayout);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const ordered = useMemo(() => [...draft.sections].sort((a, b) => a.sortOrder - b.sortOrder), [draft]);
  const isPublished = JSON.stringify(draft) === JSON.stringify(published);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await hostingerStorefrontService.getHomepageLayout();
      setDraft(result.draft);
      setPublished(result.published);
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
        <h2 className="font-semibold text-[#2C1838]">Homepage Section Manager</h2>
        <p className="text-xs text-gray-500 mt-1">Control section visibility and order. Save a draft first, then publish when the preview is ready.</p>
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
          <label className="flex items-center gap-2 text-xs font-medium">
            <input type="checkbox" checked={section.enabled} disabled={busy} onChange={event => toggle(section.id, event.target.checked)} className="h-4 w-4" />
            Visible
          </label>
        </article>;
      })}
    </div>}
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={busy || loading} onClick={() => void save()} className="px-4 py-2 rounded-lg border text-sm disabled:opacity-50">{busy ? "Saving…" : "Save draft"}</button>
      <button type="button" disabled={busy || loading} onClick={() => void publish()} className="px-4 py-2 rounded-lg bg-[#563568] text-white text-sm disabled:opacity-50">{busy ? "Publishing…" : "Publish homepage"}</button>
      <button type="button" disabled={busy || loading} onClick={() => void load()} className="px-4 py-2 rounded-lg border text-sm disabled:opacity-50">Reload</button>
      <a href="/" target="_blank" rel="noreferrer" className="px-4 py-2 rounded-lg border text-sm">Preview storefront</a>
    </div>
  </section>;
};
