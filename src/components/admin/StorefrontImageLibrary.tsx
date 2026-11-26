import React, { useEffect, useState } from "react";
import { hostingerMediaService } from "../../services";
import type { HostingerMediaAsset, HostingerMediaDuplicateGroup } from "../../services/hostinger/hostingerMediaService";

const PAGE_SIZE = 40;
type LibraryFilters = { mimeType: string; from: string; to: string; sort: "newest" | "oldest" | "filename" };
const DEFAULT_FILTERS: LibraryFilters = { mimeType: "", from: "", to: "", sort: "newest" };

export const StorefrontImageLibrary: React.FC = () => {
  const [assets, setAssets] = useState<HostingerMediaAsset[]>([]);
  const [viewMode, setViewMode] = useState<"all" | "duplicates">("all");
  const [duplicateGroups, setDuplicateGroups] = useState<HostingerMediaDuplicateGroup[]>([]);
  const [duplicateTotal, setDuplicateTotal] = useState(0);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<LibraryFilters>(DEFAULT_FILTERS);
  const [offset, setOffset] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [selected, setSelected] = useState<HostingerMediaAsset | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = async (nextOffset = offset, nextQuery = query, nextFilters = filters) => {
    setLoading(true); setError("");
    try {
      const result = await hostingerMediaService.listImages(nextQuery, PAGE_SIZE, nextOffset, nextFilters);
      setAssets(result.media); setTotal(result.total); setOffset(result.offset);
    } catch (e) { setError(e instanceof Error ? e.message : "The image library could not be loaded."); }
    finally { setLoading(false); }
  };

  const loadDuplicateGroups = async (nextOffset = 0) => {
    setLoading(true); setError("");
    try {
      const result = await hostingerMediaService.listDuplicateGroups(20, nextOffset);
      setDuplicateGroups(result.groups); setDuplicateTotal(result.total); setOffset(result.offset);
    } catch (e) { setError(e instanceof Error ? e.message : "Duplicate images could not be loaded."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(0, "", DEFAULT_FILTERS); }, []);
  useEffect(() => {
    if (!selected) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setSelected(null); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected]);

  const upload = async () => {
    if (!file) { setError("Choose a JPEG, PNG or WebP image first."); return; }
    setUploading(true); setError(""); setMessage("");
    try {
      await hostingerMediaService.uploadImage(file);
      setFile(null);
      setSearch(""); setQuery("");
      setFilters(DEFAULT_FILTERS);
      await load(0, "", DEFAULT_FILTERS);
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

  const applyFilters = (next: LibraryFilters) => {
    setFilters(next);
    void load(0, query, next);
  };

  const clearFilters = () => {
    setSearch(""); setQuery("");
    setFilters(DEFAULT_FILTERS);
    void load(0, "", DEFAULT_FILTERS);
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
    <div className="flex flex-wrap gap-2" aria-label="Image library view">
      <button type="button" aria-pressed={viewMode === "all"} onClick={() => { setViewMode("all"); void load(0); }} className="min-h-10 rounded-lg border border-[#DCCDE5] bg-[#563568] px-4 text-xs font-medium text-white">All images</button>
      <button type="button" aria-pressed={viewMode === "duplicates"} onClick={() => { setViewMode("duplicates"); void loadDuplicateGroups(0); }} className="min-h-10 rounded-lg border border-[#DCCDE5] px-4 text-xs font-medium text-[#563568]">Duplicate groups</button>
    </div>
    <form onSubmit={applySearch} className="flex flex-wrap gap-2">
      <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search image filename…" aria-label="Search image filename" className="min-h-11 min-w-0 flex-1 rounded-lg border border-[#E7DCEB] px-3 text-sm" />
      <button type="submit" disabled={loading} className="min-h-11 rounded-lg border border-[#DCCDE5] px-4 text-sm font-medium text-[#563568]">Search</button>
    </form>
    <div className="grid gap-3 rounded-xl border border-[#E7DCEB] p-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className="space-y-1 text-xs text-[#6F6475]">Image format
        <select value={filters.mimeType} onChange={event => applyFilters({ ...filters, mimeType: event.target.value })} className="min-h-10 w-full rounded-lg border border-[#E7DCEB] bg-white px-2 text-sm text-[#302438]">
          <option value="">All formats</option><option value="image/jpeg">JPEG</option><option value="image/png">PNG</option><option value="image/webp">WebP</option>
        </select>
      </label>
      <label className="space-y-1 text-xs text-[#6F6475]">Uploaded from
        <input type="date" value={filters.from} max={filters.to || undefined} onChange={event => applyFilters({ ...filters, from: event.target.value })} className="min-h-10 w-full rounded-lg border border-[#E7DCEB] bg-white px-2 text-sm text-[#302438]" />
      </label>
      <label className="space-y-1 text-xs text-[#6F6475]">Uploaded until
        <input type="date" value={filters.to} min={filters.from || undefined} onChange={event => applyFilters({ ...filters, to: event.target.value })} className="min-h-10 w-full rounded-lg border border-[#E7DCEB] bg-white px-2 text-sm text-[#302438]" />
      </label>
      <label className="space-y-1 text-xs text-[#6F6475]">Sort images
        <select value={filters.sort} onChange={event => applyFilters({ ...filters, sort: event.target.value as LibraryFilters["sort"] })} className="min-h-10 w-full rounded-lg border border-[#E7DCEB] bg-white px-2 text-sm text-[#302438]">
          <option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="filename">Filename A–Z</option>
        </select>
      </label>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#6F6475]">
      <span>{viewMode === "duplicates" ? `${duplicateTotal} duplicate groups` : `${total} matching stored images`}</span>
      <div className="flex gap-2">
        <button type="button" disabled={loading} onClick={clearFilters} className="rounded-lg border border-[#DCCDE5] px-3 py-2 text-[#563568]">Clear filters</button>
        <button type="button" disabled={loading} onClick={() => void load()} className="rounded-lg border border-[#DCCDE5] px-3 py-2 text-[#563568]">Refresh library</button>
      </div>
    </div>
    {loading ? <p role="status" className="py-8 text-center text-sm text-[#6F6475]">Loading image library…</p> : viewMode === "duplicates" ? duplicateGroups.length ? <div className="space-y-4">
      <p className="text-xs text-[#6F6475]">Groups contain files with exactly matching image content. Every copy is shown separately with its upload date and URL. This view is read-only: no files are deleted or changed.</p>
      {duplicateGroups.map(group => <article key={group.contentHash} className="overflow-hidden rounded-xl border border-[#E7DCEB]">
        <div className="flex flex-wrap items-center justify-between gap-2 bg-[#FBF8FC] p-3">
          <div><h3 className="text-sm font-semibold text-[#302438]">{group.copies} identical copies</h3><p className="text-[10px] text-[#6F6475]">Latest copy: {new Date(group.latestUpload).toLocaleString("en-IN")}</p></div>
          <span className="rounded-full bg-[#F7F0FA] px-3 py-1 text-[10px] text-[#563568]">Exact content match</span>
        </div>
        <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3">
          {group.media.map(asset => <div key={asset.id} className="min-w-0 rounded-lg border border-[#E7DCEB] p-2">
            <button type="button" onClick={() => setSelected({ ...asset, duplicateCount: group.copies })} className="block w-full cursor-zoom-in" aria-label={"Preview " + asset.fileName}><img src={asset.url} alt={asset.fileName} loading="lazy" className="aspect-[4/3] w-full rounded-md bg-[#F7F0FA] object-contain" /></button>
            <p className="mt-2 truncate text-xs font-medium text-[#302438]" title={asset.fileName}>{asset.fileName}</p>
            <p className="mt-1 text-[10px] text-[#6F6475]">{(asset.size / 1024).toFixed(1)} KB · {new Date(asset.createdAt).toLocaleString("en-IN")} · {asset.mimeType.replace("image/", "").toUpperCase()}</p>
            <p className="mt-1 break-all text-[10px] text-[#6F6475]">ID: {asset.id}</p>
            <div className="mt-2 grid grid-cols-2 gap-2"><button type="button" onClick={() => setSelected({ ...asset, duplicateCount: group.copies })} className="min-h-10 rounded-lg border border-[#DCCDE5] px-2 text-xs font-medium text-[#563568]">Inspect</button><button type="button" onClick={() => void copyUrl(asset.url)} className="min-h-10 rounded-lg border border-[#DCCDE5] px-2 text-xs font-medium text-[#563568]">Copy URL</button></div>
          </div>)}
        </div>
      </article>)}
    </div> : <p className="rounded-xl border border-dashed border-[#DCCDE5] p-8 text-center text-sm text-[#6F6475]">No identical image groups were found.</p> : assets.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {assets.map(asset => <article key={asset.id} className="min-w-0 overflow-hidden rounded-xl border border-[#E7DCEB]">
        <button type="button" onClick={() => setSelected(asset)} aria-label={"Preview " + asset.fileName} className="block w-full cursor-zoom-in">
          <img src={asset.url} alt={asset.fileName} loading="lazy" className="aspect-[4/3] w-full bg-[#F7F0FA] object-contain" />
        </button>
        <div className="space-y-2 p-3">
          <p className="truncate text-xs font-medium text-[#302438]" title={asset.fileName}>{asset.fileName}</p>
          <p className="text-[10px] text-[#6F6475]">{(asset.size / 1024).toFixed(1)} KB · {new Date(asset.createdAt).toLocaleDateString("en-IN")} · {asset.mimeType.replace("image/", "").toUpperCase()}</p>
          {asset.duplicateCount && asset.duplicateCount > 1 && <p className="text-[10px] font-medium text-amber-800">{asset.duplicateCount} identical files detected</p>}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setSelected(asset)} className="min-h-10 rounded-lg border border-[#DCCDE5] px-2 text-xs font-medium text-[#563568]">Preview</button>
            <button type="button" onClick={() => void copyUrl(asset.url)} className="min-h-10 rounded-lg border border-[#DCCDE5] px-2 text-xs font-medium text-[#563568]">Copy URL</button>
          </div>
        </div>
      </article>)}
    </div> : <p className="rounded-xl border border-dashed border-[#DCCDE5] p-8 text-center text-sm text-[#6F6475]">No uploaded images found{query ? " for this filename search" : ""}.</p>}
    {viewMode === "all" && <div className="flex items-center justify-between gap-3 border-t border-[#E7DCEB] pt-4">
      <button type="button" disabled={loading || offset <= 0} onClick={() => void load(Math.max(0, offset - PAGE_SIZE))} className="min-h-10 rounded-lg border border-[#DCCDE5] px-4 text-xs text-[#563568] disabled:opacity-40">Previous</button>
      <span className="text-xs tabular-nums text-[#6F6475]">{total ? offset + 1 : 0}–{Math.min(offset + assets.length, total)} of {total}</span>
      <button type="button" disabled={loading || offset + assets.length >= total} onClick={() => void load(offset + PAGE_SIZE)} className="min-h-10 rounded-lg border border-[#DCCDE5] px-4 text-xs text-[#563568] disabled:opacity-40">Next</button>
    </div>}
    {viewMode === "duplicates" && <div className="flex items-center justify-between gap-3 border-t border-[#E7DCEB] pt-4">
      <button type="button" disabled={loading || offset <= 0} onClick={() => void loadDuplicateGroups(Math.max(0, offset - 20))} className="min-h-10 rounded-lg border border-[#DCCDE5] px-4 text-xs text-[#563568] disabled:opacity-40">Previous groups</button>
      <span className="text-xs tabular-nums text-[#6F6475]">{duplicateTotal ? offset + 1 : 0}–{Math.min(offset + duplicateGroups.length, duplicateTotal)} of {duplicateTotal}</span>
      <button type="button" disabled={loading || offset + duplicateGroups.length >= duplicateTotal} onClick={() => void loadDuplicateGroups(offset + 20)} className="min-h-10 rounded-lg border border-[#DCCDE5] px-4 text-xs text-[#563568] disabled:opacity-40">Next groups</button>
    </div>}
    {selected && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setSelected(null); }}>
      <section role="dialog" aria-modal="true" aria-label={"Image preview: " + selected.fileName} className="max-h-[92vh] w-full max-w-5xl overflow-auto rounded-2xl bg-white p-4 shadow-2xl sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0"><h3 className="truncate text-sm font-semibold text-[#2C1838]">{selected.fileName}</h3><p className="mt-1 text-xs text-[#6F6475]">{(selected.size / 1024).toFixed(1)} KB · {selected.mimeType} · {new Date(selected.createdAt).toLocaleString("en-IN")}</p></div>
          <button type="button" autoFocus onClick={() => setSelected(null)} className="min-h-10 rounded-lg border border-[#DCCDE5] px-3 text-sm text-[#563568]">Close</button>
        </div>
        <div className="flex max-h-[65vh] min-h-40 items-center justify-center overflow-hidden rounded-xl bg-[#F7F0FA]">
          <img src={selected.url} alt={selected.fileName} className="max-h-[65vh] max-w-full object-contain" />
        </div>
        {selected.duplicateCount && selected.duplicateCount > 1 && <p className="mt-3 text-xs font-medium text-amber-800">Identical image content found in {selected.duplicateCount} stored files. No files have been removed.</p>}
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={() => void copyUrl(selected.url)} className="min-h-11 rounded-lg border border-[#DCCDE5] px-4 text-sm font-medium text-[#563568]">Copy image URL</button>
          <a href={selected.url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-lg bg-[#563568] px-4 text-sm font-medium text-white">Open original</a>
        </div>
      </section>
    </div>}
  </section>;
};
