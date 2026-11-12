export interface MarketingCoupon {
  id: string;
  code: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  minOrder: number;
  maxDiscount: number | null;
  usageLimit: number | null;
  usedCount: number;
  perCustomerLimit: number;
  startsAt: string | null;
  expiresAt: string;
  status: "active" | "paused" | "scheduled" | "expired";
  enabled: boolean;
}

export interface CouponInput {
  code: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  minOrder: number;
  maxDiscount: number | null;
  usageLimit: number | null;
  perCustomerLimit: number;
  startsAt: string | null;
  expiresAt: string;
  status: "active" | "paused";
}

function apiBase(): string {
  if (import.meta.env.VITE_HOSTINGER_API_BASE_URL) return import.meta.env.VITE_HOSTINGER_API_BASE_URL.replace(/\/+$/, "");
  if (import.meta.env.DEV) return "/api";
  return "https://lavender-goldfish-844589.hostingersite.com/api";
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiBase()}${path}`, {
    ...init,
    credentials: "include",
    cache: "no-store",
    headers: { Accept: "application/json", ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Marketing request failed.");
  return data as T;
}

export async function listMarketingCoupons(): Promise<MarketingCoupon[]> {
  const data = await request<{ coupons: MarketingCoupon[] }>("/admin/marketing/coupons");
  return data.coupons || [];
}

export async function createMarketingCoupon(input: CouponInput): Promise<MarketingCoupon> {
  const data = await request<{ coupon: MarketingCoupon }>("/admin/marketing/coupons", {
    method: "POST", body: JSON.stringify(input)
  });
  return data.coupon;
}

export async function updateMarketingCoupon(id: string, input: CouponInput): Promise<MarketingCoupon> {
  const data = await request<{ coupon: MarketingCoupon }>(`/admin/marketing/coupons/${encodeURIComponent(id)}`, {
    method: "PUT", body: JSON.stringify(input)
  });
  return data.coupon;
}

export async function setMarketingCouponStatus(id: string, status: "active" | "paused"): Promise<void> {
  await request(`/admin/marketing/coupons/${encodeURIComponent(id)}/status`, {
    method: "PATCH", body: JSON.stringify({ status })
  });
}

export async function deleteMarketingCoupon(id: string): Promise<void> {
  await request(`/admin/marketing/coupons/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function validateStorefrontCoupon(code: string, subtotal: number): Promise<{ valid: true; code: string; discountAmount: number; discountLabel: string }> {
  return request("/marketing/coupons/validate", {
    method: "POST", body: JSON.stringify({ code, subtotal })
  });
}
