import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { adminProductService, categoryService, hostingerMediaService } from '../../services';
import type { Product, JewelleryType, ProductStatus } from '../../types/product';
import type { Category } from '../../types/category';
import { JEWELLERY_TYPE_LABELS } from '../../types/product';
import { formatInr } from '../../utils/currency';
import { Plus, Search, Edit2, Copy, Archive, X, RefreshCw, Upload, Trash2, ChevronUp, ChevronDown } from 'lucide-react';

const EMPTY_FORM = {
  name: '', price: '', costPrice: '', stock: '0', categoryId: '',
  jewelleryType: 'necklace' as JewelleryType, description: '', imageUrls: [] as string[],
  status: 'draft' as ProductStatus
};

function slugify(value: string): string {
  return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export const AdminProductsPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [items, cats] = await Promise.all([
        adminProductService.getProducts(),
        categoryService.getCategories({ activeOnly: false })
      ]);
      setProducts(items);
      setCategories(cats);
      setForm(current => ({ ...current, categoryId: current.categoryId || cats[0]?.id || '' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load products. Please sign in again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const visibleProducts = useMemo(() => products.filter(product => {
    const term = search.trim().toLowerCase();
    const matchesText = !term || product.name.toLowerCase().includes(term) ||
      product.slug.toLowerCase().includes(term) || product.id.toLowerCase().includes(term);
    const matchesStatus = statusFilter === 'all' || product.status === statusFilter;
    return matchesText && matchesStatus;
  }), [products, search, statusFilter]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, categoryId: categories[0]?.id || '', status: 'draft' });
    setError('');
    setModalOpen(true);
  };

  const openEdit = (product: Product) => {
    setEditing(product);
    setForm({
      name: product.name,
      price: String(product.price),
      costPrice: product.costPrice == null ? '' : String(product.costPrice),
      stock: String(product.stock),
      categoryId: product.categoryId,
      jewelleryType: product.jewelleryType,
      description: product.description || '',
      imageUrls: product.images || [],
      status: product.status
    });
    setError('');
    setModalOpen(true);
  };

  const handleImageFiles = async (files: FileList | null) => {
    if (!files?.length || uploadingImages) return;
    const selected = Array.from(files);
    if (form.imageUrls.length + selected.length > 8) {
      setError('A product can have up to 8 images. Remove an image before adding more.');
      return;
    }

    setUploadingImages(true);
    setError('');
    setNotice('');
    try {
      const uploaded: string[] = [];
      for (const file of selected) {
        uploaded.push(await hostingerMediaService.uploadImage(file));
      }
      setForm(current => ({ ...current, imageUrls: [...current.imageUrls, ...uploaded] }));
      setNotice(`${uploaded.length} image${uploaded.length === 1 ? '' : 's'} uploaded to Hostinger storage. Save the product to publish them.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image upload failed.');
    } finally {
      setUploadingImages(false);
    }
  };

  const moveImage = (index: number, direction: -1 | 1) => {
    setForm(current => {
      const next = [...current.imageUrls];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...current, imageUrls: next };
    });
  };

  const removeImage = (index: number) => {
    setForm(current => ({
      ...current,
      imageUrls: current.imageUrls.filter((_, imageIndex) => imageIndex !== index)
    }));
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (uploadingImages) return;
    setSaving(true);
    setError('');
    try {
      const price = Number(form.price);
      const stock = Number(form.stock);
      if (!form.name.trim() || !Number.isFinite(price) || price < 0 ||
          !Number.isInteger(stock) || stock < 0 || !form.categoryId) {
        throw new Error('Enter a product name, valid price, non-negative whole stock count and category.');
      }
      const baseSlug = slugify(form.name);
      if (!baseSlug) throw new Error('Please enter a valid product title.');
      const payload = {
        slug: editing && editing.name === form.name ? editing.slug : baseSlug,
        name: form.name.trim(),
        description: form.description.trim(),
        shortDescription: editing?.shortDescription || '',
        price,
        ...(form.costPrice.trim() ? { costPrice: Number(form.costPrice) } : {}),
        images: form.imageUrls,
        categoryId: form.categoryId,
        collectionSlugs: editing?.collectionSlugs || [],
        jewelleryType: form.jewelleryType,
        stock,
        status: form.status,
        tags: editing?.tags || [],
        ...(editing?.baseMetal ? { baseMetal: editing.baseMetal } : {}),
        ...(editing?.platingFinish ? { platingFinish: editing.platingFinish } : {}),
        ...(editing?.stoneType ? { stoneType: editing.stoneType } : {}),
        ...(editing?.closureType ? { closureType: editing.closureType } : {}),
        careInstructions: editing?.careInstructions || []
      };
      if (form.costPrice.trim() && (!Number.isFinite(Number(form.costPrice)) || Number(form.costPrice) < 0)) {
        throw new Error('Enter a valid cost price.');
      }
      if (editing) {
        await adminProductService.updateProduct(editing.id, payload);
        setNotice('Product changes saved to Hostinger database.');
      } else {
        await adminProductService.createProduct(payload);
        setNotice('Product created in Hostinger database.');
      }
      setModalOpen(false);
      setEditing(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save product.');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (product: Product) => {
    try {
      await adminProductService.updateProduct(product.id, {
        status: product.status === 'active' ? 'draft' : 'active'
      });
      setNotice(`${product.name} status updated.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update product status.');
    }
  };

  const duplicate = async (product: Product) => {
    try {
      await adminProductService.createProduct({
        slug: `${product.slug}-copy-${Date.now().toString().slice(-6)}`,
        name: `${product.name} (Copy)`,
        description: product.description,
        shortDescription: product.shortDescription,
        price: product.price,
        ...(product.compareAtPrice == null ? {} : { compareAtPrice: product.compareAtPrice }),
        ...(product.costPrice == null ? {} : { costPrice: product.costPrice }),
        images: product.images,
        categoryId: product.categoryId,
        collectionSlugs: product.collectionSlugs,
        jewelleryType: product.jewelleryType,
        stock: 0,
        status: 'draft',
        tags: product.tags,
        ...(product.baseMetal ? { baseMetal: product.baseMetal } : {}),
        ...(product.platingFinish ? { platingFinish: product.platingFinish } : {}),
        ...(product.stoneType ? { stoneType: product.stoneType } : {}),
        ...(product.closureType ? { closureType: product.closureType } : {}),
        careInstructions: product.careInstructions || []
      });
      setNotice('A draft copy was saved to Hostinger.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not duplicate product.');
    }
  };

  const archive = async (product: Product) => {
    if (!window.confirm(`Archive "${product.name}"? It will be hidden from the storefront, not deleted.`)) return;
    try {
      await adminProductService.archiveProduct(product.id);
      setNotice(`${product.name} archived. Historical order references are preserved.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not archive product.');
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-[#2C1838]">Products & Catalogue</h1>
            <p className="text-xs sm:text-sm text-[#705E7B] mt-1">Changes are saved directly to your Hostinger MariaDB database.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => void load()} className="inline-flex items-center gap-2 px-3 py-2 border border-[#E7DCEB] rounded-xl text-xs"><RefreshCw size={14}/> Refresh</button>
            <button onClick={openCreate} className="inline-flex items-center gap-2 px-4 py-2 bg-[#563568] text-white rounded-xl text-xs font-semibold"><Plus size={15}/> Add Product</button>
          </div>
        </div>

        {notice && <div className="p-3 rounded-xl bg-[#F2FBF5] text-[#166534] text-xs flex justify-between">{notice}<button onClick={() => setNotice('')}><X size={14}/></button></div>}
        {error && !modalOpen && <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs">{error}</div>}

        <div className="bg-white rounded-2xl p-4 border border-[#EADFF0] flex flex-col sm:flex-row gap-3">
          <div className="flex-1 flex items-center gap-2">
            <Search size={15} className="text-[#8E769E]"/>
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search product name or ID" className="w-full bg-transparent outline-none text-sm"/>
          </div>
          <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} className="px-3 py-2 border border-[#E7DCEB] rounded-lg text-xs">
            <option value="all">All statuses</option><option value="active">Active</option><option value="draft">Draft</option><option value="archived">Archived</option>
          </select>
        </div>

        <div className="bg-white rounded-2xl border border-[#EADFF0] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF5FC] text-[#705E7B] uppercase"><tr>
                <th className="p-3">Product</th><th className="p-3">Category</th><th className="p-3">Price</th><th className="p-3">Stock</th><th className="p-3">Status</th><th className="p-3 text-right">Actions</th>
              </tr></thead>
              <tbody className="divide-y divide-[#F5EDF8]">
                {loading ? <tr><td colSpan={6} className="p-10 text-center text-[#8E769E]">Loading catalogue…</td></tr> :
                visibleProducts.length === 0 ? <tr><td colSpan={6} className="p-10 text-center text-[#8E769E]">No products found.</td></tr> :
                visibleProducts.map(product => (
                  <tr key={product.id} className="hover:bg-[#FAF5FC]">
                    <td className="p-3"><div className="flex items-center gap-3">
                      <img src={product.images?.[0] || 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=100&q=80'} alt="" className="w-11 h-11 rounded-lg object-cover"/>
                      <div><div className="font-semibold text-[#2C1838]">{product.name}</div><div className="text-[10px] text-[#8E769E] font-mono">{product.id}</div></div>
                    </div></td>
                    <td className="p-3 text-[#5D5068]">{categories.find(category => category.id === product.categoryId)?.name || product.categoryId}</td>
                    <td className="p-3 font-semibold">{formatInr(product.price)}</td>
                    <td className="p-3">{product.stock}</td>
                    <td className="p-3"><span className="capitalize">{product.status}</span></td>
                    <td className="p-3 text-right whitespace-nowrap">
                      {product.status !== 'archived' && <button onClick={() => void toggleStatus(product)} title="Toggle active/draft" className="p-2 hover:bg-[#F3E8FF] rounded-lg text-[#563568]">{product.status === 'active' ? 'Unpublish' : 'Publish'}</button>}
                      <button onClick={() => openEdit(product)} title="Edit" className="p-2 hover:bg-[#F3E8FF] rounded-lg"><Edit2 size={14}/></button>
                      <button onClick={() => void duplicate(product)} title="Duplicate as draft" className="p-2 hover:bg-[#F3E8FF] rounded-lg"><Copy size={14}/></button>
                      {product.status !== 'archived' && <button onClick={() => void archive(product)} title="Archive" className="p-2 hover:bg-red-50 text-red-600 rounded-lg"><Archive size={14}/></button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {modalOpen && <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5"><h2 className="font-serif text-xl text-[#2C1838]">{editing ? 'Edit Product' : 'Add Product'}</h2><button onClick={() => setModalOpen(false)}><X size={18}/></button></div>
            {error && <div className="mb-3 p-3 bg-red-50 text-red-700 rounded-lg text-xs">{error}</div>}
            <form onSubmit={save} className="space-y-4 text-xs">
              <label className="block">Product name *<input required maxLength={255} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="mt-1 w-full p-3 bg-[#FAF5FC] border border-[#E7DCEB] rounded-xl"/></label>
              <div className="grid grid-cols-2 gap-3">
                <label>Selling price (₹) *<input required type="number" min="0" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} className="mt-1 w-full p-3 bg-[#FAF5FC] border border-[#E7DCEB] rounded-xl"/></label>
                <label>Cost price (₹)<input type="number" min="0" step="0.01" value={form.costPrice} onChange={e => setForm({ ...form, costPrice: e.target.value })} className="mt-1 w-full p-3 bg-[#FAF5FC] border border-[#E7DCEB] rounded-xl"/></label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label>Stock *<input required type="number" min="0" step="1" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} className="mt-1 w-full p-3 bg-[#FAF5FC] border border-[#E7DCEB] rounded-xl"/></label>
                <label>Category *<select required value={form.categoryId} onChange={e => setForm({ ...form, categoryId: e.target.value })} className="mt-1 w-full p-3 bg-[#FAF5FC] border border-[#E7DCEB] rounded-xl">{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label>Jewellery type *<select value={form.jewelleryType} onChange={e => setForm({ ...form, jewelleryType: e.target.value as JewelleryType })} className="mt-1 w-full p-3 bg-[#FAF5FC] border border-[#E7DCEB] rounded-xl">{Object.entries(JEWELLERY_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label>Status<select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as ProductStatus })} className="mt-1 w-full p-3 bg-[#FAF5FC] border border-[#E7DCEB] rounded-xl"><option value="draft">Draft</option><option value="active">Active</option></select></label>
              </div>
              <section className="space-y-3 rounded-xl border border-[#E7DCEB] bg-[#FCF9FD] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-[#2C1838]">Product images</h3>
                    <p className="text-[11px] text-[#8E769E]">Upload up to 8 JPEG, PNG or WebP images. Images are optimised and stored on Hostinger.</p>
                  </div>
                  <label className={`inline-flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${uploadingImages ? 'bg-gray-200 text-gray-500' : 'bg-[#563568] text-white'}`}>
                    <Upload size={14}/>
                    {uploadingImages ? 'Uploading…' : 'Upload images'}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      disabled={uploadingImages || form.imageUrls.length >= 8}
                      onChange={event => {
                        void handleImageFiles(event.target.files);
                        event.currentTarget.value = '';
                      }}
                      className="sr-only"
                    />
                  </label>
                </div>
                {form.imageUrls.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {form.imageUrls.map((url, index) => (
                      <div key={`${url}-${index}`} className="relative overflow-hidden rounded-lg border border-[#E7DCEB] bg-white">
                        <img src={url} alt={`Product image ${index + 1}`} className="aspect-square w-full object-cover" />
                        <div className="flex items-center justify-between gap-1 p-1">
                          <span className="text-[10px] text-[#705E7B]">{index === 0 ? 'Main image' : `Image ${index + 1}`}</span>
                          <div className="flex items-center">
                            <button type="button" aria-label="Move image up" disabled={index === 0} onClick={() => moveImage(index, -1)} className="p-1 disabled:opacity-30"><ChevronUp size={13}/></button>
                            <button type="button" aria-label="Move image down" disabled={index === form.imageUrls.length - 1} onClick={() => moveImage(index, 1)} className="p-1 disabled:opacity-30"><ChevronDown size={13}/></button>
                            <button type="button" aria-label="Remove image" onClick={() => removeImage(index)} className="p-1 text-red-600"><Trash2 size={13}/></button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-[#D9C8E2] p-6 text-center text-xs text-[#8E769E]">
                    No product images added yet.
                  </div>
                )}
              </section>
              <label className="block">Description<textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="mt-1 w-full p-3 bg-[#FAF5FC] border border-[#E7DCEB] rounded-xl"/></label>
              <div className="flex justify-end gap-2 pt-3 border-t border-[#E7DCEB]">
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 border rounded-xl">Cancel</button>
                <button disabled={saving || uploadingImages} type="submit" className="px-5 py-2 bg-[#563568] text-white rounded-xl disabled:opacity-50">{uploadingImages ? 'Uploading images…' : saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Draft/Product'}</button>
              </div>
            </form>
          </div>
        </div>}
      </div>
    </AdminLayout>
  );
};
