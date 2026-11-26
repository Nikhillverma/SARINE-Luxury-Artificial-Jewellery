import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { hostingerStorefrontService, type MenStorefrontCategory, type MenStorefrontProduct } from "../services/hostinger/hostingerStorefrontService";
import { getProductDetailHref } from "../utils/productLinks";

const ProductCard: React.FC<{ product: MenStorefrontProduct }> = ({ product }) => (
  <Link to={getProductDetailHref(product.slug, product.productCollection)} className="group block min-w-0">
    <div className="aspect-[4/5] overflow-hidden rounded-xl bg-[#F7F0FA]">
      {product.images?.[0] ? <img src={product.images[0]} alt={product.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" /> : <div className="flex h-full items-center justify-center font-serif text-xl text-[#563568]">SARINE</div>}
    </div>
    <p className="mt-3 truncate text-sm font-medium text-[#302438]">{product.name}</p>
    <p className="mt-1 text-sm text-[#563568]">₹{product.price.toLocaleString("en-IN")}</p>
    {product.stock <= 0 && <p className="mt-1 text-[10px] uppercase tracking-wider text-[#8B7299]">Currently unavailable</p>}
  </Link>
);

export const MenCategoryPage: React.FC = () => {
  const { categoryId = "" } = useParams();
  const [category, setCategory] = useState<MenStorefrontCategory | null>(null);
  const [products, setProducts] = useState<MenStorefrontProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sort, setSort] = useState<"featured" | "price-asc" | "price-desc">("featured");

  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    hostingerStorefrontService.getPublicMenCategory(categoryId)
      .then(result => { if (active) { setCategory(result.category); setProducts(result.products || []); } })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : "Could not load this men's category."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [categoryId]);

  const visibleProducts = [...products].sort((a, b) => sort === "price-asc" ? a.price - b.price : sort === "price-desc" ? b.price - a.price : 0);

  if (loading) return <main className="min-h-[55vh] px-4 py-20 text-center text-sm text-[#705E7B]" role="status">Loading men's collection…</main>;
  if (error || !category) return <main className="min-h-[55vh] px-4 py-20 text-center"><p className="text-sm text-[#705E7B]">{error || "Men's category not found."}</p><Link to="/men" className="mt-5 inline-flex min-h-11 items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#563568]"><ArrowLeft size={15}/> Back to SARINE Men</Link></main>;

  return <main className="min-h-screen bg-white text-[#302438]">
    <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 lg:px-10">
      <Link to="/men" className="mb-6 inline-flex min-h-11 items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#563568]"><ArrowLeft size={15}/> SARINE Men</Link>
      <header className="mb-8 overflow-hidden rounded-2xl bg-[#F7F0FA]">
        {category.imageUrl && <div className="aspect-[16/5] max-h-64 overflow-hidden"><img src={category.imageUrl} alt={category.title} className="h-full w-full object-cover"/></div>}
        <div className="px-5 py-8 text-center sm:py-10"><p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8B7299]">SARINE · FOR HIM</p><h1 className="mt-2 font-serif text-4xl text-[#563568] sm:text-5xl">{category.title}</h1>{category.description && <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[#705E7B]">{category.description}</p>}</div>
      </header>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-[#705E7B]">{products.length} {products.length === 1 ? "piece" : "pieces"}</p><label className="flex items-center gap-2 text-xs text-[#705E7B]">Sort by <select value={sort} onChange={e => setSort(e.target.value as typeof sort)} className="min-h-10 rounded-lg border border-[#E7DCEB] bg-white px-3 text-[#563568]"><option value="featured">Featured</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option></select></label></div>
      {visibleProducts.length ? <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{visibleProducts.map(product => <ProductCard key={product.id} product={product}/>)}</div> : <div className="rounded-xl bg-[#F7F0FA] px-5 py-12 text-center"><h2 className="font-serif text-2xl text-[#563568]">A considered edit is taking shape</h2><p className="mt-2 text-sm text-[#705E7B]">Products will appear here as soon as they are assigned to this category in Storefront Studio.</p></div>}
    </div>
  </main>;
};
