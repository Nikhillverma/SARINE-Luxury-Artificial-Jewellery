/**
 * ProductDetailPage component for SARINE.
 * Luxury e-commerce PDP following contiguous purchase module guidelines,
 * high-contrast serif headlines, clear craftsmanship specifications,
 * and seamless shopping bag integration.
 */

import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { productService, categoryService } from '../services';
import { Product, isInStock, JEWELLERY_TYPE_LABELS } from '../types/product';
import { Category } from '../types/category';
import { formatInr } from '../utils/currency';
import { ProductCard } from '../components/ProductCard';
import { useCart } from '../context/CartContext';
import {
  ArrowLeft,
  ShoppingBag,
  CheckCircle2,
  Truck,
  ShieldCheck,
  RotateCcw
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
            // Load related pieces
            try {
              const related = await productService.getRelatedProducts(found.id, 4);
              if (!isCancelled) setRelatedProducts(related);
            } catch (relErr) {
              console.warn('[ProductDetailPage] Could not load related pieces:', relErr);
            }

            // Load category info
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
        <div className="text-center font-sans">
          <div className="w-8 h-8 border-2 border-[#B79A68] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="font-serif text-lg text-[#242321]">Preparing piece details...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex flex-col items-center justify-center p-8 text-center font-sans">
        <h2 className="font-serif text-3xl text-[#242321]">Piece Not Found</h2>
        <p className="text-sm text-[#81776D] mt-2 max-w-md">
          The requested jewellery item may have been archived or is no longer listed in the active catalogue.
        </p>
        <Link
          to="/shop"
          className="mt-6 px-7 py-3 bg-[#242321] text-[#FAF8F5] text-xs uppercase tracking-[0.2em] hover:bg-[#B79A68] transition-colors"
        >
          Return to All Collections
        </Link>
      </div>
    );
  }

  const inStock = isInStock(product);

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#242321] pb-20">
      {/* Toast Notification */}
      {addedToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#242321] text-[#FAF8F5] px-5 py-3 border-l-2 border-[#B79A68] shadow-lg flex items-center justify-between gap-4 font-sans animate-fadeIn">
          <div className="flex items-center gap-3">
            <CheckCircle2 size={16} className="text-[#B79A68]" />
            <div>
              <p className="text-xs font-medium">{product.name}</p>
              <p className="text-[11px] text-[#FAF8F5]/80">Added {quantity} to your shopping bag</p>
            </div>
          </div>
          <button
            onClick={openDrawer}
            className="text-[11px] uppercase tracking-[0.2em] text-[#B79A68] hover:underline font-medium ml-2"
          >
            View Bag
          </button>
        </div>
      )}

      {/* Navigation Breadcrumb */}
      <div className="border-b border-[#E8E0D6]">
        <div className="site-container py-4">
          <Link
            to="/shop"
            className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[#81776D] hover:text-[#242321] transition-colors font-sans"
          >
            <ArrowLeft size={13} />
            <span>Back to Collection</span>
          </Link>
        </div>
      </div>

      {/* Product Detail Stage */}
      <main className="site-container pt-8 sm:pt-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
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
                        ? 'border-[#242321] ring-1 ring-[#242321]'
                        : 'border-[#E8E0D6] opacity-75 hover:opacity-100'
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
            <div className="flex-1 bg-[#F2EADF] border border-[#E8E0D6] relative overflow-hidden aspect-[3/4]">
              <img
                src={product.images[activeImageIndex] || product.images[0]}
                alt={product.name}
                className="w-full h-full object-cover object-center transition-all duration-300"
              />
              {!inStock && (
                <div className="absolute top-4 left-4">
                  <span className="text-[10px] uppercase tracking-[0.2em] px-2.5 py-1 bg-[#FAF8F5]/95 text-[#81776D] border border-[#E8E0D6] font-sans font-medium">
                    Awaiting Atelier
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Product Details & Contiguous Purchase Form (Right Column - 5 cols) */}
          <div className="lg:col-span-5 flex flex-col justify-start">
            {/* Metadata Tags */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] uppercase tracking-[0.25em] text-[#B79A68] font-sans font-medium">
                {category?.name || 'Jewellery'}
              </span>
              <span className="text-[#81776D] text-xs">•</span>
              <span className="text-[10px] uppercase tracking-[0.2em] text-[#81776D] font-sans">
                {JEWELLERY_TYPE_LABELS[product.jewelleryType] || product.jewelleryType}
              </span>
            </div>

            {/* Product Title */}
            <h1 className="font-serif text-3xl sm:text-4xl text-[#242321] font-normal leading-tight tracking-tight">
              {product.name}
            </h1>

            {/* Price Row */}
            <div className="mt-4 pb-4 border-b border-[#E8E0D6] flex items-baseline gap-3">
              <span className="text-2xl sm:text-3xl font-medium text-[#242321] font-sans tracking-tight">
                {formatInr(product.price)}
              </span>
              {product.compareAtPrice && (
                <span className="text-[#81776D] line-through text-sm font-sans">
                  {formatInr(product.compareAtPrice)}
                </span>
              )}
              <span className="text-[11px] text-[#81776D] ml-auto font-sans">Inclusive of all taxes</span>
            </div>

            {/* Stock Availability */}
            <div className="mt-4 flex items-center gap-2 font-sans">
              <span
                className={`w-2 h-2 rounded-full ${
                  inStock ? 'bg-[#2F593E]' : 'bg-[#81776D]'
                }`}
              ></span>
              <span className="text-xs uppercase tracking-wider text-[#81776D]">
                {inStock ? `Available (${product.stock} in stock)` : 'Currently Out of Stock'}
              </span>
            </div>

            {/* Short Narrative Description */}
            <p className="mt-4 text-xs sm:text-sm text-[#81776D] leading-relaxed font-sans">
              {product.description}
            </p>

            {/* Quantity & Add to Cart Controls */}
            <div className="mt-6 pt-6 border-t border-[#E8E0D6] space-y-4 font-sans">
              <div className="flex items-center gap-3">
                {/* Quantity Selector */}
                <div className="flex items-center border border-[#E8E0D6] bg-white">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={!inStock || quantity <= 1}
                    className="w-10 h-11 flex items-center justify-center text-[#242321] hover:bg-[#F2EADF] disabled:opacity-30 transition-colors"
                  >
                    -
                  </button>
                  <span className="w-10 text-center text-xs font-medium text-[#242321]">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity((q) => Math.min(product.stock, q + 1))}
                    disabled={!inStock || quantity >= product.stock}
                    className="w-10 h-11 flex items-center justify-center text-[#242321] hover:bg-[#F2EADF] disabled:opacity-30 transition-colors"
                  >
                    +
                  </button>
                </div>

                {/* Primary Add to Cart Action */}
                <button
                  onClick={handleAddToCart}
                  disabled={!inStock}
                  className="flex-1 h-11 px-6 bg-[#242321] text-[#FAF8F5] text-xs uppercase tracking-[0.2em] font-medium hover:bg-[#B79A68] disabled:bg-[#E8E0D6] disabled:text-[#81776D] disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  <ShoppingBag size={15} />
                  <span>{inStock ? 'Add to Shopping Bag' : 'Out of Stock'}</span>
                </button>
              </div>
            </div>

            {/* Specifications Details */}
            <div className="mt-8 bg-[#FAF8F5] border border-[#E8E0D6] p-5">
              <h3 className="font-serif text-lg text-[#242321] font-normal border-b border-[#E8E0D6] pb-2">
                Craftsmanship & Materials
              </h3>
              <dl className="divide-y divide-[#E8E0D6] text-xs font-sans mt-2">
                {product.baseMetal && (
                  <div className="py-2.5 flex justify-between">
                    <dt className="text-[#81776D]">Base Metal:</dt>
                    <dd className="text-[#242321] font-medium">{product.baseMetal}</dd>
                  </div>
                )}
                {product.platingFinish && (
                  <div className="py-2.5 flex justify-between">
                    <dt className="text-[#81776D]">Plating & Finish:</dt>
                    <dd className="text-[#242321] font-medium">{product.platingFinish}</dd>
                  </div>
                )}
                {product.stoneType && (
                  <div className="py-2.5 flex justify-between">
                    <dt className="text-[#81776D]">Stones & Embellishments:</dt>
                    <dd className="text-[#242321] font-medium">{product.stoneType}</dd>
                  </div>
                )}
                {product.closureType && (
                  <div className="py-2.5 flex justify-between">
                    <dt className="text-[#81776D]">Closure & Fastening:</dt>
                    <dd className="text-[#242321] font-medium">{product.closureType}</dd>
                  </div>
                )}
                <div className="py-2.5 flex justify-between">
                  <dt className="text-[#81776D]">SKU Reference:</dt>
                  <dd className="text-[#242321] font-mono text-[11px]">{product.id.toUpperCase()}</dd>
                </div>
              </dl>
            </div>

            {/* Care Guidance */}
            {product.careInstructions && product.careInstructions.length > 0 && (
              <div className="mt-4 p-4 bg-[#F2EADF]/60 border border-[#E8E0D6] text-xs text-[#81776D] font-sans">
                <strong className="block text-[#242321] uppercase tracking-wider text-[10px] mb-1.5">
                  Jewellery Care:
                </strong>
                <ul className="list-disc pl-4 space-y-1">
                  {product.careInstructions.map((rule, idx) => (
                    <li key={idx}>{rule}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Trust Pillars */}
            <div className="mt-6 grid grid-cols-3 gap-2 border-t border-[#E8E0D6] pt-5 text-center font-sans">
              <div className="flex flex-col items-center">
                <Truck size={17} className="text-[#B79A68] mb-1" />
                <span className="text-[10px] uppercase tracking-wider text-[#81776D]">
                  Pan-India Shipping
                </span>
              </div>
              <div className="flex flex-col items-center">
                <ShieldCheck size={17} className="text-[#B79A68] mb-1" />
                <span className="text-[10px] uppercase tracking-wider text-[#81776D]">
                  Razorpay Secured
                </span>
              </div>
              <div className="flex flex-col items-center">
                <RotateCcw size={17} className="text-[#B79A68] mb-1" />
                <span className="text-[10px] uppercase tracking-wider text-[#81776D]">
                  7-Day Assistance
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Related Pieces */}
        {relatedProducts.length > 0 && (
          <section className="mt-16 sm:mt-24 pt-12 border-t border-[#E8E0D6]">
            <div className="text-center mb-10">
              <span className="text-[10px] uppercase tracking-[0.25em] text-[#B79A68] font-sans font-medium block">
                Complementary Styles
              </span>
              <h2 className="font-serif text-2xl sm:text-3xl text-[#242321] font-normal mt-1">
                You May Also Admire
              </h2>
            </div>

            <div className="site-container">
              <div className="product-grid">
                {relatedProducts.map((rel) => (
                  <ProductCard key={rel.id} product={rel} />
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
};
