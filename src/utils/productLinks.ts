import type { ProductCollection } from "../types/product";

export function getCurrentProductCollection(): ProductCollection | undefined {
  const fromUrl = new URLSearchParams(window.location.search).get("range");
  if (fromUrl === "home") { window.sessionStorage.removeItem("sarine_product_range"); return undefined; }
  if (fromUrl === "artificial" || fromUrl === "demi-fine") {
    window.sessionStorage.setItem("sarine_product_range", fromUrl);
    return fromUrl;
  }
  const stored = window.sessionStorage.getItem("sarine_product_range");
  return stored === "artificial" || stored === "demi-fine" ? stored : undefined;
}

/** Keep a product detail URL tied to the product range, even after a range switch. */
/** Preserve the selected browsing range when opening a product. */
export function getProductDetailHref(slug: string, _productCollection?: ProductCollection | null): string {
  const range = getCurrentProductCollection() || "home";
  return "/product/" + encodeURIComponent(slug) + "?range=" + range;
}
