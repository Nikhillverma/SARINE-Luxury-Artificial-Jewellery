import React, { useEffect, useMemo, useState } from "react";
import { hostingerMediaService } from "../../services";
import {
  hostingerStorefrontService,
  type MenStorefrontSettings,
  type MenStorefrontProduct,
  type MenLaunchSubscriber
} from "../../services/hostinger/hostingerStorefrontService";

const defaults: MenStorefrontSettings = {
  version: 1, enabled: true, heroImageUrl: "", eyebrow: "SARINE · MEN",
  title: "A New Standard of Style",
  description: "Modern essentials. Timeless details. Discover a considered edit of jewellery for him.",
  comingSoon: true, comingSoonText: "Our men's edit is on its way. Be among the first to discover it.",
  categories: [
    { id: "bracelets", title: "Bracelets", description: "Refined details for every day.", imageUrl: "", active: true, sortOrder: 0 },
    { id: "chains", title: "Chains", description: "Understated pieces with presence.", imageUrl: "", active: true, sortOrder: 1 },
    { id: "rings", title: "Rings", description: "A signature in the details.", imageUrl: "", active: true, sortOrder: 2 },
    { id: "kada", title: "Kada", description: "Classic form, modern character.", imageUrl: "", active: true, sortOrder: 3 }
  ],
  showProducts: false, productIds: [], featuredTitle: "The Men's Edit",
  bestSellerIds: [], showBestSellers: false, collections: [],
  offers: { enabled: false, label: "A little something extra", description: "", ctaText: "Explore offers", ctaLink: "/men" },
  notification: { enabled: true, headline: "Be first to know", description: "Sign up for an update when SARINE Men arrives.", buttonText: "Notify me" }
};

const fieldClass = "w-full rounded-lg border border-[#E7DCEB] bg-white px-3 py-2.5 text-sm text-[#302438] focus:outline-none focus:ring-2 focus:ring-[#B69ACF]";
const labelClass = "mb-1 block text-xs font-semibold text-[#563568]";

export const MenStorefrontManager: React.FC = () => {
  const [settings, setSettings] = useState<MenStorefrontSettings>(defaults);
  const [products, setProducts] = useState<MenStorefrontProduct[]>([]);
  const [subscribers, setSubscribers] = useState<MenLaunchSubscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState<"content" | "catalogue" | "marketing" | "signups">("content");

  const load = async () => {
    setLoading(true); setError("");
    try {
      const result = await hostingerStorefrontService.getMenStorefront();
      setSettings({ ...defaults, ...result.draft, offers: { ...defaults.offers, ...result.draft.offers }, notification: { ...defaults.notification, ...result.draft.notification } });
      setProducts(result.products || []);
      const signups = await hostingerStorefrontService.getMenLaunchSignups().catch(() => ({ subscribers: [] }));
      setSubscribers(signups.subscribers || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load SARINE Men settings.");
    } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const activeProducts = useMemo(() => products.filter(p => p.status === "active"), [products]);
  const update = <K extends keyof MenStorefrontSettings,>(key: K, value: MenStorefrontSettings[K]) => setSettings(current => ({ ...current, [key]: value }));

  const uploadImage = async (key: "heroImageUrl" | "category", file?: File, categoryId?: string) => {
    if (!file) return;
    setUploading(categoryId || key); setError(""); setMessage("");
    try {
      const url = await hostingerMediaService.uploadImage(file);
      if (key === "heroImageUrl") update("heroImageUrl", url);
      else update("categories", settings.categories.map(item => item.id === categoryId ? { ...item, imageUrl: url } : item));
      setMessage("Image uploaded to Hostinger. Save draft to keep this change.");
    } catch (e) { setError(e instanceof Error ? e.message : "Image upload failed."); }
    finally { setUploading(""); }
  };

  const saveDraft = async () => {
    setBusy(true); setError(""); setMessage("");
    try { await hostingerStorefrontService.saveMenStorefrontDraft(settings); setMessage("Draft saved. It is not public until you publish."); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not save the draft."); }
    finally { setBusy(false); }
  };
  const publish = async () => {
    setBusy(true); setError(""); setMessage("");
    try {
      await hostingerStorefrontService.saveMenStorefrontDraft(settings);
      await hostingerStorefrontService.publishMenStorefront();
      setMessage("SARINE Men changes are now published.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not publish SARINE Men."); }
    finally { setBusy(false); }
  };

  const toggleId = (key: "productIds" | "bestSellerIds", id: string) => {
    const current = settings[key];
    update(key, current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  };
  const addCategory = () => {
    if (settings.categories.length >= 12) return;
    const id = `category-${Date.now()}`;
    update("categories", [...settings.categories, { id, title: "New category", description: "", imageUrl: "", active: true, sortOrder: settings.categories.length }]);
  };
  const updateCategory = (id: string, patch: Partial<MenStorefrontSettings["categories"][number]>) =>
    update("categories", settings.categories.map(item => item.id === id ? { ...item, ...patch } : item));
  const removeCategory = (id: string) => update("categories", settings.categories.filter(item => item.id !== id));

  const exportSubscribers = () => {
    const rows = [["Email", "Consent", "Source", "Signed up"], ...subscribers.map(item => [item.email, item.consent ? "Yes" : "No", item.source, item.createdAt])];
    const csv = rows.map(row => row.map(value => '"' + String(value ?? "").replace(/"/g, '""') + '"').join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = "sarine-men-launch-signups.csv"; link.click();
    URL.revokeObjectURL(url);
  };
  const removeSubscriber = async (id: string) => {
    if (!window.confirm("Delete this launch signup? This cannot be undone.")) return;
    try { await hostingerStorefrontService.deleteMenLaunchSignup(id); setSubscribers(current => current.filter(item => item.id !== id)); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not delete signup."); }
  };

  if (loading) return <div className="rounded-xl border bg-white p-6 text-sm text-[#705E7B]" role="status">Loading SARINE Men settings…</div>;

  return <div className="space-y-5">
    <header className="rounded-2xl border border-[#E7DCEB] bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="font-serif text-2xl text-[#563568]">SARINE Men Studio</h2><p className="mt-1 text-xs text-[#705E7B]">Manage the men's landing page, imagery, product curation, offers and launch signups.</p></div>
        <a href="/men" target="_blank" rel="noreferrer" className="rounded-lg border px-3 py-2 text-xs font-semibold text-[#563568]">Preview men's page ↗</a>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {(["content", "catalogue", "marketing", "signups"] as const).map(item => <button key={item} type="button" onClick={() => setTab(item)} className={`min-h-10 rounded-lg px-3 text-xs font-semibold capitalize ${tab === item ? "bg-[#563568] text-white" : "border border-[#E7DCEB] text-[#563568]"}`}>{item === "signups" ? `Launch signups (${subscribers.length})` : item}</button>)}
      </div>
    </header>

    {error && <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    {message && <div role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{message}</div>}

    {tab === "content" && <section className="space-y-4 rounded-2xl border border-[#E7DCEB] bg-white p-4 sm:p-5">
      <h3 className="font-semibold text-[#302438]">Page identity & hero</h3>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.enabled} onChange={e => update("enabled", e.target.checked)} /> Men's page enabled</label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label><span className={labelClass}>Eyebrow</span><input className={fieldClass} value={settings.eyebrow} maxLength={100} onChange={e => update("eyebrow", e.target.value)} /></label>
        <label><span className={labelClass}>Main heading</span><input className={fieldClass} value={settings.title} maxLength={140} onChange={e => update("title", e.target.value)} /></label>
      </div>
      <label className="block"><span className={labelClass}>Introduction</span><textarea className={fieldClass} rows={3} value={settings.description} maxLength={500} onChange={e => update("description", e.target.value)} /></label>
      <div className="space-y-2">
        <label className={labelClass}>Hero image</label>
        <input type="file" accept="image/jpeg,image/png,image/webp" disabled={Boolean(uploading)} onChange={e => void uploadImage("heroImageUrl", e.target.files?.[0])} className="block w-full text-sm" />
        {uploading === "heroImageUrl" && <p className="text-xs text-[#705E7B]">Uploading…</p>}
        {settings.heroImageUrl && <img src={settings.heroImageUrl} alt="Men's hero preview" className="max-h-56 w-full rounded-xl object-cover" />}
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.comingSoon} onChange={e => update("comingSoon", e.target.checked)} /> Show Coming Soon notice</label>
      <label className="block"><span className={labelClass}>Coming Soon message</span><textarea className={fieldClass} rows={2} value={settings.comingSoonText} maxLength={300} onChange={e => update("comingSoonText", e.target.value)} /></label>
      <div className="flex flex-wrap gap-2"><button disabled={busy} onClick={() => void saveDraft()} className="rounded-lg border px-4 py-2.5 text-sm font-semibold text-[#563568] disabled:opacity-50">Save draft</button><button disabled={busy} onClick={() => void publish()} className="rounded-lg bg-[#563568] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Publishing…" : "Publish changes"}</button></div>
    </section>}

    {tab === "catalogue" && <div className="space-y-4">
      <section className="space-y-4 rounded-2xl border border-[#E7DCEB] bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold text-[#302438]">Category previews</h3><p className="text-xs text-[#705E7B]">Add, edit, reorder and hide men's categories. Each category has its own image.</p></div><button type="button" onClick={addCategory} disabled={settings.categories.length >= 12} className="rounded-lg border px-3 py-2 text-xs font-semibold text-[#563568] disabled:opacity-40">+ Add category</button></div>
        {settings.categories.map((item, index) => <div key={item.id} className="grid gap-3 rounded-xl border border-[#EEE6F1] p-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <label><span className={labelClass}>Category name</span><input className={fieldClass} value={item.title} onChange={e => updateCategory(item.id, { title: e.target.value })} /></label>
          <label><span className={labelClass}>Short description</span><input className={fieldClass} value={item.description} onChange={e => updateCategory(item.id, { description: e.target.value })} /></label>
          <div><span className={labelClass}>Image</span><input type="file" accept="image/jpeg,image/png,image/webp" disabled={Boolean(uploading)} onChange={e => void uploadImage("category", e.target.files?.[0], item.id)} className="w-full text-xs" />{item.imageUrl && <img src={item.imageUrl} alt={item.title} className="mt-2 h-16 w-24 rounded-lg object-cover" />}</div>
          <div className="flex items-end gap-2"><label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={item.active} onChange={e => updateCategory(item.id, { active: e.target.checked })} /> Active</label><button type="button" onClick={() => removeCategory(item.id)} className="rounded-lg border px-2 py-2 text-xs text-red-600">Remove</button></div>
        </div>)}
      </section>
      <section className="space-y-3 rounded-2xl border border-[#E7DCEB] bg-white p-4 sm:p-5">
        <h3 className="font-semibold text-[#302438]">Men's product selection</h3>
        <p className="text-xs text-[#705E7B]">Choose real catalogue products to feature. Only active products are shown publicly; drafts and archived items stay private. Product assignment is curated here without changing existing product records.</p>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.showProducts} onChange={e => update("showProducts", e.target.checked)} /> Show selected products on the men's page</label>
        <label><span className={labelClass}>Product section heading</span><input className={fieldClass} value={settings.featuredTitle} onChange={e => update("featuredTitle", e.target.value)} /></label>
        <div className="grid gap-2 sm:grid-cols-2">
          {products.map(product => <label key={product.id} className="flex items-center gap-3 rounded-lg border p-2 text-xs">
            <input type="checkbox" checked={settings.productIds.includes(product.id)} onChange={() => toggleId("productIds", product.id)} />
            {product.images?.[0] && <img src={product.images[0]} alt="" className="h-12 w-12 rounded object-cover" />}
            <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{product.name}</span><span className="text-[#705E7B]">₹{product.price.toLocaleString("en-IN")} · {product.status}</span></span>
          </label>)}
        </div>
        {products.length === 0 && <p className="text-xs text-[#705E7B]">No catalogue products found yet. Add products in Products & Catalogue first.</p>}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.showBestSellers} onChange={e => update("showBestSellers", e.target.checked)} /> Show a separate Best Sellers section</label>
        <p className="text-xs text-[#705E7B]">Best Sellers uses the same selected product pool; choose items below.</p>
        <div className="grid gap-2 sm:grid-cols-2">{activeProducts.map(product => <label key={product.id} className="flex items-center gap-2 rounded-lg border p-2 text-xs"><input type="checkbox" checked={settings.bestSellerIds.includes(product.id)} onChange={() => toggleId("bestSellerIds", product.id)} /><span>{product.name}</span></label>)}</div>
        <div className="flex flex-wrap gap-2"><button disabled={busy} onClick={() => void saveDraft()} className="rounded-lg border px-4 py-2.5 text-sm font-semibold text-[#563568]">Save draft</button><button disabled={busy} onClick={() => void publish()} className="rounded-lg bg-[#563568] px-4 py-2.5 text-sm font-semibold text-white">Publish catalogue settings</button></div>
      </section>
    </div>}

    {tab === "marketing" && <section className="space-y-4 rounded-2xl border border-[#E7DCEB] bg-white p-4 sm:p-5">
      <h3 className="font-semibold text-[#302438]">Offers & launch notifications</h3>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.offers.enabled} onChange={e => update("offers", { ...settings.offers, enabled: e.target.checked })} /> Show men's offer panel</label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label><span className={labelClass}>Offer label</span><input className={fieldClass} value={settings.offers.label} onChange={e => update("offers", { ...settings.offers, label: e.target.value })} /></label>
        <label><span className={labelClass}>Button text</span><input className={fieldClass} value={settings.offers.ctaText} onChange={e => update("offers", { ...settings.offers, ctaText: e.target.value })} /></label>
        <label className="sm:col-span-2"><span className={labelClass}>Offer description</span><textarea className={fieldClass} rows={2} value={settings.offers.description} onChange={e => update("offers", { ...settings.offers, description: e.target.value })} /></label>
        <label className="sm:col-span-2"><span className={labelClass}>Offer destination (internal URL)</span><input className={fieldClass} value={settings.offers.ctaLink} onChange={e => update("offers", { ...settings.offers, ctaLink: e.target.value })} /></label>
      </div>
      <div className="border-t border-[#EEE6F1] pt-4 space-y-3">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.notification.enabled} onChange={e => update("notification", { ...settings.notification, enabled: e.target.checked })} /> Enable launch email signup on men's page</label>
        <label><span className={labelClass}>Signup heading</span><input className={fieldClass} value={settings.notification.headline} onChange={e => update("notification", { ...settings.notification, headline: e.target.value })} /></label>
        <label><span className={labelClass}>Signup description</span><textarea className={fieldClass} rows={2} value={settings.notification.description} onChange={e => update("notification", { ...settings.notification, description: e.target.value })} /></label>
        <label><span className={labelClass}>Button label</span><input className={fieldClass} value={settings.notification.buttonText} onChange={e => update("notification", { ...settings.notification, buttonText: e.target.value })} /></label>
      </div>
      <div className="flex flex-wrap gap-2"><button disabled={busy} onClick={() => void saveDraft()} className="rounded-lg border px-4 py-2.5 text-sm font-semibold text-[#563568]">Save draft</button><button disabled={busy} onClick={() => void publish()} className="rounded-lg bg-[#563568] px-4 py-2.5 text-sm font-semibold text-white">Publish marketing settings</button></div>
    </section>}

    {tab === "signups" && <section className="space-y-3 rounded-2xl border border-[#E7DCEB] bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold text-[#302438]">Launch notification signups</h3><p className="text-xs text-[#705E7B]">Emails are stored securely in your Hostinger database with signup consent.</p></div><button onClick={exportSubscribers} disabled={!subscribers.length} className="rounded-lg bg-[#563568] px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Export CSV</button></div>
      {subscribers.length ? <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr className="border-b text-[#705E7B]"><th className="p-2">Email</th><th className="p-2">Consent</th><th className="p-2">Signed up</th><th className="p-2">Action</th></tr></thead><tbody>{subscribers.map(item => <tr key={item.id} className="border-b border-[#F0EAF2]"><td className="p-2">{item.email}</td><td className="p-2">{item.consent ? "Yes" : "No"}</td><td className="p-2">{new Date(item.createdAt).toLocaleDateString()}</td><td className="p-2"><button onClick={() => void removeSubscriber(item.id)} className="text-red-600 underline">Delete</button></td></tr>)}</tbody></table></div> : <p className="rounded-lg bg-[#F7F0FA] p-4 text-sm text-[#705E7B]">No signups yet. Once visitors subscribe, they will appear here.</p>}
      <button onClick={() => void load()} className="rounded-lg border px-3 py-2 text-xs font-semibold text-[#563568]">Refresh signups</button>
    </section>}
  </div>;
};
