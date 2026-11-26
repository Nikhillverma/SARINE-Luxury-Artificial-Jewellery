import React, { useEffect, useState } from "react";
import { categoryService, hostingerMediaService } from "../../services";
import { hostingerStorefrontService, type HomepageCategoryImages } from "../../services/hostinger/hostingerStorefrontService";
import type { Category } from "../../types/category";

export const HomepageCategoryImagesManager: React.FC = () => {
  const [collection, setCollection] = useState<"" | "artificial" | "demi-fine">("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [images, setImages] = useState<HomepageCategoryImages>({});
  const [published, setPublished] = useState<HomepageCategoryImages>({});
  const [savedPreview, setSavedPreview] = useState<HomepageCategoryImages | null>(null);
  const [showPublishReview, setShowPublishReview] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busySlug, setBusySlug] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [previewMode, setPreviewMode] = useState<"desktop" | "tablet" | "mobile">("desktop");

  const load = async (isCancelled: () => boolean = () => false) => {
    setLoading(true); setError(""); setMessage("");
    try {
      const [categoryList, result] = await Promise.all([
        categoryService.getCategories({ activeOnly: true }),
        hostingerStorefrontService.getHomepageCategoryImages(collection || undefined)
      ]);
      if (isCancelled()) return;
      setCategories(categoryList);
      setImages(result.draft || {});
      setPublished(result.published || {});
      setSavedPreview(null);
      setShowPublishReview(false);
    } catch (e) {
      if (!isCancelled()) setError(e instanceof Error ? e.message : "Homepage category images could not be loaded.");
    } finally { if (!isCancelled()) setLoading(false); }
  };
  useEffect(() => { let cancelled = false; setImages({}); void load(() => cancelled); return () => { cancelled = true; }; }, [collection]);

  const upload = async (slug: string, file?: File) => {
    if (!file) return;
    setBusySlug(slug); setError(""); setMessage("");
    try {
      const url = await hostingerMediaService.uploadImage(file);
      setImages(current => ({ ...current, [slug]: url }));
      setMessage("Image uploaded to Hostinger. Save changes to apply it to this homepage version.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Category image upload failed.");
    } finally { setBusySlug(""); }
  };
  const save = async () => {
    setSaving(true); setError(""); setMessage("");
    try {
      const result = await hostingerStorefrontService.saveHomepageCategoryImagesDraft(images, collection || undefined);
      setImages(result.draft);
      setSavedPreview(result.draft);
      setShowPublishReview(false);
      setMessage("Category image draft saved. Customers still see the published artwork until you confirm publication.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Category images could not be saved.");
    } finally { setSaving(false); }
  };

  const previewIsCurrent = Boolean(savedPreview && JSON.stringify(savedPreview) === JSON.stringify(images));
  const changedSlugs = Array.from(new Set([...Object.keys(images), ...Object.keys(published)])).filter(slug => (images[slug] || "") !== (published[slug] || ""));
  const publish = async () => {
    if (!previewIsCurrent) { setError("Save draft & refresh preview before publishing."); return; }
    setSaving(true); setError(""); setMessage(""); setShowPublishReview(false);
    try {
      const result = await hostingerStorefrontService.publishHomepageCategoryImages(collection || undefined);
      setImages(result.published); setPublished(result.published); setSavedPreview(result.published);
      setMessage("Category images published for " + (collection || "Shared") + ".");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not publish category images."); }
    finally { setSaving(false); }
  };

  return <section className="space-y-5 rounded-2xl border border-[#E7DCEB] bg-white p-5">
    <div>
      <h2 className="font-semibold text-[#2C1838]">Shop by Category Images</h2>
      <p className="mt-1 text-xs text-[#6F6475]">Replace the category tile artwork independently for Home, Artificial and Demi-Fine. Category names, links and layout remain unchanged.</p>
      <label className="mt-3 block max-w-xs space-y-1 text-xs font-medium text-[#563568]">Homepage version
        <select value={collection} disabled={loading || saving || Boolean(busySlug)} onChange={event => setCollection(event.target.value as "" | "artificial" | "demi-fine")} className="w-full rounded-lg border border-[#E7DCEB] bg-white p-2.5 text-sm">
          <option value="">Shared (shown in both collections)</option><option value="artificial">Artificial</option><option value="demi-fine">Demi-Fine</option>
        </select>
      </label>
    </div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {message && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{message}</p>}
    {loading ? <p className="text-sm text-gray-500">Loading categories…</p> : categories.length === 0 ? <p className="rounded-lg border border-dashed p-4 text-sm text-gray-500">No active categories were found.</p> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {categories.map(category => <article key={category.id} className="space-y-3 rounded-xl border border-[#E7DCEB] p-3">
        <div className="aspect-[4/3] overflow-hidden rounded-lg bg-[#F7F0FA]">
          <img src={images[category.slug] || category.image || "/images/product-placeholder.png"} alt={category.name} className="h-full w-full object-cover" />
        </div>
        <div><h3 className="text-sm font-semibold text-[#563568]">{category.name}</h3><p className="text-xs text-[#6F6475]">/{category.slug}</p></div>
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex min-h-10 cursor-pointer items-center rounded-lg bg-[#563568] px-3 py-2 text-xs font-medium text-white">
            {busySlug === category.slug ? "Uploading…" : images[category.slug] ? "Replace image" : "Upload image"}
            <input type="file" accept="image/jpeg,image/png,image/webp" disabled={Boolean(busySlug) || saving} onChange={event => { void upload(category.slug, event.target.files?.[0]); event.currentTarget.value = ""; }} className="sr-only" />
          </label>
          <button type="button" disabled={saving || !images[category.slug]} onClick={() => setImages(current => { const next = { ...current }; delete next[category.slug]; return next; })} className="min-h-10 rounded-lg border border-red-200 px-3 py-2 text-xs text-red-700 disabled:opacity-40">Use default</button>
        </div>
      </article>)}
    </div>}
    <section className="space-y-3 rounded-xl border border-[#E7DCEB] bg-[#FBF8FC] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h3 className="text-sm font-semibold text-[#563568]">Responsive category preview</h3><p className="text-xs text-[#705E7B]">Shows the last saved draft with existing category names. Customers continue seeing the published artwork until confirmation.</p></div>
        <div className="flex gap-1">{(["desktop", "tablet", "mobile"] as const).map(mode => <button key={mode} type="button" onClick={() => setPreviewMode(mode)} aria-pressed={previewMode === mode} className={`min-h-9 rounded-md border px-3 text-xs capitalize ${previewMode === mode ? "bg-[#563568] text-white" : "bg-white text-[#563568]"}`}>{mode}</button>)}</div>
      </div>
      <div className="mx-auto overflow-hidden rounded-xl border border-[#E7DCEB] bg-white p-3 transition-all" style={{ width: previewMode === "desktop" ? "100%" : previewMode === "tablet" ? "620px" : "375px", maxWidth: "100%" }}>
        <div className={`grid gap-3 ${previewMode === "mobile" ? "grid-cols-2" : previewMode === "tablet" ? "grid-cols-3" : "grid-cols-4"}`}>
          {categories.map(category => <div key={category.id} className="min-w-0 overflow-hidden rounded-lg">
            <div className="aspect-[4/3] overflow-hidden rounded-lg bg-[#F7F0FA]"><img src={(savedPreview || {})[category.slug] || category.image || "/images/product-placeholder.png"} alt={category.name} className="h-full w-full object-cover" /></div>
            <p className="mt-2 truncate text-center text-xs font-medium text-[#563568]">{category.name}</p>
          </div>)}
        </div>
      </div>
      {!previewIsCurrent && <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">Preview needs refreshing after edits. Customers still see the published category images.</p>}
    </section>
    <section className="rounded-xl border p-4 space-y-2"><h3 className="text-sm font-semibold text-[#563568]">Draft vs published</h3><p className="text-xs text-gray-600">{changedSlugs.length} category image override(s) changed.</p>{changedSlugs.length === 0 && <p className="text-xs text-green-700">Draft matches published.</p>}</section>
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={saving || loading || Boolean(busySlug)} onClick={() => void save()} className="min-h-11 rounded-lg bg-[#563568] px-5 py-2 text-sm font-medium text-white disabled:opacity-50">{saving ? "Saving…" : "Save draft & refresh preview"}</button>
      <button type="button" disabled={saving || loading || Boolean(busySlug) || !previewIsCurrent || changedSlugs.length === 0} onClick={() => setShowPublishReview(true)} className="min-h-11 rounded-lg border px-4 py-2 text-sm disabled:opacity-50">Review & publish</button>
      <button type="button" disabled={saving || loading || Boolean(busySlug)} onClick={() => void load()} className="min-h-11 rounded-lg border px-4 py-2 text-sm disabled:opacity-50">Reload</button>
      <a href={collection ? "/?range=" + collection : "/"} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-lg border px-4 py-2 text-sm">Preview this homepage</a>
    </div>
    {showPublishReview && <div role="alertdialog" aria-modal="true" className="rounded-xl border-2 border-[#B69ACF] bg-[#F7F0FA] p-4 space-y-3"><h3 className="text-sm font-semibold text-[#563568]">Confirm category image publication</h3><p className="text-xs text-gray-700">Publish {changedSlugs.length} changed category image override(s) for {collection || "Shared"}? Category names, links and layout remain unchanged.</p><div className="flex gap-2"><button type="button" disabled={saving} onClick={() => void publish()} className="rounded-lg bg-[#563568] px-4 py-2 text-xs text-white">Confirm and publish</button><button type="button" onClick={() => setShowPublishReview(false)} className="rounded-lg border px-4 py-2 text-xs">Cancel</button></div></div>}
  </section>;
};
