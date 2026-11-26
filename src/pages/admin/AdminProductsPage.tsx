import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { Link, useSearchParams } from 'react-router-dom';
import { adminProductService, hostingerMediaService } from '../../services';
import { hostingerAdminCategoryService } from '../../services/hostinger/hostingerAdminCategoryService';
import type { Product, JewelleryType, ProductStatus, ProductCollection } from '../../types/product';
import type { Category } from '../../types/category';
import { JEWELLERY_TYPE_LABELS } from '../../types/product';
import { BulkProductEditor } from '../../components/admin/BulkProductEditor';
import { ProductVariantsManager } from '../../components/admin/ProductVariantsManager';
import type { BulkProductUpdates, BulkProductUpdateResult } from '../../services/interfaces';
import { formatInr } from '../../utils/currency';
import { Plus, Search, Edit2, Copy, Archive, X, RefreshCw, Upload, Trash2, ChevronUp, ChevronDown, Eye, Download, Package, AlertTriangle, Image as ImageIcon, Filter } from 'lucide-react';

const EMPTY_FORM = {
  name: '', productCollection: '' as '' | ProductCollection, price: '', compareAtPrice: '', costPrice: '', stock: '0', categoryId: '',
  jewelleryType: 'necklace' as JewelleryType, shortDescription: '', description: '',
  tags: '', collectionSlugs: '', baseMetal: '', platingFinish: '', stoneType: '', closureType: '', careInstructions: '', productVideoUrl: '',
  imageUrls: [] as string[], status: 'draft' as ProductStatus
};

function splitList(value: string): string[] {
  return Array.from(new Set(value.split(',').flatMap(item => item.split(String.fromCharCode(10))).map(item => item.trim()).filter(Boolean)));
}

function splitLines(value: string): string[] {
  return Array.from(new Set(value.split(String.fromCharCode(10)).map(item => item.trim()).filter(Boolean)));
}

function slugify(value: string): string {
  return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export const AdminProductsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [search, setSearch] = useState(() => searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [productCollectionFilter, setProductCollectionFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [variantProduct, setVariantProduct] = useState<Product | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [items, cats] = await Promise.all([
        adminProductService.getProducts(),
        hostingerAdminCategoryService.getCategories()
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

  useEffect(() => { setSearch(searchParams.get('search') || ''); }, [searchParams]);

  const visibleProducts = useMemo(() => {
    const filtered = products.filter(product => {
      const term = search.trim().toLowerCase();
      const matchesText = !term || product.name.toLowerCase().includes(term) ||
        product.slug.toLowerCase().includes(term) || product.id.toLowerCase().includes(term);
      const matchesStatus = statusFilter === 'all' || product.status === statusFilter;
      const matchesCategory = categoryFilter === 'all' || product.categoryId === categoryFilter;
      const matchesProductCollection = productCollectionFilter === 'all'
        || (productCollectionFilter === 'unassigned' && !product.productCollection)
        || product.productCollection === productCollectionFilter;
      const matchesStock = stockFilter === 'all' ||
        (stockFilter === 'out' && product.stock <= 0) ||
        (stockFilter === 'low' && product.stock > 0 && product.stock <= 5) ||
        (stockFilter === 'available' && product.stock > 5) ||
        (stockFilter === 'missing-image' && !(product.images || []).some(Boolean));
      return matchesText && matchesStatus && matchesCategory && matchesProductCollection && matchesStock;
    });
    return filtered.sort((a, b) => {
      if (sortBy === 'price-low') return a.price - b.price;
      if (sortBy === 'price-high') return b.price - a.price;
      if (sortBy === 'stock-low') return a.stock - b.stock;
      if (sortBy === 'stock-high') return b.stock - a.stock;
      if (sortBy === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
    });
  }, [products, search, statusFilter, categoryFilter, productCollectionFilter, stockFilter, sortBy]);

  useEffect(() => { setPage(1); }, [search, statusFilter, categoryFilter, productCollectionFilter, stockFilter, sortBy]);
  const pageCount = Math.max(1, Math.ceil(visibleProducts.length / pageSize));
  const pageProducts = visibleProducts.slice((page - 1) * pageSize, page * pageSize);

  const catalogueStats = useMemo(() => ({
    total: products.length,
    active: products.filter(product => product.status === 'active').length,
    drafts: products.filter(product => product.status === 'draft').length,
    outOfStock: products.filter(product => product.stock <= 0 && product.status !== 'archived').length,
    missingImages: products.filter(product => !(product.images || []).some(Boolean) && product.status !== 'archived').length
  }), [products]);

  const exportCsv = () => {
    const headers = ['Product ID', 'Name', 'Product Range', 'SKU / Slug', 'Category', 'Type', 'Price INR', 'Compare At INR', 'Cost INR', 'Stock', 'Status', 'Image URLs', 'Tags'];
    const escapeCsv = (value: unknown) => {
      let text = String(value ?? '');
      if (typeof value === 'string' && (/^[=+@-]/.test(text) || text.startsWith('\t') || text.startsWith('\r'))) text = "'" + text;
      return '"' + text.replace(/"/g, '""') + '"';
    };
    const rows = visibleProducts.map(product => [
      product.id, product.name, product.productCollection || 'Unassigned', product.slug,
      categories.find(category => category.id === product.categoryId)?.name || product.categoryId,
      product.jewelleryType, product.price, product.compareAtPrice ?? '',
      product.costPrice ?? '', product.stock, product.status,
      (product.images || []).join(' | '), (product.tags || []).join(' | ')
    ]);
    const csv = [headers, ...rows].map(row => row.map(escapeCsv).join(',')).join('\r\n');
    const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'sarine-catalogue-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice('Exported ' + visibleProducts.length + ' filtered catalogue records to CSV.');
  };


  const allVisibleSelected = pageProducts.length > 0 && pageProducts.every(product => selectedIds.includes(product.id));
  const toggleProductSelection = (id: string) => setSelectedIds(current =>
    current.includes(id) ? current.filter(item => item !== id) : current.length >= 100 ? current : [...current, id]
  );
  const toggleVisibleSelection = () => setSelectedIds(current => allVisibleSelected
    ? current.filter(id => !pageProducts.some(product => product.id === id))
    : Array.from(new Set([...current, ...pageProducts.map(product => product.id)])).slice(0, 100)
  );
  const applyBulkChanges = async (updates: BulkProductUpdates): Promise<BulkProductUpdateResult> => {
    const result = await adminProductService.bulkUpdateProducts(selectedIds, updates);
    const skipped = result.results.filter(item => item.status !== "updated");
    const detail = skipped.length
      ? " Skipped: " + skipped.map(item => (item.productName || item.productId) + ": " + item.message).join(" | ")
      : "";
    setNotice("Bulk update complete: " + result.summary.updated + " updated, " + result.summary.skipped + " skipped." + detail);
    setSelectedIds([]);
    await load();
    return result;
  };

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
      productCollection: product.productCollection || '',
      price: String(product.price),
      compareAtPrice: product.compareAtPrice == null ? '' : String(product.compareAtPrice),
      costPrice: product.costPrice == null ? '' : String(product.costPrice),
      stock: String(product.stock),
      categoryId: product.categoryId,
      jewelleryType: product.jewelleryType,
      shortDescription: product.shortDescription || '',
      description: product.description || '',
      tags: (product.tags || []).join(', '),
      collectionSlugs: (product.collectionSlugs || []).join(', '),
      baseMetal: product.baseMetal || '',
      platingFinish: product.platingFinish || '',
      stoneType: product.stoneType || '',
      closureType: product.closureType || '',
      careInstructions: (product.careInstructions || []).join(String.fromCharCode(10)),
      productVideoUrl: product.productVideoUrl || '',
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
        const url = await hostingerMediaService.uploadImage(file);
        uploaded.push(url);
        setForm(current => ({ ...current, imageUrls: [...current.imageUrls, url] }));
      }
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
      if (form.productVideoUrl.trim() && (!/^https:\/\//i.test(form.productVideoUrl.trim()) || !/\.(mp4|webm)(\?|#|$)/i.test(form.productVideoUrl.trim()))) {
        throw new Error('Use a secure HTTPS MP4 or WebM video URL.');
      }
      const baseSlug = slugify(form.name);
      if (!baseSlug) throw new Error('Please enter a valid product title.');
      if (!editing && !form.productCollection) throw new Error('Choose Artificial or Demi-Fine before creating a new product.');
      const payload = {
        slug: editing && editing.name === form.name ? editing.slug : baseSlug,
        name: form.name.trim(),
        ...(editing && !form.productCollection ? {} : { productCollection: form.productCollection }),
        description: form.description.trim(),
        shortDescription: form.shortDescription.trim(),
        price,
        compareAtPrice: form.compareAtPrice.trim() ? Number(form.compareAtPrice) : null,
        ...(form.costPrice.trim() ? { costPrice: Number(form.costPrice) } : {}),
        images: form.imageUrls,
        categoryId: form.categoryId,
        collectionSlugs: splitList(form.collectionSlugs),
        jewelleryType: form.jewelleryType,
        stock,
        status: form.status,
        tags: splitList(form.tags),
        baseMetal: form.baseMetal.trim(),
        platingFinish: form.platingFinish.trim(),
        stoneType: form.stoneType.trim(),
        closureType: form.closureType.trim(),
        careInstructions: splitLines(form.careInstructions),
        productVideoUrl: form.productVideoUrl.trim()
      };
      if (form.productVideoUrl.trim() && (!/^https:\/\//i.test(form.productVideoUrl.trim()) || !/\.(mp4|webm)(\?|#|$)/i.test(form.productVideoUrl.trim()))) throw new Error('Use a secure HTTPS MP4 or WebM video URL.');
      if (form.costPrice.trim() && (!Number.isFinite(Number(form.costPrice)) || Number(form.costPrice) < 0)) {
        throw new Error('Enter a valid cost price.');
      }
      if (form.compareAtPrice.trim() && (!Number.isFinite(Number(form.compareAtPrice)) || Number(form.compareAtPrice) <= price)) {
        throw new Error('Comparison price must be greater than the selling price.');
      }
      if (form.shortDescription.length > 240 || form.description.length > 5000) throw new Error('Short description is limited to 240 characters and full description to 5,000 characters.');
      if (splitList(form.tags).length > 20 || splitList(form.collectionSlugs).length > 20 || splitLines(form.careInstructions).length > 20 || splitLines(form.careInstructions).some(instruction => instruction.length > 300)) throw new Error('Use no more than 20 tags, collections or care instructions.');
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
    if (product.status !== 'active' && !window.confirm(`Publish "${product.name}" to the storefront?`)) return;
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
      if (!product.productCollection) throw new Error('Assign this legacy product to Artificial or Demi-Fine before duplicating it.');
      await adminProductService.createProduct({
        slug: `${product.slug}-copy-${Date.now().toString().slice(-6)}`,
        name: `${product.name} (Copy)`,
        productCollection: product.productCollection,
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
        careInstructions: product.careInstructions || [],
        productVideoUrl: product.productVideoUrl || ''
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
            <button onClick={() => void load()} className="inline-flex min-h-10 items-center gap-2 px-3 py-2 border border-[#E7DCEB] rounded-xl text-xs"><RefreshCw size={14}/> Refresh</button>
            <button onClick={openCreate} className="inline-flex min-h-10 items-center gap-2 px-4 py-2 bg-[#563568] text-white rounded-xl text-xs font-semibold"><Plus size={15}/> Add Product</button>
          </div>
        </div>

        {notice && <div className="p-3 rounded-xl bg-[#F2FBF5] text-[#166534] text-xs flex justify-between">{notice}<button onClick={() => setNotice('')}><X size={14}/></button></div>}
        {error && !modalOpen && <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs">{error}</div>}

        <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
          {[
            { label: 'Total products', value: catalogueStats.total, icon: Package, tone: 'text-[#563568] bg-[#F7F0FA]' },
            { label: 'Published', value: catalogueStats.active, icon: Eye, tone: 'text-emerald-700 bg-emerald-50' },
            { label: 'Drafts', value: catalogueStats.drafts, icon: Copy, tone: 'text-violet-700 bg-violet-50' },
            { label: 'Out of stock', value: catalogueStats.outOfStock, icon: AlertTriangle, tone: 'text-amber-700 bg-amber-50' },
            { label: 'Missing images', value: catalogueStats.missingImages, icon: ImageIcon, tone: 'text-rose-700 bg-rose-50' }
          ].map(item => { const Icon = item.icon; return <div key={item.label} className="rounded-xl border border-[#EADFF0] bg-white p-4"><span className={'inline-flex h-8 w-8 items-center justify-center rounded-lg ' + item.tone}><Icon size={16}/></span><p className="mt-3 text-xl font-semibold text-[#2C1838]">{loading ? '—' : item.value.toLocaleString('en-IN')}</p><p className="mt-0.5 text-[10px] text-[#806B8D]">{item.label}</p></div>; })}
        </div>

        <div className="bg-white rounded-2xl p-4 border border-[#EADFF0] space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1 flex items-center gap-2 min-w-0">
              <Search size={15} className="text-[#8E769E]"/>
              <input aria-label="Search products by name or ID" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search product name, slug or ID" className="w-full min-h-10 bg-transparent outline-none text-sm"/>
            </div>
            <button type="button" onClick={exportCsv} disabled={loading || visibleProducts.length === 0} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#E7DCEB] px-3 text-xs font-semibold text-[#563568] hover:bg-[#FAF5FC] disabled:opacity-50"><Download size={14}/> Export CSV ({visibleProducts.length})</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-2">
            <label className="text-[10px] text-[#806B8D]">Status
              <select aria-label="Filter products by status" value={statusFilter} onChange={event => setStatusFilter(event.target.value)} className="mt-1 w-full min-h-10 px-3 border border-[#E7DCEB] rounded-lg text-xs text-[#302438]">
                <option value="all">All statuses</option><option value="active">Active</option><option value="draft">Draft</option><option value="archived">Archived</option>
              </select>
            </label>
            <label className="text-[10px] text-[#806B8D]">Category
              <select aria-label="Filter products by category" value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)} className="mt-1 w-full min-h-10 px-3 border border-[#E7DCEB] rounded-lg text-xs text-[#302438]">
                <option value="all">All categories</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </label>
            <label className="text-[10px] text-[#806B8D]">Product range
              <select aria-label="Filter products by product range" value={productCollectionFilter} onChange={event => setProductCollectionFilter(event.target.value)} className="mt-1 w-full min-h-10 px-3 border border-[#E7DCEB] rounded-lg text-xs text-[#302438]">
                <option value="all">All ranges</option><option value="artificial">Artificial</option><option value="demi-fine">Demi-Fine</option><option value="unassigned">Unassigned</option>
              </select>
            </label>
            <label className="text-[10px] text-[#806B8D]">Stock status
              <select aria-label="Filter products by stock status" value={stockFilter} onChange={event => setStockFilter(event.target.value)} className="mt-1 w-full min-h-10 px-3 border border-[#E7DCEB] rounded-lg text-xs text-[#302438]">
                <option value="all">All stock levels</option><option value="out">Out of stock</option><option value="low">Low stock (1–5)</option><option value="available">Available (6+)</option><option value="missing-image">Missing product images</option>
              </select>
            </label>
            <label className="text-[10px] text-[#806B8D]">Sort by
              <select aria-label="Sort products" value={sortBy} onChange={event => setSortBy(event.target.value)} className="mt-1 w-full min-h-10 px-3 border border-[#E7DCEB] rounded-lg text-xs text-[#302438]">
                <option value="name">Name (A–Z)</option><option value="newest">Newest first</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option><option value="stock-low">Stock: low to high</option><option value="stock-high">Stock: high to low</option>
              </select>
            </label>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-[#806B8D]">
            <span><Filter size={12} className="inline mr-1"/>Showing <strong className="text-[#563568]">{visibleProducts.length}</strong> of {products.length} products</span>
            {(search || statusFilter !== 'all' || categoryFilter !== 'all' || productCollectionFilter !== 'all' || stockFilter !== 'all' || sortBy !== 'name') && <button type="button" onClick={() => { setSearch(''); setStatusFilter('all'); setCategoryFilter('all'); setProductCollectionFilter('all'); setStockFilter('all'); setSortBy('name'); }} className="min-h-9 px-2 font-semibold text-[#704A83] hover:underline">Clear filters</button>}
          </div>
        </div>


        {selectedIds.length > 0 && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#D9C8E2] bg-[#F7F0FA] p-3">
          <div className="text-xs text-[#563568]"><strong>{selectedIds.length}</strong> product{selectedIds.length === 1 ? "" : "s"} selected <span className="text-[#806B8D]">· Maximum 100 per operation</span></div>
          <div className="flex gap-2">
            <button onClick={() => setSelectedIds([])} className="min-h-10 rounded-lg border border-[#D9C8E2] px-3 text-xs">Clear selection</button>
            <button onClick={() => setBulkOpen(true)} className="min-h-10 rounded-lg bg-[#563568] px-4 text-xs font-semibold text-white">Bulk edit selected</button>
          </div>
        </div>}
        {bulkOpen && <BulkProductEditor products={products.filter(product => selectedIds.includes(product.id))} categories={categories} onApply={applyBulkChanges} onClose={() => setBulkOpen(false)}/>}
        {variantProduct && <ProductVariantsManager product={variantProduct} onClose={() => setVariantProduct(null)} onSaved={(stock) => { setProducts(current => current.map(item => item.id === variantProduct.id ? { ...item, stock } : item)); void load(); }} />}
        <div className="bg-white rounded-2xl border border-[#EADFF0] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF5FC] text-[#705E7B] uppercase"><tr>
                <th className="p-3"><input type="checkbox" aria-label="Select all products on this page" checked={allVisibleSelected} onChange={toggleVisibleSelection} className="accent-[#563568]"/></th><th className="p-3">Product</th><th className="p-3">Category</th><th className="p-3">Range</th><th className="p-3">Price</th><th className="p-3">Stock</th><th className="p-3">Status</th><th className="p-3 text-right">Actions</th>
              </tr></thead>
              <tbody className="divide-y divide-[#F5EDF8]">
                {loading ? <tr><td colSpan={8} className="p-10 text-center text-[#8E769E]">Loading catalogue…</td></tr> :
                visibleProducts.length === 0 ? <tr><td colSpan={7} className="p-10 text-center text-[#8E769E]">No products found.</td></tr> :
                pageProducts.map(product => (
                  <tr key={product.id} className="hover:bg-[#FAF5FC]">
                    <td className="p-3"><input type="checkbox" aria-label={"Select " + product.name} checked={selectedIds.includes(product.id)} onChange={() => toggleProductSelection(product.id)} className="accent-[#563568]"/></td>
                    <td className="p-3"><div className="flex items-center gap-3">
                      {product.images?.[0] ? <img src={product.images[0]} alt="" loading="lazy" className="w-11 h-11 rounded-lg object-cover"/> : <div role="img" aria-label="No product image uploaded" className="w-11 h-11 rounded-lg bg-[#F7F0FA] text-[#A58BB3] flex items-center justify-center"><ImageIcon size={16}/></div>}
                      <div><div className="font-semibold text-[#2C1838]">{product.name}</div><div className="text-[10px] text-[#8E769E] font-mono">{product.id}</div></div>
                    </div></td>
                    <td className="p-3 text-[#5D5068]">{categories.find(category => category.id === product.categoryId)?.name || product.categoryId}</td>
                    <td className="p-3 text-[#5D5068]">{product.productCollection === 'demi-fine' ? 'Demi-Fine' : product.productCollection === 'artificial' ? 'Artificial' : 'Unassigned'}</td>
                    <td className="p-3 font-semibold">{formatInr(product.price)}</td>
                    <td className="p-3">{product.stock}</td>
                    <td className="p-3"><span className="capitalize">{product.status}</span></td>
                    <td className="p-3 text-right whitespace-nowrap">
                      {product.status !== 'archived' && <button onClick={() => void toggleStatus(product)} title="Toggle active/draft" className="p-2 hover:bg-[#F3E8FF] rounded-lg text-[#563568]">{product.status === 'active' ? 'Unpublish' : 'Publish'}</button>}
                      <Link to={`/admin/products/${encodeURIComponent(product.id)}/preview`} title="Preview product privately (no purchasing)" className="inline-flex items-center gap-1 px-2 py-1.5 hover:bg-[#F3E8FF] rounded-lg text-[10px] font-semibold text-[#563568]"><Eye size={13}/> Preview</Link>
                      <button onClick={() => setVariantProduct(product)} title="Manage sizes, colours and variant stock" className="px-2 py-1.5 hover:bg-[#F3E8FF] rounded-lg text-[10px] font-semibold text-[#563568]">Variants{product.variants?.length ? ` (${product.variants.length})` : ''}</button>
                      <button onClick={() => openEdit(product)} title="Edit" className="p-2 hover:bg-[#F3E8FF] rounded-lg"><Edit2 size={14}/></button>
                      <button onClick={() => void duplicate(product)} title="Duplicate as draft" className="p-2 hover:bg-[#F3E8FF] rounded-lg"><Copy size={14}/></button>
                      {product.status !== 'archived' && <button onClick={() => void archive(product)} title="Archive" className="p-2 hover:bg-red-50 text-red-600 rounded-lg"><Archive size={14}/></button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && visibleProducts.length > 0 && <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-[#F0E8F3] px-4 py-3">
            <p className="text-[10px] text-[#806B8D]">Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, visibleProducts.length)} of {visibleProducts.length} filtered products</p>
            <div className="flex items-center gap-2">
              <button type="button" disabled={page <= 1} onClick={() => setPage(current => Math.max(1, current - 1))} className="min-h-10 rounded-lg border border-[#E7DCEB] px-3 text-xs disabled:opacity-40">Previous</button>
              <span className="min-w-20 text-center text-[10px] text-[#806B8D]">Page {page} of {pageCount}</span>
              <button type="button" disabled={page >= pageCount} onClick={() => setPage(current => Math.min(pageCount, current + 1))} className="min-h-10 rounded-lg border border-[#E7DCEB] px-3 text-xs disabled:opacity-40">Next</button>
            </div>
          </div>}
        </div>

        {modalOpen && <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5"><h2 className="font-serif text-xl text-[#2C1838]">{editing ? 'Edit Product' : 'Add Product'}</h2><button onClick={() => setModalOpen(false)}><X size={18}/></button></div>
            {error && <div className="mb-3 p-3 bg-red-50 text-red-700 rounded-lg text-xs">{error}</div>}
            <form onSubmit={save} className="space-y-4 text-xs">
              <label className="block">Product name *<input required maxLength={255} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="mt-1 w-full p-3 bg-[#FAF5FC] border border-[#E7DCEB] rounded-xl"/></label>
              <label className="block">Product range {editing && !editing.productCollection ? "(Unassigned)" : "*"}<select required={!editing || Boolean(editing.productCollection)} value={form.productCollection} onChange={e => setForm({ ...form, productCollection: e.target.value as '' | ProductCollection })} className="mt-1 w-full p-3 bg-[#FAF5FC] border border-[#E7DCEB] rounded-xl"><option value="">{editing && !editing.productCollection ? "Unassigned — leave unchanged" : "Choose a product range"}</option><option value="artificial">Artificial</option><option value="demi-fine">Demi-Fine</option></select><span className="mt-1 block text-[10px] text-[#806B8D]">This determines which storefront collection displays this product.</span></label>
              <div className="grid grid-cols-2 gap-3">
                <label>Selling price (₹) *<input required type="number" min="0" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} className="mt-1 w-full p-3 bg-[#FAF5FC] border border-[#E7DCEB] rounded-xl"/></label>
                <label>Cost price (₹)<input type="number" min="0" step="0.01" value={form.costPrice} onChange={e => setForm({ ...form, costPrice: e.target.value })} className="mt-1 w-full p-3 bg-[#FAF5FC] border border-[#E7DCEB] rounded-xl"/></label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label>Stock *<input required type="number" min="0" step="1" value={form.stock} disabled={Boolean(editing?.variants?.length)} onChange={e => setForm({ ...form, stock: e.target.value })} className="mt-1 w-full p-3 bg-[#FAF5FC] border border-[#E7DCEB] rounded-xl disabled:bg-[#F0E8F3]"/></label>
                <label>Category *<select required value={form.categoryId} onChange={e => setForm({ ...form, categoryId: e.target.value })} className="mt-1 w-full p-3 bg-[#FAF5FC] border border-[#E7DCEB] rounded-xl">{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
              </div>
              {editing?.variants?.length ? <p className="-mt-2 text-[10px] text-[#705E7B]">This product uses variants. Its total stock is calculated from active variant stock; adjust individual options in Product Variants.</p> : null}
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
              <section className="space-y-3 rounded-xl border border-[#E7DCEB] bg-[#FCF9FD] p-4">
                <div><h3 className="font-semibold text-sm text-[#2C1838]">Product story & merchandising</h3><p className="text-[11px] text-[#806B8D] mt-1">These details appear on the customer product page and help organise catalogue discovery.</p></div>
                <label className="block">Short description <span className="text-[#8E769E]">(up to 240 characters)</span><input maxLength={240} value={form.shortDescription} onChange={e => setForm({ ...form, shortDescription: e.target.value })} placeholder="A concise line shown below the product name" className="mt-1 w-full min-h-10 px-3 bg-white border border-[#E7DCEB] rounded-lg"/></label>
                <label className="block">Full product description <span className="text-[#8E769E]">(up to 5,000 characters)</span><textarea rows={4} maxLength={5000} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Describe the design, occasion, finish and styling..." className="mt-1 w-full p-3 bg-white border border-[#E7DCEB] rounded-lg"/></label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block">Comparison / MRP price (₹)<input type="number" min="0" step="0.01" value={form.compareAtPrice} onChange={e => setForm({ ...form, compareAtPrice: e.target.value })} placeholder="Leave empty to remove" className="mt-1 w-full min-h-10 px-3 bg-white border border-[#E7DCEB] rounded-lg"/><span className="text-[10px] text-[#806B8D]">Must be higher than selling price. Leave empty to clear.</span></label>
                  <label className="block">Search tags <textarea rows={2} value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} placeholder="kundan, festive, wedding, statement" className="mt-1 w-full p-3 bg-white border border-[#E7DCEB] rounded-lg"/><span className="text-[10px] text-[#806B8D]">Separate tags with commas or new lines (max 20).</span></label>
                  <label className="block">Collections <input value={form.collectionSlugs} onChange={e => setForm({ ...form, collectionSlugs: e.target.value })} placeholder="festive, everyday, heritage" className="mt-1 w-full min-h-10 px-3 bg-white border border-[#E7DCEB] rounded-lg"/><span className="text-[10px] text-[#806B8D]">Use existing collection slugs, separated by commas.</span></label>
                </div>
              </section>
              <section className="space-y-3 rounded-xl border border-[#E7DCEB] bg-[#FCF9FD] p-4">
                <div><h3 className="font-semibold text-sm text-[#2C1838]">Craftsmanship & specifications</h3><p className="text-[11px] text-[#806B8D] mt-1">Only details you enter are shown to customers; blank fields stay hidden.</p></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block">Base metal<input maxLength={120} value={form.baseMetal} onChange={e => setForm({ ...form, baseMetal: e.target.value })} placeholder="e.g. Brass, stainless steel" className="mt-1 w-full min-h-10 px-3 bg-white border border-[#E7DCEB] rounded-lg"/></label>
                  <label className="block">Plating / finish<input maxLength={120} value={form.platingFinish} onChange={e => setForm({ ...form, platingFinish: e.target.value })} placeholder="e.g. 18K gold-tone plating" className="mt-1 w-full min-h-10 px-3 bg-white border border-[#E7DCEB] rounded-lg"/></label>
                  <label className="block">Stones & embellishments<input maxLength={160} value={form.stoneType} onChange={e => setForm({ ...form, stoneType: e.target.value })} placeholder="e.g. American diamonds, pearls" className="mt-1 w-full min-h-10 px-3 bg-white border border-[#E7DCEB] rounded-lg"/></label>
                  <label className="block">Closure / fastening<input maxLength={120} value={form.closureType} onChange={e => setForm({ ...form, closureType: e.target.value })} placeholder="e.g. Push-back, lobster clasp" className="mt-1 w-full min-h-10 px-3 bg-white border border-[#E7DCEB] rounded-lg"/></label>
                </div>
                <label className="block">Product video URL (optional)
                  <input type="url" value={form.productVideoUrl} onChange={e => setForm({ ...form, productVideoUrl: e.target.value })} placeholder="https://your-hostinger-storage.com/product-demo.mp4" className="mt-1 w-full min-h-10 px-3 bg-white border border-[#E7DCEB] rounded-lg"/>
                  <span className="text-[10px] text-[#806B8D]">Paste a secure HTTPS link to an MP4 or WebM video uploaded to Hostinger storage.</span>
                </label>
                <label className="block">Care instructions <textarea rows={4} value={form.careInstructions} onChange={e => setForm({ ...form, careInstructions: e.target.value })} placeholder={"Store in a dry pouch\\nAvoid perfume and water\\nWipe gently after wear"} className="mt-1 w-full p-3 bg-white border border-[#E7DCEB] rounded-lg"/><span className="text-[10px] text-[#806B8D]">Enter one instruction per line (max 20).</span></label>
              </section>
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
