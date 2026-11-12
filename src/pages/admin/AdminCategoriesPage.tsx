import React, { useEffect, useState } from "react";
import { AdminLayout } from "../../components/admin/AdminLayout";
import { hostingerMediaService } from "../../services";
import { hostingerAdminCategoryService } from "../../services/hostinger/hostingerAdminCategoryService";
import type { Category } from "../../types/category";

const blank = { name: "", slug: "", description: "", image: "", isActive: true };
export const AdminCategoriesPage: React.FC = () => {
  const [items, setItems] = useState<Category[]>([]);
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const load = async () => { setLoading(true); setError(""); try { const r = await hostingerAdminCategoryService.getAll(); setItems(r.categories); } catch(e) { setError(e instanceof Error ? e.message : "Could not load categories."); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, []);
  const reset = () => { setForm(blank); setEditingId(null); setFile(null); };
  const edit = (c: Category) => { setEditingId(c.id); setForm({ name:c.name, slug:c.slug, description:c.description || "", image:c.image || "", isActive:c.isActive }); setFile(null); setError(""); setNotice(""); };
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      let image = form.image;
      if (file) image = await hostingerMediaService.uploadImage(file);
      const payload = { ...form, image };
      if (editingId) await hostingerAdminCategoryService.update(editingId, payload);
      else await hostingerAdminCategoryService.create(payload);
      setNotice("Category saved to Hostinger database."); reset(); await load();
    } catch(e) { setError(e instanceof Error ? e.message : "Could not save category."); }
    finally { setBusy(false); }
  };
  const toggle = async (c: Category) => { setBusy(true); setError(""); try { await hostingerAdminCategoryService.update(c.id,{isActive:!c.isActive}); await load(); } catch(e) { setError(e instanceof Error ? e.message : "Could not update category."); } finally { setBusy(false); } };
  const remove = async (c: Category) => { if(!window.confirm(`Delete category "${c.name}"? Products assigned to it will block deletion.`)) return; setBusy(true); setError(""); try { await hostingerAdminCategoryService.remove(c.id); setNotice("Category deleted."); await load(); } catch(e) { setError(e instanceof Error ? e.message : "Could not delete category."); } finally { setBusy(false); } };
  const move = async (index:number, direction:-1|1) => { const next=[...items], target=index+direction; if(target<0||target>=next.length)return; [next[index],next[target]]=[next[target],next[index]]; setBusy(true); try { await hostingerAdminCategoryService.reorder(next.map(x=>x.id)); await load(); } catch(e) { setError(e instanceof Error ? e.message : "Could not reorder."); } finally { setBusy(false); } };
  return <AdminLayout><div className="max-w-6xl space-y-6">
    <header><h1 className="font-serif text-3xl text-[#2C1838]">Categories</h1><p className="text-sm text-[#705E7B] mt-1">Create, edit, publish and organise storefront categories.</p></header>
    {error && <div role="alert" className="rounded-lg bg-red-50 text-red-700 p-3 text-sm">{error}</div>}{notice && <div role="status" className="rounded-lg bg-green-50 text-green-800 p-3 text-sm">{notice}</div>}
    <section className="bg-white border rounded-2xl p-5 space-y-4"><h2 className="font-semibold">{editingId ? "Edit category" : "Add category"}</h2>
      <form onSubmit={save} className="grid md:grid-cols-2 gap-3">
        <input required maxLength={120} value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Category name" className="border rounded-lg p-3 text-sm"/>
        <input maxLength={180} value={form.slug} onChange={e=>setForm({...form,slug:e.target.value})} placeholder="URL slug (optional)" className="border rounded-lg p-3 text-sm"/>
        <textarea maxLength={1000} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Description" className="border rounded-lg p-3 text-sm md:col-span-2"/>
        <div className="md:col-span-2 space-y-2"><label className="text-sm">Category image</label><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setFile(e.target.files?.[0]||null)} className="block text-sm"/>{form.image && !file && <img src={form.image} alt="Current category" className="w-32 h-24 object-cover rounded-lg"/>}</div>
        <label className="flex items-center gap-2 text-sm md:col-span-2"><input type="checkbox" checked={form.isActive} onChange={e=>setForm({...form,isActive:e.target.checked})}/> Visible in storefront</label>
        <div className="flex gap-2 md:col-span-2"><button disabled={busy} className="bg-[#563568] text-white rounded-lg px-4 py-2 text-sm disabled:opacity-50">{busy ? "Saving…" : editingId ? "Save category" : "Create category"}</button><button type="button" onClick={reset} className="border rounded-lg px-4 py-2 text-sm">Clear</button></div>
      </form>
    </section>
    <section className="bg-white border rounded-2xl p-5"><h2 className="font-semibold mb-4">All categories ({items.length})</h2>{loading ? <p className="text-sm text-gray-500">Loading…</p> : <div className="space-y-3">{items.map((c,i)=><article key={c.id} className="flex flex-wrap items-center gap-3 border rounded-xl p-3"><img src={c.image || "/images/category-bracelets.jpg"} alt="" className="w-16 h-16 rounded-lg object-cover bg-gray-100"/><div className="flex-1 min-w-40"><p className="font-medium">{c.name}</p><p className="text-xs text-gray-500">/{c.slug} · {c.isActive ? "Published" : "Hidden"}</p></div><div className="flex flex-wrap gap-2"><button disabled={busy||i===0} onClick={()=>void move(i,-1)} className="border rounded px-2 py-1 text-xs disabled:opacity-40">↑</button><button disabled={busy||i===items.length-1} onClick={()=>void move(i,1)} className="border rounded px-2 py-1 text-xs disabled:opacity-40">↓</button><button disabled={busy} onClick={()=>edit(c)} className="border rounded px-3 py-1 text-xs">Edit</button><button disabled={busy} onClick={()=>void toggle(c)} className="border rounded px-3 py-1 text-xs">{c.isActive ? "Hide" : "Publish"}</button><button disabled={busy} onClick={()=>void remove(c)} className="border border-red-200 text-red-700 rounded px-3 py-1 text-xs">Delete</button></div></article>)}</div>}</section>
  </div></AdminLayout>;
};
