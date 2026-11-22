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
  heroPlacement: "auto" | "first" | "normal";
  heroDurationSeconds: number;
  countdownLabel: string;
  countdownBackgroundColor: string;
  countdownTextColor: string;
  countdownTimerColor: string;
  updatedAt: string | null;
}
const API_BASE = (import.meta.env.VITE_HOSTINGER_API_BASE_URL || (import.meta.env.DEV ? "/api" : "https://lavender-goldfish-844589.hostingersite.com/api")).replace(/\/+$/, "");
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(API_BASE + path, { ...init, credentials: "include", cache: "no-store", headers: { Accept: "application/json", ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Campaign request failed.");
  return data as T;
}
async function fetchActiveCampaigns(): Promise<FestivalCampaign[]> {
  const data = await request<{ campaigns?: FestivalCampaign[]; campaign?: FestivalCampaign | null }>("/storefront/campaign");
  const campaigns = Array.isArray(data.campaigns) ? data.campaigns : data.campaign ? [data.campaign] : [];
  return campaigns.map(item => ({
    ...item,
    campaignType: (item.campaignType === "sale" ? "sale" : "festival") as FestivalCampaign["campaignType"],
    showCountdown: item.showCountdown === true,
    artworkOnly: item.artworkOnly !== false,
    storewideDiscountPercent: Math.max(0, Math.min(75, Number(item.storewideDiscountPercent) || 0)),
    sortOrder: Number(item.sortOrder) || 0,
    heroPlacement: item.heroPlacement === "first" || item.heroPlacement === "normal" ? item.heroPlacement : "auto",
    heroDurationSeconds: Math.max(5, Math.min(20, Number(item.heroDurationSeconds) || 9)),
    countdownLabel: String(item.countdownLabel || ""),
    countdownBackgroundColor: /^#[0-9a-f]{6}$/i.test(item.countdownBackgroundColor || "") ? item.countdownBackgroundColor : "#563568",
    countdownTextColor: /^#[0-9a-f]{6}$/i.test(item.countdownTextColor || "") ? item.countdownTextColor : "#FFFFFF",
    countdownTimerColor: /^#[0-9a-f]{6}$/i.test(item.countdownTimerColor || "") ? item.countdownTimerColor : "#B3265C"
  }));
}
export const festivalCampaignService = {
  list: async () => (await request<{campaigns: FestivalCampaign[]}>("/admin/storefront/campaigns")).campaigns,
  save: async (campaigns: FestivalCampaign[]) => (await request<{campaigns: FestivalCampaign[]}>("/admin/storefront/campaigns", { method: "PUT", body: JSON.stringify({campaigns}) })).campaigns,
  getActiveCampaigns: fetchActiveCampaigns,
  getActive: async () => (await fetchActiveCampaigns())[0] || null
};
