import React, { useEffect, useState } from "react";
import { AdminLayout } from "../../components/admin/AdminLayout";
import { HostingerMediaService } from "../../services/hostinger/hostingerMediaService";
import { festivalCampaignService, type FestivalCampaign } from "../../services/hostinger/festivalCampaignService";
import { CalendarHeart, Plus, Save, Trash2, RefreshCw, Upload, Clock3, Percent, Image as ImageIcon } from "lucide-react";

const mediaService = new HostingerMediaService();
const festivals = ["Diwali", "Raksha Bandhan", "Navratri", "Dussehra", "Karwa Chauth", "Wedding Season", "Christmas", "New Year", "Valentine's Day", "Women's Day", "Eid", "Akshaya Tritiya", "Other"];
const blank = (): FestivalCampaign => ({
  id: crypto.randomUUID(), name: "", festival: "Other", campaignType: "sale",
  eyebrow: "A SPECIAL SARINE OFFER", title: "", subtitle: "", imageUrl: "",
  ctaText: "Shop the Collection", ctaLink: "/shop", couponCode: "", offerLabel: "",
  startsAt: null, endsAt: null, active: false, showCountdown: false, artworkOnly: true,
  storewideDiscountPercent: 0, sortOrder: 10, updatedAt: null
});
function toLocalInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}
function fromLocalInput(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export const AdminCampaignsPage: React.FC = () => {
  const [items, setItems] = useState<FestivalCampaign[]>([]);
  const [draft, setDraft] = useState<FestivalCampaign>(blank());
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = async () => {
    setLoading(true); setError("");
    try { setItems(await festivalCampaignService.list()); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not load campaigns."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const update = (key: keyof FestivalCampaign, value: unknown) => setDraft(current => ({ ...current, [key]: value }));
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      const next = editing ? items.map(item => item.id === draft.id ? draft : item) : [...items, draft];
      setItems(await festivalCampaignService.save(next));
      setNotice("Campaign saved to Hostinger MariaDB. Live dates and discount rules are enforced by the store API.");
      setDraft(blank()); setEditing(false);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save campaign."); }
    finally { setSaving(false); }
  };
  const edit = (item: FestivalCampaign) => {
    setDraft({ ...blank(), ...item }); setEditing(true); setNotice(""); setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const remove = async (id: string) => {
    if (!window.confirm("Delete this campaign? This does not delete any existing orders.")) return;
    try { setItems(await festivalCampaignService.save(items.filter(item => item.id !== id))); setNotice("Campaign deleted."); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not delete campaign."); }
  };
  const upload = async (file?: File) => {
    if (!file) return;
    setUploading(true); setError("");
    try { const url = await mediaService.uploadImage(file); update("imageUrl", url); setNotice("Artwork uploaded. Save the campaign to publish the change."); }
    catch (e) { setError(e instanceof Error ? e.message : "Image upload failed."); }
    finally { setUploading(false); }
  };

  return <AdminLayout><div className="space-y-6">
    <div className="flex flex-wrap justify-between gap-3 items-center">
      <div><h1 className="font-serif text-3xl text-[#2C1838]">Campaigns & Promotions</h1><p className="text-sm text-[#705E7B] mt-1">Create hero slides, schedule sales and manage automatic storewide discounts.</p></div>
      <button onClick={() => { setDraft(blank()); setEditing(false); setError(""); setNotice(""); }} className="bg-[#563568] text-white rounded-xl px-4 py-2.5 text-sm inline-flex gap-2 items-center"><Plus size={16}/> New campaign</button>
    </div>
    {notice && <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800">{notice}</div>}
    {error && <div role="alert" className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}

    <form onSubmit={save} className="bg-white border border-[#EADFF0] rounded-2xl p-5 space-y-5">
      <div className="flex items-center gap-2"><CalendarHeart className="text-[#563568]"/><h2 className="font-semibold">{editing ? "Edit campaign" : "Create campaign"}</h2></div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        <label className="text-xs text-[#705E7B]">Internal campaign name<input required maxLength={100} value={draft.name} onChange={e => update("name", e.target.value)} placeholder="Weekend Sparkle Sale" className="mt-1 w-full border rounded-lg p-2.5 text-sm"/></label>
        <label className="text-xs text-[#705E7B]">Campaign type<select value={draft.campaignType} onChange={e => update("campaignType", e.target.value)} className="mt-1 w-full border rounded-lg p-2.5 text-sm"><option value="sale">Sale / special offer</option><option value="festival">Festival / occasion</option></select></label>
        <label className="text-xs text-[#705E7B]">Festival / occasion<select value={draft.festival} onChange={e => update("festival", e.target.value)} className="mt-1 w-full border rounded-lg p-2.5 text-sm">{festivals.map(value => <option key={value}>{value}</option>)}</select></label>
        <label className="text-xs text-[#705E7B]">Offer label<input value={draft.offerLabel} onChange={e => update("offerLabel", e.target.value)} placeholder="10% SALE OFF" maxLength={80} className="mt-1 w-full border rounded-lg p-2.5 text-sm"/></label>
        <label className="text-xs text-[#705E7B]">Eyebrow<input value={draft.eyebrow} onChange={e => update("eyebrow", e.target.value)} maxLength={100} className="mt-1 w-full border rounded-lg p-2.5 text-sm"/></label>
        <label className="text-xs text-[#705E7B]">Slide priority (lower appears first)<input type="number" min={0} max={99} value={draft.sortOrder} onChange={e => update("sortOrder", Number(e.target.value))} className="mt-1 w-full border rounded-lg p-2.5 text-sm"/></label>
        <label className="text-xs text-[#705E7B] lg:col-span-2">Main headline<input required value={draft.title} onChange={e => update("title", e.target.value)} maxLength={180} placeholder="Celebrate the Season in Sparkle" className="mt-1 w-full border rounded-lg p-2.5 text-sm"/></label>
        <label className="text-xs text-[#705E7B] lg:col-span-3">Description<textarea value={draft.subtitle} onChange={e => update("subtitle", e.target.value)} maxLength={400} rows={2} className="mt-1 w-full border rounded-lg p-2.5 text-sm"/></label>
        <label className="text-xs text-[#705E7B]">Button label<input value={draft.ctaText} onChange={e => update("ctaText", e.target.value)} maxLength={80} className="mt-1 w-full border rounded-lg p-2.5 text-sm"/></label>
        <label className="text-xs text-[#705E7B]">Button destination<input value={draft.ctaLink} onChange={e => update("ctaLink", e.target.value)} placeholder="/shop?search=festive" className="mt-1 w-full border rounded-lg p-2.5 text-sm"/></label>
        <label className="text-xs text-[#705E7B]">Coupon code (optional)<input value={draft.couponCode} onChange={e => update("couponCode", e.target.value.toUpperCase())} maxLength={40} placeholder="DIWALI20" className="mt-1 w-full border rounded-lg p-2.5 text-sm uppercase"/></label>
        <label className="text-xs text-[#705E7B]">Starts at (India local time)<input type="datetime-local" value={toLocalInput(draft.startsAt)} onChange={e => update("startsAt", fromLocalInput(e.target.value))} className="mt-1 w-full border rounded-lg p-2.5 text-sm"/></label>
        <label className="text-xs text-[#705E7B]">Ends at (India local time)<input type="datetime-local" value={toLocalInput(draft.endsAt)} onChange={e => update("endsAt", fromLocalInput(e.target.value))} className="mt-1 w-full border rounded-lg p-2.5 text-sm"/></label>
      </div>

      <section className="rounded-xl border border-[#EADFF0] bg-[#FBF8FC] p-4 space-y-3">
        <div className="flex items-center gap-2 font-semibold text-sm"><Percent size={16} className="text-[#563568]"/> Automatic storewide discount</div>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-xs text-[#705E7B]">Discount percentage (0–75%)<input type="number" min={0} max={75} step={1} value={draft.storewideDiscountPercent} onChange={e => update("storewideDiscountPercent", Math.max(0, Math.min(75, Number(e.target.value) || 0)))} className="mt-1 w-full border rounded-lg p-2.5 text-sm"/></label>
          <div className="text-xs text-[#705E7B] flex items-end pb-2">{draft.storewideDiscountPercent > 0 ? <span className="text-emerald-800 font-medium">{draft.storewideDiscountPercent}% is automatically deducted from the existing selling price of every product while this campaign is live.</span> : "Set 0 for a promotional hero slide without an automatic price discount."}</div>
        </div>
        <p className="text-xs text-[#705E7B]">Automatic storewide discounts cannot overlap with another storewide discount or be combined with coupon codes. Product-level selling prices remain unchanged.</p>
      </section>

      <section className="rounded-xl border border-[#EADFF0] p-4 space-y-3">
        <div className="flex items-center gap-2 font-semibold text-sm"><ImageIcon size={16} className="text-[#563568]"/> Hero slide artwork</div>
        <label className="text-xs font-medium text-[#705E7B]">Campaign artwork (JPEG, PNG or WebP)<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => void upload(e.target.files?.[0])} className="block mt-2 text-sm"/></label>
        {uploading && <p className="text-xs text-[#705E7B]">Uploading artwork…</p>}
        {draft.imageUrl && <img src={draft.imageUrl} alt="Campaign artwork preview" className="max-h-56 max-w-full rounded-lg object-contain bg-[#F7F0FA]"/>}
        <label className="flex gap-2 items-start text-sm"><input type="checkbox" checked={draft.artworkOnly} onChange={e => update("artworkOnly", e.target.checked)} className="mt-0.5"/> <span><strong>Artwork contains its own text.</strong><span className="block text-xs text-[#705E7B]">Show the artwork as a clean, clickable hero slide without duplicate headline or button overlays. Turn off if you want the editable headline and CTA rendered over the image.</span></span></label>
      </section>

      <section className="rounded-xl border border-[#EADFF0] p-4 space-y-3">
        <div className="flex items-center gap-2 font-semibold text-sm"><Clock3 size={16} className="text-[#563568]"/> Scheduling & visibility</div>
        <label className="flex gap-2 items-center text-sm"><input type="checkbox" checked={draft.showCountdown} onChange={e => update("showCountdown", e.target.checked)}/> Show a live countdown inside this hero slide (requires an end date)</label>
        <label className="flex gap-2 items-center text-sm"><input type="checkbox" checked={draft.active} onChange={e => update("active", e.target.checked)}/> Enable campaign (it only appears during its scheduled dates)</label>
      </section>

      <div className="flex justify-end gap-2"><button type="button" onClick={() => { setDraft(blank()); setEditing(false); }} className="px-4 py-2 border rounded-lg text-sm">Clear</button><button disabled={saving || uploading} className="px-5 py-2 bg-[#563568] text-white rounded-lg text-sm inline-flex items-center gap-2 disabled:opacity-50"><Save size={15}/>{saving ? "Saving…" : "Save campaign"}</button></div>
    </form>

    <section className="bg-white border rounded-2xl overflow-hidden">
      <div className="p-4 border-b flex justify-between items-center"><div><h2 className="font-semibold">Campaign library</h2><p className="text-xs text-[#705E7B] mt-1">Enabled campaigns automatically join the existing homepage hero carousel during their dates.</p></div><button onClick={() => void load()} className="text-xs inline-flex gap-1 items-center"><RefreshCw size={13}/> Refresh</button></div>
      {loading ? <p className="p-8 text-center text-sm">Loading campaigns…</p> : items.length === 0 ? <p className="p-8 text-center text-sm text-gray-500">No campaigns created yet.</p> : <div className="divide-y">{items.map(item => <div key={item.id} className="p-4 flex flex-wrap gap-3 items-center">
        <div className="w-24 h-16 bg-[#F7F0FA] rounded-lg overflow-hidden">{item.imageUrl && <img src={item.imageUrl} alt="" className="w-full h-full object-cover"/>}</div>
        <div className="min-w-0 flex-1"><p className="font-semibold text-sm">{item.name} · {item.campaignType === "sale" ? "Sale" : item.festival}</p><p className="text-xs text-gray-500">{item.title}</p><p className="text-xs mt-1">{item.offerLabel || "Hero campaign"} {item.storewideDiscountPercent > 0 && <strong className="text-emerald-700">· {item.storewideDiscountPercent}% storewide</strong>} {item.showCountdown && "· Countdown"} {item.couponCode && "· " + item.couponCode}</p></div>
        <span className={item.active ? "text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full text-xs" : "text-amber-700 bg-amber-50 px-2 py-1 rounded-full text-xs"}>{item.active ? "Enabled" : "Paused"}</span>
        <button onClick={() => edit(item)} className="border rounded-lg px-3 py-2 text-xs">Edit</button><button onClick={() => void remove(item.id)} className="border rounded-lg px-3 py-2 text-xs text-red-600"><Trash2 size={14}/></button>
      </div>)}</div>}
    </section>
  </div></AdminLayout>;
};
