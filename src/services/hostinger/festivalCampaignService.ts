export interface FestivalCampaign {
  id: string;
  name: string;
  festival: string;
  campaignType: "festival" | "sale";
  eyebrow: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  ctaText: string;
  ctaLink: string;
  couponCode: string;
  offerLabel: string;
  startsAt: string | null;
  endsAt: string | null;
  active: boolean;
  showCountdown: boolean;
  artworkOnly: boolean;
  storewideDiscountPercent: number;
  sortOrder: number;
  updatedAt: string | null;
}
const API_BASE = (import.meta.env.VITE_HOSTINGER_API_BASE_URL || (import.meta.env.DEV ? "/api" : "https://lavender-goldfish-844589.hostingersite.com/api")).replace(/\/+$/, "");
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(API_BASE + path, { ...init, credentials: "include", cache: "no-store", headers: { Accept: "application/json", ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Campaign request failed.");
  return data as T;
}
export const festivalCampaignService = {
  list: async () => (await request<{campaigns: FestivalCampaign[]}>("/admin/storefront/campaigns")).campaigns,
  save: async (campaigns: FestivalCampaign[]) => (await request<{campaigns: FestivalCampaign[]}>("/admin/storefront/campaigns", { method: "PUT", body: JSON.stringify({campaigns}) })).campaigns,
  getActiveCampaigns: async () => (await request<{campaigns: FestivalCampaign[]}>("/storefront/campaign")).campaigns,
  getActive: async () => (await request<{campaign: FestivalCampaign | null}>("/storefront/campaign")).campaign
};
