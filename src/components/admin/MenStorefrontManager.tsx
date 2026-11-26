import React, { useEffect, useMemo, useState } from "react";
import { adminProductService, hostingerMediaService } from "../../services";
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
  comingSoon: false, comingSoonText: "",
  categories: [
    { id: "bracelets", title: "Bracelets", description: "Refined details for every day.", imageUrl: "", productIds: [], active: true, sortOrder: 0 },
    { id: "chains", title: "Chains", description: "Understated pieces with presence.", imageUrl: "", productIds: [], active: true, sortOrder: 1 },
    { id: "rings", title: "Rings", description: "A signature in the details.", imageUrl: "", productIds: [], active: true, sortOrder: 2 },
    { id: "kada", title: "Kada", description: "Classic form, modern character.", imageUrl: "", productIds: [], active: true, sortOrder: 3 }
  ],
  showProducts: false, productIds: [], featuredTitle: "The Men's Edit",
  bestSellerIds: [], showBestSellers: false, collections: [],
  offers: { enabled: false, label: "A little something extra", description: "", ctaText: "Explore offers", ctaLink: "/men" },
  notification: { enabled: true, headline: "Be first to know", description: "Sign up for an update when SARINE Men arrives.", buttonText: "Notify me" }
};

const fieldClass = "w-full rounded-lg border border-[#E7DCEB] bg-white px-3 py-2.5 text-sm text-[#302438] focus:outline-none focus:ring-2 focus:ring-[#B69ACF]";
const labelClass = "mb-1 block text-xs font-semibold text-[#563568]";

function normalizeMenSettings(value: MenStorefrontSettings): MenStorefrontSettings {
  return { ...defaults, ...value, comingSoon: false,
    categories: (value.categories || defaults.categories).map((category, index) => ({ ...category, productIds: category.productIds || [], sortOrder: category.sortOrder ?? index })),
    offers: { ...defaults.offers, ...value.offers }, notification: { ...defaults.notification, ...value.notification }
  };
}

export const MenStorefrontManager: React.FC = () => {
  const [settings, setSettings] = useState<MenStorefrontSettings>(defaults);
  const [publishedSettings, setPublishedSettings] = useState<MenStorefrontSettings>(defaults);
  const [savedPreviewSnapshot, setSavedPreviewSnapshot] = useState<string | null>(null);
  const [publishReview, setPublishReview] = useState(false);
  const [collection, setCollection] = useState<"" | "artificial" | "demi-fine">("");
  const [products, setProducts] = useState<MenStorefrontProduct[]>([]);
  const [subscribers, setSubscribers] = useState<MenLaunchSubscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState<"content" | "catalogue" | "advanced">("content");
  const [previewMode, setPreviewMode] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [addingProductTo, setAddingProductTo] = useState<string | null>(null);
  const [newProduct, setNewProduct] = useState({ name: "", price: "", stock: "0", description: "", imageUrl: "", status: "draft" as "draft" | "active" });
  const [savingNewProduct, setSavingNewProduct] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productEdit, setProductEdit] = useState({ name: "", price: "", description: "", status: "draft" as "draft" | "active" });
  const [updatingProduct, setUpdatingProduct] = useState(false);

  const load = async (isCancelled: () => boolean = () => false) => {
    setLoading(true); setError("");
    try {
      const result = await hostingerStorefrontService.getMenStorefront(collection || undefined);
      if (isCancelled()) return;
      const loadedDraft = normalizeMenSettings(result.draft);
      setSettings(loadedDraft);
      setPublishedSettings(normalizeMenSettings(result.published));
      setSavedPreviewSnapshot(JSON.stringify(loadedDraft));
      setPublishReview(false);
      setProducts(result.products || []);
      const signups = await hostingerStorefrontService.getMenLaunchSignups().catch(() => ({ subscribers: [] }));
      if (!isCancelled()) setSubscribers(signups.subscribers || []);
    } catch (e) {
      if (!isCancelled()) setError(e instanceof Error ? e.message : "Could not load SARINE Men settings.");
    } finally { if (!isCancelled()) setLoading(false); }
  };
  useEffect(() => {
    let cancelled = false;
    setSettings(defaults); setPublishedSettings(defaults); setSavedPreviewSnapshot(null); setPublishReview(false);
    setProducts([]); setEditingProductId(null); setAddingProductTo(null);
    setNewProduct({ name: "", price: "", stock: "0", description: "", imageUrl: "", status: "draft" });
    void load(() => cancelled);
    return () => { cancelled = true; };
  }, [collection]);

  const activeProducts = useMemo(() => products.filter(p => p.status === "active" && (!collection || p.productCollection === collection)), [products, collection]);
  const settingsSnapshot = JSON.stringify(settings);
  const previewIsCurrent = savedPreviewSnapshot === settingsSnapshot;
  const changedAreas = useMemo(() => {
    const groups: Array<{ label: string; keys: (keyof MenStorefrontSettings)[] }> = [
      { label: "Page identity & hero", keys: ["enabled", "eyebrow", "title", "description", "heroImageUrl"] },
      { label: "Categories", keys: ["categories"] },
      { label: "Featured products", keys: ["showProducts", "productIds", "featuredTitle"] },
      { label: "Best sellers", keys: ["showBestSellers", "bestSellerIds"] },
      { label: "Curated collections", keys: ["collections"] },
      { label: "Offers", keys: ["offers"] },
      { label: "Launch notifications", keys: ["notification"] }
    ];
    return groups.filter(group => group.keys.some(key => JSON.stringify(settings[key]) !== JSON.stringify(publishedSettings[key]))).map(group => group.label);
  }, [settings, publishedSettings]);
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
    try {
      await hostingerStorefrontService.saveMenStorefrontDraft(settings, collection || undefined);
      setSavedPreviewSnapshot(settingsSnapshot);
      setPublishReview(false);
      setMessage("Draft saved and preview refreshed. It is not public until you publish.");
    }
    catch (e) { setError(e instanceof Error ? e.message : "Could not save the draft."); }
    finally { setBusy(false); }
  };
  const publish = () => {
    setError("");
    if (!previewIsCurrent) { setError("Save draft & refresh preview before reviewing publication. The current edits have not been saved."); return; }
    if (changedAreas.length === 0) { setError("There are no changes to publish for this version."); return; }
    setPublishReview(true);
  };
  const confirmPublish = async () => {
    if (!previewIsCurrent) { setPublishReview(false); setError("The draft changed after review. Save draft & refresh preview, then review again."); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await hostingerStorefrontService.publishMenStorefront(collection || undefined);
      setPublishedSettings(normalizeMenSettings(result.published));
      setSavedPreviewSnapshot(JSON.stringify(settings));
      setPublishReview(false);
      setMessage("The saved SARINE Men version is now published.");
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
    update("categories", [...settings.categories, { id, title: "New category", description: "", imageUrl: "", productIds: [], active: true, sortOrder: settings.categories.length }]);
  };
  const updateCategory = (id: string, patch: Partial<MenStorefrontSettings["categories"][number]>) =>
    update("categories", settings.categories.map(item => item.id === id ? { ...item, ...patch } : item));
  const removeCategory = (id: string) => update("categories", settings.categories.filter(item => item.id !== id));

  const uploadMenProductImage = async (file?: File) => {
    if (!file) return;
    setUploading("men-product"); setError(""); setMessage("");
    try {
      const imageUrl = await hostingerMediaService.uploadImage(file);
      setNewProduct(current => ({ ...current, imageUrl }));
      setMessage("Product image uploaded to Hostinger storage.");
    } catch (e) { setError(e instanceof Error ? e.message : "Product image upload failed."); }
    finally { setUploading(""); }
  };

  const createMenProduct = async (category: MenStorefrontSettings["categories"][number]) => {
    if (!collection) { setError("Choose Artificial or Demi-Fine before creating a new men's product."); return; }
    if (!newProduct.name.trim() || !newProduct.price.trim() || !newProduct.imageUrl) {
      setError("Add a product name, selling price and at least one product image."); return;
    }
    const price = Number(newProduct.price); const stock = Number(newProduct.stock);
    if (!Number.isFinite(price) || price < 0 || !Number.isInteger(stock) || stock < 0) {
      setError("Enter a valid price and non-negative whole stock quantity."); return;
    }
    setSavingNewProduct(true); setError(""); setMessage("");
    try {
      const slug = newProduct.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const created = await adminProductService.createProduct({
        slug, name: newProduct.name.trim(), description: newProduct.description.trim(), shortDescription: "",
        price, images: [newProduct.imageUrl], categoryId: "", collectionSlugs: [], productCollection: collection,
        jewelleryType: /ring/i.test(category.title) ? "ring" : /chain/i.test(category.title) ? "necklace" : "bracelet",
        stock, status: newProduct.status, tags: [], gender: "men"
      });
      setProducts(current => [...current, { id: created.id, name: created.name, slug: created.slug, price: created.price, images: created.images, status: created.status, stock: created.stock, productCollection: collection }]);
      const nextCategories = settings.categories.map(item => item.id === category.id ? { ...item, productIds: [...new Set([...(item.productIds || []), created.id])] } : item);
      update("categories", nextCategories);
      const nextSettings = { ...settings, categories: nextCategories };
      await hostingerStorefrontService.saveMenStorefrontDraft(nextSettings, collection);
      setSavedPreviewSnapshot(JSON.stringify(nextSettings));
      if (newProduct.status === "active") {
        const published = await hostingerStorefrontService.publishMenStorefront(collection);
        setPublishedSettings(normalizeMenSettings(published.published));
      }
      setNewProduct({ name: "", price: "", stock: "0", description: "", imageUrl: "", status: "draft" });
      setAddingProductTo(null);
      setMessage((newProduct.status === "active" ? "Product published" : "Product saved as a draft") + " and assigned to " + category.title + ".");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not create the men's product."); }
    finally { setSavingNewProduct(false); }
  };


  const openProductEditor = (product: MenStorefrontProduct) => {
    setEditingProductId(product.id);
    setProductEdit({ name: product.name, price: String(product.price), description: product.description || "", status: product.status === "active" ? "active" : "draft" });
    setError("");
    setMessage("");
  };

  const saveProductSettings = async (product: MenStorefrontProduct) => {
    const price = Number(productEdit.price);
    if (!productEdit.name.trim() || !Number.isFinite(price) || price < 0) {
      setError("Enter a product name and a valid selling price.");
      return;
    }
    setUpdatingProduct(true); setError(""); setMessage("");
    try {
      const updated = await adminProductService.updateProduct(product.id, {
        name: productEdit.name.trim(), price, description: productEdit.description,
        status: productEdit.status, gender: "men"
      });
      setProducts(current => current.map(item => item.id === product.id ? {
        ...item, name: updated.name, description: updated.description, price: updated.price, status: updated.status
      } : item));
      if (productEdit.status === "active") {
        await hostingerStorefrontService.saveMenStorefrontDraft(settings, collection || undefined);
        const published = await hostingerStorefrontService.publishMenStorefront(collection || undefined);
        setPublishedSettings(normalizeMenSettings(published.published));
        setSavedPreviewSnapshot(JSON.stringify(settings));
        setPublishReview(false);
      }
      setEditingProductId(null);
      setMessage(productEdit.status === "active" ? "Product published. The current men's storefront settings were published too." : "Product settings saved as a draft.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update this men's product.");
    } finally { setUpdatingProduct(false); }
  };

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
      <label className="mt-4 block max-w-xs space-y-1 text-xs font-semibold text-[#563568]">Homepage version
        <select value={collection} disabled={loading || busy || Boolean(uploading) || savingNewProduct || updatingProduct} onChange={event => setCollection(event.target.value as "" | "artificial" | "demi-fine")} className="w-full rounded-lg border border-[#E7DCEB] bg-white p-2.5 text-sm">
          <option value="">Home (existing global content)</option><option value="artificial">Artificial</option><option value="demi-fine">Demi-Fine</option>
        </select>
      </label>
      <div className="mt-4 flex flex-wrap gap-2">
        {(["content", "catalogue", "advanced"] as const).map(item => <button key={item} type="button" onClick={() => setTab(item)} className={`min-h-10 rounded-lg px-3 text-xs font-semibold ${tab === item ? "bg-[#563568] text-white" : "border border-[#E7DCEB] text-[#563568]"}`}>{item === "content" ? "Page" : item === "catalogue" ? "Products & categories" : "Advanced"}</button>)}
      </div>
    </header>

    <section className="space-y-3 rounded-2xl border border-[#E7DCEB] bg-white p-4 sm:p-5" aria-label="Draft and publication review">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold text-[#302438]">Draft & publication safety</h3><p className="mt-1 text-xs text-[#705E7B]">Review the selected version before publishing. Other collection versions remain separate.</p></div>
        <span className={previewIsCurrent ? "rounded-full bg-[#EAF7EF] px-3 py-1 text-xs font-semibold text-[#24613A]" : "rounded-full bg-[#FFF5E8] px-3 py-1 text-xs font-semibold text-[#8A5315]"}>{previewIsCurrent ? "Saved preview is current" : "Preview needs saving"}</span></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg bg-[#FCFAFD] p-3"><p className="text-xs font-semibold text-[#563568]">Draft vs published</p>
          {changedAreas.length ? <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-[#705E7B]">{changedAreas.map(area => <li key={area}>{area} changed</li>)}</ul> : <p className="mt-2 text-xs text-[#705E7B]">The saved draft matches the published version.</p>}</div>
        <div className="rounded-lg bg-[#FCFAFD] p-3"><p className="text-xs font-semibold text-[#563568]">Selected version</p>
          <p className="mt-2 text-sm font-semibold text-[#302438]">{collection === "artificial" ? "Artificial" : collection === "demi-fine" ? "Demi-Fine" : "Shared (default for both collections)"}</p>
          <p className="mt-1 text-xs text-[#705E7B]">{previewIsCurrent ? "The preview represents the exact saved draft." : "Save the current edits to refresh the saved preview before publication."}</p></div>
      </div>
      <div className="flex flex-wrap gap-2"><button type="button" disabled={busy || Boolean(uploading) || savingNewProduct || updatingProduct} onClick={() => void saveDraft()} className="rounded-lg border border-[#DCCCE4] px-4 py-2.5 text-sm font-semibold text-[#563568] disabled:opacity-50">Save draft & refresh preview</button>
        <button type="button" disabled={busy || !previewIsCurrent || changedAreas.length === 0} onClick={publish} className="rounded-lg bg-[#563568] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Review & publish this version</button></div>
      {publishReview && <div className="space-y-3 rounded-xl border border-[#B69ACF] bg-[#F7F0FA] p-4" role="dialog" aria-label="Confirm SARINE Men publication">
        <div><h4 className="font-semibold text-[#563568]">Confirm publication</h4><p className="mt-1 text-xs text-[#705E7B]">You are about to publish the saved {collection === "artificial" ? "Artificial" : collection === "demi-fine" ? "Demi-Fine" : "Shared"} SARINE Men version. This does not publish the other collection version.</p></div>
        <ul className="list-disc space-y-1 pl-4 text-xs text-[#705E7B]">{changedAreas.map(area => <li key={area}>{area}</li>)}</ul>
        <p className="text-xs font-semibold text-[#563568]">Only saved page settings for this version will be published. Product-level publishing actions remain separate.</p>
        <div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => void confirmPublish()} className="rounded-lg bg-[#563568] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Publishing…" : "Confirm and publish this version"}</button><button type="button" disabled={busy} onClick={() => setPublishReview(false)} className="rounded-lg border border-[#DCCCE4] px-4 py-2.5 text-sm font-semibold text-[#563568]">Cancel</button></div>
      </div>}
    </section>
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
      <p className="rounded-lg bg-[#F7F0FA] p-3 text-xs text-[#705E7B]">Coming Soon mode is retired. The men's storefront and category pages are managed as live catalogue pages.</p>
      <div className="flex flex-wrap gap-2"><button disabled={busy} onClick={() => void saveDraft()} className="rounded-lg border px-4 py-2.5 text-sm font-semibold text-[#563568] disabled:opacity-50">Save draft</button><button disabled={busy} onClick={publish} className="rounded-lg bg-[#563568] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Publishing…" : "Publish changes"}</button></div>
    </section>}

    {tab === "content" && <section className="space-y-3 rounded-2xl border border-[#E7DCEB] bg-white p-4 sm:p-5" aria-label="Responsive SARINE Men draft preview">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold text-[#302438]">Responsive storefront preview</h3><p className="text-xs text-[#705E7B]">Preview current page edits and selected catalogue content without saving or publishing.</p></div>
        <div className="flex gap-1" role="group" aria-label="Preview size">{(["desktop", "tablet", "mobile"] as const).map(mode => <button key={mode} type="button" onClick={() => setPreviewMode(mode)} aria-pressed={previewMode === mode} className={`min-h-9 rounded-lg px-3 text-xs font-semibold capitalize ${previewMode === mode ? "bg-[#563568] text-white" : "border border-[#DCCCE4] text-[#563568]"}`}>{mode}</button>)}</div>
      </div>
      <div className="mx-auto overflow-hidden rounded-xl border border-[#DCCCE4] bg-[#FCFAFD] shadow-sm transition-all" style={{ width: "100%", maxWidth: previewMode === "mobile" ? "390px" : previewMode === "tablet" ? "768px" : "100%" }}>
        <div className="bg-[#563568] px-4 py-3 text-center text-white"><p className="font-serif text-lg tracking-[0.16em]">SARINE</p><p className="mt-1 text-[9px] tracking-[0.2em]">MEN · MODERN ESSENTIALS</p></div>
        <div className="grid gap-3 bg-[#F7F0FA] p-4 sm:grid-cols-2"><div className="flex min-h-40 flex-col justify-center"><p className="text-[10px] font-semibold tracking-[0.18em] text-[#8B70A0]">{settings.eyebrow}</p><h4 className="mt-2 font-serif text-2xl text-[#563568]">{settings.title}</h4><p className="mt-2 text-xs text-[#705E7B]">{settings.description}</p>{settings.offers.enabled && <p className="mt-3 text-[10px] font-semibold text-[#563568]">{settings.offers.label}: {settings.offers.description}</p>}</div>
          {settings.heroImageUrl ? <img src={settings.heroImageUrl} alt="SARINE Men draft hero" className="h-40 w-full rounded-lg object-cover" /> : <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-[#B69ACF] text-xs text-[#8B70A0]">Hero image preview</div>}</div>
        {settings.categories.some(item => item.active) && <div className="space-y-3 p-4"><div className="text-center"><p className="font-serif text-lg text-[#563568]">Explore the edit</p><p className="text-[10px] text-[#705E7B]">Categories</p></div><div className={`grid gap-2 ${previewMode === "mobile" ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"}`}>{settings.categories.filter(item => item.active).sort((a,b) => a.sortOrder-b.sortOrder).map(item => <div key={item.id} className="overflow-hidden rounded-lg border border-[#EEE6F1] bg-white">{item.imageUrl ? <img src={item.imageUrl} alt={item.title} className="h-20 w-full object-cover" /> : <div className="h-20 bg-[#F7F0FA]" />}<p className="p-2 text-center text-[11px] font-semibold text-[#563568]">{item.title}</p><p className="px-2 pb-2 text-center text-[9px] text-[#705E7B]">{item.description}</p></div>)}</div></div>}
        {settings.showProducts && <div className="space-y-2 bg-white p-4"><h5 className="text-center font-serif text-lg text-[#563568]">{settings.featuredTitle}</h5><div className={`grid gap-2 ${previewMode === "mobile" ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"}`}>{activeProducts.filter(item => settings.productIds.includes(item.id)).slice(0,4).map(item => <div key={item.id} className="rounded-lg border p-2">{item.images?.[0] ? <img src={item.images[0]} alt={item.name} className="h-20 w-full rounded object-cover" /> : <div className="h-20 bg-[#F7F0FA]" />}<p className="mt-1 truncate text-[10px] font-semibold text-[#563568]">{item.name}</p><p className="text-[10px] text-[#705E7B]">₹{item.price.toLocaleString("en-IN")}</p></div>)}</div></div>}
        {settings.notification.enabled && <div className="bg-[#563568] p-4 text-center text-white"><p className="font-serif text-lg">{settings.notification.headline}</p><p className="mt-1 text-[10px]">{settings.notification.description}</p><span className="mt-2 inline-block rounded bg-white px-3 py-1.5 text-[10px] font-semibold text-[#563568]">{settings.notification.buttonText}</span></div>}
      </div><p className="text-[11px] text-[#705E7B]">Preview width: {previewMode === "mobile" ? "390px" : previewMode === "tablet" ? "768px" : "fluid desktop"}. Local draft preview only; it does not save, publish, or change the live page.</p>
    </section>}

    {tab === "catalogue" && <div className="space-y-4">
      <section className="space-y-4 rounded-2xl border border-[#E7DCEB] bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold text-[#302438]">Category previews</h3><p className="text-xs text-[#705E7B]">Add, edit, reorder and hide men's categories. Each category has its own image.</p></div><button type="button" onClick={addCategory} disabled={settings.categories.length >= 12} className="rounded-lg border px-3 py-2 text-xs font-semibold text-[#563568] disabled:opacity-40">+ Add category</button></div>
        {settings.categories.map((item, index) => <div key={item.id} className="grid gap-3 rounded-xl border border-[#EEE6F1] p-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <label><span className={labelClass}>Category name</span><input className={fieldClass} value={item.title} onChange={e => updateCategory(item.id, { title: e.target.value })} /></label>
          <label><span className={labelClass}>Short description</span><input className={fieldClass} value={item.description} onChange={e => updateCategory(item.id, { description: e.target.value })} /></label>
          <div><span className={labelClass}>Image</span><input type="file" accept="image/jpeg,image/png,image/webp" disabled={Boolean(uploading)} onChange={e => void uploadImage("category", e.target.files?.[0], item.id)} className="w-full text-xs" />{item.imageUrl && <img src={item.imageUrl} alt={item.title} className="mt-2 h-16 w-24 rounded-lg object-cover" />}</div>
          <div className="flex items-end gap-2"><label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={item.active} onChange={e => updateCategory(item.id, { active: e.target.checked })} /> Published</label><button type="button" onClick={() => updateCategory(item.id, { sortOrder: Math.max(0, index - 1) })} disabled={index === 0} className="rounded-lg border px-2 py-2 text-xs disabled:opacity-40" aria-label="Move category up">↑</button><button type="button" onClick={() => updateCategory(item.id, { sortOrder: index + 1 })} disabled={index === settings.categories.length - 1} className="rounded-lg border px-2 py-2 text-xs disabled:opacity-40" aria-label="Move category down">↓</button><button type="button" onClick={() => removeCategory(item.id)} className="rounded-lg border px-2 py-2 text-xs text-red-600">Remove</button></div>
          <div className="sm:col-span-4 rounded-lg bg-[#FCFAFD] p-3"><p className={labelClass}>Assign men's catalogue products</p><div className="grid gap-2 sm:grid-cols-2">{products.map(product => <label key={product.id} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={(item.productIds || []).includes(product.id)} onChange={e => updateCategory(item.id, { productIds: e.target.checked ? [...(item.productIds || []), product.id] : (item.productIds || []).filter(id => id !== product.id) })}/><span className="min-w-0 truncate">{product.name}</span><span className="text-[#8B7299]">₹{product.price.toLocaleString("en-IN")}</span></label>)}</div>{products.length === 0 && <p className="text-xs text-[#705E7B]">Add men's products to the catalogue, then assign them here.</p>}</div>

          <div className="sm:col-span-4 rounded-lg border border-dashed border-[#CDB9D8] bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-semibold text-[#563568]">Products in {item.title}</p><p className="text-xs text-[#705E7B]">Only men's catalogue products are available in this category.</p></div><button type="button" onClick={() => { setAddingProductTo(addingProductTo === item.id ? null : item.id); setNewProduct({ name: "", price: "", stock: "0", description: "", imageUrl: "", status: "draft" }); setError(""); }} className="rounded-lg bg-[#563568] px-3 py-2 text-xs font-semibold text-white">+ Add product</button></div>
            {addingProductTo === item.id && <div className="mt-3 grid gap-3 rounded-lg bg-[#F7F0FA] p-3 sm:grid-cols-2">
              <label><span className={labelClass}>Product name *</span><input className={fieldClass} value={newProduct.name} maxLength={255} onChange={e => setNewProduct(current => ({ ...current, name: e.target.value }))} /></label>
              <label><span className={labelClass}>Selling price (₹) *</span><input className={fieldClass} type="number" min="0" step="1" value={newProduct.price} onChange={e => setNewProduct(current => ({ ...current, price: e.target.value }))} /></label>
              <label><span className={labelClass}>Opening stock</span><input className={fieldClass} type="number" min="0" step="1" value={newProduct.stock} onChange={e => setNewProduct(current => ({ ...current, stock: e.target.value }))} /></label>
              <label><span className={labelClass}>Publishing status</span><select className={fieldClass} value={newProduct.status} onChange={e => setNewProduct(current => ({ ...current, status: e.target.value as "draft" | "active" }))}><option value="draft">Save as draft</option><option value="active">Publish when category is published</option></select></label>
              <label><span className={labelClass}>Product image *</span><input className="block w-full text-xs" type="file" accept="image/jpeg,image/png,image/webp" disabled={Boolean(uploading)} onChange={e => void uploadMenProductImage(e.target.files?.[0])}/>{uploading === "men-product" && <span className="text-xs text-[#705E7B]">Uploading image…</span>}{newProduct.imageUrl && <img src={newProduct.imageUrl} alt="Men's product preview" className="mt-2 h-20 w-20 rounded-lg object-cover"/>}</label>
              <label className="sm:col-span-2"><span className={labelClass}>Description</span><textarea className={fieldClass} rows={2} maxLength={5000} value={newProduct.description} onChange={e => setNewProduct(current => ({ ...current, description: e.target.value }))}/></label>
              <div className="sm:col-span-2 flex flex-wrap gap-2"><button type="button" disabled={savingNewProduct || Boolean(uploading)} onClick={() => void createMenProduct(item)} className="rounded-lg bg-[#563568] px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50">{savingNewProduct ? "Saving product…" : "Save product to this category"}</button><button type="button" onClick={() => setAddingProductTo(null)} className="rounded-lg border px-4 py-2.5 text-xs font-semibold text-[#563568]">Cancel</button></div>
            </div>}
          </div>
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

        {products.length > 0 && <div className="mt-3 space-y-2">
          <h4 className="text-sm font-semibold text-[#563568]">Manage men's products</h4>
          <p className="text-xs text-[#705E7B]">Edit product details or publish a draft here. Published products can appear on the men's storefront when assigned to a visible section.</p>
          {products.map(product => <div key={product.id} className="rounded-xl border border-[#EEE6F1] p-3">
            <div className="flex flex-wrap items-center gap-3">
              {product.images?.[0] && <img src={product.images[0]} alt="" className="h-14 w-14 rounded-lg object-cover" />}
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-[#302438]">{product.name}</p><p className="text-xs text-[#705E7B]">₹{product.price.toLocaleString("en-IN")} · Stock {product.stock} · {product.status === "active" ? "Published" : product.status === "archived" ? "Archived" : "Draft"}</p></div>
              {product.status !== "archived" && <button type="button" onClick={() => openProductEditor(product)} className="rounded-lg border border-[#DCCCE4] px-3 py-2 text-xs font-semibold text-[#563568]">Edit settings</button>}
            </div>
            {editingProductId === product.id && <div className="mt-3 grid gap-3 rounded-lg bg-[#F7F0FA] p-3 sm:grid-cols-2">
              <label><span className={labelClass}>Product name</span><input className={fieldClass} value={productEdit.name} onChange={e => setProductEdit(current => ({ ...current, name: e.target.value }))}/></label>
              <label><span className={labelClass}>Selling price (₹)</span><input className={fieldClass} type="number" min="0" step="1" value={productEdit.price} onChange={e => setProductEdit(current => ({ ...current, price: e.target.value }))}/></label>
              <label><span className={labelClass}>Visibility</span><select className={fieldClass} value={productEdit.status} onChange={e => setProductEdit(current => ({ ...current, status: e.target.value as "draft" | "active" }))}><option value="draft">Keep as draft</option><option value="active">Publish product</option></select></label>
              <label className="sm:col-span-2"><span className={labelClass}>Description</span><textarea className={fieldClass} rows={2} value={productEdit.description} onChange={e => setProductEdit(current => ({ ...current, description: e.target.value }))}/></label>
              <div className="sm:col-span-2 flex flex-wrap gap-2"><button type="button" disabled={updatingProduct} onClick={() => void saveProductSettings(product)} className="rounded-lg bg-[#563568] px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50">{updatingProduct ? "Saving…" : productEdit.status === "active" ? "Save & publish" : "Save changes"}</button><button type="button" onClick={() => setEditingProductId(null)} className="rounded-lg border px-4 py-2.5 text-xs font-semibold text-[#563568]">Cancel</button></div>
            </div>}
          </div>)}
        </div>}
        {products.length === 0 && <p className="text-xs text-[#705E7B]">No catalogue products found yet. Add products in Products & Catalogue first.</p>}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.showBestSellers} onChange={e => update("showBestSellers", e.target.checked)} /> Show a separate Best Sellers section</label>
        <p className="text-xs text-[#705E7B]">Best Sellers uses the same selected product pool; choose items below.</p>
        <div className="grid gap-2 sm:grid-cols-2">{activeProducts.map(product => <label key={product.id} className="flex items-center gap-2 rounded-lg border p-2 text-xs"><input type="checkbox" checked={settings.bestSellerIds.includes(product.id)} onChange={() => toggleId("bestSellerIds", product.id)} /><span>{product.name}</span></label>)}</div>
        <div className="flex flex-wrap gap-2"><button disabled={busy} onClick={() => void saveDraft()} className="rounded-lg border px-4 py-2.5 text-sm font-semibold text-[#563568]">Save draft</button><button disabled={busy} onClick={() => void publish()} className="rounded-lg bg-[#563568] px-4 py-2.5 text-sm font-semibold text-white">Publish catalogue settings</button></div>
      </section>
      <section className="space-y-3 rounded-2xl border border-[#E7DCEB] bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold text-[#302438]">Curated men's collections</h3><p className="text-xs text-[#705E7B]">Create named edits and select which products belong to each collection.</p></div><button type="button" disabled={settings.collections.length >= 20} onClick={() => update("collections", [...settings.collections, { id: "men-edit-" + Date.now(), title: "New edit", description: "", productIds: [], active: false, sortOrder: settings.collections.length }])} className="rounded-lg border px-3 py-2 text-xs font-semibold text-[#563568]">+ Add collection</button></div>
        {settings.collections.map(collection => <div key={collection.id} className="space-y-3 rounded-xl border border-[#EEE6F1] p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label><span className={labelClass}>Collection title</span><input className={fieldClass} value={collection.title} onChange={e => update("collections", settings.collections.map(item => item.id === collection.id ? { ...item, title: e.target.value } : item))}/></label>
            <label><span className={labelClass}>Description</span><input className={fieldClass} value={collection.description} onChange={e => update("collections", settings.collections.map(item => item.id === collection.id ? { ...item, description: e.target.value } : item))}/></label>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2"><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={collection.active} onChange={e => update("collections", settings.collections.map(item => item.id === collection.id ? { ...item, active: e.target.checked } : item))}/> Publish this collection</label><button type="button" onClick={() => update("collections", settings.collections.filter(item => item.id !== collection.id))} className="text-xs text-red-600 underline">Remove collection</button></div>
          <div className="grid gap-2 sm:grid-cols-2">{products.map(product => <label key={product.id} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={collection.productIds.includes(product.id)} onChange={() => update("collections", settings.collections.map(item => item.id === collection.id ? { ...item, productIds: item.productIds.includes(product.id) ? item.productIds.filter(id => id !== product.id) : [...item.productIds, product.id] } : item))}/>{product.name} <span className="text-[#8B7299]">({product.status})</span></label>)}</div>
        </div>)}
        {!settings.collections.length && <p className="text-xs text-[#705E7B]">No collections created yet.</p>}
        <div className="flex flex-wrap gap-2"><button disabled={busy} onClick={() => void saveDraft()} className="rounded-lg border px-4 py-2.5 text-sm font-semibold text-[#563568]">Save draft</button><button disabled={busy} onClick={() => void publish()} className="rounded-lg bg-[#563568] px-4 py-2.5 text-sm font-semibold text-white">Publish collections</button></div>
      </section>
    </div>}

    {tab === "advanced" && <section className="space-y-4 rounded-2xl border border-[#E7DCEB] bg-white p-4 sm:p-5">
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

    {tab === "advanced" && <section className="space-y-3 rounded-2xl border border-[#E7DCEB] bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold text-[#302438]">Launch notification signups</h3><p className="text-xs text-[#705E7B]">Emails are stored securely in your Hostinger database with signup consent.</p></div><button onClick={exportSubscribers} disabled={!subscribers.length} className="rounded-lg bg-[#563568] px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Export CSV</button></div>
      {subscribers.length ? <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr className="border-b text-[#705E7B]"><th className="p-2">Email</th><th className="p-2">Consent</th><th className="p-2">Signed up</th><th className="p-2">Action</th></tr></thead><tbody>{subscribers.map(item => <tr key={item.id} className="border-b border-[#F0EAF2]"><td className="p-2">{item.email}</td><td className="p-2">{item.consent ? "Yes" : "No"}</td><td className="p-2">{new Date(item.createdAt).toLocaleDateString()}</td><td className="p-2"><button onClick={() => void removeSubscriber(item.id)} className="text-red-600 underline">Delete</button></td></tr>)}</tbody></table></div> : <p className="rounded-lg bg-[#F7F0FA] p-4 text-sm text-[#705E7B]">No signups yet. Once visitors subscribe, they will appear here.</p>}
      <button onClick={() => void load()} className="rounded-lg border px-3 py-2 text-xs font-semibold text-[#563568]">Refresh signups</button>
    </section>}
  </div>;
};
