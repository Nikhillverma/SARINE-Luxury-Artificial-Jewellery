import React, { useEffect, useState } from "react";
import { hostingerMediaService, type HostingerMediaAsset } from "../../services/hostinger/hostingerMediaService";

const PAGE_SIZE = 40;

export const StorefrontImageLibrary: React.FC = () => {
  const [assets, setAssets] = useState<HostingerMediaAsset[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = async (nextOffset = offset, nextQuery = query) => {
    setLoading(true); setError("");
    try {
      const result = await hostingerMediaService.listImages(nextQuery, PAGE_SIZE, nextOffset);
      setAssets(result.media); setTotal(result.total); setOffset(result.offset);
    } catch (e) { setError(e instanceof Error ? e.message : "The image library could not be loaded."); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(0, ""); }, []);

  const upload = async () => {
    if (!file) { setError("Choose a JPEG, PNG or WebP image first."); return; }
    setUploading(true); setError(""); setMessage("");
    try {
      await hostingerMediaService.uploadImage(file);
      setFile(null);
      setSearch("");
      setQuery("");
      await load(0, "");
      setMessage("Image uploaded and saved to Hostinger media storage.");
    } catch (e) { setError(e instanceof Error ? e.message : "Image upload failed."); }
    finally { setUploading(false); }
  };

  const copyUrl = async (url: string) => {
    try { await navigator.clipboard.writeText(url); setMessage("Image URL copied."); }
    catch { setError("Clipboard access was unavailable. Open the image and copy its address from the browser."); }
  };

  const applySearch = (event: React.FormEvent) => {
    event.preventDefault();
    const next = search.trim();
    setQuery(next);
    void load(0, next);
  };

  return <section className="space-y-5 rounded-2xl border border-[#E7DCEB] bg-white p-5">
    <div>
      <h2 className="font-semibold text-[#2C1838]">Storefront Image Library</h2>
      <p className="mt-1 text-xs leading-relaxed text-[#6F6475]">Browse images already uploaded to Hostinger, reuse their URLs in banners and homepage content, or add new artwork here. Existing media files are never replaced or deleted by this tool.</p>
    </div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {message && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{message}</p>}
    <div className="grid gap-4 rounded-xl border border-[#E7DCEB] bg-[#FBF8FC] p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
      <label className="block space-y-1.5 text-xs font-medium text-[#563568]">Upload new image
        <input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading || loading} onChange={event => setFile(event.target.files?.[0] || null)} className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[#F7F0FA] file:px-3 file:py-2 file:text-xs file:font-medium file:text-[#563568]" />
        <span className="block text-[11px] font-normal text-[#6F6475]">JPEG, PNG or WebP. Existing upload validation and size limits still apply.</span>
      </label>
      <button type="button" disabled={!file || uploading || loading} onClick={() => void upload()} className="min-h-11 rounded-lg bg-[#563568] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{uploading ? "Uploading…" : "Upload to library"}</button>
    </div>
    <form onSubmit={applySearch} className="flex flex-wrap gap-2">
      <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search image filename…" aria-label="Search image filename" className="min-h-11 min-w-0 flex-1 rounded-lg border border-[#E7DCEB] px-3 text-sm" />
      <button type="submit" disabled={loading} className="min-h-11 rounded-lg border border-[#DCCDE5] px-4 text-sm font-medium text-[#563568]">Search</button>
      <button type="button" disabled={loading} onClick={() => { setSearch(""); setQuery(""); void load(0, ""); }} className="min-h-11 rounded-lg border border-[#DCCDE5] px-4 text-sm text-[#563568]">Clear</button>
    </form>
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#6F6475]"><span>{total} stored image{total === 1 ? "" : "s"}</span><button type="button" disabled={loading} onClick={() => void load()} className="rounded-lg border border-[#DCCDE5] px-3 py-2 text-[#563568]">Refresh library</button></div>
    {loading ? <p role="status" className="py-8 text-center text-sm text-[#6F6475]">Loading image library…</p> : assets.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {assets.map(asset => <article key={asset.id} className="min-w-0 overflow-hidden rounded-xl border border-[#E7DCEB]">
        <a href={asset.url} target="_blank" rel="noreferrer" aria-label={"Open " + asset.fileName}><img src={asset.url} alt={asset.fileName} loading="lazy" className="aspect-[4/3] w-full bg-[#F7F0FA] object-contain" /></a>
        <div className="space-y-2 p-3">
          <p className="truncate text-xs font-medium text-[#302438]" title={asset.fileName}>{asset.fileName}</p>
          <p className="text-[10px] text-[#6F6475]">{(asset.size / 1024).toFixed(1)} KB · {new Date(asset.createdAt).toLocaleDateString("en-IN")}</p>
          <button type="button" onClick={() => void copyUrl(asset.url)} className="min-h-10 w-full rounded-lg border border-[#DCCDE5] px-2 text-xs font-medium text-[#563568]">Copy image URL</button>
        </div>
      </article>)}
    </div> : <p className="rounded-xl border border-dashed border-[#DCCDE5] p-8 text-center text-sm text-[#6F6475]">No uploaded images found{query ? " for this filename search" : ""}.</p>}
    <div className="flex items-center justify-between gap-3 border-t border-[#E7DCEB] pt-4">
      <button type="button" disabled={loading || offset <= 0} onClick={() => void load(Math.max(0, offset - PAGE_SIZE))} className="min-h-10 rounded-lg border border-[#DCCDE5] px-4 text-xs text-[#563568] disabled:opacity-40">Previous</button>
      <span className="text-xs tabular-nums text-[#6F6475]">{total ? offset + 1 : 0}–{Math.min(offset + assets.length, total)} of {total}</span>
      <button type="button" disabled={loading || offset + assets.length >= total} onClick={() => void load(offset + PAGE_SIZE)} className="min-h-10 rounded-lg border border-[#DCCDE5] px-4 text-xs text-[#563568] disabled:opacity-40">Next</button>
    </div>
  </section>;
};
