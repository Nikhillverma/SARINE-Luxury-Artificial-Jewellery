import React, { useEffect, useState } from "react";
import { hostingerMediaService } from "../../services";
import { hostingerStorefrontService, type ShopByGenderSettings } from "../../services/hostinger/hostingerStorefrontService";

const emptySettings: ShopByGenderSettings = { version: 1, forHerImageUrl: "", forHimImageUrl: "" };

export const ShopByGenderManager: React.FC = () => {
  const [settings, setSettings] = useState<ShopByGenderSettings>(emptySettings);
  const [published, setPublished] = useState<ShopByGenderSettings>(emptySettings);
  const [savedPreview, setSavedPreview] = useState<ShopByGenderSettings | null>(null);
  const [showPublishReview, setShowPublishReview] = useState(false);
  const [collection, setCollection] = useState<"" | "artificial" | "demi-fine">("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [previewMode, setPreviewMode] = useState<"desktop" | "tablet" | "mobile">("desktop");

  const load = async (isCancelled: () => boolean = () => false) => {
    setLoading(true); setError(""); setMessage("");
    try {
      const result = await hostingerStorefrontService.getShopByGender(collection || undefined);
      if (isCancelled()) return;
      setSettings(result.draft || emptySettings);
      setPublished(result.published || emptySettings);
      setSavedPreview(null);
      setShowPublishReview(false);
    } catch (e) {
      if (!isCancelled()) setError(e instanceof Error ? e.message : "Could not load Shop by Gender settings.");
    } finally { if (!isCancelled()) setLoading(false); }
  };

  useEffect(() => { let cancelled = false; setSettings(emptySettings); void load(() => cancelled); return () => { cancelled = true; }; }, [collection]);

  const upload = async (key: "forHerImageUrl" | "forHimImageUrl", file?: File) => {
    if (!file) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const imageUrl = await hostingerMediaService.uploadImage(file);
      setSettings(current => ({ ...current, [key]: imageUrl }));
      setMessage(key === "forHerImageUrl" ? "For Her image uploaded. Save changes to show it on the homepage." : "For Him image uploaded. Save changes to show it on the homepage.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Image upload failed. Please try again.");
    } finally { setBusy(false); }
  };

  const save = async () => {
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await hostingerStorefrontService.saveShopByGenderDraft(settings, collection || undefined);
      setSettings(result.draft);
      setSavedPreview(result.draft);
      setShowPublishReview(false);
      setMessage("Draft saved to Hostinger. Customers still see the published images until you confirm publication.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Shop by Gender settings could not be saved.");
    } finally { setBusy(false); }
  };

  const previewIsCurrent = Boolean(savedPreview && JSON.stringify(savedPreview) === JSON.stringify(settings));
  const changed = JSON.stringify(settings) !== JSON.stringify(published);
  const publish = async () => {
    if (!previewIsCurrent) { setError("Save draft & refresh preview before publishing."); return; }
    setBusy(true); setError(""); setMessage(""); setShowPublishReview(false);
    try {
      const result = await hostingerStorefrontService.publishShopByGender(collection || undefined);
      setSettings(result.published); setPublished(result.published); setSavedPreview(result.published);
      setMessage("Shop by Gender published for " + (collection || "Shared") + ".");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not publish Shop by Gender."); }
    finally { setBusy(false); }
  };

  const tiles = [
    { key: "forHerImageUrl" as const, title: "FOR HER", value: settings.forHerImageUrl },
    { key: "forHimImageUrl" as const, title: "FOR HIM", value: settings.forHimImageUrl }
  ];

  const previewTiles = [
    { key: "forHerImageUrl" as const, title: "FOR HER", value: savedPreview?.forHerImageUrl || "" },
    { key: "forHimImageUrl" as const, title: "FOR HIM", value: savedPreview?.forHimImageUrl || "" }
  ];

  return <section className="space-y-5 rounded-2xl border bg-white p-5">
    <div>
      <h2 className="font-semibold text-[#2C1838]">Shop by Gender</h2>
      <p className="mt-1 text-xs text-gray-500">Upload and manage each homepage image independently. The preview adapts across phone, tablet and desktop sizes. Images are stored through Hostinger; save the settings after uploading.</p>
      <label className="mt-3 block max-w-xs space-y-1 text-xs font-medium text-[#563568]">Homepage version<select value={collection} disabled={loading || busy} onChange={event => setCollection(event.target.value as "" | "artificial" | "demi-fine")} className="w-full rounded-lg border border-[#E7DCEB] bg-white p-2.5 text-sm"><option value="">Shared (shown in both collections)</option><option value="artificial">Artificial</option><option value="demi-fine">Demi-Fine</option></select></label>
    </div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {message && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{message}</p>}
    {loading ? <p className="text-sm text-gray-500">Loading Shop by Gender settings…</p> : <div className="grid gap-4 sm:grid-cols-2">
      {tiles.map(tile => <article key={tile.key} className="space-y-3 rounded-xl border p-4">
        <h3 className="text-sm font-semibold tracking-wide text-[#563568]">{tile.title}</h3>
        <div className="aspect-[1.6/1] min-[380px]:aspect-[1.8/1] min-[440px]:aspect-[2/1] sm:aspect-[2.5/1] md:aspect-[2.75/1] lg:aspect-[3/1] overflow-hidden rounded-lg bg-[#F7F0FA]">
          {tile.value ? <img src={tile.value} alt={tile.title + " homepage preview"} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xs text-[#705E7B]">No image uploaded</div>}
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex min-h-11 cursor-pointer items-center rounded-lg bg-[#563568] px-4 py-2 text-xs font-medium text-white">
            {tile.value ? "Replace image" : "Upload image"}
            <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={event => { void upload(tile.key, event.target.files?.[0]); event.currentTarget.value = ""; }} className="sr-only" />
          </label>
          <button type="button" disabled={busy || !tile.value} onClick={() => { setSettings(current => ({ ...current, [tile.key]: "" })); setMessage(""); }} className="min-h-11 rounded-lg border border-red-200 px-4 py-2 text-xs text-red-700 disabled:opacity-40">Remove image</button>
        </div>
        <p className="text-[11px] text-gray-500">Responsive crop: 1.6:1 compact phones, 1.8:1 larger phones, 2:1 large phones, 2.5:1 small tablets, 2.75:1 tablets, 3:1 desktop. JPEG, PNG or WebP.</p>
      </article>)}
    </div>}
    <section className="space-y-3 rounded-xl border border-[#E7DCEB] bg-[#FBF8FC] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h3 className="text-sm font-semibold text-[#563568]">Responsive storefront preview</h3><p className="text-xs text-[#705E7B]">Preview the last saved draft. Customers continue seeing the published version until you confirm publication.</p></div>
        <div className="flex gap-1">{(["desktop", "tablet", "mobile"] as const).map(mode => <button key={mode} type="button" onClick={() => setPreviewMode(mode)} aria-pressed={previewMode === mode} className={`min-h-9 rounded-md border px-3 text-xs capitalize ${previewMode === mode ? "bg-[#563568] text-white" : "bg-white text-[#563568]"}`}>{mode}</button>)}</div>
      </div>
      <div className="mx-auto overflow-hidden rounded-xl border border-[#E7DCEB] bg-white p-3 transition-all" style={{ width: previewMode === "desktop" ? "100%" : previewMode === "tablet" ? "620px" : "375px", maxWidth: "100%" }}>
        <div className={`grid gap-2 ${previewMode === "mobile" ? "grid-cols-1" : "grid-cols-2"}`}>
          {previewTiles.map(tile => <div key={tile.key} className="overflow-hidden rounded-lg bg-[#F7F0FA]">
            <div className={`overflow-hidden ${previewMode === "mobile" ? "aspect-[2/1]" : "aspect-[1.35/1]"}`}>{tile.value ? <img src={tile.value} alt={tile.title + " preview"} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xs text-[#705E7B]">Upload an image</div>}</div>
            <p className="p-2 text-center text-xs font-semibold tracking-widest text-[#563568]">{tile.title}</p>
          </div>)}
        </div>
      </div>
      {!previewIsCurrent && <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">Preview needs refreshing after edits. Customers still see the published images.</p>}
    </section>
    <section className="rounded-xl border p-4 space-y-2"><h3 className="text-sm font-semibold text-[#563568]">Draft vs published</h3><p className="text-xs text-gray-600">{changed ? "Image settings differ from the published version." : "Draft matches published."}</p></section>
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={busy || loading} onClick={() => void save()} className="min-h-11 rounded-lg bg-[#563568] px-5 py-2 text-sm font-medium text-white disabled:opacity-50">{busy ? "Saving…" : "Save draft & refresh preview"}</button>
      <button type="button" disabled={busy || loading || !previewIsCurrent || !changed} onClick={() => setShowPublishReview(true)} className="min-h-11 rounded-lg border px-4 py-2 text-sm disabled:opacity-50">Review & publish</button>
      <button type="button" disabled={busy || loading} onClick={() => void load()} className="min-h-11 rounded-lg border px-4 py-2 text-sm disabled:opacity-50">Reload</button>
      <a href="/" target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-lg border px-4 py-2 text-sm">Preview homepage</a>
    </div>
    {showPublishReview && <div role="alertdialog" aria-modal="true" className="rounded-xl border-2 border-[#B69ACF] bg-[#F7F0FA] p-4 space-y-3"><h3 className="text-sm font-semibold text-[#563568]">Confirm Shop by Gender publication</h3><p className="text-xs text-gray-700">Publish the saved {collection || "Shared"} For Her and For Him images? Other collection versions remain unchanged.</p><div className="flex gap-2"><button type="button" disabled={busy} onClick={() => void publish()} className="rounded-lg bg-[#563568] px-4 py-2 text-xs text-white">Confirm and publish</button><button type="button" onClick={() => setShowPublishReview(false)} className="rounded-lg border px-4 py-2 text-xs">Cancel</button></div></div>}
  </section>;
};
