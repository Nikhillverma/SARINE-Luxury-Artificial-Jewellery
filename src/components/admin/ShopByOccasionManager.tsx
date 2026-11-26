import React, { useEffect, useState } from "react";
import { hostingerMediaService } from "../../services";
import { hostingerStorefrontService, type OccasionCard } from "../../services/hostinger/hostingerStorefrontService";

const defaults: OccasionCard[] = [
  { id: "daily-wear", title: "Daily Wear", subtitle: "Effortless everyday minimalism", image: "/images/optimized/ananya-temple-coin-bracelet.webp", link: "/shop?search=everyday", active: true, sortOrder: 0 },
  { id: "festive", title: "Festive", subtitle: "Celebratory sparkle and classic motifs", image: "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=1000&q=80", link: "/shop?search=festive", active: true, sortOrder: 1 },
  { id: "wedding", title: "Wedding", subtitle: "Regal bridal sets & heritage chokers", image: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=1000&q=80", link: "/shop?search=wedding", active: true, sortOrder: 2 },
  { id: "gifting", title: "Gifting", subtitle: "Precious tokens of affection", image: "/images/optimized/zoya-open-cuff-leaf-bangle.webp", link: "/shop", active: true, sortOrder: 3 }
];

const makeId = (title: string) => title.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "occasion";

export const ShopByOccasionManager: React.FC = () => {
  const [draft, setDraft] = useState<OccasionCard[]>(defaults);
  const [published, setPublished] = useState<OccasionCard[]>(defaults);
  const [savedPreview, setSavedPreview] = useState<OccasionCard[] | null>(null);
  const [showPublishReview, setShowPublishReview] = useState(false);
  const [collection, setCollection] = useState<"" | "artificial" | "demi-fine">("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [previewMode, setPreviewMode] = useState<"desktop" | "tablet" | "mobile">("desktop");

  const load = async (isCancelled: () => boolean = () => false) => {
    setLoading(true); setError("");
    try {
      const result = await hostingerStorefrontService.getOccasions(collection || undefined);
      if (isCancelled()) return;
      setDraft(result.draft);
      setPublished(result.published);
      setSavedPreview(result.published);
      setShowPublishReview(false);
    } catch (e) {
      if (!isCancelled()) setError(e instanceof Error ? e.message : "Could not load occasion cards.");
    } finally { if (!isCancelled()) setLoading(false); }
  };

  useEffect(() => { let cancelled = false; setDraft(defaults); void load(() => cancelled); return () => { cancelled = true; }; }, [collection]);

  const update = (index: number, patch: Partial<OccasionCard>) => {
    setDraft(current => current.map((item, i) => i === index ? { ...item, ...patch } : item));
    setMessage("");
  };

  const move = (index: number, direction: -1 | 1) => {
    setDraft(current => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((item, sortOrder) => ({ ...item, sortOrder }));
    });
    setMessage("");
  };

  const add = () => {
    if (draft.length >= 12) return;
    let title = "New Occasion";
    let id = makeId(title);
    let suffix = 2;
    while (draft.some(item => item.id === id)) { id = makeId(title) + "-" + suffix++; }
    setDraft(current => [...current, { id, title, subtitle: "Discover the collection", image: "/images/product-placeholder.png", link: "/shop", active: false, sortOrder: current.length }]);
    setMessage("");
  };

  const remove = (index: number) => {
    if (!window.confirm("Remove this occasion card from the homepage?")) return;
    setDraft(current => current.filter((_, i) => i !== index).map((item, sortOrder) => ({ ...item, sortOrder })));
    setMessage("");
  };

  const upload = async (index: number, file?: File) => {
    if (!file) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const image = await hostingerMediaService.uploadImage(file);
      update(index, { image });
      setMessage("Image uploaded to Hostinger. Save changes to publish it.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Occasion image upload failed.");
    } finally { setBusy(false); }
  };

  const cardWarnings = (item: OccasionCard) => {
    const warnings: string[] = [];
    if (!item.title.trim() || /^new occasion$/i.test(item.title.trim())) warnings.push("Add a distinctive occasion title.");
    if (!item.subtitle.trim() || /^discover the collection$/i.test(item.subtitle.trim())) warnings.push("Add a short customer-facing description.");
    if (!item.image || /product-placeholder/i.test(item.image)) warnings.push("Choose a real occasion image.");
    if (!item.link.startsWith("/") || item.link.startsWith("//")) warnings.push("Use an internal destination beginning with /.");
    return warnings;
  };
  const incompleteVisibleCards = draft.filter(item => item.active && cardWarnings(item).length > 0);

  const save = async () => {
    if (incompleteVisibleCards.length > 0) {
      setError(`Complete or hide ${incompleteVisibleCards.length} visible occasion card(s) before saving. Hidden draft cards can remain incomplete.`);
      return;
    }
    setBusy(true); setError(""); setMessage("");
    try {
      const normalized = draft.map((item, sortOrder) => ({ ...item, id: makeId(item.id), sortOrder }));
      const result = await hostingerStorefrontService.saveOccasionsDraft(normalized, collection || undefined);
      setDraft(result.draft);
      setSavedPreview(result.draft);
      setShowPublishReview(false);
      setMessage("Draft saved to MariaDB. The preview now shows this saved version; customers still see the published cards.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Occasion cards could not be saved.");
    } finally { setBusy(false); }
  };


  const previewIsCurrent = Boolean(savedPreview && JSON.stringify(savedPreview) === JSON.stringify(draft));
  const addedCount = draft.filter(item => !published.some(current => current.id === item.id)).length;
  const removedCount = published.filter(item => !draft.some(current => current.id === item.id)).length;
  const changedCount = draft.filter(item => {
    const current = published.find(entry => entry.id === item.id);
    return current && JSON.stringify(current) !== JSON.stringify(item);
  }).length;
  const publish = async () => {
    if (!previewIsCurrent) { setError("Save draft & refresh preview before publishing."); return; }
    setBusy(true); setError(""); setMessage(""); setShowPublishReview(false);
    try {
      const result = await hostingerStorefrontService.publishOccasions(collection || undefined);
      setPublished(result.published);
      setDraft(result.published);
      setSavedPreview(result.published);
      setMessage("Shop by Occasion published for " + (collection || "Shared") + ".");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not publish occasion cards."); }
    finally { setBusy(false); }
  };

  return <section className="bg-white border rounded-2xl p-5 space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="font-semibold text-[#2C1838]">Shop by Occasion</h2>
        <p className="text-xs text-gray-500 mt-1">Add, upload, replace or remove occasion images. Choose files directly from your computer — no image URLs needed.</p>
        <label className="mt-3 block max-w-xs space-y-1 text-xs font-medium text-[#563568]">Homepage version<select value={collection} disabled={loading || busy} onChange={event => setCollection(event.target.value as "" | "artificial" | "demi-fine")} className="w-full rounded-lg border border-[#E7DCEB] bg-white p-2.5 text-sm"><option value="">Shared (shown in both collections)</option><option value="artificial">Artificial</option><option value="demi-fine">Demi-Fine</option></select></label>
      </div>
      <span className="text-xs rounded-full px-3 py-1 bg-purple-50 text-purple-700">{draft.filter(item => item.active).length} visible · {draft.length}/12 cards</span>
    </div>
    {error && <p role="alert" className="text-sm text-red-700 bg-red-50 rounded-lg p-3">{error}</p>}
    {message && <p role="status" className="text-sm text-green-800 bg-green-50 rounded-lg p-3">{message}</p>}
    {loading ? <p className="text-sm text-gray-500">Loading occasion cards…</p> : <>
      <div className="grid md:grid-cols-2 gap-4">
        {draft.map((item, index) => <article key={item.id} className="border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-[#563568]">CARD {index + 1}</p>
            <div className="flex items-center gap-1">
              <button type="button" disabled={busy || index === 0} onClick={() => move(index, -1)} aria-label="Move occasion up" className="border rounded px-2 py-1 text-xs disabled:opacity-30">↑</button>
              <button type="button" disabled={busy || index === draft.length - 1} onClick={() => move(index, 1)} aria-label="Move occasion down" className="border rounded px-2 py-1 text-xs disabled:opacity-30">↓</button>
              <button type="button" disabled={busy} onClick={() => remove(index)} className="border border-red-200 text-red-700 rounded px-2 py-1 text-xs">Delete card</button>
            </div>
          </div>
          <div className="grid grid-cols-[104px_1fr] gap-3">
            <img src={item.image || "/images/product-placeholder.png"} alt={item.title} onError={event => { event.currentTarget.src = "/images/product-placeholder.png"; }} className="w-full aspect-[4/5] rounded-lg object-cover bg-[#F7F0FA]" />
            <div className="space-y-2">
              <label className="block text-xs space-y-1"><span>Card title</span><input value={item.title} maxLength={80} onChange={e => update(index, { title: e.target.value })} className="w-full border rounded-lg p-2 text-sm" /></label>
              <label className="block text-xs space-y-1"><span>Short description</span><input value={item.subtitle} maxLength={180} onChange={e => update(index, { subtitle: e.target.value })} className="w-full border rounded-lg p-2 text-sm" /></label>
            </div>
          </div>
          <div className="rounded-lg border border-dashed border-[#B69ACF] bg-[#F7F0FA] p-3 space-y-2"><label className="block text-sm font-medium text-[#563568]">Occasion image</label><p className="text-xs text-gray-600">Choose a JPEG, PNG or WebP image from your computer. It uploads to Hostinger automatically.</p><div className="flex flex-wrap items-center gap-2"><label className="inline-flex cursor-pointer items-center rounded-lg bg-[#563568] px-3 py-2 text-xs font-medium text-white"> {item.image ? "Replace image" : "Upload image"} <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e => { void upload(index, e.target.files?.[0]); e.currentTarget.value = ""; }} className="sr-only" /></label><button type="button" disabled={busy || !item.image} onClick={() => update(index, { image: "/images/product-placeholder.png" })} className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs text-red-700 disabled:opacity-40">Remove image</button></div></div>
          <label className="block text-xs space-y-1"><span>Shop destination (internal site path)</span><input value={item.link} maxLength={500} onChange={e => update(index, { link: e.target.value })} placeholder="/shop?search=festive" className="w-full border rounded-lg p-2 text-sm" /></label>
          {cardWarnings(item).length > 0 && <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900"><strong>{item.active ? "Needs attention before saving" : "Draft quality check"}</strong><ul className="mt-1 list-disc pl-4">{cardWarnings(item).map(warning => <li key={warning}>{warning}</li>)}</ul></div>}
          <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={item.active} onChange={e => update(index, { active: e.target.checked })} /> Show this card on homepage</label>
        </article>)}
      </div>
      {draft.length === 0 && <p className="text-sm text-gray-500 border rounded-xl p-4">No occasion cards. Add a card to display the Shop by Occasion section.</p>}
    </>}
    <section className="space-y-3 rounded-xl border border-[#E7DCEB] bg-[#FBF8FC] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h3 className="text-sm font-semibold text-[#563568]">Responsive Shop by Occasion preview</h3><p className="text-xs text-[#705E7B]">Preview shows the last saved draft. Customers continue seeing the published version until you confirm publication.</p></div>
        <div className="flex gap-1">{(["desktop", "tablet", "mobile"] as const).map(mode => <button key={mode} type="button" onClick={() => setPreviewMode(mode)} aria-pressed={previewMode === mode} className={`min-h-9 rounded-md border px-3 text-xs capitalize ${previewMode === mode ? "bg-[#563568] text-white" : "bg-white text-[#563568]"}`}>{mode}</button>)}</div>
      </div>
      <div className="mx-auto overflow-hidden rounded-xl border border-[#E7DCEB] bg-white p-3 transition-all" style={{ width: previewMode === "desktop" ? "100%" : previewMode === "tablet" ? "620px" : "375px", maxWidth: "100%" }}>
        <div className={`grid gap-3 ${previewMode === "mobile" ? "grid-cols-1" : previewMode === "tablet" ? "grid-cols-2" : "grid-cols-3"}`}>
          {(savedPreview || []).filter(item => item.active).map(item => <article key={item.id} className="overflow-hidden rounded-lg bg-[#F7F0FA]">
            <div className={`overflow-hidden ${previewMode === "mobile" ? "aspect-[16/9]" : "aspect-[4/5]"}`}><img src={item.image || "/images/product-placeholder.png"} alt={item.title} className="h-full w-full object-cover" /></div>
            <div className="p-3"><h4 className="font-serif text-sm text-[#563568]">{item.title || "Occasion title"}</h4><p className="mt-1 line-clamp-2 text-xs text-[#705E7B]">{item.subtitle}</p></div>
          </article>)}
        </div>
        {(savedPreview || []).filter(item => item.active).length === 0 && <p className="py-8 text-center text-xs text-[#705E7B]">Save a draft to preview its visible occasion cards.</p>}
        {!previewIsCurrent && <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">Preview needs refreshing after draft edits. Customers still see the published version.</p>}
      </div>
    </section>
    <section className="rounded-xl border p-4 space-y-2"><h3 className="text-sm font-semibold text-[#563568]">Draft vs published</h3><p className="text-xs text-gray-600">{addedCount} added · {removedCount} removed · {changedCount} edited</p>{addedCount + removedCount + changedCount === 0 && <p className="text-xs text-green-700">Draft matches published.</p>}</section>
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={busy || loading || draft.length >= 12} onClick={add} className="px-4 py-2 rounded-lg border text-sm disabled:opacity-50">Add occasion</button>
      <button type="button" disabled={busy || loading || incompleteVisibleCards.length > 0} onClick={() => void save()} className="px-4 py-2 rounded-lg bg-[#563568] text-white text-sm disabled:opacity-50">{busy ? "Saving…" : "Save draft & refresh preview"}</button>
      <button type="button" disabled={busy || loading || !previewIsCurrent || addedCount + removedCount + changedCount === 0} onClick={() => setShowPublishReview(true)} className="px-4 py-2 rounded-lg border text-sm disabled:opacity-50">Review & publish</button>
      <button type="button" disabled={busy || loading} onClick={() => void load()} className="px-4 py-2 rounded-lg border text-sm disabled:opacity-50">Reload</button>
      <a href="/" target="_blank" rel="noreferrer" className="px-4 py-2 rounded-lg border text-sm">Preview homepage</a>
    </div>
    {showPublishReview && <div role="alertdialog" aria-modal="true" className="rounded-xl border-2 border-[#B69ACF] bg-[#F7F0FA] p-4 space-y-3"><h3 className="text-sm font-semibold text-[#563568]">Confirm Shop by Occasion publication</h3><p className="text-xs text-gray-700">Publish the saved {collection || "Shared"} version? {addedCount} cards added, {removedCount} removed and {changedCount} edited. Other collection versions remain unchanged.</p><div className="flex gap-2"><button type="button" disabled={busy} onClick={() => void publish()} className="rounded-lg bg-[#563568] px-4 py-2 text-xs text-white">Confirm and publish</button><button type="button" onClick={() => setShowPublishReview(false)} className="rounded-lg border px-4 py-2 text-xs">Cancel</button></div></div>}
  </section>;
};
