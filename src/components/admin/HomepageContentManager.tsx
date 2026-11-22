import React, { useEffect, useState } from "react";
import { hostingerMediaService } from "../../services";
import {
  DEFAULT_HOMEPAGE_CONTENT,
  hostingerStorefrontService,
  type HomepageContent
} from "../../services/hostinger/hostingerStorefrontService";

const fieldClass = "w-full rounded-lg border border-[#E7DCEB] bg-white p-3 text-sm text-[#302438] focus:outline-none focus:ring-2 focus:ring-[#B69ACF]";
const labelClass = "block space-y-1.5 text-xs font-medium text-[#563568]";

export const HomepageContentManager: React.FC = () => {
  const [draft, setDraft] = useState<HomepageContent>(DEFAULT_HOMEPAGE_CONTENT);
  const [published, setPublished] = useState<HomepageContent>(DEFAULT_HOMEPAGE_CONTENT);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState(false);

  const load = async () => {
    setLoading(true); setError(""); setMessage("");
    try {
      const result = await hostingerStorefrontService.getHomepageContent();
      setDraft(result.draft);
      setPublished(result.published);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Homepage content could not be loaded.");
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const update = (patch: Partial<HomepageContent>) => {
    setDraft(current => ({ ...current, ...patch }));
    setMessage("");
  };
  const saveDraft = async () => {
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await hostingerStorefrontService.saveHomepageContent(draft);
      setDraft(result.draft);
      setMessage("Homepage content draft saved. The live homepage is unchanged until you publish.");
    } catch (e) { setError(e instanceof Error ? e.message : "Homepage content draft could not be saved."); }
    finally { setBusy(false); }
  };
  const publish = async () => {
    setBusy(true); setError(""); setMessage("");
    try {
      await hostingerStorefrontService.saveHomepageContent(draft);
      const result = await hostingerStorefrontService.publishHomepageContent();
      setDraft(result.published);
      setPublished(result.published);
      setMessage("Homepage content published successfully.");
    } catch (e) { setError(e instanceof Error ? e.message : "Homepage content could not be published."); }
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
  const input = (value: string, onChange: (value: string) => void, maxLength: number, placeholder = "") =>
    <input value={value} maxLength={maxLength} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={fieldClass} />;
  const textarea = (value: string, onChange: (value: string) => void, maxLength: number, rows = 3) =>
    <textarea value={value} maxLength={maxLength} rows={rows} onChange={e => onChange(e.target.value)} className={fieldClass} />;

  return <section className="rounded-2xl border border-[#E7DCEB] bg-white p-5 sm:p-6 space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="font-semibold text-[#2C1838]">Homepage Content Editor</h2>
        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-[#6F6475]">Edit the actual copy, buttons, destinations, story image and care cards used by the homepage. Changes are saved as a draft first; publishing updates the customer-facing content.</p>
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
                <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || uploading} onChange={e => { void uploadStoryImage(e.target.files?.[0]); e.currentTarget.value = ""; }} className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[#F7F0FA] file:px-3 file:py-2 file:text-xs file:font-medium file:text-[#563568]" />
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

      {preview && <div className="space-y-3 rounded-xl border border-[#B69ACF] bg-[#F7F0FA] p-4">
        <div className="flex items-center justify-between gap-2"><h3 className="font-semibold text-[#563568]">Draft content preview</h3><span className="text-[11px] text-[#6F6475]">Text and artwork preview · live styling remains on the storefront</span></div>
        <div className="grid gap-3 md:grid-cols-2">
          <article className="rounded-lg bg-white p-4"><p className="text-[10px] uppercase tracking-widest text-[#6F6475]">{draft.price.eyebrow}</p><h4 className="mt-1 font-serif text-2xl text-[#302438]">{draft.price.title}</h4><p className="mt-2 text-sm text-[#6F6475]">{draft.price.description}</p><div className="mt-3 flex flex-wrap gap-2">{draft.price.links.map((link,i)=><span key={i} className="rounded-full border px-3 py-2 text-xs">{link.label}</span>)}</div></article>
          <article className="rounded-lg bg-white p-4"><p className="text-[10px] uppercase tracking-widest text-[#6F6475]">{draft.contact.eyebrow}</p><h4 className="mt-1 font-serif text-2xl text-[#302438]">{draft.contact.title}</h4><p className="mt-2 text-sm text-[#6F6475]">{draft.contact.description} <span className="font-medium underline">{draft.contact.linkText}</span>.</p></article>
          <article className="rounded-lg bg-white p-4 md:col-span-2"><img src={draft.story.imageUrl} alt="" className="mb-3 h-36 w-full rounded-lg object-cover sm:h-48" /><p className="text-[10px] uppercase tracking-widest text-[#6F6475]">{draft.story.eyebrow}</p><h4 className="mt-1 font-serif text-2xl text-[#302438]">{draft.story.title}</h4>{draft.story.paragraphs.map((p,i)=><p key={i} className="mt-2 text-sm text-[#6F6475]">{p}</p>)}<div className="mt-3 grid gap-2 sm:grid-cols-3">{draft.story.pillars.map((p,i)=><div key={i} className="rounded-lg bg-[#F7F0FA] p-3 text-sm"><strong>{p.title}</strong><p className="text-xs text-[#6F6475]">{p.description}</p></div>)}</div></article>
          <article className="rounded-lg bg-white p-4 md:col-span-2"><p className="text-[10px] uppercase tracking-widest text-[#6F6475]">{draft.care.eyebrow}</p><h4 className="mt-1 font-serif text-2xl text-[#302438]">{draft.care.title}</h4><p className="mt-2 text-sm text-[#6F6475]">{draft.care.description}</p><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{draft.care.steps.map((step,i)=><div key={i} className="rounded-lg bg-[#F7F0FA] p-3"><strong className="text-sm">{i+1}. {step.title}</strong><p className="mt-1 text-xs text-[#6F6475]">{step.description}</p></div>)}</div></article>
        </div>
      </div>}

      <div className="flex flex-wrap items-center gap-2 border-t border-[#E7DCEB] pt-4">
        <button type="button" disabled={busy || uploading} onClick={() => void saveDraft()} className="rounded-lg border border-[#DCCDE5] px-4 py-2.5 text-sm font-medium text-[#563568] disabled:opacity-50">{busy ? "Saving…" : "Save draft"}</button>
        <button type="button" disabled={busy || uploading} onClick={() => void publish()} className="rounded-lg bg-[#563568] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">{busy ? "Publishing…" : "Publish homepage content"}</button>
        <button type="button" disabled={busy || uploading} onClick={() => setPreview(value => !value)} className="rounded-lg border border-[#DCCDE5] px-4 py-2.5 text-sm text-[#563568]">{preview ? "Hide preview" : "Preview draft"}</button>
        <button type="button" disabled={busy || uploading} onClick={() => void load()} className="rounded-lg border border-[#DCCDE5] px-4 py-2.5 text-sm text-[#563568]">Reload saved content</button>
        <span className="text-[11px] text-[#6F6475]">Draft and published content are stored separately in MariaDB.</span>
      </div>
    </>}
  </section>;
};
