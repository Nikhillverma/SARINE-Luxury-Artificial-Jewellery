import React, { useEffect, useState } from "react";
import { hostingerMediaService } from "../../services";
import { hostingerStorefrontService, type ShopByGenderSettings } from "../../services/hostinger/hostingerStorefrontService";

const emptySettings: ShopByGenderSettings = { version: 1, forHerImageUrl: "", forHimImageUrl: "" };

export const ShopByGenderManager: React.FC = () => {
  const [settings, setSettings] = useState<ShopByGenderSettings>(emptySettings);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    setLoading(true); setError(""); setMessage("");
    try {
      const result = await hostingerStorefrontService.getShopByGender();
      setSettings(result.settings || emptySettings);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load Shop by Gender settings.");
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

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
      const result = await hostingerStorefrontService.saveShopByGender(settings);
      setSettings(result.settings);
      setMessage("Shop by Gender images saved to Hostinger and are now available on the homepage.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Shop by Gender settings could not be saved.");
    } finally { setBusy(false); }
  };

  const tiles = [
    { key: "forHerImageUrl" as const, title: "FOR HER", value: settings.forHerImageUrl },
    { key: "forHimImageUrl" as const, title: "FOR HIM", value: settings.forHimImageUrl }
  ];

  return <section className="space-y-5 rounded-2xl border bg-white p-5">
    <div>
      <h2 className="font-semibold text-[#2C1838]">Shop by Gender</h2>
      <p className="mt-1 text-xs text-gray-500">Upload and manage each 3:1 homepage image independently. Images are stored through Hostinger; save the settings after uploading.</p>
    </div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {message && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{message}</p>}
    {loading ? <p className="text-sm text-gray-500">Loading Shop by Gender settings…</p> : <div className="grid gap-4 sm:grid-cols-2">
      {tiles.map(tile => <article key={tile.key} className="space-y-3 rounded-xl border p-4">
        <h3 className="text-sm font-semibold tracking-wide text-[#563568]">{tile.title}</h3>
        <div className="aspect-[3/1] overflow-hidden rounded-lg bg-[#F7F0FA]">
          {tile.value ? <img src={tile.value} alt={tile.title + " homepage preview"} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xs text-[#705E7B]">No image uploaded</div>}
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex min-h-11 cursor-pointer items-center rounded-lg bg-[#563568] px-4 py-2 text-xs font-medium text-white">
            {tile.value ? "Replace image" : "Upload image"}
            <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={event => { void upload(tile.key, event.target.files?.[0]); event.currentTarget.value = ""; }} className="sr-only" />
          </label>
          <button type="button" disabled={busy || !tile.value} onClick={() => { setSettings(current => ({ ...current, [tile.key]: "" })); setMessage(""); }} className="min-h-11 rounded-lg border border-red-200 px-4 py-2 text-xs text-red-700 disabled:opacity-40">Remove image</button>
        </div>
        <p className="text-[11px] text-gray-500">Recommended ratio: 3:1 landscape. JPEG, PNG or WebP.</p>
      </article>)}
    </div>}
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={busy || loading} onClick={() => void save()} className="min-h-11 rounded-lg bg-[#563568] px-5 py-2 text-sm font-medium text-white disabled:opacity-50">{busy ? "Saving…" : "Save Shop by Gender"}</button>
      <button type="button" disabled={busy || loading} onClick={() => void load()} className="min-h-11 rounded-lg border px-4 py-2 text-sm disabled:opacity-50">Reload</button>
      <a href="/" target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-lg border px-4 py-2 text-sm">Preview homepage</a>
    </div>
  </section>;
};
