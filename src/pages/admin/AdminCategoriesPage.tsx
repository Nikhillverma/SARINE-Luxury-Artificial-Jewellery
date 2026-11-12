import React, { useCallback, useEffect, useState } from 'react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { hostingerAdminCategoryService } from '../../services/hostinger/hostingerAdminCategoryService';
import { hostingerMediaService } from '../../services';
import type { Category } from '../../types/category';
import { Plus, RefreshCw, Edit2, Trash2, Upload, X, CheckCircle2, Eye, EyeOff } from 'lucide-react';

const EMPTY_FORM = { name: '', description: '', image: '', sortOrder: '0', isActive: true };

function slugify(value: string): string {
  return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export const AdminCategoriesPage: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [modalOpen, setModalOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setCategories(await hostingerAdminCategoryService.getCategories());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load categories. Please sign in again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, sortOrder: String(categories.length * 10) });
    setError('');
    setModalOpen(true);
  };

  const openEdit = (category: Category) => {
    setEditing(category);
    setForm({
      name: category.name,
      description: category.description || '',
      image: category.image || '',
      sortOrder: String(category.sortOrder),
      isActive: category.isActive
    });
    setError('');
    setModalOpen(true);
  };

  const uploadImage = async (file?: File) => {
    if (!file || uploading) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Choose a JPG, PNG or WebP image.');
      return;
    }
    setUploading(true);
    setError('');
    try {
      const image = await hostingerMediaService.uploadImage(file);
      setForm(current => ({ ...current, image }));
      setNotice('Category artwork uploaded to Hostinger. Save the category to apply it.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving || uploading) return;
    const sortOrder = Number(form.sortOrder);
    if (!form.name.trim() || !Number.isInteger(sortOrder) || sortOrder < 0) {
      setError('Enter a category name and a non-negative whole display order.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: form.name.trim(),
        slug: editing && form.name.trim() === editing.name ? editing.slug : slugify(form.name),
        description: form.description.trim(),
        image: form.image,
        sortOrder,
        isActive: form.isActive
      };
      if (!payload.slug) throw new Error('Enter a valid category name.');
      if (editing) {
        await hostingerAdminCategoryService.updateCategory(editing.id, payload);
        setNotice('Category updated in Hostinger MariaDB.');
      } else {
        await hostingerAdminCategoryService.createCategory(payload);
        setNotice('Category created in Hostinger MariaDB.');
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save category.');
    } finally {
      setSaving(false);
    }
  };

  const togglePublished = async (category: Category) => {
    setError('');
    try {
      await hostingerAdminCategoryService.updateCategory(category.id, { isActive: !category.isActive });
      setNotice(`${category.name} ${category.isActive ? 'unpublished' : 'published'}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change category visibility.');
    }
  };

  const remove = async (category: Category) => {
    if (!window.confirm(`Delete category "${category.name}"? This is allowed only when no products use it.`)) return;
    setError('');
    try {
      await hostingerAdminCategoryService.deleteCategory(category.id);
      setNotice(`${category.name} deleted.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete category.');
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-[#2C1838]">Categories Management</h1>
            <p className="text-xs sm:text-sm text-[#705E7B] mt-1">Manage storefront collections, category artwork, visibility and display order.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => void load()} className="inline-flex items-center gap-2 px-3 py-2 border border-[#E7DCEB] rounded-xl text-xs"><RefreshCw size={14}/> Refresh</button>
            <button onClick={openCreate} className="inline-flex items-center gap-2 px-4 py-2 bg-[#563568] text-white rounded-xl text-xs font-semibold"><Plus size={15}/> Add Category</button>
          </div>
        </div>

        {notice && <div role="status" className="p-3 rounded-xl bg-[#F2FBF5] text-[#166534] text-xs flex items-center gap-2"><CheckCircle2 size={14}/><span className="flex-1">{notice}</span><button onClick={() => setNotice('')} aria-label="Dismiss notice"><X size={14}/></button></div>}
        {error && !modalOpen && <div role="alert" className="p-3 rounded-xl bg-red-50 text-red-700 text-xs">{error}</div>}

        <div className="bg-white rounded-2xl border border-[#EADFF0] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF5FC] text-[#705E7B] uppercase"><tr>
                <th className="p-3">Category</th><th className="p-3">Slug</th><th className="p-3">Order</th><th className="p-3">Visibility</th><th className="p-3 text-right">Actions</th>
              </tr></thead>
              <tbody className="divide-y divide-[#F5EDF8]">
                {loading ? <tr><td colSpan={5} className="p-10 text-center text-[#8E769E]">Loading categories…</td></tr> :
                categories.length === 0 ? <tr><td colSpan={5} className="p-10 text-center text-[#8E769E]">No categories yet. Add your first category.</td></tr> :
                categories.map(category => (
                  <tr key={category.id} className="hover:bg-[#FAF5FC]">
                    <td className="p-3"><div className="flex items-center gap-3">
                      {category.image ? <img src={category.image} alt="" className="w-12 h-12 rounded-lg object-cover border border-[#EADFF0]"/> : <div className="w-12 h-12 rounded-lg bg-[#F7F0FA] flex items-center justify-center text-[#8E769E]">—</div>}
                      <div><div className="font-semibold text-[#2C1838]">{category.name}</div><div className="text-[10px] text-[#8E769E] line-clamp-2">{category.description || 'No description'}</div></div>
                    </div></td>
                    <td className="p-3 font-mono text-[#705E7B]">{category.slug}</td>
                    <td className="p-3 tabular-nums">{category.sortOrder}</td>
                    <td className="p-3"><span className={category.isActive ? 'text-emerald-700' : 'text-[#8E769E]'}>{category.isActive ? 'Published' : 'Hidden'}</span></td>
                    <td className="p-3 text-right whitespace-nowrap">
                      <button onClick={() => void togglePublished(category)} title={category.isActive ? 'Unpublish category' : 'Publish category'} className="p-2 hover:bg-[#F3E8FF] rounded-lg text-[#563568]">{category.isActive ? <EyeOff size={14}/> : <Eye size={14}/>}</button>
                      <button onClick={() => openEdit(category)} title="Edit category" className="p-2 hover:bg-[#F3E8FF] rounded-lg"><Edit2 size={14}/></button>
                      <button onClick={() => void remove(category)} title="Delete category" className="p-2 hover:bg-red-50 text-red-600 rounded-lg"><Trash2 size={14}/></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <p className="text-[11px] text-[#8E769E]">Categories assigned to products cannot be deleted. Reassign those products first; hiding a category keeps its existing product records intact.</p>

        {modalOpen && <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5"><h2 className="font-serif text-xl text-[#2C1838]">{editing ? 'Edit Category' : 'Add Category'}</h2><button onClick={() => setModalOpen(false)} aria-label="Close"><X size={18}/></button></div>
            {error && <div role="alert" className="mb-3 p-3 bg-red-50 text-red-700 rounded-lg text-xs">{error}</div>}
            <form onSubmit={save} className="space-y-4 text-xs">
              <label className="block">Category name *<input required maxLength={120} value={form.name} onChange={e => setForm(current => ({ ...current, name: e.target.value }))} className="mt-1 w-full p-3 bg-[#FAF5FC] border border-[#E7DCEB] rounded-xl"/></label>
              <label className="block">Description<textarea maxLength={2000} rows={3} value={form.description} onChange={e => setForm(current => ({ ...current, description: e.target.value }))} className="mt-1 w-full p-3 bg-[#FAF5FC] border border-[#E7DCEB] rounded-xl"/></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">Display order<input required type="number" min="0" step="1" value={form.sortOrder} onChange={e => setForm(current => ({ ...current, sortOrder: e.target.value }))} className="mt-1 w-full p-3 bg-[#FAF5FC] border border-[#E7DCEB] rounded-xl"/></label>
                <label className="flex items-center gap-2 pt-5"><input type="checkbox" checked={form.isActive} onChange={e => setForm(current => ({ ...current, isActive: e.target.checked }))} className="w-4 h-4 accent-[#563568]"/> Published on storefront</label>
              </div>
              <div className="space-y-2">
                <span className="block">Category artwork</span>
                {form.image && <div className="relative w-full max-w-xs"><img src={form.image} alt="Category preview" className="w-full aspect-[4/3] object-cover rounded-xl border border-[#E7DCEB]"/><button type="button" onClick={() => setForm(current => ({ ...current, image: '' }))} className="absolute top-2 right-2 p-2 rounded-full bg-white shadow" aria-label="Remove category image"><X size={14}/></button></div>}
                <label className="inline-flex items-center gap-2 px-4 py-3 border border-[#E7DCEB] rounded-xl cursor-pointer hover:bg-[#FAF5FC]"><Upload size={15}/>{uploading ? 'Uploading…' : 'Choose image'}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={e => { void uploadImage(e.target.files?.[0]); e.currentTarget.value = ''; }} className="sr-only"/></label>
                <p className="text-[10px] text-[#8E769E]">JPG, PNG or WebP. Uploaded to the existing Hostinger media service.</p>
              </div>
              <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 border border-[#E7DCEB] rounded-xl">Cancel</button><button type="submit" disabled={saving || uploading} className="px-5 py-2 bg-[#563568] text-white rounded-xl disabled:opacity-50">{saving ? 'Saving…' : editing ? 'Save changes' : 'Create category'}</button></div>
            </form>
          </div>
        </div>}
      </div>
    </AdminLayout>
  );
};
