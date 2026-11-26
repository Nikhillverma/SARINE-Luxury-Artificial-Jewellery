import React, { useEffect, useState } from "react";
import { ArrowRight, Gem, ShieldCheck, Sparkles } from "lucide-react";
import { hostingerMediaService } from "../../services";
import {
  DEFAULT_HOMEPAGE_CONTENT,
  hostingerStorefrontService,
  type HomepageContent,
  type EditorialSchedule,
  type EditorialScheduleStatus
} from "../../services/hostinger/hostingerStorefrontService";

const fieldClass = "w-full rounded-lg border border-[#E7DCEB] bg-white p-3 text-sm text-[#302438] focus:outline-none focus:ring-2 focus:ring-[#B69ACF]";
const labelClass = "block space-y-1.5 text-xs font-medium text-[#563568]";
function localDateTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "";
}
function utcDateTime(value: string) { return new Date(value).toISOString(); }

export const HomepageContentManager: React.FC = () => {
  const [draft, setDraft] = useState<HomepageContent>(DEFAULT_HOMEPAGE_CONTENT);
  const [collection, setCollection] = useState<"" | "artificial" | "demi-fine">("");
  const [published, setPublished] = useState<HomepageContent>(DEFAULT_HOMEPAGE_CONTENT);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [savedPreview, setSavedPreview] = useState<HomepageContent | null>(null);
  const [showPublishConfirmation, setShowPublishConfirmation] = useState(false);
  const [schedule, setSchedule] = useState<EditorialSchedule | null>(null);
  const [scheduleStatus, setScheduleStatus] = useState<EditorialScheduleStatus>("none");
  const [startLocal, setStartLocal] = useState("");
  const [endLocal, setEndLocal] = useState("");
  const [scheduleReview, setScheduleReview] = useState(false);
  const [cancelReview, setCancelReview] = useState(false);

  const load = async (isCancelled: () => boolean = () => false) => {
    setLoading(true); setError(""); setMessage("");
    try {
      const result = await hostingerStorefrontService.getHomepageContent(collection || undefined);
      if (isCancelled()) return;
      setDraft(result.draft);
      setPublished(result.published);
      setSchedule(result.schedule); setScheduleStatus(result.scheduleStatus);
      setStartLocal(localDateTime(result.schedule?.startsAtUtc)); setEndLocal(localDateTime(result.schedule?.endsAtUtc));
      setSavedPreview(null);
      setShowPublishConfirmation(false);
    } catch (e) {
      if (!isCancelled()) setError(e instanceof Error ? e.message : "Homepage content could not be loaded.");
    } finally { if (!isCancelled()) setLoading(false); }
  };

  useEffect(() => { let cancelled = false; setDraft(DEFAULT_HOMEPAGE_CONTENT); setPublished(DEFAULT_HOMEPAGE_CONTENT); setSavedPreview(null); setPreview(false); setShowPublishConfirmation(false); void load(() => cancelled); return () => { cancelled = true; }; }, [collection]);

  const update = (patch: Partial<HomepageContent>) => {
    setDraft(current => ({ ...current, ...patch }));
    setMessage("");
  };
  const saveDraft = async (): Promise<boolean> => {
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await hostingerStorefrontService.saveHomepageContent(draft, collection || undefined);
      setDraft(result.draft);
      setSavedPreview(result.draft);
      setPreview(true);
      setShowPublishConfirmation(false);
      setMessage("Draft saved. The preview now shows this exact saved version; customers still see the published content.");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Homepage content draft could not be saved.");
      return false;
    } finally { setBusy(false); }
  };
  const publish = async () => {
    setBusy(true); setError(""); setMessage(""); setShowPublishConfirmation(false);
    try {
      const result = await hostingerStorefrontService.publishHomepageContent(collection || undefined);
      setDraft(result.published);
      setPublished(result.published);
      setSavedPreview(result.published);
      setSchedule(null); setScheduleStatus("none"); setStartLocal(""); setEndLocal("");
      setMessage("Homepage content published successfully. Any pending schedule was cleared.");
    } catch (e) { setError(e instanceof Error ? e.message : "Homepage content could not be published."); }
    finally { setBusy(false); }
  };
  const hasSavedPreview = savedPreview !== null && JSON.stringify(draft) === JSON.stringify(savedPreview);
  const reviewContentSchedule = () => {
    setError("");
    if (!hasSavedPreview) { setError("Save draft & refresh preview before scheduling."); return; }
    const start = new Date(startLocal);
    const end = endLocal ? new Date(endLocal) : null;
    if (!startLocal || !Number.isFinite(start.getTime()) || start.getTime() <= Date.now()) { setError("Choose a future publication date and time."); return; }
    if (end && (!Number.isFinite(end.getTime()) || end.getTime() <= start.getTime())) { setError("Expiry must be later than publication."); return; }
    setScheduleReview(true);
  };
  const confirmContentSchedule = async () => {
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await hostingerStorefrontService.scheduleHomepageContent(utcDateTime(startLocal), endLocal ? utcDateTime(endLocal) : null, collection || undefined);
      setSchedule(result.schedule); setScheduleStatus(result.scheduleStatus); setScheduleReview(false);
      setMessage("Homepage content publication scheduled.");
    } catch (e) { setError(e instanceof Error ? e.message : "Schedule could not be saved."); }
    finally { setBusy(false); }
  };
  const cancelContentSchedule = async () => {
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await hostingerStorefrontService.cancelHomepageContentSchedule(collection || undefined);
      setSchedule(result.schedule); setScheduleStatus(result.scheduleStatus); setStartLocal(""); setEndLocal(""); setCancelReview(false);
      setMessage("Schedule cancelled. The previous published version remains live.");
    } catch (e) { setError(e instanceof Error ? e.message : "Schedule could not be cancelled."); }
    finally { setBusy(false); }
  };
  const uploadStoryImage = async (file?: File) => {
    if (!file) return;
    setUploading(true); setError(""); setMessage("");
    try {
      const imageUrl = await hostingerMediaService.uploadImage(file);
      setDraft(current => ({ ...current, story: { ...current.story, imageUrl } }));
      setMessage("Our Story image uploaded to Hostinger. Save the draft to keep this change.");
    } catch (e) { setError(e instanceof Error ? e.message : "Our Story image upload failed."); }
    finally { setUploading(false); }
  };

  const isPublished = JSON.stringify(draft) === JSON.stringify(published);
  const contentChanges: string[] = ([
    ["Shop by Price", draft.price, published.price],
    ["Our Story", draft.story, published.story],
    ["Jewellery Care Guide", draft.care, published.care],
    ["Stay in Touch", draft.contact, published.contact]
  ] as const).filter(([, current, live]) => JSON.stringify(current) !== JSON.stringify(live)).map(([label]) => label);
  const previewContent = savedPreview || draft;
  const selectedVersion = collection === "artificial" ? "Artificial" : collection === "demi-fine" ? "Demi-Fine" : "Shared (both collections)";
  const input = (value: string, onChange: (value: string) => void, maxLength: number, placeholder = "") =>
    <input value={value} maxLength={maxLength} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={fieldClass} />;
  const textarea = (value: string, onChange: (value: string) => void, maxLength: number, rows = 3) =>
    <textarea value={value} maxLength={maxLength} rows={rows} onChange={e => onChange(e.target.value)} className={fieldClass} />;

  return <section className="rounded-2xl border border-[#E7DCEB] bg-white p-5 sm:p-6 space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="font-semibold text-[#2C1838]">Homepage Content Editor</h2>
        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-[#6F6475]">Edit the actual copy, buttons, destinations, story image and care cards used by the homepage. Changes are saved as a draft first; publishing updates the customer-facing content.</p>
        <label className="mt-3 block max-w-xs space-y-1 text-xs font-medium text-[#563568]">Homepage version<select value={collection} disabled={loading || busy || uploading} onChange={event => setCollection(event.target.value as "" | "artificial" | "demi-fine")} className="w-full rounded-lg border border-[#E7DCEB] bg-white p-2.5 text-sm"><option value="">Shared (shown in both collections)</option><option value="artificial">Artificial</option><option value="demi-fine">Demi-Fine</option></select></label>
      </div>
      <span className={isPublished ? "rounded-full bg-green-50 px-3 py-1 text-xs text-green-700" : "rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-800"}>{isPublished ? "Published version" : "Unpublished changes"}</span>
    </div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {message && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{message}</p>}
    {loading ? <p className="text-sm text-gray-500">Loading saved homepage content…</p> : <>
      <div className="grid gap-5 lg:grid-cols-2">
        <fieldset className="min-w-0 space-y-3 rounded-xl border border-[#E7DCEB] p-4">
          <legend className="px-2 text-sm font-semibold text-[#563568]">Shop by Price</legend>
          <label className={labelClass}>Eyebrow {input(draft.price.eyebrow, value => update({ price: { ...draft.price, eyebrow: value } }), 80)}</label>
          <label className={labelClass}>Heading {input(draft.price.title, value => update({ price: { ...draft.price, title: value } }), 120)}</label>
          <label className={labelClass}>Description {textarea(draft.price.description, value => update({ price: { ...draft.price, description: value } }), 300, 2)}</label>
          <div className="space-y-3">
            {draft.price.links.map((link, index) => <div key={index} className="grid gap-2 sm:grid-cols-2">
              <label className={labelClass}>Link {index + 1} label {input(link.label, value => update({ price: { ...draft.price, links: draft.price.links.map((item, i) => i === index ? { ...item, label: value } : item) } }), 60)}</label>
              <label className={labelClass}>Internal destination {input(link.href, value => update({ price: { ...draft.price, links: draft.price.links.map((item, i) => i === index ? { ...item, href: value } : item) } }), 500, "/shop")}</label>
            </div>)}
          </div>
        </fieldset>

        <fieldset className="min-w-0 space-y-3 rounded-xl border border-[#E7DCEB] p-4">
          <legend className="px-2 text-sm font-semibold text-[#563568]">Stay in Touch</legend>
          <label className={labelClass}>Eyebrow {input(draft.contact.eyebrow, value => update({ contact: { ...draft.contact, eyebrow: value } }), 80)}</label>
          <label className={labelClass}>Heading {input(draft.contact.title, value => update({ contact: { ...draft.contact, title: value } }), 140)}</label>
          <label className={labelClass}>Description {textarea(draft.contact.description, value => update({ contact: { ...draft.contact, description: value } }), 300, 3)}</label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={labelClass}>Link label {input(draft.contact.linkText, value => update({ contact: { ...draft.contact, linkText: value } }), 60)}</label>
            <label className={labelClass}>Internal destination {input(draft.contact.linkHref, value => update({ contact: { ...draft.contact, linkHref: value } }), 500, "/contact")}</label>
          </div>
        </fieldset>

        <fieldset className="min-w-0 space-y-3 rounded-xl border border-[#E7DCEB] p-4 lg:col-span-2">
          <legend className="px-2 text-sm font-semibold text-[#563568]">Our Story</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={labelClass}>Eyebrow {input(draft.story.eyebrow, value => update({ story: { ...draft.story, eyebrow: value } }), 80)}</label>
            <label className={labelClass}>Heading {input(draft.story.title, value => update({ story: { ...draft.story, title: value } }), 140)}</label>
          </div>
          <label className={labelClass}>First paragraph {textarea(draft.story.paragraphs[0], value => update({ story: { ...draft.story, paragraphs: draft.story.paragraphs.map((item, i) => i === 0 ? value : item) } }), 700, 4)}</label>
          <label className={labelClass}>Second paragraph {textarea(draft.story.paragraphs[1], value => update({ story: { ...draft.story, paragraphs: draft.story.paragraphs.map((item, i) => i === 1 ? value : item) } }), 700, 4)}</label>
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
            <div className="space-y-2">
              <label className={labelClass}>Story image (JPEG, PNG or WebP)
                <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || uploading || loading} onChange={e => { void uploadStoryImage(e.target.files?.[0]); e.currentTarget.value = ""; }} className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[#F7F0FA] file:px-3 file:py-2 file:text-xs file:font-medium file:text-[#563568]" />
              </label>
              <p className="text-[11px] text-[#6F6475]">The image is uploaded to Hostinger media storage. It becomes customer-facing only after publishing the content draft.</p>
            </div>
            <img src={draft.story.imageUrl} alt="Our Story draft preview" className="h-32 w-full rounded-lg border border-[#E7DCEB] bg-[#F7F0FA] object-cover" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={labelClass}>Button label {input(draft.story.ctaText, value => update({ story: { ...draft.story, ctaText: value } }), 60)}</label>
            <label className={labelClass}>Internal destination {input(draft.story.ctaLink, value => update({ story: { ...draft.story, ctaLink: value } }), 500, "/about")}</label>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {draft.story.pillars.map((pillar, index) => <div key={index} className="space-y-2 rounded-lg bg-[#F7F0FA] p-3">
              <p className="text-xs font-semibold text-[#563568]">Brand pillar {index + 1}</p>
              <label className={labelClass}>Heading {input(pillar.title, value => update({ story: { ...draft.story, pillars: draft.story.pillars.map((item, i) => i === index ? { ...item, title: value } : item) } }), 60)}</label>
              <label className={labelClass}>Description {input(pillar.description, value => update({ story: { ...draft.story, pillars: draft.story.pillars.map((item, i) => i === index ? { ...item, description: value } : item) } }), 100)}</label>
            </div>)}
          </div>
        </fieldset>

        <fieldset className="min-w-0 space-y-3 rounded-xl border border-[#E7DCEB] p-4 lg:col-span-2">
          <legend className="px-2 text-sm font-semibold text-[#563568]">Jewellery Care Guide</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={labelClass}>Eyebrow {input(draft.care.eyebrow, value => update({ care: { ...draft.care, eyebrow: value } }), 80)}</label>
            <label className={labelClass}>Heading {input(draft.care.title, value => update({ care: { ...draft.care, title: value } }), 140)}</label>
          </div>
          <label className={labelClass}>Introduction {textarea(draft.care.description, value => update({ care: { ...draft.care, description: value } }), 500, 3)}</label>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {draft.care.steps.map((step, index) => <div key={index} className="space-y-2 rounded-lg bg-[#F7F0FA] p-3">
              <p className="text-xs font-semibold text-[#563568]">Care step {index + 1}</p>
              <label className={labelClass}>Heading {input(step.title, value => update({ care: { ...draft.care, steps: draft.care.steps.map((item, i) => i === index ? { ...item, title: value } : item) } }), 60)}</label>
              <label className={labelClass}>Description {textarea(step.description, value => update({ care: { ...draft.care, steps: draft.care.steps.map((item, i) => i === index ? { ...item, description: value } : item) } }), 300, 4)}</label>
            </div>)}
          </div>
        </fieldset>
      </div>

      {preview && <section className="space-y-4 rounded-2xl border border-[#DCCDE5] bg-[#F7F0FA] p-3 sm:p-5" aria-label="Responsive storefront draft preview">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-[#563568]">Live-style homepage preview</h3>
            <p className="mt-1 text-xs text-[#6F6475]">A visual rendering of the saved content version for {selectedVersion}. Draft only — nothing is published.</p>
          </div>
          <div className="inline-flex rounded-lg border border-[#DCCDE5] bg-white p-1" role="group" aria-label="Preview screen size">
            <button type="button" aria-pressed={previewDevice === "desktop"} onClick={() => setPreviewDevice("desktop")} className={previewDevice === "desktop" ? "min-h-10 rounded-md bg-[#563568] px-3 text-xs font-medium text-white" : "min-h-10 rounded-md px-3 text-xs text-[#563568]"}>Desktop</button>
            <button type="button" aria-pressed={previewDevice === "mobile"} onClick={() => setPreviewDevice("mobile")} className={previewDevice === "mobile" ? "min-h-10 rounded-md bg-[#563568] px-3 text-xs font-medium text-white" : "min-h-10 rounded-md px-3 text-xs text-[#563568]"}>Mobile</button>
          </div>
        </div>
        <div className="overflow-x-auto rounded-xl border border-[#DCCDE5] bg-[#EDE5F0] p-2 sm:p-4">
          <div className={previewDevice === "mobile" ? "mx-auto w-[390px] max-w-full overflow-hidden rounded-xl border border-[#D8C9E0] bg-white shadow-xl" : "mx-auto w-full max-w-[1120px] overflow-hidden rounded-xl border border-[#D8C9E0] bg-white shadow-xl"}>
            <div className="flex items-center justify-between border-b border-[#E7DCEB] bg-white px-4 py-3">
              <div className="font-serif text-lg tracking-[0.18em] text-[#563568]">SARINE</div>
              <div className="text-[9px] tracking-[0.12em] text-[#6F6475]">{previewDevice === "mobile" ? "MENU  ·  BAG" : "NEW ARRIVALS　 SHOP　 COLLECTIONS　 ABOUT"}</div>
            </div>

            <section className="border-b border-[#E7DCEB] bg-white px-4 py-7 text-center sm:px-8 sm:py-9">
              <span className="mb-2 block text-[9px] font-medium uppercase tracking-[0.25em] text-[#6F6475]">{previewContent.price.eyebrow}</span>
              <h4 className="font-serif text-2xl font-normal text-[#302438] sm:text-3xl">{previewContent.price.title}</h4>
              <p className="mx-auto mt-2 max-w-xl text-xs leading-relaxed text-[#6F6475]">{previewContent.price.description}</p>
              <div className="mx-auto mt-5 flex max-w-2xl flex-wrap items-center justify-center gap-2">
                {previewContent.price.links.map((link, index) => <span key={index} className="rounded-full border border-[#E7DCEB] bg-white px-4 py-2.5 text-[10px] font-medium text-[#302438] shadow-sm">{link.label}</span>)}
              </div>
            </section>

            <section className="border-y border-[#E7DCEB] bg-[#F0E6F4] px-4 py-6 sm:px-8 sm:py-9">
              <div className="grid grid-cols-1 items-center gap-5 lg:grid-cols-12 lg:gap-8">
                <div className="lg:col-span-5">
                  <div className="aspect-[4/3] overflow-hidden border border-[#E7DCEB] bg-[#EBDFF2] sm:aspect-[1/1]">
                    <img src={previewContent.story.imageUrl} alt="Our Story draft" className="h-full w-full object-cover" />
                  </div>
                </div>
                <div className="flex flex-col items-start gap-6 md:flex-row lg:col-span-7 lg:gap-8">
                  <div className="min-w-0 flex-1">
                    <span className="mb-2 block text-[9px] font-medium uppercase tracking-[0.25em] text-[#6F6475]">{previewContent.story.eyebrow}</span>
                    <h4 className="font-serif text-2xl font-normal leading-tight text-[#302438] sm:text-3xl">{previewContent.story.title}</h4>
                    {previewContent.story.paragraphs.map((paragraph, index) => <p key={index} className="mt-3 text-xs leading-relaxed text-[#6F6475]">{paragraph}</p>)}
                    <div className="mt-5 inline-flex items-center gap-2 rounded-sm bg-[#563568] px-5 py-3 text-[10px] font-medium text-white">{previewContent.story.ctaText}<ArrowRight size={13} /></div>
                  </div>
                  <div className="w-full space-y-4 border-t border-[#E7DCEB] pt-4 md:w-56 md:border-l md:border-t-0 md:pl-5 md:pt-1">
                    {previewContent.story.pillars.map((pillar, index) => {
                      const PillarIcon = [Gem, Sparkles, ShieldCheck][index] || Gem;
                      return <div key={index} className="flex items-start gap-3">
                        <span className="shrink-0 border border-[#E7DCEB] bg-[#FAF5FC] p-2 text-[#563568]"><PillarIcon size={16} strokeWidth={1.5} /></span>
                        <div><h5 className="text-[11px] font-medium leading-snug text-[#302438]">{pillar.title}</h5><p className="mt-0.5 text-[10px] leading-tight text-[#6F6475]">{pillar.description}</p></div>
                      </div>;
                    })}
                  </div>
                </div>
              </div>
            </section>

            <section className="border-t border-[#E7DCEB] bg-white px-4 py-7 sm:px-8 sm:py-9">
              <div className="mx-auto mb-6 max-w-2xl text-center">
                <span className="mb-2 block text-[9px] font-medium uppercase tracking-[0.25em] text-[#6F6475]">{previewContent.care.eyebrow}</span>
                <h4 className="font-serif text-2xl font-normal text-[#302438] sm:text-3xl">{previewContent.care.title}</h4>
                <p className="mt-2 text-xs leading-relaxed text-[#6F6475]">{previewContent.care.description}</p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {previewContent.care.steps.map((step, index) => <div key={index} className="space-y-2 border border-[#E7DCEB] bg-[#FAF5FC] p-4 text-center">
                  <span className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-[#563568] font-serif text-xs text-white">{index + 1}</span>
                  <h5 className="font-serif text-base text-[#302438]">{step.title}</h5>
                  <p className="text-[10px] leading-relaxed text-[#6F6475]">{step.description}</p>
                </div>)}
              </div>
            </section>

            <section className="bg-[#F7F0FA] px-4 py-7 text-center sm:px-8 sm:py-9">
              <div className="mx-auto max-w-[620px]">
                <span className="mb-2 block text-[9px] font-medium uppercase tracking-[0.25em] text-[#6F6475]">{previewContent.contact.eyebrow}</span>
                <h4 className="font-serif text-2xl font-normal text-[#302438] sm:text-3xl">{previewContent.contact.title}</h4>
                <p className="mt-3 text-xs leading-relaxed text-[#6F6475]">{previewContent.contact.description} <span className="font-medium text-[#563568] underline underline-offset-4">{previewContent.contact.linkText}</span>.</p>
              </div>
            </section>
            <div className="border-t border-[#E7DCEB] px-4 py-3 text-center text-[9px] tracking-[0.12em] text-[#8B7C91]">SARINE · LUXURY ARTIFICIAL JEWELLERY</div>
          </div>
        </div>
        <p className="text-[11px] text-[#6F6475]">Preview width: {previewDevice === "mobile" ? "390px mobile" : "fluid desktop (up to 1120px)"}. This preview shows the saved version only. Any edits made since saving are not included until you save and refresh again.</p>
      </section>}

      <section className="space-y-3 rounded-xl border border-[#E7DCEB] bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-sm font-semibold text-[#563568]">Scheduled publishing</h3><p className="mt-1 text-xs text-[#6F6475]">Uses your local time zone. The saved content snapshot goes live at the start time; the previous published version returns at expiry.</p></div><span className="rounded-full bg-[#F0EAF5] px-3 py-1 text-xs font-semibold text-[#563568]">{scheduleStatus === "none" ? "Not scheduled" : scheduleStatus === "scheduled" ? "Scheduled" : scheduleStatus === "published" ? "Published" : "Expired"}</span></div>
        {schedule && <div className="rounded-lg bg-[#FCFAFD] p-3 text-xs text-[#6F6475]"><p><strong>Starts:</strong> {new Date(schedule.startsAtUtc).toLocaleString()}</p><p className="mt-1"><strong>Expires:</strong> {schedule.endsAtUtc ? new Date(schedule.endsAtUtc).toLocaleString() : "No expiry"}</p></div>}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={labelClass}>Publish date & time (local)<input type="datetime-local" value={startLocal} min={localDateTime(new Date().toISOString())} onChange={e => setStartLocal(e.target.value)} disabled={busy || loading} className={fieldClass} /></label>
          <label className={labelClass}>Expiry date & time (optional)<input type="datetime-local" value={endLocal} min={startLocal || undefined} onChange={e => setEndLocal(e.target.value)} disabled={busy || loading} className={fieldClass} /></label>
        </div>
        <div className="flex flex-wrap gap-2"><button type="button" disabled={busy || uploading || loading || !hasSavedPreview || !startLocal} onClick={reviewContentSchedule} className="rounded-lg bg-[#563568] px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50">{schedule ? "Review reschedule" : "Review schedule"}</button>{schedule && <button type="button" disabled={busy} onClick={() => setCancelReview(true)} className="rounded-lg border px-4 py-2.5 text-xs text-[#563568]">Cancel schedule</button>}</div>
        {scheduleReview && <div role="dialog" className="space-y-3 rounded-lg border border-[#B69ACF] p-3"><h4 className="text-sm font-semibold text-[#563568]">Confirm scheduled publication</h4><p className="text-xs text-[#6F6475]">The saved {selectedVersion} homepage content goes live at {new Date(startLocal).toLocaleString()}{endLocal ? " and expires at " + new Date(endLocal).toLocaleString() : ", with no automatic expiry"}.</p><button type="button" disabled={busy} onClick={() => void confirmContentSchedule()} className="rounded-lg bg-[#563568] px-4 py-2 text-xs text-white">Confirm schedule</button><button type="button" disabled={busy} onClick={() => setScheduleReview(false)} className="ml-2 rounded-lg border px-4 py-2 text-xs">Keep editing</button></div>}
        {cancelReview && <div role="dialog" className="space-y-2 rounded-lg border border-amber-200 p-3"><p className="text-xs text-[#6F6475]">Cancel this schedule? The previous published content remains live.</p><button type="button" disabled={busy} onClick={() => void cancelContentSchedule()} className="rounded-lg bg-[#563568] px-4 py-2 text-xs text-white">Confirm cancellation</button><button type="button" disabled={busy} onClick={() => setCancelReview(false)} className="ml-2 rounded-lg border px-4 py-2 text-xs">Keep schedule</button></div>}
      </section>
      <div className="space-y-3 border-t border-[#E7DCEB] pt-4">
        <div className="rounded-xl border border-[#E7DCEB] bg-[#FCFAFD] p-4 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-[#302438]">Draft vs published comparison</h3>
            <span className="text-xs text-[#6F6475]">{contentChanges.length} changed section(s)</span>
          </div>
          {contentChanges.length ? <ul className="space-y-1 text-xs text-[#6F6475]">{contentChanges.map(label => <li key={label}>• {label} has unpublished changes</li>)}</ul> : <p className="text-xs text-[#6F6475]">The selected homepage content matches its published version.</p>}
          <p className="text-[11px] text-[#6F6475]">Comparison covers all editable text, links, story image and care cards for this content version.</p>
          <p className="text-[11px] text-[#6F6475]">{hasSavedPreview ? "Saved preview is up to date." : "Save draft & refresh preview after any edits before publishing."}</p>
        </div>
        {showPublishConfirmation && <div className="rounded-xl border-2 border-[#B69ACF] bg-[#F7F0FA] p-4 space-y-3" role="alertdialog" aria-labelledby="content-publish-confirm-title" aria-describedby="content-publish-confirm-description">
          <h3 id="content-publish-confirm-title" className="text-sm font-semibold text-[#302438]">Confirm homepage content publication</h3>
          <p id="content-publish-confirm-description" className="text-xs text-[#6F6475]">You are publishing the <strong>{selectedVersion}</strong> content version. This updates Shop by Price, Our Story, Jewellery Care Guide and Stay in Touch. The other collection and homepage section layout are not changed.</p>
          <p className="text-xs text-[#6F6475]">{contentChanges.length} section(s) differ from the current published content.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => void publish()} className="rounded-lg bg-[#563568] px-4 py-2.5 text-xs font-medium text-white disabled:opacity-50">Confirm and publish {selectedVersion}</button>
            <button type="button" disabled={busy} onClick={() => setShowPublishConfirmation(false)} className="rounded-lg border border-[#DCCDE5] bg-white px-4 py-2.5 text-xs text-[#563568]">Cancel</button>
          </div>
        </div>}
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={busy || uploading || loading} onClick={() => void saveDraft()} className="rounded-lg border border-[#DCCDE5] px-4 py-2.5 text-sm font-medium text-[#563568] disabled:opacity-50">{busy ? "Saving…" : "Save draft & refresh preview"}</button>
          <button type="button" disabled={busy || uploading || loading || !hasSavedPreview} onClick={() => { setError(""); setShowPublishConfirmation(true); }} className="rounded-lg bg-[#563568] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">{busy ? "Publishing…" : "Review & publish content"}</button>
          <button type="button" disabled={busy || uploading || loading || !savedPreview} onClick={() => setPreview(value => !value)} className="rounded-lg border border-[#DCCDE5] px-4 py-2.5 text-sm text-[#563568]">{preview ? "Hide preview" : "Show saved preview"}</button>
          <button type="button" disabled={busy || uploading || loading} onClick={() => void load()} className="rounded-lg border border-[#DCCDE5] px-4 py-2.5 text-sm text-[#563568]">Reload saved content</button>
        </div>
        <p className="text-[11px] text-[#6F6475]">Draft and published content are stored separately in MariaDB. Customers see no changes until you confirm publication.</p>
      </div>
    </>}
  </section>;
};
