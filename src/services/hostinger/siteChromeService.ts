const API_BASE = (import.meta.env.VITE_HOSTINGER_API_BASE_URL || (import.meta.env.DEV ? "/api" : "https://lavender-goldfish-844589.hostingersite.com/api")).replace(/\\/+$/, "");

export interface SiteChromeSettings {
  version: 1;
  header: { tagline: string };
  footer: {
    tagline: string;
    copyright: string;
    social: { instagram: string; facebook: string; pinterest: string; youtube: string };
    headings: { shop: string; care: string; about: string; payments: string };
  };
}
export const DEFAULT_SITE_CHROME: SiteChromeSettings = {
  version: 1,
  header: { tagline: "Timeless jewellery for every you." },
  footer: {
    tagline: "Timeless jewellery for every you.",
    copyright: "© 2026 SARINE. All rights reserved.",
    social: { instagram: "https://instagram.com", facebook: "https://facebook.com", pinterest: "https://pinterest.com", youtube: "https://youtube.com" },
    headings: { shop: "Shop", care: "Customer Care", about: "About", payments: "Payment Methods" }
  }
};
async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(API_BASE + path, { ...init, credentials: "include", headers: { Accept: "application/json", "Content-Type": "application/json", ...init.headers } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : `Request failed (${response.status}).`);
  return body as T;
}
export const siteChromeService = {
  getDraft: () => call<{ draft: SiteChromeSettings; published: SiteChromeSettings }>("/admin/storefront/site-chrome"),
  saveDraft: (settings: SiteChromeSettings) => call<{ success: boolean; draft: SiteChromeSettings }>("/admin/storefront/site-chrome", { method: "PUT", body: JSON.stringify({ settings }) }),
  publish: () => call<{ success: boolean; published: SiteChromeSettings }>("/admin/storefront/site-chrome/publish", { method: "POST" }),
  getPublic: () => call<{ settings: SiteChromeSettings }>("/storefront/site-chrome")
};
