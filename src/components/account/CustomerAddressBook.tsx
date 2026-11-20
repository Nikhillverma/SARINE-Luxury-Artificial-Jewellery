import React, { useEffect, useState } from "react";
import { MapPin, Plus, Star, Trash2 } from "lucide-react";
import { customerAuthService, type CustomerSavedAddress } from "../../services/customerAuthService";

const emptyAddress = (): Omit<CustomerSavedAddress, "id"> => ({
  fullName: "", phone: "", line1: "", line2: "", city: "", state: "", pincode: "", isDefault: false
});

export const CustomerAddressBook: React.FC = () => {
  const [addresses, setAddresses] = useState<CustomerSavedAddress[]>([]);
  const [draft, setDraft] = useState<Omit<CustomerSavedAddress, "id"> & { id?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try { setAddresses(await customerAuthService.getAddresses()); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to load saved addresses."); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const update = (field: keyof Omit<CustomerSavedAddress, "id">, value: string | boolean) => {
    setDraft(current => current ? { ...current, [field]: value } : current);
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft) return;
    setSaving(true);
    setError("");
    try {
      await customerAuthService.saveAddress(draft);
      setDraft(null);
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to save this address."); }
    finally { setSaving(false); }
  };

  const remove = async (address: CustomerSavedAddress) => {
    if (!window.confirm("Remove this saved delivery address?")) return;
    setError("");
    try { await customerAuthService.deleteAddress(address.id); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to remove this address."); }
  };

  return (
    <section className="mt-6 bg-white border border-[#E7DCEB] p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-[10px] uppercase tracking-[0.18em] text-[#8A7B90]">Delivery details</p><h2 className="font-serif text-2xl text-[#563568]">Saved Addresses</h2></div>
        {!draft && addresses.length < 10 && <button type="button" onClick={() => { setDraft({ ...emptyAddress(), isDefault: addresses.length === 0 }); setError(""); }} className="inline-flex items-center gap-2 min-h-10 px-3 bg-[#563568] text-white text-xs"><Plus size={14}/> Add address</button>}
      </div>
      <p className="mt-2 text-xs text-[#6F6475]">Save up to 10 Indian delivery addresses for quicker checkout.</p>
      {error && <p role="alert" className="mt-3 p-3 bg-red-50 border border-red-200 text-xs text-red-700">{error}</p>}
      {loading ? <p className="py-6 text-sm text-[#6F6475]">Loading saved addresses…</p> : addresses.length === 0 && !draft ? (
        <div className="mt-4 border border-dashed border-[#D9B8A0] p-6 text-center"><MapPin size={22} className="mx-auto text-[#B69ACF]"/><p className="mt-2 text-sm text-[#6F6475]">No saved delivery addresses yet.</p></div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {addresses.map(address => <article key={address.id} className="border border-[#E7DCEB] p-4">
            <div className="flex items-start justify-between gap-2"><div className="flex items-center gap-2"><MapPin size={15} className="text-[#9B7CB0]"/><strong className="text-sm text-[#302438]">{address.fullName}</strong></div>{address.isDefault && <span className="inline-flex items-center gap-1 text-[10px] text-[#8A6A36]"><Star size={11}/> Default</span>}</div>
            <p className="mt-2 text-xs leading-5 text-[#6F6475]">{address.line1}{address.line2 ? `, ${address.line2}` : ""}<br/>{address.city}, {address.state} - {address.pincode}<br/>+91 {address.phone}</p>
            <div className="mt-3 flex gap-3"><button type="button" onClick={() => { setDraft({ ...address }); setError(""); }} className="text-xs text-[#563568] underline">Edit</button><button type="button" onClick={() => void remove(address)} className="inline-flex items-center gap-1 text-xs text-red-700"><Trash2 size={12}/> Remove</button></div>
          </article>)}
        </div>
      )}
      {draft && <form onSubmit={submit} className="mt-5 border-t border-[#E7DCEB] pt-5">
        <h3 className="font-serif text-lg text-[#563568]">{draft.id ? "Edit address" : "Add a delivery address"}</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-[#6F6475]">Full name<input required maxLength={120} value={draft.fullName} onChange={e => update("fullName", e.target.value)} className="mt-1 w-full min-h-11 px-3 border border-[#E7DCEB] text-sm text-[#302438]"/></label>
          <label className="text-xs text-[#6F6475]">Mobile number<input required type="tel" inputMode="numeric" maxLength={14} value={draft.phone} onChange={e => update("phone", e.target.value)} className="mt-1 w-full min-h-11 px-3 border border-[#E7DCEB] text-sm text-[#302438]"/></label>
          <label className="text-xs text-[#6F6475] sm:col-span-2">Address line 1<input required maxLength={240} value={draft.line1} onChange={e => update("line1", e.target.value)} placeholder="House / flat, street, area" className="mt-1 w-full min-h-11 px-3 border border-[#E7DCEB] text-sm text-[#302438]"/></label>
          <label className="text-xs text-[#6F6475] sm:col-span-2">Address line 2 (optional)<input maxLength={240} value={draft.line2} onChange={e => update("line2", e.target.value)} placeholder="Landmark, locality" className="mt-1 w-full min-h-11 px-3 border border-[#E7DCEB] text-sm text-[#302438]"/></label>
          <label className="text-xs text-[#6F6475]">City<input required maxLength={100} value={draft.city} onChange={e => update("city", e.target.value)} className="mt-1 w-full min-h-11 px-3 border border-[#E7DCEB] text-sm text-[#302438]"/></label>
          <label className="text-xs text-[#6F6475]">State<input required maxLength={100} value={draft.state} onChange={e => update("state", e.target.value)} className="mt-1 w-full min-h-11 px-3 border border-[#E7DCEB] text-sm text-[#302438]"/></label>
          <label className="text-xs text-[#6F6475]">PIN code<input required inputMode="numeric" maxLength={6} value={draft.pincode} onChange={e => update("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))} className="mt-1 w-full min-h-11 px-3 border border-[#E7DCEB] text-sm text-[#302438]"/></label>
        </div>
        <label className="mt-3 flex items-center gap-2 text-xs text-[#6F6475]"><input type="checkbox" checked={draft.isDefault} onChange={e => update("isDefault", e.target.checked)}/> Set as default delivery address</label>
        <div className="mt-4 flex gap-2"><button type="button" onClick={() => setDraft(null)} className="min-h-10 px-4 border border-[#D9B8A0] text-xs text-[#563568]">Cancel</button><button type="submit" disabled={saving} className="min-h-10 px-5 bg-[#563568] text-white text-xs disabled:opacity-50">{saving ? "Saving…" : "Save address"}</button></div>
      </form>}
    </section>
  );
};
