import React, { useEffect, useState } from "react";
import { DEFAULT_SITE_CHROME, siteChromeService, type SiteChromeSettings } from "../../services/hostinger/siteChromeService";

export const SiteChromeManager: React.FC = () => {
  const [settings, setSettings] = useState<SiteChromeSettings>(DEFAULT_SITE_CHROME);
  const [saved, setSaved] = useState<SiteChromeSettings>(DEFAULT_SITE_CHROME);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const dirty = JSON.stringify(settings) !== JSON.stringify(saved);
  const socialUrlsValid = ([settings.footer.social.facebook, settings.footer.social.pinterest, settings.footer.social.youtube] as string[]).every(value => {
    if (!value.trim()) return true;
    try { return new URL(value).protocol === "https:"; } catch { return false; }
  });
  const requiredCopyValid = [settings.header.tagline, settings.footer.tagline, settings.footer.copyright, ...Object.values(settings.footer.headings)].every(value => value.trim().length > 0);
  const formValid = socialUrlsValid && requiredCopyValid;
  useEffect(() => {
    let active = true;
    siteChromeService.getDraft().then(result => {
      if (!active) return;
      setSettings(result.draft); setSaved(result.draft);
    }).catch(e => { if (active) setError(e instanceof Error ? e.message : "Unable to load header and footer settings."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const update = (patch: { header?: Partial<SiteChromeSettings["header"]>; footer?: { tagline?: string; copyright?: string; social?: Partial<SiteChromeSettings["footer"]["social"]>; headings?: Partial<SiteChromeSettings["footer"]["headings"]> } }) => setSettings(current => ({
    ...current,
    header: { ...current.header, ...(patch.header || {}) },
    footer: { ...current.footer, ...(patch.footer || {}), social: { ...current.footer.social, ...(patch.footer?.social || {}) }, headings: { ...current.footer.headings, ...(patch.footer?.headings || {}) } }
  }));
  const save = async () => {
    if (!formValid) { setError("Complete all brand text fields and use valid HTTPS social profile URLs."); return; }
    setBusy(true); setError(""); setMessage("");
    try { const result = await siteChromeService.saveDraft(settings); setSettings(result.draft); setSaved(result.draft); setMessage("Header and footer draft saved. The live storefront is unchanged."); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not save header and footer settings."); }
    finally { setBusy(false); }
  };
  const publish = async () => {
    if (!formValid) { setError("Complete all brand text fields and use valid HTTPS social profile URLs before publishing."); return; }
    if (!window.confirm("Publish these header and footer changes to the live SARINE storefront?")) return;
    setBusy(true); setError(""); setMessage("");
    try { await siteChromeService.saveDraft(settings); const result = await siteChromeService.publish(); setSaved(result.published); setMessage("Header and footer settings published."); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not publish header and footer settings."); }
    finally { setBusy(false); }
  };
  const field = (label: string, value: string, onChange: (value: string) => void, maxLength = 120) => (
    <label className="block space-y-1 text-xs font-medium text-[#563568]">{label}
      <input value={value} maxLength={maxLength} onChange={e => onChange(e.target.value)} className="min-h-11 w-full rounded-lg border border-[#E7DCEB] bg-white p-3 text-sm text-[#302438]" />
    </label>
  );
  return <section className="rounded-2xl border border-[#E7DCEB] bg-white p-4 sm:p-6 space-y-5">
    <div><p className="text-[11px] uppercase tracking-[0.18em] font-semibold text-[#8B70A0]">Shared storefront content</p><h2 className="mt-1 font-serif text-2xl text-[#563568]">Header & Footer Studio</h2><p className="mt-1 text-sm text-[#705E7B]">Edit shared brand messaging, footer headings and social destinations without changing checkout or essential store links.</p></div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {message && <p role="status" className="rounded-lg bg-[#F7F0FA] p-3 text-sm text-[#563568]">{message}</p>}
    {!loading && <p className="text-xs text-[#705E7B]" role="status">{dirty ? "You have unsaved header/footer changes." : "Header/footer draft is saved."} {!socialUrlsValid && "Social links must use HTTPS."} {!requiredCopyValid && "Brand text fields cannot be empty."}</p>}
    {loading ? <p role="status" className="text-sm text-[#705E7B]">Loading shared content…</p> : <>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3 rounded-xl border p-4">
          <h3 className="font-semibold text-[#302438]">Header</h3>
          {field("Brand tagline", settings.header.tagline, value => update({ header: { tagline: value } }), 100)}
          <p className="text-xs text-gray-500">Displayed beneath the SARINE wordmark where space allows.</p>
        </div>
        <div className="space-y-3 rounded-xl border p-4">
          <h3 className="font-semibold text-[#302438]">Footer brand content</h3>
          {field("Footer tagline", settings.footer.tagline, value => update({ footer: { tagline: value } }), 140)}
          {field("Copyright line", settings.footer.copyright, value => update({ footer: { copyright: value } }), 140)}
        </div>
      </div>
      <div className="rounded-xl border p-4 space-y-3">
        <h3 className="font-semibold text-[#302438]">Footer column headings</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(["shop","care","about","payments"] as const).map(key => field(key === "care" ? "Customer care" : key === "payments" ? "Payment methods" : key[0].toUpperCase()+key.slice(1), settings.footer.headings[key], value => update({ footer: { headings: { ...settings.footer.headings, [key]: value } } }), 50))}
        </div>
      </div>
      <div className="rounded-xl border p-4 space-y-3">
        <h3 className="font-semibold text-[#302438]">Social profile destinations</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {(["facebook","pinterest","youtube"] as const).map(key => field(key[0].toUpperCase()+key.slice(1)+" URL", settings.footer.social[key], value => update({ footer: { social: { ...settings.footer.social, [key]: value } } }), 300))}
        </div>
        <p className="text-xs text-gray-500">Use full HTTPS URLs. Leave a network's default destination until your official profile is ready.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy || !formValid || !dirty} className="min-h-11 rounded-lg border border-[#563568] px-5 py-2 text-sm font-medium text-[#563568] disabled:opacity-50">Save draft</button>
        <button type="button" disabled={busy || !formValid} className="min-h-11 rounded-lg bg-[#563568] px-5 py-2 text-sm font-medium text-white disabled:opacity-50">Save & publish</button>
        <button type="button" disabled={busy} onClick={() => setSettings(saved)} className="min-h-11 rounded-lg border px-4 py-2 text-sm disabled:opacity-50">Discard edits</button>
      </div>
    </>}
  </section>;
};
