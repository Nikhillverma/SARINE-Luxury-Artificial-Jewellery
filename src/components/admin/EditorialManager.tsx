import React, { useEffect, useMemo, useState } from "react";
import { hostingerMediaService } from "../../services";
import { hostingerStorefrontService, type EditorialContent, type EditorialSchedule, type EditorialScheduleStatus } from "../../services/hostinger/hostingerStorefrontService";

const defaults: EditorialContent = {
  eyebrow: "EDITORIAL COLLECTION",
  title: "The Art of Everyday Elegance",
  description: "A curated collection that blends classic beauty with modern sensibilities.",
  ctaText: "Explore the Collection",
  ctaLink: "/shop",
  imageUrl: "/images/optimized/editorial-banner.webp",
  active: true
};
type Collection = "" | "artificial" | "demi-fine";
type PreviewMode = "desktop" | "tablet" | "mobile";

function toLocalDateTimeInput(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
function fromLocalDateTimeInput(value: string): string {
  return new Date(value).toISOString();
}
function scheduleStatusLabel(status: EditorialScheduleStatus): string {
  if (status === "scheduled") return "Scheduled";
  if (status === "published") return "Published";
  if (status === "expired") return "Expired";
  return "Not scheduled";
}

export const EditorialManager: React.FC = () => {
  const [collection, setCollection] = useState<Collection>("");
  const [draft, setDraft] = useState<EditorialContent>(defaults);
  const [published, setPublished] = useState<EditorialContent>(defaults);
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("desktop");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [schedule, setSchedule] = useState<EditorialSchedule | null>(null);
  const [scheduleStatus, setScheduleStatus] = useState<EditorialScheduleStatus>("none");
  const [scheduleStartLocal, setScheduleStartLocal] = useState("");
  const [scheduleEndLocal, setScheduleEndLocal] = useState("");
  const [scheduleReviewOpen, setScheduleReviewOpen] = useState(false);
  const [cancelScheduleOpen, setCancelScheduleOpen] = useState(false);

  const snapshot = JSON.stringify(draft);
  const previewCurrent = savedSnapshot === snapshot && !file;
  const changedFields = useMemo(() => {
    const fields: Array<[string, keyof EditorialContent]> = [
      ["Eyebrow", "eyebrow"], ["Heading", "title"], ["Description", "description"],
      ["Button label", "ctaText"], ["Button destination", "ctaLink"], ["Artwork", "imageUrl"], ["Visibility", "active"]
    ];
    return fields.filter(([, key]) => JSON.stringify(draft[key]) !== JSON.stringify(published[key])).map(([label]) => label);
  }, [draft, published]);

  useEffect(() => {
    let current = true;
    setLoading(true); setError(""); setMessage(""); setReviewOpen(false); setSavedSnapshot(null);
    void hostingerStorefrontService.getEditorial(collection || undefined).then(result => {
      if (!current) return;
      const nextDraft = { ...defaults, ...result.draft };
      setDraft(nextDraft);
      setPublished({ ...defaults, ...result.published });
      setSchedule(result.schedule);
      setScheduleStatus(result.scheduleStatus);
      setScheduleStartLocal(toLocalDateTimeInput(result.schedule?.startsAtUtc));
      setScheduleEndLocal(toLocalDateTimeInput(result.schedule?.endsAtUtc));
      setSavedSnapshot(JSON.stringify(nextDraft));
      setFile(null);
    }).catch(e => {
      if (current) setError(e instanceof Error ? e.message : "Unable to load editorial settings.");
    }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [collection]);

  const saveDraft = async () => {
    setBusy(true); setError(""); setMessage("");
    try {
      let imageUrl = draft.imageUrl;
      if (file) imageUrl = await hostingerMediaService.uploadImage(file);
      const payload = { ...draft, imageUrl };
      const result = await hostingerStorefrontService.saveEditorial(payload, collection || undefined);
      const saved = { ...defaults, ...result.draft };
      setDraft(saved); setPublished({ ...defaults, ...result.published });
      setSchedule(result.schedule);
      setScheduleStatus(result.scheduleStatus);
      setSavedSnapshot(JSON.stringify(saved)); setFile(null); setReviewOpen(false);
      setMessage("Editorial draft saved. It is not live until you confirm publication.");
    } catch (e) { setError(e instanceof Error ? e.message : "Editorial draft could not be saved."); }
    finally { setBusy(false); }
  };

  const reviewPublish = () => {
    setError("");
    if (!previewCurrent) { setError("Save draft & refresh preview before reviewing publication."); return; }
    if (!changedFields.length) { setError("There are no editorial changes to publish for this version."); return; }
    setReviewOpen(true);
  };

  const confirmPublish = async () => {
    if (!previewCurrent) { setReviewOpen(false); setError("The draft changed after review. Save it and refresh the preview again."); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await hostingerStorefrontService.publishEditorial(collection || undefined);
      const next = { ...defaults, ...result.published };
      setDraft(next); setPublished(next); setSavedSnapshot(JSON.stringify(next)); setReviewOpen(false);
      setSchedule(result.schedule); setScheduleStatus(result.scheduleStatus);
      setScheduleStartLocal(""); setScheduleEndLocal("");
      setMessage("The saved Editorial version is now published. Any previous schedule was cleared.");
    } catch (e) { setError(e instanceof Error ? e.message : "Editorial publication failed."); }
    finally { setBusy(false); }
  };

  const reviewSchedule = () => {
    setError("");
    if (!previewCurrent) { setError("Save draft & refresh preview before scheduling publication."); return; }
    if (!scheduleStartLocal) { setError("Choose a publication date and time."); return; }
    const startsAt = new Date(scheduleStartLocal);
    const endsAt = scheduleEndLocal ? new Date(scheduleEndLocal) : null;
    if (!Number.isFinite(startsAt.getTime()) || startsAt.getTime() <= Date.now()) { setError("Choose a future publication date and time."); return; }
    if (endsAt && (!Number.isFinite(endsAt.getTime()) || endsAt.getTime() <= startsAt.getTime())) { setError("Expiry date and time must be later than publication."); return; }
    setScheduleReviewOpen(true);
  };

  const confirmSchedule = async () => {
    if (!previewCurrent || !scheduleStartLocal) { setScheduleReviewOpen(false); setError("Save the current draft before scheduling it."); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await hostingerStorefrontService.scheduleEditorial(
        fromLocalDateTimeInput(scheduleStartLocal),
        scheduleEndLocal ? fromLocalDateTimeInput(scheduleEndLocal) : null,
        collection || undefined
      );
      setSchedule(result.schedule);
      setScheduleStatus(result.scheduleStatus);
      setScheduleReviewOpen(false);
      setMessage("Editorial publication scheduled. The saved snapshot will go live automatically at the selected time.");
    } catch (e) { setError(e instanceof Error ? e.message : "Editorial schedule could not be saved."); }
    finally { setBusy(false); }
  };

  const cancelSchedule = async () => {
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await hostingerStorefrontService.cancelEditorialSchedule(collection || undefined);
      setSchedule(result.schedule);
      setScheduleStatus(result.scheduleStatus);
      setScheduleStartLocal(""); setScheduleEndLocal(""); setCancelScheduleOpen(false);
      setMessage("Editorial schedule cancelled. The previous published version remains live.");
    } catch (e) { setError(e instanceof Error ? e.message : "Editorial schedule could not be cancelled."); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    if (!schedule) return;
    const refreshStatus = () => {
      const now = Date.now();
      const starts = new Date(schedule.startsAtUtc).getTime();
      const ends = schedule.endsAtUtc ? new Date(schedule.endsAtUtc).getTime() : null;
      setScheduleStatus(now < starts ? "scheduled" : ends !== null && now >= ends ? "expired" : "published");
    };
    refreshStatus();
    const timer = window.setInterval(refreshStatus, 30_000);
    return () => window.clearInterval(timer);
  }, [schedule]);

  const update = <K extends keyof EditorialContent,>(key: K, value: EditorialContent[K]) => setDraft(current => ({ ...current, [key]: value }));

  return <div className="space-y-5">
    <section className="scroll-mt-24 rounded-2xl border bg-white p-5 space-y-4">
      <label className="block max-w-xs space-y-1 text-xs font-medium text-[#563568]">Homepage version
        <select value={collection} disabled={loading || busy || uploading} onChange={e => setCollection(e.target.value as Collection)} className="w-full rounded-lg border border-[#E7DCEB] bg-white p-2.5 text-sm">
          <option value="">Shared (shown in both collections)</option><option value="artificial">Artificial</option><option value="demi-fine">Demi-Fine</option>
        </select>
      </label>
      <div><h2 className="font-semibold text-[#2C1838]">Editorial Collection</h2><p className="text-xs text-gray-500">Manage the image, copy and destination shown in the Editorial Collection homepage section. Artificial and Demi-Fine inherit Shared until saved independently.</p></div>
      {loading ? <p className="text-sm text-gray-500">Loading editorial settings…</p> : <>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-xs"><span>Eyebrow</span><input value={draft.eyebrow} maxLength={120} onChange={e => update("eyebrow", e.target.value)} className="w-full rounded-lg border p-3 text-sm" /></label>
          <label className="space-y-1 text-xs"><span>Heading</span><input value={draft.title} maxLength={180} onChange={e => update("title", e.target.value)} className="w-full rounded-lg border p-3 text-sm" /></label>
          <label className="space-y-1 text-xs md:col-span-2"><span>Description</span><textarea value={draft.description} maxLength={500} rows={3} onChange={e => update("description", e.target.value)} className="w-full rounded-lg border p-3 text-sm" /></label>
          <label className="space-y-1 text-xs"><span>Button label</span><input value={draft.ctaText} maxLength={80} onChange={e => update("ctaText", e.target.value)} className="w-full rounded-lg border p-3 text-sm" /></label>
          <label className="space-y-1 text-xs"><span>Button destination</span><input value={draft.ctaLink} maxLength={500} onChange={e => update("ctaLink", e.target.value)} className="w-full rounded-lg border p-3 text-sm" /></label>
          <div className="space-y-2 md:col-span-2"><label className="block text-xs font-medium">Background artwork (JPEG, PNG or WebP)</label>
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => setFile(e.target.files?.[0] || null)} className="block w-full text-sm" />
            {file && <div className="flex flex-wrap items-center gap-2"><span className="text-xs text-gray-600">{file.name}</span><button type="button" disabled={busy || uploading} onClick={async () => { setUploading(true); setError(""); try { const imageUrl = await hostingerMediaService.uploadImage(file); update("imageUrl", imageUrl); setFile(null); setMessage("Artwork uploaded. Save draft to include it."); } catch (e) { setError(e instanceof Error ? e.message : "Artwork upload failed."); } finally { setUploading(false); } }} className="rounded-lg bg-[#563568] px-3 py-2 text-xs text-white disabled:opacity-50">{uploading ? "Uploading…" : "Upload artwork"}</button></div>}
          </div>
          <label className="flex items-center gap-2 text-sm md:col-span-2"><input type="checkbox" checked={draft.active} onChange={e => update("active", e.target.checked)} /> Show Editorial Collection when this version is published</label>
        </div>
      </>}
    </section>
    {!loading && <>
      <section className="space-y-3 rounded-2xl border bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold text-[#2C1838]">Responsive draft preview</h3><p className="text-xs text-gray-500">Preview local edits without saving or publishing.</p></div>
          <div className="flex gap-1 rounded-lg border p-1">{(["desktop", "tablet", "mobile"] as const).map(mode => <button key={mode} type="button" onClick={() => setPreviewMode(mode)} className={previewMode === mode ? "rounded-md bg-[#563568] px-3 py-1.5 text-xs text-white" : "rounded-md px-3 py-1.5 text-xs text-[#563568]"}>{mode[0].toUpperCase() + mode.slice(1)}</button>)}</div>
        </div>
        <div className="mx-auto overflow-hidden rounded-xl border bg-[#F7F0FA]" style={{ maxWidth: previewMode === "mobile" ? 390 : previewMode === "tablet" ? 768 : "100%" }}>
          <div className={previewMode === "mobile" ? "flex flex-col" : "grid grid-cols-2 items-center"}>
            <div className="p-5 sm:p-8"><p className="text-xs font-semibold tracking-[0.2em] text-[#705E7B]">{draft.eyebrow || "EDITORIAL"}</p><h4 className="mt-3 font-serif text-2xl text-[#563568] sm:text-3xl">{draft.title || "Your editorial heading"}</h4><p className="mt-3 text-sm leading-6 text-[#705E7B]">{draft.description || "Your editorial description will appear here."}</p><span className="mt-5 inline-flex rounded-lg bg-[#563568] px-4 py-2.5 text-sm font-semibold text-white">{draft.ctaText || "Explore"}</span></div>
            <div className="min-h-48 bg-white">{draft.imageUrl ? <img src={draft.imageUrl} alt={draft.title || "Editorial artwork"} className="h-full max-h-[420px] w-full object-cover" /> : <div className="flex min-h-48 items-center justify-center text-sm text-[#705E7B]">Upload editorial artwork to preview</div>}</div>
          </div><p className="border-t bg-white px-3 py-2 text-right text-[11px] text-[#705E7B]">Preview width: {previewMode === "mobile" ? "390px" : previewMode === "tablet" ? "up to 768px" : "desktop"}. Local draft only.</p>
        </div>
      </section>
      <section className="space-y-3 rounded-2xl border border-[#E7DCEB] bg-white p-5" aria-label="Editorial draft and publication review">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold text-[#2C1838]">Draft & publication safety</h3><p className="mt-1 text-xs text-[#705E7B]">Only the selected editorial version is affected.</p></div><span className={previewCurrent ? "rounded-full bg-[#EAF7EF] px-3 py-1 text-xs font-semibold text-[#24613A]" : "rounded-full bg-[#FFF5E8] px-3 py-1 text-xs font-semibold text-[#8A5315]"}>{previewCurrent ? "Saved preview is current" : "Preview needs saving"}</span></div>
        <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-lg bg-[#FCFAFD] p-3"><p className="text-xs font-semibold text-[#563568]">Draft vs published</p>{changedFields.length ? <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-[#705E7B]">{changedFields.map(field => <li key={field}>{field} changed</li>)}</ul> : <p className="mt-2 text-xs text-[#705E7B]">The draft matches the published version.</p>}</div>
          <div className="rounded-lg bg-[#FCFAFD] p-3"><p className="text-xs font-semibold text-[#563568]">Selected version</p><p className="mt-2 text-sm font-semibold text-[#302438]">{collection === "artificial" ? "Artificial" : collection === "demi-fine" ? "Demi-Fine" : "Shared (shown in both collections)"}</p><p className="mt-1 text-xs text-[#705E7B]">{previewCurrent ? "Preview represents the exact saved draft." : "Save draft & refresh preview before publication."}</p></div></div>
        <div className="space-y-3 rounded-xl border border-[#E7DCEB] bg-[#FCFAFD] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-sm font-semibold text-[#563568]">Scheduled publishing</h3><p className="mt-1 text-xs text-[#705E7B]">Times use your local time zone. The scheduled snapshot goes live automatically at the start time and the previous published version returns at expiry.</p></div><span className="rounded-full bg-[#F0EAF5] px-3 py-1 text-xs font-semibold text-[#563568]">{scheduleStatusLabel(scheduleStatus)}</span></div>
          {schedule && <div className="rounded-lg bg-white p-3 text-xs text-[#705E7B]">
            <p><strong>Starts:</strong> {new Date(schedule.startsAtUtc).toLocaleString()}</p>
            <p className="mt-1"><strong>Expires:</strong> {schedule.endsAtUtc ? new Date(schedule.endsAtUtc).toLocaleString() : "No expiry — remains live until cancelled or replaced"}</p>
            {scheduleStatus === "scheduled" && <p className="mt-2">This saved editorial snapshot is waiting for its start time.</p>}
            {scheduleStatus === "published" && <p className="mt-2">The scheduled editorial snapshot is currently live.</p>}
            {scheduleStatus === "expired" && <p className="mt-2">The scheduled window has ended; the previous published version is live again.</p>}
          </div>}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs"><span>Publish date & time (local)</span><input type="datetime-local" value={scheduleStartLocal} min={toLocalDateTimeInput(new Date().toISOString())} onChange={e => setScheduleStartLocal(e.target.value)} disabled={busy || loading} className="w-full rounded-lg border bg-white p-3 text-sm" /></label>
            <label className="space-y-1 text-xs"><span>Expiry date & time (optional)</span><input type="datetime-local" value={scheduleEndLocal} min={scheduleStartLocal || undefined} onChange={e => setScheduleEndLocal(e.target.value)} disabled={busy || loading} className="w-full rounded-lg border bg-white p-3 text-sm" /></label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy || uploading || !previewCurrent || !scheduleStartLocal} onClick={reviewSchedule} className="rounded-lg bg-[#563568] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{schedule ? "Review reschedule" : "Review schedule"}</button>
            {schedule && <button type="button" disabled={busy} onClick={() => setCancelScheduleOpen(true)} className="rounded-lg border border-[#DCCCE4] px-4 py-2.5 text-sm font-semibold text-[#563568] disabled:opacity-50">Cancel schedule</button>}
          </div>
          {scheduleReviewOpen && <div role="dialog" aria-label="Confirm editorial schedule" className="space-y-3 rounded-lg border border-[#B69ACF] bg-white p-3">
            <h4 className="text-sm font-semibold text-[#563568]">Confirm scheduled publication</h4>
            <p className="text-xs text-[#705E7B]">The saved {collection === "artificial" ? "Artificial" : collection === "demi-fine" ? "Demi-Fine" : "Shared"} editorial snapshot will become visible at {new Date(scheduleStartLocal).toLocaleString()}{scheduleEndLocal ? " and expire at " + new Date(scheduleEndLocal).toLocaleString() : ", with no automatic expiry"}. {schedule ? "This replaces the current schedule." : ""}</p>
            <div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => void confirmSchedule()} className="rounded-lg bg-[#563568] px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50">{busy ? "Scheduling…" : "Confirm schedule"}</button><button type="button" disabled={busy} onClick={() => setScheduleReviewOpen(false)} className="rounded-lg border px-4 py-2.5 text-xs">Keep editing</button></div>
          </div>}
          {cancelScheduleOpen && <div role="dialog" aria-label="Confirm schedule cancellation" className="space-y-3 rounded-lg border border-amber-200 bg-white p-3">
            <p className="text-xs text-[#705E7B]">Cancel this schedule? The scheduled snapshot will stop being served and the previous published version will remain live.</p>
            <div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => void cancelSchedule()} className="rounded-lg bg-[#563568] px-4 py-2.5 text-xs font-semibold text-white">Confirm cancellation</button><button type="button" disabled={busy} onClick={() => setCancelScheduleOpen(false)} className="rounded-lg border px-4 py-2.5 text-xs">Keep schedule</button></div>
          </div>}
        </div>
        <div className="flex flex-wrap gap-2"><button type="button" disabled={busy || uploading || loading} onClick={() => void saveDraft()} className="rounded-lg border border-[#DCCCE4] px-4 py-2.5 text-sm font-semibold text-[#563568] disabled:opacity-50">Save draft & refresh preview</button><button type="button" disabled={busy || !previewCurrent || !changedFields.length} onClick={reviewPublish} className="rounded-lg bg-[#563568] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Review & publish this version</button></div>
        {reviewOpen && <div role="dialog" aria-label="Confirm editorial publication" className="space-y-3 rounded-xl border border-[#B69ACF] bg-[#F7F0FA] p-4"><div><h4 className="font-semibold text-[#563568]">Confirm editorial publication</h4><p className="mt-1 text-xs text-[#705E7B]">You are publishing the saved {collection === "artificial" ? "Artificial" : collection === "demi-fine" ? "Demi-Fine" : "Shared"} Editorial version immediately. Any scheduled window for this version will be cleared. Other collection versions remain unchanged.</p></div><ul className="list-disc space-y-1 pl-4 text-xs text-[#705E7B]">{changedFields.map(field => <li key={field}>{field}</li>)}</ul><div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => void confirmPublish()} className="rounded-lg bg-[#563568] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Publishing…" : "Confirm and publish this version"}</button><button type="button" disabled={busy} onClick={() => setReviewOpen(false)} className="rounded-lg border border-[#DCCCE4] px-4 py-2.5 text-sm font-semibold text-[#563568]">Cancel</button></div></div>}
      </section>
    </>}
    {error && <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    {message && <div role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{message}</div>}
  </div>;
};
