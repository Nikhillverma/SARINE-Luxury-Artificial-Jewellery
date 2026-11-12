import { compressForUpload } from "../../utils/imageUpload";
const API_BASE = (
  import.meta.env.VITE_HOSTINGER_API_BASE_URL ||
  (import.meta.env.DEV ? "/api" : "https://lavender-goldfish-844589.hostingersite.com/api")
).replace(/\/+$/, "");

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
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : `Request failed (${response.status}).`);
  return body as T;
}

export const hostingerStorefrontService = {
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
