import { compressForUpload } from "../../utils/imageUpload";
const API_BASE = (
  import.meta.env.VITE_HOSTINGER_API_BASE_URL ||
  (import.meta.env.DEV ? "/api" : "https://lavender-goldfish-844589.hostingersite.com/api")
).replace(/\/+$/, "");


export type DesignFontFamily = "Cormorant Garamond" | "Plus Jakarta Sans" | "Playfair Display" | "DM Sans" | "Lato" | "Montserrat" | "Poppins" | "Inter" | "Roboto" | "Georgia" | "Arial";
export interface DesignFontRole { family: DesignFontFamily; sizeScale: number; weight: 300 | 400 | 500 | 600 | 700; }
export interface ResponsiveTypeScale { desktop: { h1:number; h2:number; h3:number; h4:number; body:number; small:number; button:number }; tablet: { h1:number; h2:number; h3:number; h4:number; body:number; small:number; button:number }; mobile: { h1:number; h2:number; h3:number; h4:number; body:number; small:number; button:number }; tabletOverride:boolean; mobileOverride:boolean; }
export interface ElementStyle { fontSize:number; lineHeight:number; letterSpacing:number; fontWeight:300|400|500|600|700; textAlign:'left'|'center'|'right'|'justify'; textTransform:'none'|'uppercase'|'capitalize'|'lowercase'; marginTop:number; marginRight:number; marginBottom:number; marginLeft:number; paddingTop:number; paddingRight:number; paddingBottom:number; paddingLeft:number; width:number; maxWidth:number; minHeight:number; borderRadius:number; borderWidth:number; }
const makeElementStyle=(fontSize:number):ElementStyle=>({fontSize,lineHeight:1.4,letterSpacing:0,fontWeight:400,textAlign:'left',textTransform:'none',marginTop:0,marginRight:0,marginBottom:0,marginLeft:0,paddingTop:0,paddingRight:0,paddingBottom:0,paddingLeft:0,width:100,maxWidth:100,minHeight:0,borderRadius:8,borderWidth:0});
const makeResponsiveStyle=(fontSize:number)=>({desktop:makeElementStyle(fontSize),tablet:makeElementStyle(fontSize),mobile:makeElementStyle(fontSize)});
export interface GlobalDesignSettings {
  version: 2;
  colors: { primary: string; accent: string; surface: string; pageBackground: string; text: string; headerBackground: string; footerBackground: string; footerText: string };
  typography: { headingFont: "Cormorant Garamond" | "Georgia" | "Playfair Display"; bodyFont: "Plus Jakarta Sans" | "Arial" | "DM Sans"; headingScale: number; bodyScale: number };
  layout: { contentWidth: 1120 | 1200 | 1280 | 1360; cornerRadius: 0 | 4 | 8 | 16 };
  components: { buttonStyle: "solid" | "outline" };
  elements: {
    text: { heading: string; body: string; goldText: string; muted: string; link: string; linkHover: string };
    buttons: { primaryBackground: string; primaryText: string; primaryHoverBackground: string; primaryPressedBackground: string; secondaryBorder: string; secondaryText: string };
    surfaces: { alternateSection: string; card: string; border: string; pill: string };
    productCards: { saleBadgeBackground: string; saleBadgeText: string; sellingPrice: string; oldPrice: string; starRating: string; categoryLabel: string };
    announcement: { background: string; text: string; separator: string };
    hero: { caption: string; heading: string; paragraph: string };
    countdown: { background: string; border: string; text: string };
    footer: { background: string; headings: string; links: string; linkHover: string; divider: string; bottomText: string };
  };
  fonts: { logo: DesignFontRole; heading: DesignFontRole; body: DesignFontRole; buttonLabel: DesignFontRole };
  responsiveTypography: ResponsiveTypeScale;
  customization: { spacing: { sectionVertical:number; sectionHorizontal:number; cardPadding:number; cardGap:number; gridGap:number; buttonPaddingX:number; buttonPaddingY:number; headerHeight:number; footerPadding:number }; elements: Record<string, { desktop: ElementStyle; tablet: ElementStyle; mobile: ElementStyle }> };
}
export const DEFAULT_GLOBAL_DESIGN: GlobalDesignSettings = {
  version: 2,
  colors: { primary: "#563568", accent: "#B69ACF", surface: "#FFFFFF", pageBackground: "#FFFFFF", text: "#302438", headerBackground: "#FFFFFF", footerBackground: "#563568", footerText: "#FFFFFF" },
  typography: { headingFont: "Cormorant Garamond", bodyFont: "Plus Jakarta Sans", headingScale: 100, bodyScale: 100 },
  layout: { contentWidth: 1280, cornerRadius: 8 }, components: { buttonStyle: "solid" },
  elements: {
    text: { heading: "#302438", body: "#5A4F5E", goldText: "#563568", muted: "#806F89", link: "#563568", linkHover: "#B69ACF" },
    buttons: { primaryBackground: "#563568", primaryText: "#FFFFFF", primaryHoverBackground: "#B69ACF", primaryPressedBackground: "#442753", secondaryBorder: "#B69ACF", secondaryText: "#302438" },
    surfaces: { alternateSection: "#F7F0FA", card: "#FFFFFF", border: "#E7DCEB", pill: "#F7F0FA" },
    productCards: { saleBadgeBackground: "#563568", saleBadgeText: "#FFFFFF", sellingPrice: "#563568", oldPrice: "#806F89", starRating: "#B69ACF", categoryLabel: "#563568" },
    announcement: { background: "#563568", text: "#FFFFFF", separator: "#B69ACF" },
    hero: { caption: "#B69ACF", heading: "#FFFFFF", paragraph: "#FFFFFF" },
    countdown: { background: "#F7F0FA", border: "#B69ACF", text: "#563568" },
    footer: { background: "#563568", headings: "#FFFFFF", links: "#FFFFFF", linkHover: "#B69ACF", divider: "#806F89", bottomText: "#F7F0FA" }
  },
  responsiveTypography: {"desktop":{"h1":60,"h2":42,"h3":28,"h4":20,"body":16,"small":13,"button":14},"tablet":{"h1":48,"h2":36,"h3":24,"h4":19,"body":15,"small":12,"button":14},"mobile":{"h1":38,"h2":30,"h3":21,"h4":18,"body":14,"small":12,"button":13},"tabletOverride":false,"mobileOverride":false},
  customization: { spacing: { sectionVertical:48, sectionHorizontal:24, cardPadding:16, cardGap:16, gridGap:20, buttonPaddingX:24, buttonPaddingY:12, headerHeight:76, footerPadding:48 }, elements: {announcement:makeResponsiveStyle(12),header:makeResponsiveStyle(14),logo:makeResponsiveStyle(28),navigation:makeResponsiveStyle(12),hero:makeResponsiveStyle(16),heroEyebrow:makeResponsiveStyle(11),heroHeading:makeResponsiveStyle(48),heroBody:makeResponsiveStyle(16),heroButton:makeResponsiveStyle(14),sectionHeading:makeResponsiveStyle(32),sectionBody:makeResponsiveStyle(16),categoryTile:makeResponsiveStyle(14),productGrid:makeResponsiveStyle(14),productCard:makeResponsiveStyle(14),productImage:makeResponsiveStyle(14),productTitle:makeResponsiveStyle(15),productPrice:makeResponsiveStyle(14),countdown:makeResponsiveStyle(12),footer:makeResponsiveStyle(14),footerHeading:makeResponsiveStyle(14),footerLink:makeResponsiveStyle(13)} },
  fonts: {
    logo: { family: "Cormorant Garamond", sizeScale: 100, weight: 600 },
    heading: { family: "Cormorant Garamond", sizeScale: 100, weight: 600 },
    body: { family: "Plus Jakarta Sans", sizeScale: 100, weight: 400 },
    buttonLabel: { family: "Plus Jakarta Sans", sizeScale: 100, weight: 600 }
  }
};

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
export interface MenStorefrontProduct { id: string; name: string; slug: string; description?: string; price: number; compareAtPrice?: number | null; images: string[]; status: string; stock: number; }
export interface MenLaunchSubscriber { id: string; email: string; consent: boolean; source: string; createdAt: string; }


export interface StorefrontBanner {
  id: string;
  tagline: string;
  title: string;
  subtitle: string;
  ctaText: string;
  ctaLink: string;
  imageUrl: string;
  active: boolean;
  sortOrder: number;
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

export const hostingerStorefrontService = {
  getGlobalDesign: () => request<{ draft: GlobalDesignSettings; published: GlobalDesignSettings }>("/admin/storefront/design"),
  saveGlobalDesign: (design: GlobalDesignSettings) => request<{ success: boolean; draft: GlobalDesignSettings }>("/admin/storefront/design", { method: "PUT", body: JSON.stringify({ design }) }),
  publishGlobalDesign: () => request<{ success: boolean; published: GlobalDesignSettings }>("/admin/storefront/design/publish", { method: "POST" }),
  getPublicGlobalDesign: (options?: { signal?: AbortSignal }) =>
    request<{ design: GlobalDesignSettings }>("/storefront/design", options?.signal ? { signal: options.signal } : undefined),
  getHomepageLayout: () => request<{ draft: HomepageLayout; published: HomepageLayout }>("/admin/homepage-layout"),
  getPublicHomepageLayout: () => request<{ layout: HomepageLayout }>("/homepage-layout"),
  getCuratedFavourites: () => request<{ draft: CuratedFavouritesConfig; published: CuratedFavouritesConfig; maxProducts: number }>("/admin/curated-favourites"),
  saveCuratedFavourites: (config: CuratedFavouritesConfig) =>
    request<{ success: boolean; draft: CuratedFavouritesConfig }>("/admin/curated-favourites/draft", { method: "PUT", body: JSON.stringify(config) }),
  publishCuratedFavourites: () =>
    request<{ success: boolean; published: CuratedFavouritesConfig }>("/admin/curated-favourites/publish", { method: "POST" }),
  getPublicCuratedFavourites: () =>
    request<{ products: import("../../types/product").Product[]; configured: boolean }>("/curated-favourites"),
  getExploreNow: () => request<{ draft: ExploreNowConfig; published: ExploreNowConfig; maxProducts: number }>("/admin/explore-now"),
  saveExploreNow: (config: ExploreNowConfig) => request<{ success: boolean; draft: ExploreNowConfig }>("/admin/explore-now/draft", { method: "PUT", body: JSON.stringify(config) }),
  publishExploreNow: () => request<{ success: boolean; published: ExploreNowConfig }>("/admin/explore-now/publish", { method: "POST" }),
  getPublicExploreNow: () => request<{ products: import("../../types/product").Product[]; displayCount: number; configured: boolean }>("/explore-now"),
  saveHomepageLayout: (layout: HomepageLayout) =>
    request<{ success: boolean; draft: HomepageLayout }>("/admin/homepage-layout/draft", { method: "PUT", body: JSON.stringify(layout) }),
  publishHomepageLayout: () =>
    request<{ success: boolean; published: HomepageLayout }>("/admin/homepage-layout/publish", { method: "POST" }),
  getHomepageContent: () => request<{ draft: HomepageContent; published: HomepageContent }>("/admin/homepage-layout/content"),
  saveHomepageContent: (content: HomepageContent) =>
    request<{ success: boolean; draft: HomepageContent }>("/admin/homepage-layout/content/draft", { method: "PUT", body: JSON.stringify(content) }),
  publishHomepageContent: () =>
    request<{ success: boolean; published: HomepageContent }>("/admin/homepage-layout/content/publish", { method: "POST" }),
  getPublicHomepageContent: () => request<{ content: HomepageContent }>("/homepage-layout/content"),

  getMenStorefront: () => request<{ draft: MenStorefrontSettings; published: MenStorefrontSettings; products: MenStorefrontProduct[] }>("/admin/storefront/men-storefront"),
  saveMenStorefrontDraft: (settings: MenStorefrontSettings) => request<{ success: boolean; draft: MenStorefrontSettings }>("/admin/storefront/men-storefront/draft", { method: "PUT", body: JSON.stringify({ settings }) }),
  publishMenStorefront: () => request<{ success: boolean; published: MenStorefrontSettings }>("/admin/storefront/men-storefront/publish", { method: "POST" }),
  getPublicMenStorefront: () => request<{ settings: MenStorefrontSettings; products: MenStorefrontProduct[] }>("/storefront/men-storefront"),
  getPublicMenCategory: (categoryId: string) => request<{ category: MenStorefrontCategory; products: MenStorefrontProduct[] }>(`/storefront/men-storefront/categories/${encodeURIComponent(categoryId)}`),
  subscribeMenLaunch: (email: string, consent: boolean) => request<{ success: boolean; message: string }>("/storefront/men-launch-signups", { method: "POST", body: JSON.stringify({ email, consent }) }),
  getMenLaunchSignups: () => request<{ subscribers: MenLaunchSubscriber[] }>("/admin/storefront/men-launch-signups"),
  deleteMenLaunchSignup: (id: string) => request<{ success: boolean }>(`/admin/storefront/men-launch-signups/${encodeURIComponent(id)}`, { method: "DELETE" }),
  getShopByGender: () => request<{ settings: ShopByGenderSettings }>("/admin/storefront/shop-by-gender"),
  saveShopByGender: (settings: ShopByGenderSettings) => request<{ success: boolean; settings: ShopByGenderSettings }>("/admin/storefront/shop-by-gender", { method: "PUT", body: JSON.stringify(settings) }),
  getPublicShopByGender: () => request<{ settings: ShopByGenderSettings }>("/storefront/shop-by-gender"),
  getOccasions: () => request<{ occasions: OccasionCard[] }>("/admin/storefront/occasions"),
  getPublicOccasions: () => request<{ occasions: OccasionCard[] }>("/storefront/occasions"),
  saveOccasions: (occasions: OccasionCard[]) => request<{ success: boolean; occasions: OccasionCard[] }>("/admin/storefront/occasions", { method: "PUT", body: JSON.stringify({ occasions }) }),
  getBanners: () => request<{ banners: StorefrontBanner[] }>("/admin/storefront/banners"),
  getPublicBanners: () => request<{ banners: StorefrontBanner[] }>("/storefront/banners"),
  createBanner: (banner: Omit<StorefrontBanner, "id" | "sortOrder">) =>
    request<{ banner: StorefrontBanner }>("/admin/storefront/banners", { method: "POST", body: JSON.stringify(banner) }),
  updateBanner: (id: string, banner: Partial<StorefrontBanner>) =>
    request<{ banner: StorefrontBanner }>(`/admin/storefront/banners/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(banner) }),
  deleteBanner: (id: string) =>
    request<{ success: boolean }>(`/admin/storefront/banners/${encodeURIComponent(id)}`, { method: "DELETE" }),
  reorderBanners: (ids: string[]) =>
    request<{ success: boolean }>("/admin/storefront/banners/reorder", { method: "PUT", body: JSON.stringify({ ids }) }),
  getAnnouncement: () => request<{ announcement: { message: string; active: boolean; trustMessages?: string[] } }>("/admin/storefront/announcement"),
  getPublicAnnouncement: () => request<{ announcement: { message: string; active: boolean; trustMessages?: string[] } }>("/storefront/announcement"),
  saveAnnouncement: (message: string, active: boolean, trustMessages: string[]) =>
    request<{ success: boolean }>("/admin/storefront/announcement", { method: "PUT", body: JSON.stringify({ message, active, trustMessages }) }),
  getEditorial: () => request<{ editorial: EditorialContent }>("/admin/storefront/editorial"),
  saveEditorial: (editorial: EditorialContent) =>
    request<{ editorial: EditorialContent }>("/admin/storefront/editorial", { method: "PUT", body: JSON.stringify(editorial) }),
  getPublicEditorial: () => request<{ editorial: EditorialContent | null }>("/storefront/editorial"),
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

