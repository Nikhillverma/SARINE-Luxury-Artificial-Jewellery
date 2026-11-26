import { compressForUpload } from "../../utils/imageUpload";
const API_BASE = (
  import.meta.env.VITE_HOSTINGER_API_BASE_URL ||
  (import.meta.env.DEV ? "/api" : "https://lavender-goldfish-844589.hostingersite.com/api")
).replace(/\/+$/, "");


export interface HomepageSectionConfig {
  id: string;
  enabled: boolean;
  sortOrder: number;
  cardsPerView?: number;
  carouselEnabled?: boolean;
}
export interface HomepageLayout {
  version: 1;
  sections: HomepageSectionConfig[];
}


export interface HomepageContentLink { label: string; href: string; }
export interface HomepageContentItem { title: string; description: string; }
export interface HomepageContent {
  version: 1;
  price: { eyebrow: string; title: string; description: string; links: HomepageContentLink[] };
  story: { eyebrow: string; title: string; paragraphs: string[]; imageUrl: string; ctaText: string; ctaLink: string; pillars: HomepageContentItem[] };
  care: { eyebrow: string; title: string; description: string; steps: HomepageContentItem[] };
  contact: { eyebrow: string; title: string; description: string; linkText: string; linkHref: string };
}

export const DEFAULT_HOMEPAGE_CONTENT: HomepageContent = {
  version: 1,
  price: {
    eyebrow: "PRICE CURATION", title: "Shop by Price",
    description: "Find stunning handcrafted jewellery suited to your style and budget.",
    links: [
      { label: "Under ₹999", href: "/shop?price=under-999" },
      { label: "₹1,000 to ₹1,999", href: "/shop?price=1000-2000" },
      { label: "₹2,000 and above", href: "/shop?price=above-2000" },
      { label: "All pieces", href: "/shop" }
    ]
  },
  story: {
    eyebrow: "OUR STORY", title: "More Than Just Jewellery",
    paragraphs: [
      "SARINE is a premium Indian fashion jewellery brand created to bring timeless elegance to your everyday moments. We celebrate traditional motifs through modern design, curating versatile pieces that seamlessly elevate both celebrations and daily attire.",
      "We believe in accessible luxury — exquisite craftsmanship, refined finishes, and enduring beauty at honest, direct prices. Every piece is crafted so you can express your personal grace with confidence and ease."
    ],
    imageUrl: "/images/optimized/our-story.webp", ctaText: "Our Story", ctaLink: "/about",
    pillars: [
      { title: "Thoughtfully Designed", description: "for Everyday Elegance" },
      { title: "Artisanal Heritage", description: "& Modern Craft" },
      { title: "Accessible Luxury", description: "for Every You" }
    ]
  },
  care: {
    eyebrow: "ATELIER CARE PHILOSOPHY", title: "The Art of Jewellery Preservation",
    description: "Every SARINE piece is crafted with protective seals and demi-fine gold plating. Follow these four timeless steps to preserve its radiant shine for generations.",
    steps: [
      { title: "The Last Touch", description: "Put your jewellery on last after perfumes, lotions, and hair styling sprays have dried completely." },
      { title: "Air-Tight Storage", description: "Store each piece in its individual velvet pouch or zip bag to prevent moisture and accidental scratches." },
      { title: "Gentle Cleaning", description: "Wipe gently with a dry soft microfiber cloth after wear to remove skin oils before returning to storage." },
      { title: "Moisture Barrier", description: "Keep pieces away from steam, pool chlorine, and water basins to maintain pristine prong tension." }
    ]
  },
  contact: {
    eyebrow: "STAY IN TOUCH", title: "Connect With SARINE",
    description: "Have questions about styling, care, or your order? Connect with our customer care team on our",
    linkText: "Contact page", linkHref: "/contact"
  }
};

export interface ExploreNowConfig { version: 1; productIds: string[]; displayCount: number; configured: boolean; }

export interface PublicProductReviewSummary { count: number; average: number; }
let reviewSummaryCache: { expiresAt: number; summaries: Record<string, PublicProductReviewSummary> } | null = null;
let reviewSummaryRequest: Promise<Record<string, PublicProductReviewSummary>> | null = null;

async function loadPublicProductReviewSummaries(): Promise<Record<string, PublicProductReviewSummary>> {
  if (reviewSummaryCache && reviewSummaryCache.expiresAt > Date.now()) return reviewSummaryCache.summaries;
  if (!reviewSummaryRequest) {
    reviewSummaryRequest = request<{ summaries: Array<{ productId: string; count: number; average: number }> }>("/storefront/review-summaries")
      .then(result => {
        const summaries = Object.fromEntries(result.summaries.map(item => [
          item.productId,
          { count: Math.max(0, Number(item.count) || 0), average: Math.max(0, Math.min(5, Number(item.average) || 0)) }
        ]));
        reviewSummaryCache = { expiresAt: Date.now() + 60_000, summaries };
        return summaries;
      })
      .finally(() => { reviewSummaryRequest = null; });
  }
  return reviewSummaryRequest;
}

export interface CuratedFavouritesConfig {
  version: 1;
  productIds: string[];
  configured: boolean;
}

export interface OccasionCard {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  link: string;
  active: boolean;
  sortOrder: number;
}

export interface ShopByGenderSettings { version: 1; forHerImageUrl: string; forHimImageUrl: string; }

export interface MenStorefrontCategory { id: string; title: string; description: string; imageUrl: string; productIds: string[]; active: boolean; sortOrder: number; }
export interface MenStorefrontCollection { id: string; title: string; description: string; productIds: string[]; active: boolean; sortOrder: number; }
export interface MenStorefrontSettings {
  version: 1; enabled: boolean; heroImageUrl: string; eyebrow: string; title: string; description: string;
  comingSoon: boolean; comingSoonText: string; categories: MenStorefrontCategory[];
  showProducts: boolean; productIds: string[]; featuredTitle: string;
  bestSellerIds: string[]; showBestSellers: boolean; collections: MenStorefrontCollection[];
  offers: { enabled: boolean; label: string; description: string; ctaText: string; ctaLink: string };
  notification: { enabled: boolean; headline: string; description: string; buttonText: string };
}
export interface MenStorefrontProduct { id: string; name: string; slug: string; description?: string; price: number; compareAtPrice?: number | null; images: string[]; status: string; stock: number; productCollection?: "artificial" | "demi-fine" | null; }
export interface MenLaunchSubscriber { id: string; email: string; consent: boolean; source: string; createdAt: string; }


export interface StorefrontBanner {
  id: string;
  productCollection?: "artificial" | "demi-fine" | null;
  tagline: string;
  title: string;
  subtitle: string;
  ctaText: string;
  ctaLink: string;
  imageUrl: string;
  active: boolean;
  sortOrder: number;
  startsAtUtc?: string | null;
  endsAtUtc?: string | null;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: { Accept: "application/json", "Content-Type": "application/json", ...init.headers }
  });
  const body = await response.json().catch(error => {
    // Preserve aborts so callers can distinguish a timed-out body read from invalid JSON.
    if (init.signal?.aborted) throw error;
    return {};
  });
  if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : `Request failed (${response.status}).`);
  return body as T;
}

function collectionQuery(collection?: "artificial" | "demi-fine"): string {
  return collection ? "?productCollection=" + encodeURIComponent(collection) : "";
}

function publicRangeQuery(): string {
  const params = new URLSearchParams();
  const fromUrl = new URLSearchParams(window.location.search).get("range");
  const stored = window.sessionStorage.getItem("sarine_product_range");
  if (fromUrl === "home") window.sessionStorage.removeItem("sarine_product_range");
  const collection = fromUrl === "home" ? "" : fromUrl === "artificial" || fromUrl === "demi-fine"
    ? fromUrl
    : stored === "artificial" || stored === "demi-fine" ? stored : "";
  if (fromUrl === "artificial" || fromUrl === "demi-fine") window.sessionStorage.setItem("sarine_product_range", fromUrl);
  if (collection) params.set("productCollection", collection);
  const query = params.toString();
  return query ? "?" + query : "";
}

export type HomepageCategoryImages = Record<string, string>;

export const hostingerStorefrontService = {
  getHomepageLayout: (collection?: "artificial" | "demi-fine") => request<{ draft: HomepageLayout; published: HomepageLayout }>("/admin/homepage-layout" + collectionQuery(collection)),

  getPublicHomepageLayout: () => request<{ layout: HomepageLayout }>("/homepage-layout" + publicRangeQuery()),
  getCuratedFavourites: (collection?: "artificial" | "demi-fine") => request<{ draft: CuratedFavouritesConfig; published: CuratedFavouritesConfig; maxProducts: number }>("/admin/curated-favourites" + collectionQuery(collection)),
  saveCuratedFavourites: (config: CuratedFavouritesConfig, collection?: "artificial" | "demi-fine") =>
    request<{ success: boolean; draft: CuratedFavouritesConfig }>("/admin/curated-favourites/draft", { method: "PUT", body: JSON.stringify({ ...config, productCollection: collection }) }),
  publishCuratedFavourites: (collection?: "artificial" | "demi-fine") =>
    request<{ success: boolean; published: CuratedFavouritesConfig }>("/admin/curated-favourites/publish", { method: "POST", body: JSON.stringify({ productCollection: collection }) }),
  getPublicCuratedFavourites: () =>
    request<{ products: import("../../types/product").Product[]; configured: boolean }>("/curated-favourites" + publicRangeQuery()),
  getExploreNow: (collection?: "artificial" | "demi-fine") => request<{ draft: ExploreNowConfig; published: ExploreNowConfig; maxProducts: number }>("/admin/explore-now" + collectionQuery(collection)),
  saveExploreNow: (config: ExploreNowConfig, collection?: "artificial" | "demi-fine") => request<{ success: boolean; draft: ExploreNowConfig }>("/admin/explore-now/draft", { method: "PUT", body: JSON.stringify({ ...config, productCollection: collection }) }),
  publishExploreNow: (collection?: "artificial" | "demi-fine") => request<{ success: boolean; published: ExploreNowConfig }>("/admin/explore-now/publish", { method: "POST", body: JSON.stringify({ productCollection: collection }) }),
  getPublicExploreNow: () => request<{ products: import("../../types/product").Product[]; displayCount: number; configured: boolean }>("/explore-now" + publicRangeQuery()),
  saveHomepageLayout: (layout: HomepageLayout, collection?: "artificial" | "demi-fine") =>
    request<{ success: boolean; draft: HomepageLayout }>("/admin/homepage-layout/draft", { method: "PUT", body: JSON.stringify({ ...layout, productCollection: collection }) }),
  publishHomepageLayout: (collection?: "artificial" | "demi-fine") =>
    request<{ success: boolean; published: HomepageLayout }>("/admin/homepage-layout/publish", { method: "POST", body: JSON.stringify({ productCollection: collection }) }),
  getHomepageContent: (collection?: "artificial" | "demi-fine") => request<{ draft: HomepageContent; published: HomepageContent; schedule: EditorialSchedule | null; scheduleStatus: EditorialScheduleStatus }>("/admin/homepage-layout/content" + collectionQuery(collection)),
  scheduleHomepageContent: (startsAtUtc: string, endsAtUtc: string | null, collection?: "artificial" | "demi-fine") => request<{ draft: HomepageContent; published: HomepageContent; schedule: EditorialSchedule; scheduleStatus: EditorialScheduleStatus }>("/admin/homepage-layout/content/schedule", { method: "POST", body: JSON.stringify({ startsAtUtc, endsAtUtc, productCollection: collection }) }),
  cancelHomepageContentSchedule: (collection?: "artificial" | "demi-fine") => request<{ draft: HomepageContent; published: HomepageContent; schedule: null; scheduleStatus: EditorialScheduleStatus }>("/admin/homepage-layout/content/schedule/cancel", { method: "POST", body: JSON.stringify({ productCollection: collection }) }),
  saveHomepageContent: (content: HomepageContent, collection?: "artificial" | "demi-fine") =>
    request<{ success: boolean; draft: HomepageContent }>("/admin/homepage-layout/content/draft", { method: "PUT", body: JSON.stringify({ ...content, productCollection: collection }) }),
  publishHomepageContent: (collection?: "artificial" | "demi-fine") =>
    request<{ success: boolean; published: HomepageContent; schedule: null; scheduleStatus: EditorialScheduleStatus }>("/admin/homepage-layout/content/publish", { method: "POST", body: JSON.stringify({ productCollection: collection }) }),
  getPublicHomepageContent: () => request<{ content: HomepageContent }>("/homepage-layout/content" + publicRangeQuery()),

  getMenStorefront: (collection?: "artificial" | "demi-fine") => request<{ draft: MenStorefrontSettings; published: MenStorefrontSettings; products: MenStorefrontProduct[] }>("/admin/storefront/men-storefront" + collectionQuery(collection)),
  saveMenStorefrontDraft: (settings: MenStorefrontSettings, collection?: "artificial" | "demi-fine") => request<{ success: boolean; draft: MenStorefrontSettings }>("/admin/storefront/men-storefront/draft", { method: "PUT", body: JSON.stringify({ settings, productCollection: collection }) }),
  publishMenStorefront: (collection?: "artificial" | "demi-fine") => request<{ success: boolean; published: MenStorefrontSettings }>("/admin/storefront/men-storefront/publish", { method: "POST", body: JSON.stringify({ productCollection: collection }) }),
  getPublicMenStorefront: () => request<{ settings: MenStorefrontSettings; products: MenStorefrontProduct[] }>("/storefront/men-storefront" + publicRangeQuery()),
  getPublicMenCategory: (categoryId: string) => request<{ category: MenStorefrontCategory; products: MenStorefrontProduct[] }>(`/storefront/men-storefront/categories/${encodeURIComponent(categoryId)}` + publicRangeQuery()),
  subscribeMenLaunch: (email: string, consent: boolean) => request<{ success: boolean; message: string }>("/storefront/men-launch-signups", { method: "POST", body: JSON.stringify({ email, consent }) }),
  getMenLaunchSignups: () => request<{ subscribers: MenLaunchSubscriber[] }>("/admin/storefront/men-launch-signups"),
  deleteMenLaunchSignup: (id: string) => request<{ success: boolean }>(`/admin/storefront/men-launch-signups/${encodeURIComponent(id)}`, { method: "DELETE" }),
  getShopByGender: (collection?: "artificial" | "demi-fine") => request<{ settings: ShopByGenderSettings }>("/admin/storefront/shop-by-gender" + collectionQuery(collection)),
  saveShopByGender: (settings: ShopByGenderSettings, collection?: "artificial" | "demi-fine") => request<{ success: boolean; settings: ShopByGenderSettings }>("/admin/storefront/shop-by-gender", { method: "PUT", body: JSON.stringify({ ...settings, productCollection: collection }) }),
  getPublicShopByGender: () => request<{ settings: ShopByGenderSettings }>("/storefront/shop-by-gender" + publicRangeQuery()),
  getOccasions: (collection?: "artificial" | "demi-fine") => request<{ occasions: OccasionCard[] }>("/admin/storefront/occasions" + collectionQuery(collection)),
  getPublicOccasions: () => request<{ occasions: OccasionCard[] }>("/storefront/occasions" + publicRangeQuery()),
  getHomepageCategoryImages: (collection?: "artificial" | "demi-fine") => request<{ images: HomepageCategoryImages }>("/admin/storefront/category-images" + collectionQuery(collection)),
  saveHomepageCategoryImages: (images: HomepageCategoryImages, collection?: "artificial" | "demi-fine") => request<{ success: boolean; images: HomepageCategoryImages }>("/admin/storefront/category-images", { method: "PUT", body: JSON.stringify({ images, productCollection: collection }) }),
  getPublicHomepageCategoryImages: () => request<{ images: HomepageCategoryImages }>("/storefront/category-images" + publicRangeQuery()),
  saveOccasions: (occasions: OccasionCard[], collection?: "artificial" | "demi-fine") => request<{ success: boolean; occasions: OccasionCard[] }>("/admin/storefront/occasions", { method: "PUT", body: JSON.stringify({ occasions, productCollection: collection }) }),
  getBanners: (collection?: "artificial" | "demi-fine") => request<{ banners: StorefrontBanner[] }>("/admin/storefront/banners" + collectionQuery(collection)),
  getPublicBanners: () => request<{ banners: StorefrontBanner[] }>("/storefront/banners" + publicRangeQuery()),
  createBanner: (banner: Omit<StorefrontBanner, "id" | "sortOrder">) =>
    request<{ banner: StorefrontBanner }>("/admin/storefront/banners", { method: "POST", body: JSON.stringify(banner) }),
  updateBanner: (id: string, banner: Partial<StorefrontBanner>) =>
    request<{ banner: StorefrontBanner }>(`/admin/storefront/banners/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(banner) }),
  deleteBanner: (id: string) =>
    request<{ success: boolean }>(`/admin/storefront/banners/${encodeURIComponent(id)}`, { method: "DELETE" }),
  reorderBanners: (ids: string[], collection?: "artificial" | "demi-fine") =>
    request<{ success: boolean }>("/admin/storefront/banners/reorder", { method: "PUT", body: JSON.stringify({ ids, productCollection: collection }) }),
  getAnnouncement: () => request<{ announcement: { message: string; active: boolean; trustMessages?: string[] } }>("/admin/storefront/announcement"),
  getPublicAnnouncement: () => request<{ announcement: { message: string; active: boolean; trustMessages?: string[] } }>("/storefront/announcement"),
  saveAnnouncement: (message: string, active: boolean, trustMessages: string[]) =>
    request<{ success: boolean }>("/admin/storefront/announcement", { method: "PUT", body: JSON.stringify({ message, active, trustMessages }) }),
  getEditorial: (collection?: "artificial" | "demi-fine") => request<{ draft: EditorialContent; published: EditorialContent; schedule: EditorialSchedule | null; scheduleStatus: EditorialScheduleStatus }>("/admin/storefront/editorial" + collectionQuery(collection)),
  saveEditorial: (editorial: EditorialContent, collection?: "artificial" | "demi-fine") =>
    request<{ draft: EditorialContent; published: EditorialContent; schedule: EditorialSchedule | null; scheduleStatus: EditorialScheduleStatus }>("/admin/storefront/editorial", { method: "PUT", body: JSON.stringify({ ...editorial, productCollection: collection }) }),
  scheduleEditorial: (startsAtUtc: string, endsAtUtc: string | null, collection?: "artificial" | "demi-fine") =>
    request<{ draft: EditorialContent; published: EditorialContent; schedule: EditorialSchedule; scheduleStatus: EditorialScheduleStatus }>("/admin/storefront/editorial/schedule", { method: "POST", body: JSON.stringify({ startsAtUtc, endsAtUtc, productCollection: collection }) }),
  cancelEditorialSchedule: (collection?: "artificial" | "demi-fine") =>
    request<{ draft: EditorialContent; published: EditorialContent; schedule: null; scheduleStatus: EditorialScheduleStatus }>("/admin/storefront/editorial/schedule/cancel", { method: "POST", body: JSON.stringify({ productCollection: collection }) }),
  publishEditorial: (collection?: "artificial" | "demi-fine") =>
    request<{ editorial: EditorialContent; draft: EditorialContent; published: EditorialContent; schedule: null; scheduleStatus: EditorialScheduleStatus }>("/admin/storefront/editorial/publish", { method: "POST", body: JSON.stringify({ productCollection: collection }) }),
  getPublicEditorial: () => request<{ editorial: EditorialContent | null }>("/storefront/editorial" + publicRangeQuery()),
  getPublicProductReviewSummary: async (productId: string) => {
    const summaries = await loadPublicProductReviewSummaries();
    return summaries[productId] || null;
  },
  getReviews: async (productId: string) => {
    const result = await request<{ reviews: ProductReview[]; count: number; average: number }>(`/storefront/products/${encodeURIComponent(productId)}/reviews`);
    return { ...result, reviews: result.reviews.map(mapReviewMedia) };
  },
  uploadReviewImage: async (file: File) => {
    const { base64, mimeType, fileName } = await compressForUpload(file);
    const response = await fetch(`${API_BASE}/storefront/review-images`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ fileName, mimeType, base64 })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : `Photo upload failed (${response.status}).`);
    if (typeof body.media?.id !== "string") throw new Error("The server did not confirm the photo upload.");
    return body.media.id as string;
  },
  submitReview: (productId: string, payload: { name: string; email: string; orderNumber: string; rating: number; title: string; comment: string; imageIds: string[] }) =>
    request<{ success: boolean; message: string }>(`/storefront/products/${encodeURIComponent(productId)}/reviews`, { method: "POST", body: JSON.stringify(payload) }),
  getAdminReviews: async (status: string) => {
    const result = await request<{ reviews: ProductReview[] }>(`/admin/storefront/reviews?status=${encodeURIComponent(status)}`);
    return { reviews: result.reviews.map(mapReviewMedia) };
  },
  moderateReview: (id: string, status: "pending" | "approved" | "rejected", adminReply: string) =>
    request<{ success: boolean }>(`/admin/storefront/reviews/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ status, adminReply }) })
};

export interface EditorialContent {
  eyebrow: string;
  title: string;
  description: string;
  ctaText: string;
  ctaLink: string;
  imageUrl: string;
  active: boolean;
}
export interface EditorialSchedule { startsAtUtc: string; endsAtUtc: string | null; }
export type EditorialScheduleStatus = "none" | "scheduled" | "published" | "expired";
function mapReviewMedia(review: ProductReview): ProductReview {
  return { ...review, imageUrls: (review.imageUrls || []).map(url => url.startsWith("/api/media/") ? `${API_BASE}${url.slice(4)}` : url) };
}

export interface ProductReview {
  id: string;
  productId: string;
  name: string;
  rating: number;
  title: string;
  comment: string;
  status: "pending" | "approved" | "rejected";
  verified: boolean;
  adminReply?: string;
  date: string;
  email?: string;
  orderNumber?: string;
  productName?: string;
  imageUrls: string[];
}

