import React, { useEffect, useState } from "react";
import { AdminLayout } from "../../components/admin/AdminLayout";
import { hostingerMediaService } from "../../services";
import { hostingerStorefrontService, type StorefrontBanner, type EditorialContent, type ProductReview } from "../../services/hostinger/hostingerStorefrontService";

const defaultEditorial: EditorialContent = { eyebrow: "EDITORIAL COLLECTION", title: "The Art of Everyday Elegance", description: "A curated collection that blends classic beauty with modern sensibilities.", ctaText: "Explore the Collection", ctaLink: "/shop", imageUrl: "/images/editorial-banner.jpg", active: true };
const emptyForm = { tagline: "", title: "", subtitle: "", ctaText: "Shop now", ctaLink: "/shop", imageUrl: "", active: false };

export const AdminStorefrontPage: React.FC = () => {
  const [banners, setBanners] = useState<StorefrontBanner[]>([]);
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [reviewStatus, setReviewStatus] = useState("pending");
  const [reviewReplies, setReviewReplies] = useState<Record<string,string>>({});
  const [editorial, setEditorial] = useState<EditorialContent>(defaultEditorial);
  const [editorialFile, setEditorialFile] = useState<File | null>(null);
  const [editorialUploading, setEditorialUploading] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [announcementActive, setAnnouncementActive] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [artworkUploading, setArtworkUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true); setError("");
    try {
      const [bannerResult, announcementResult, editorialResult] = await Promise.all([
        hostingerStorefrontService.getBanners(),
        hostingerStorefrontService.getAnnouncement(),
        hostingerStorefrontService.getEditorial()
      ]);
      setBanners(bannerResult.banners);
      setEditorial({ ...defaultEditorial, ...editorialResult.editorial });
      setAnnouncement(announcementResult.announcement.message || "");
      setAnnouncementActive(Boolean(announcementResult.announcement.active));
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load storefront content."); }
    finally { setLoading(false); }
  };
  const loadReviews = async (status = reviewStatus) => {
    try { const result = await hostingerStorefrontService.getAdminReviews(status); setReviews(result.reviews); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to load customer feedback."); }
  };
  useEffect(() => { void load(); void loadReviews("pending"); }, []);

  const beginAdd = () => { setEditingId(null); setForm(emptyForm); setFile(null); setMessage(""); setError(""); };
  const beginEdit = (banner: StorefrontBanner) => {
    setEditingId(banner.id);
    setForm({ tagline: banner.tagline, title: banner.title, subtitle: banner.subtitle, ctaText: banner.ctaText, ctaLink: banner.ctaLink, imageUrl: banner.imageUrl, active: banner.active });
    setFile(null); setMessage(""); setError("");
  };

  const uploadArtwork = async () => {
    if (!file) {
      setError("Choose a JPEG, PNG or WebP image first.");
      return;
    }
    setArtworkUploading(true);
    setError("");
    setMessage("");
    try {
      const imageUrl = await hostingerMediaService.uploadImage(file);
      setForm(current => ({ ...current, imageUrl }));
      setFile(null);
      setMessage("Artwork uploaded successfully to Hostinger. Preview it below, then save the banner.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Artwork upload failed. Please try again.");
    } finally {
      setArtworkUploading(false);
    }
  };

  const saveBanner = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      let imageUrl = form.imageUrl;
      if (file) imageUrl = await hostingerMediaService.uploadImage(file);
      if (!imageUrl) throw new Error("Upload a banner image before saving.");
      const payload = { ...form, imageUrl };
      if (editingId) await hostingerStorefrontService.updateBanner(editingId, payload);
      else await hostingerStorefrontService.createBanner(payload);
      setForm(emptyForm); setEditingId(null); setFile(null);
      setMessage("Banner saved to MariaDB. Homepage content will use published slides.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Banner could not be saved."); }
    finally { setBusy(false); }
  };

  const toggle = async (banner: StorefrontBanner) => {
    setBusy(true); setError("");
    try { await hostingerStorefrontService.updateBanner(banner.id, { active: !banner.active }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not update banner."); }
    finally { setBusy(false); }
  };
  const remove = async (banner: StorefrontBanner) => {
    if (!window.confirm(`Delete banner "${banner.title}"? This removes the banner record, not the stored media file.`)) return;
    setBusy(true); setError("");
    try { await hostingerStorefrontService.deleteBanner(banner.id); setMessage("Banner deleted."); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not delete banner."); }
    finally { setBusy(false); }
  };
  const move = async (index: number, direction: -1 | 1) => {
    const next = [...banners]; const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setBusy(true); setError("");
    try { await hostingerStorefrontService.reorderBanners(next.map(b => b.id)); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not reorder banners."); }
    finally { setBusy(false); }
  };
  const moderateReview = async (review: ProductReview, status: "approved" | "rejected") => {
    setBusy(true); setError(""); setMessage("");
    try {
      await hostingerStorefrontService.moderateReview(review.id, status, reviewReplies[review.id] || "");
      setMessage(status === "approved" ? "Review approved and visible on its product page." : "Review rejected and hidden from customers.");
      await loadReviews(reviewStatus);
    } catch (e) { setError(e instanceof Error ? e.message : "Review moderation failed."); }
    finally { setBusy(false); }
  };

  const saveEditorial = async () => {
    setBusy(true); setError(""); setMessage("");
    try {
      let imageUrl = editorial.imageUrl;
      if (editorialFile) imageUrl = await hostingerMediaService.uploadImage(editorialFile);
      const saved = await hostingerStorefrontService.saveEditorial({ ...editorial, imageUrl });
      setEditorial(saved.editorial); setEditorialFile(null);
      setMessage("Editorial Collection saved to MariaDB. Its publish setting controls customer visibility.");
    } catch (e) { setError(e instanceof Error ? e.message : "Editorial Collection could not be saved."); }
    finally { setBusy(false); }
  };

  const saveAnnouncement = async () => {
    setBusy(true); setError(""); setMessage("");
    try { await hostingerStorefrontService.saveAnnouncement(announcement, announcementActive); setMessage("Announcement saved to MariaDB."); }
    catch (e) { setError(e instanceof Error ? e.message : "Announcement could not be saved."); }
    finally { setBusy(false); }
  };

  return <AdminLayout>
    <div className="space-y-6 max-w-6xl">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="font-serif text-3xl text-[#2C1838]">Storefront Studio</h1><p className="text-sm text-[#705E7B] mt-1">Manage homepage hero banners and announcement publishing.</p></div>
        <a href="/" target="_blank" rel="noreferrer" className="px-4 py-2 rounded-lg border text-sm">Preview storefront</a>
      </header>
      {error && <div role="alert" className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>}
      {message && <div role="status" className="p-3 rounded-lg bg-green-50 text-green-800 text-sm">{message}</div>}

      <section className="bg-white border rounded-2xl p-5 space-y-4">
        <div><h2 className="font-semibold text-[#2C1838]">Announcement bar</h2><p className="text-xs text-gray-500">Only publish truthful current offers and policies.</p></div>
        <input value={announcement} maxLength={300} onChange={e => setAnnouncement(e.target.value)} placeholder="Announcement text" className="w-full border rounded-lg p-3 text-sm" />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={announcementActive} onChange={e => setAnnouncementActive(e.target.checked)} /> Publish announcement</label>
        <button disabled={busy} onClick={() => void saveAnnouncement()} className="px-4 py-2 rounded-lg bg-[#563568] text-white text-sm disabled:opacity-50">Save announcement</button>
      </section>

      <section className="bg-white border rounded-2xl p-5 space-y-4">
        <div><h2 className="font-semibold text-[#2C1838]">Homepage Sections · Editorial Collection</h2><p className="text-xs text-gray-500">Independent of hero banners. Edit the image, copy and destination shown in the Editorial Collection block.</p></div>
        <div className="grid md:grid-cols-2 gap-3">
          <label className="text-xs space-y-1"><span>Eyebrow</span><input value={editorial.eyebrow} maxLength={120} onChange={e=>setEditorial({...editorial,eyebrow:e.target.value})} className="w-full border rounded-lg p-3 text-sm" /></label>
          <label className="text-xs space-y-1"><span>Heading</span><input value={editorial.title} maxLength={180} onChange={e=>setEditorial({...editorial,title:e.target.value})} className="w-full border rounded-lg p-3 text-sm" /></label>
          <label className="text-xs space-y-1 md:col-span-2"><span>Description</span><textarea value={editorial.description} maxLength={500} onChange={e=>setEditorial({...editorial,description:e.target.value})} rows={3} className="w-full border rounded-lg p-3 text-sm" /></label>
          <label className="text-xs space-y-1"><span>Button label</span><input value={editorial.ctaText} maxLength={80} onChange={e=>setEditorial({...editorial,ctaText:e.target.value})} className="w-full border rounded-lg p-3 text-sm" /></label>
          <label className="text-xs space-y-1"><span>Button destination</span><input value={editorial.ctaLink} maxLength={500} onChange={e=>setEditorial({...editorial,ctaLink:e.target.value})} placeholder="/shop" className="w-full border rounded-lg p-3 text-sm" /></label>
          <div className="md:col-span-2 space-y-2"><label className="block text-xs font-medium">Background artwork (JPEG, PNG or WebP)</label><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setEditorialFile(e.target.files?.[0] || null)} className="block w-full text-sm" />{editorialFile && <button type="button" disabled={editorialUploading || busy} onClick={async()=>{setEditorialUploading(true);setError("");try{const imageUrl=await hostingerMediaService.uploadImage(editorialFile);setEditorial({...editorial,imageUrl});setEditorialFile(null);setMessage("Editorial artwork uploaded. Save changes to publish it.");}catch(e){setError(e instanceof Error?e.message:"Artwork upload failed.");}finally{setEditorialUploading(false);}}} className="px-3 py-2 rounded-lg bg-[#563568] text-white text-xs disabled:opacity-50">{editorialUploading?"Uploading…":"Upload artwork"}</button>}{editorial.imageUrl && <img src={editorial.imageUrl} alt="Editorial Collection preview" className="max-h-48 rounded-lg border object-contain" />}</div>
          <label className="flex items-center gap-2 text-sm md:col-span-2"><input type="checkbox" checked={editorial.active} onChange={e=>setEditorial({...editorial,active:e.target.checked})} /> Publish Editorial Collection on homepage</label>
          <div className="flex gap-2 md:col-span-2"><button disabled={busy || editorialUploading} onClick={()=>void saveEditorial()} className="px-4 py-2 rounded-lg bg-[#563568] text-white text-sm disabled:opacity-50">{busy?"Saving…":"Save Editorial Collection"}</button><a href="/" target="_blank" rel="noreferrer" className="px-4 py-2 rounded-lg border text-sm">Preview homepage</a></div>
        </div>
      </section>

      <section className="bg-white border rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-[#2C1838]">Customer Ratings & Feedback</h2><p className="text-xs text-gray-500">Only delivered-order reviews are accepted. Approve reviews before they appear publicly.</p></div><div className="flex gap-2"><select value={reviewStatus} onChange={e=>{setReviewStatus(e.target.value);void loadReviews(e.target.value);}} className="border rounded-lg p-2 text-xs"><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="all">All reviews</option></select><button onClick={()=>void loadReviews()} className="border rounded-lg px-3 py-2 text-xs">Refresh</button></div></div>
        {reviews.length===0 ? <p className="text-sm text-gray-500">No reviews found in this view.</p> : <div className="space-y-3">{reviews.map(review=><article key={review.id} className="border rounded-xl p-4 space-y-2"><div className="flex flex-wrap justify-between gap-2"><div><p className="font-medium text-sm">{review.productName || review.productId}</p><p className="text-xs text-gray-500">{review.name} · {review.email} · Order {review.orderNumber || "—"}</p></div><span className="text-xs capitalize">{review.status} · {"★".repeat(review.rating)}</span></div>{review.title && <p className="font-medium text-sm">{review.title}</p>}<p className="text-sm text-gray-700 whitespace-pre-wrap">{review.comment}</p><label className="block text-xs text-gray-500">Admin reply (optional)<textarea value={reviewReplies[review.id] ?? review.adminReply ?? ""} maxLength={1000} rows={2} onChange={e=>setReviewReplies({...reviewReplies,[review.id]:e.target.value})} className="mt-1 w-full border rounded-lg p-2 text-sm" placeholder="Write a response to the customer" /></label><div className="flex flex-wrap gap-2"><button disabled={busy || review.status==="approved"} onClick={()=>void moderateReview(review,"approved")} className="rounded-lg bg-[#563568] text-white px-3 py-2 text-xs disabled:opacity-50">Approve & publish</button><button disabled={busy || review.status==="rejected"} onClick={()=>void moderateReview(review,"rejected")} className="rounded-lg border border-red-200 text-red-700 px-3 py-2 text-xs disabled:opacity-50">Reject</button></div></article>)}</div>}
      </section>

      <section className="bg-white border rounded-2xl p-5 space-y-4">
        <div className="flex justify-between items-center gap-3"><div><h2 className="font-semibold text-[#2C1838]">Homepage hero banners</h2><p className="text-xs text-gray-500">Changes are saved in MariaDB, not browser memory.</p></div><button onClick={beginAdd} className="px-4 py-2 rounded-lg bg-[#563568] text-white text-sm">Add banner</button></div>
        {loading ? <p className="text-sm text-gray-500">Loading banners…</p> : banners.length === 0 ? <p className="text-sm text-gray-500">No banners created yet. Add a banner and publish it when ready.</p> :
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">{banners.map((banner, index) => <article key={banner.id} className="border rounded-xl overflow-hidden">
            <img src={banner.imageUrl} alt={banner.title} className="w-full aspect-[16/7] object-cover bg-gray-100" />
            <div className="p-4 space-y-2"><div className="flex justify-between gap-2"><span className="text-xs text-purple-700">{banner.tagline || "HERO BANNER"}</span><span className={banner.active ? "text-xs text-green-700" : "text-xs text-gray-500"}>{banner.active ? "Published" : "Draft"}</span></div><h3 className="font-medium">{banner.title}</h3><p className="text-xs text-gray-500">{banner.subtitle}</p><p className="text-xs text-gray-500">CTA: {banner.ctaText} · {banner.ctaLink}</p>
              <div className="flex flex-wrap gap-2 pt-2"><button disabled={busy || index===0} onClick={() => void move(index,-1)} className="border rounded px-2 py-1 text-xs disabled:opacity-40">Move up</button><button disabled={busy || index===banners.length-1} onClick={() => void move(index,1)} className="border rounded px-2 py-1 text-xs disabled:opacity-40">Move down</button><button disabled={busy} onClick={() => beginEdit(banner)} className="border rounded px-2 py-1 text-xs">Edit</button><button disabled={busy} onClick={() => void toggle(banner)} className="border rounded px-2 py-1 text-xs">{banner.active ? "Unpublish" : "Publish"}</button><button disabled={busy} onClick={() => void remove(banner)} className="border border-red-200 text-red-700 rounded px-2 py-1 text-xs">Delete</button></div>
            </div></article>)}</div>}
      </section>

      <section className="bg-white border rounded-2xl p-5 space-y-4">
        <h2 className="font-semibold text-[#2C1838]">{editingId ? "Edit hero banner" : "Create hero banner"}</h2>
        <form onSubmit={saveBanner} className="grid md:grid-cols-2 gap-3">
          <input value={form.tagline} onChange={e => setForm({...form,tagline:e.target.value})} maxLength={120} placeholder="Tagline" className="border rounded-lg p-3 text-sm" />
          <input required value={form.title} onChange={e => setForm({...form,title:e.target.value})} maxLength={180} placeholder="Heading" className="border rounded-lg p-3 text-sm" />
          <textarea value={form.subtitle} onChange={e => setForm({...form,subtitle:e.target.value})} maxLength={500} placeholder="Subtitle" className="border rounded-lg p-3 text-sm md:col-span-2" />
          <input value={form.ctaText} onChange={e => setForm({...form,ctaText:e.target.value})} maxLength={80} placeholder="Button text" className="border rounded-lg p-3 text-sm" />
          <input value={form.ctaLink} onChange={e => setForm({...form,ctaLink:e.target.value})} maxLength={500} placeholder="Destination, e.g. /shop" className="border rounded-lg p-3 text-sm" />
          <div className="md:col-span-2 space-y-3">
            <label className="block text-sm font-medium">Banner artwork</label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={e => { setFile(e.target.files?.[0] || null); setError(""); setMessage(""); }}
              className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[#F5EDF8] file:px-3 file:py-2 file:text-sm file:font-medium file:text-[#563568]"
            />
            {file && <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed p-3">
              <div className="min-w-0"><p className="text-sm font-medium truncate">{file.name}</p><p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB · JPEG, PNG or WebP</p></div>
              <button type="button" disabled={artworkUploading || busy} onClick={() => void uploadArtwork()} className="rounded-lg bg-[#563568] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{artworkUploading ? "Uploading artwork…" : "Upload artwork"}</button>
            </div>}
            {form.imageUrl && <div className="space-y-2"><p className="text-xs font-medium text-green-700">Artwork uploaded and ready</p><img src={form.imageUrl} alt="Uploaded banner artwork preview" className="max-h-48 w-auto rounded-lg border object-contain" /></div>}
            <p className="text-xs text-gray-500">Choose an image, click Upload artwork, confirm the preview, then create or save the banner. Images are optimised and stored in Hostinger media storage.</p>
          </div>
          <label className="flex items-center gap-2 text-sm md:col-span-2"><input type="checkbox" checked={form.active} onChange={e => setForm({...form,active:e.target.checked})} /> Publish immediately after saving</label>
          <div className="flex gap-2 md:col-span-2"><button disabled={busy || artworkUploading} type="submit" className="px-5 py-2 rounded-lg bg-[#563568] text-white text-sm disabled:opacity-50">{busy ? "Saving…" : editingId ? "Save changes" : "Create banner"}</button><button type="button" disabled={busy || artworkUploading} onClick={beginAdd} className="px-4 py-2 rounded-lg border text-sm disabled:opacity-50">Clear form</button></div>
        </form>
      </section>
    </div>
  </AdminLayout>;
};
