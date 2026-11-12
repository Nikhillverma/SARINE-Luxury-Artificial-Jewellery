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
  getAnnouncement: () => request<{ announcement: { message: string; active: boolean } }>("/admin/storefront/announcement"),
  saveAnnouncement: (message: string, active: boolean) =>
    request<{ success: boolean }>("/admin/storefront/announcement", { method: "PUT", body: JSON.stringify({ message, active }) })
};
