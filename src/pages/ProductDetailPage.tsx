/**
 * ProductDetailPage component for SARINE.
 * Demonstrates single product view with image gallery, price formatting,
 * specifications table, Add to Cart backed by CartContext, and related products via IProductService.
 */

import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { productService, categoryService } from '../services';
import { Product, getDiscountPercent, isInStock, JEWELLERY_TYPE_LABELS } from '../types/product';
import { Category } from '../types/category';
import { formatInr } from '../utils/currency';
import { ProductCard } from '../components/ProductCard';
import { useCart } from '../context/CartContext';
import {
  ArrowLeft,
  ShoppingBag,
  CheckCircle,
  Truck,
  ShieldCheck,
  RotateCcw,
  Sparkles
} from 'lucide-react';

interface ProductDetailPageProps {
  includeAll: boolean;
}

export const ProductDetailPage: React.FC<ProductDetailPageProps> = ({
  includeAll
}) => {
  const { slug } = useParams<{ slug: string }>();
  const { addItem, openDrawer } = useCart();

  const [product, setProduct] = useState<Product | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [activeImageIndex, setActiveImageIndex] = useState<number>(0);
  const [quantity, setQuantity] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [addedToast, setAddedToast] = useState<boolean>(false);

  useEffect(() => {
    let isCancelled = false;

    async function loadData() {
      if (!slug) return;
      setLoading(true);
      setActiveImageIndex(0);
      setQuantity(1);

      try {
        const found = await productService.getProductBySlug(slug, { includeAll });
        if (!isCancelled) {
          setProduct(found);

          if (found) {
            // Load related products safely
            try {
              const related = await productService.getRelatedProducts(found.id, 4);
              if (!isCancelled) setRelatedProducts(related);
            } catch (relErr) {
              console.warn('[ProductDetailPage] Could not load related pieces:', relErr);
            }

            // Load category info safely
            try {
              const categories = await categoryService.getCategories();
              const cat = categories.find((c) => c.id === found.categoryId);
              if (!isCancelled && cat) setCategory(cat);
            } catch (catErr) {
              console.warn('[ProductDetailPage] Could not load category info:', catErr);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load product detail', err);
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }

    loadData();

    return () => {
      isCancelled = true;
    };
  }, [slug, includeAll]);

  const handleAddToCart = () => {
    if (!product || !isInStock(product)) return;
    addItem(product, quantity);
    setAddedToast(true);
    setTimeout(() => setAddedToast(false), 3000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center p-8">
        <div className="text-center">
          <Sparkles size={28} className="text-[#B89758] animate-spin mx-auto mb-3" />
          <p className="font-serif text-lg text-[#1C1917]">Preparing piece details...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex flex-col items-center justify-center p-8 text-center">
        <h2 className="font-serif text-3xl text-[#1C1917]">Piece Not Found</h2>
        <p className="text-sm text-[#6B635D] mt-2 font-sans max-w-md">
          The requested jewellery item may have been archived or is no longer listed in the active catalogue.
        </p>
        <Link
          to="/shop"
          className="mt-6 px-6 py-2.5 bg-[#1C1917] text-[#FAF8F5] text-xs uppercase tracking-widest hover:bg-[#B89758] transition-colors"
        >
          Return to All Collections
        </Link>
      </div>
    );
  }

  const discount = getDiscountPercent(product);
  const inStock = isInStock(product);

  return (
    <div className="min-h-screen bg-[#FAF8F5] pb-16">
      {/* Toast Notification */}
      {addedToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1C1917] text-[#FAF8F5] px-5 py-3 border-l-4 border-[#B89758] shadow-lg flex items-center justify-between gap-4 transition-transform animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center gap-3">
            <CheckCircle size={18} className="text-[#B89758]" />
            <div>
              <p className="text-xs font-semibold">{product.name}</p>
              <p className="text-[11px] text-[#E6DFD5]">Added {quantity} to your shopping bag</p>
            </div>
          </div>
          <button
            onClick={openDrawer}
            className="text-[11px] uppercase tracking-widest text-[#B89758] hover:underline font-semibold ml-2"
          >
            View Bag
          </button>
        </div>
      )}

      {/* Navigation Breadcrumb */}
      <div className="max-w-[1280px] mx-auto px-4 sm:px-8 py-4 border-b border-[#E6DFD5]">
        <Link
          to="/shop"
          className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-[#6B635D] hover:text-[#1C1917] transition-colors"
        >
          <ArrowLeft size={14} />
          <span>Back to Collection</span>
        </Link>
      </div>

      {/* Product Detail Stage */}
      <main className="max-w-[1280px] mx-auto px-4 sm:px-8 pt-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14">
          {/* Gallery View (Left Column - 7 cols) */}
          <div className="lg:col-span-7 flex flex-col-reverse md:flex-row gap-4">
            {/* Thumbnail Column */}
            {product.images.length > 1 && (
              <div className="flex md:flex-col gap-3 overflow-x-auto md:w-20 shrink-0">
                {product.images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImageIndex(idx)}
                    className={`relative w-16 h-20 md:w-20 md:h-24 overflow-hidden border transition-all ${
                      activeImageIndex === idx
                        ? 'border-[#B89758] ring-1 ring-[#B89758]'
                        : 'border-[#E6DFD5] opacity-75 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={img}
                      alt={`${product.name} thumbnail ${idx + 1}`}
                      className="w-full h-full object-cover object-center"
                    />
                  </button>
                ))}
              </div>
            )}

            {/* Main Stage Image */}
            <div className="flex-1 bg-[#F3EEE7] border border-[#E6DFD5] relative overflow-hidden aspect-[4/5]">
              <img
                src={product.images[activeImageIndex] || product.images[0]}
                alt={product.name}
                className="w-full h-full object-cover object-center transition-all duration-300"
              />
              {discount && (
                <span className="absolute top-4 left-4 bg-[#B89758] text-[#1C1917] font-semibold text-xs px-3 py-1 tracking-widest uppercase">
                  {discount}% OFF
                </span>
              )}
              {product.status !== 'active' && (
                <span className="absolute top-4 right-4 bg-[#8C2F2F] text-white text-xs px-3 py-1 tracking-widest uppercase font-semibold">
                  Status: {product.status}
                </span>
              )}
            </div>
          </div>

          {/* Product Details & Purchase Form (Right Column - 5 cols) */}
          <div className="lg:col-span-5 flex flex-col justify-start">
            {/* Metadata Tags */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs uppercase tracking-[0.2em] text-[#B89758] font-medium font-sans">
                {category?.name || 'Jewellery'}
              </span>
              <span className="text-[#8C847C]">•</span>
              <span className="text-xs uppercase tracking-widest text-[#6B635D] font-sans">
                {JEWELLERY_TYPE_LABELS[product.jewelleryType] || product.jewelleryType}
              </span>
            </div>

            {/* Product Title */}
            <h1 className="font-serif text-3xl sm:text-4xl text-[#1C1917] font-normal leading-tight tracking-tight">
              {product.name}
            </h1>

            {/* Price Row */}
            <div className="mt-4 pb-4 border-b border-[#E6DFD5] flex items-baseline gap-3">
              <span className="font-serif text-2xl sm:text-3xl font-semibold text-[#1C1917]">
                {formatInr(product.price)}
              </span>
              {product.compareAtPrice && (
                <>
                  <span className="text-[#6B635D] line-through text-base font-sans">
                    {formatInr(product.compareAtPrice)}
                  </span>
                  <span className="text-[#3F624D] text-xs font-semibold uppercase tracking-wider font-sans">
                    Save {formatInr(product.compareAtPrice - product.price)}
                  </span>
                </>
              )}
              <span className="text-[11px] text-[#6B635D] ml-auto">Inclusive of all taxes</span>
            </div>

            {/* Stock Availability */}
            <div className="mt-4 flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  inStock ? 'bg-[#2F593E]' : 'bg-[#8C2F2F]'
                }`}
              ></span>
              <span className="text-xs uppercase tracking-wider font-medium text-[#1C1917]">
                {inStock ? `In Stock (${product.stock} available)` : 'Currently Out of Stock'}
              </span>
            </div>

            {/* Short Narrative Description */}
            <p className="mt-4 text-sm text-[#57534E] leading-relaxed font-sans">
              {product.description}
            </p>

            {/* Quantity & Add to Cart Controls */}
            <div className="mt-6 pt-6 border-t border-[#E6DFD5] space-y-4">
              <div className="flex items-center gap-4">
                {/* Quantity Selector */}
                <div className="flex items-center border border-[#8C847C] bg-white">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={!inStock || quantity <= 1}
                    className="w-9 h-10 flex items-center justify-center text-[#1C1917] hover:bg-[#F3EEE7] disabled:opacity-40 transition-colors"
                  >
                    -
                  </button>
                  <span className="w-10 text-center text-sm font-semibold text-[#1C1917]">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity((q) => Math.min(product.stock, q + 1))}
                    disabled={!inStock || quantity >= product.stock}
                    className="w-9 h-10 flex items-center justify-center text-[#1C1917] hover:bg-[#F3EEE7] disabled:opacity-40 transition-colors"
                  >
                    +
                  </button>
                </div>

                {/* Primary Add to Cart Action */}
                <button
                  onClick={handleAddToCart}
                  disabled={!inStock}
                  className="flex-1 h-10 px-6 bg-[#1C1917] text-[#FAF8F5] text-xs uppercase tracking-[0.2em] font-semibold hover:bg-[#B89758] disabled:bg-[#E6DFD5] disabled:text-[#8C847C] disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  <ShoppingBag size={16} />
                  <span>{inStock ? 'Add to Bag' : 'Out of Stock'}</span>
                </button>
              </div>
            </div>

            {/* Specifications Card */}
            <div className="mt-8 bg-white border border-[#E6DFD5] p-5">
              <h3 className="font-serif text-lg text-[#1C1917] font-medium border-b border-[#F0EAE1] pb-2">
                Craftsmanship & Product Specifications
              </h3>
              <dl className="divide-y divide-[#F0EAE1] text-xs font-sans mt-2">
                {product.baseMetal && (
                  <div className="py-2 flex justify-between">
                    <dt className="text-[#6B635D]">Base Metal:</dt>
                    <dd className="text-[#1C1917] font-medium">{product.baseMetal}</dd>
                  </div>
                )}
                {product.platingFinish && (
                  <div className="py-2 flex justify-between">
                    <dt className="text-[#6B635D]">Plating & Finish:</dt>
                    <dd className="text-[#1C1917] font-medium">{product.platingFinish}</dd>
                  </div>
                )}
                {product.stoneType && (
                  <div className="py-2 flex justify-between">
                    <dt className="text-[#6B635D]">Stones & Embellishments:</dt>
                    <dd className="text-[#1C1917] font-medium">{product.stoneType}</dd>
                  </div>
                )}
                {product.closureType && (
                  <div className="py-2 flex justify-between">
                    <dt className="text-[#6B635D]">Closure & Fastening:</dt>
                    <dd className="text-[#1C1917] font-medium">{product.closureType}</dd>
                  </div>
                )}
                <div className="py-2 flex justify-between">
                  <dt className="text-[#6B635D]">SKU Reference:</dt>
                  <dd className="text-[#1C1917] font-mono text-[11px]">{product.id.toUpperCase()}</dd>
                </div>
              </dl>
            </div>

            {/* Care Guidance */}
            {product.careInstructions && product.careInstructions.length > 0 && (
              <div className="mt-4 p-4 bg-[#F3EEE7]/70 border border-[#E6DFD5] text-xs text-[#57534E]">
                <strong className="block text-[#1C1917] uppercase tracking-wider text-[11px] mb-1 font-sans">
                  Jewellery Care Guidelines:
                </strong>
                <ul className="list-disc pl-4 space-y-1">
                  {product.careInstructions.map((rule, idx) => (
                    <li key={idx}>{rule}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Trust & Dispatch Guarantees */}
            <div className="mt-6 grid grid-cols-3 gap-2 border-t border-[#E6DFD5] pt-4 text-center">
              <div className="flex flex-col items-center">
                <Truck size={18} className="text-[#B89758] mb-1" />
                <span className="text-[10px] uppercase tracking-wider text-[#6B635D] font-medium">
                  Dispatch in 24-48 hrs
                </span>
              </div>
              <div className="flex flex-col items-center">
                <ShieldCheck size={18} className="text-[#B89758] mb-1" />
                <span className="text-[10px] uppercase tracking-wider text-[#6B635D] font-medium">
                  Secured Transit Packaging
                </span>
              </div>
              <div className="flex flex-col items-center">
                <RotateCcw size={18} className="text-[#B89758] mb-1" />
                <span className="text-[10px] uppercase tracking-wider text-[#6B635D] font-medium">
                  Easy Exchange Policy
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Related Products Section */}
        {relatedProducts.length > 0 && (
          <section className="mt-16 sm:mt-24 pt-12 border-t border-[#E6DFD5]">
            <div className="text-center mb-8">
              <span className="text-xs uppercase tracking-[0.25em] text-[#B89758] font-medium block">
                Complementary Styles
              </span>
              <h2 className="font-serif text-2xl sm:text-3xl text-[#1C1917] font-normal mt-1">
                You May Also Admire
              </h2>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
              {relatedProducts.map((rel) => (
                <ProductCard key={rel.id} product={rel} />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
};
