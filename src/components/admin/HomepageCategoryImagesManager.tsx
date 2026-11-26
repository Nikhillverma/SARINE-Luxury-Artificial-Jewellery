import React, { useEffect, useState } from "react";
import { categoryService, hostingerMediaService } from "../../services";
import { hostingerStorefrontService, type HomepageCategoryImages } from "../../services/hostinger/hostingerStorefrontService";
import type { Category } from "../../types/category";

export const HomepageCategoryImagesManager: React.FC = () => {
  const [collection, setCollection] = useState<"" | "artificial" | "demi-fine">("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [images, setImages] = useState<HomepageCategoryImages>({});
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
      setImages(result.images || {});
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
      const result = await hostingerStorefrontService.saveHomepageCategoryImages(images, collection || undefined);
      setImages(result.images);
      setMessage("Category images saved for this homepage version.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Category images could not be saved.");
    } finally { setSaving(false); }
  };

  return <section className="space-y-5 rounded-2xl border border-[#E7DCEB] bg-white p-5">
    <div>
      <h2 className="font-semibold text-[#2C1838]">Shop by Category Images</h2>
      <p className="mt-1 text-xs text-[#6F6475]">Replace the category tile artwork independently for Home, Artificial and Demi-Fine. Category names, links and layout remain unchanged.</p>
      <label className="mt-3 block max-w-xs space-y-1 text-xs font-medium text-[#563568]">Homepage version
        <select value={collection} disabled={loading || saving || Boolean(busySlug)} onChange={event => setCollection(event.target.value as "" | "artificial" | "demi-fine")} className="w-full rounded-lg border border-[#E7DCEB] bg-white p-2.5 text-sm">
          <option value="">Home (existing global content)</option><option value="artificial">Artificial</option><option value="demi-fine">Demi-Fine</option>
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
        <div><h3 className="text-sm font-semibold text-[#563568]">Responsive category preview</h3><p className="text-xs text-[#705E7B]">Shows your current image edits with the existing category names. Save applies these images to the selected homepage version.</p></div>
        <div className="flex gap-1">{(["desktop", "tablet", "mobile"] as const).map(mode => <button key={mode} type="button" onClick={() => setPreviewMode(mode)} aria-pressed={previewMode === mode} className={`min-h-9 rounded-md border px-3 text-xs capitalize ${previewMode === mode ? "bg-[#563568] text-white" : "bg-white text-[#563568]"}`}>{mode}</button>)}</div>
      </div>
      <div className="mx-auto overflow-hidden rounded-xl border border-[#E7DCEB] bg-white p-3 transition-all" style={{ width: previewMode === "desktop" ? "100%" : previewMode === "tablet" ? "620px" : "375px", maxWidth: "100%" }}>
        <div className={`grid gap-3 ${previewMode === "mobile" ? "grid-cols-2" : previewMode === "tablet" ? "grid-cols-3" : "grid-cols-4"}`}>
          {categories.map(category => <div key={category.id} className="min-w-0 overflow-hidden rounded-lg">
            <div className="aspect-[4/3] overflow-hidden rounded-lg bg-[#F7F0FA]"><img src={images[category.slug] || category.image || "/images/product-placeholder.png"} alt={category.name} className="h-full w-full object-cover" /></div>
            <p className="mt-2 truncate text-center text-xs font-medium text-[#563568]">{category.name}</p>
          </div>)}
        </div>
      </div>
    </section>
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={saving || loading || Boolean(busySlug)} onClick={() => void save()} className="min-h-11 rounded-lg bg-[#563568] px-5 py-2 text-sm font-medium text-white disabled:opacity-50">{saving ? "Saving…" : "Save category images"}</button>
      <button type="button" disabled={saving || loading || Boolean(busySlug)} onClick={() => void load()} className="min-h-11 rounded-lg border px-4 py-2 text-sm disabled:opacity-50">Reload</button>
      <a href={collection ? "/?range=" + collection : "/"} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-lg border px-4 py-2 text-sm">Preview this homepage</a>
    </div>
  </section>;
};
