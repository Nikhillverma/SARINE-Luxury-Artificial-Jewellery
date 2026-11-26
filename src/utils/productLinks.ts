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

/** Preserve the selected browsing range; cart links can opt into the item's own range. */
export function getProductDetailHref(
  slug: string,
  productCollection?: ProductCollection | null,
  preferProductRange = false
): string {
  const selected = getCurrentProductCollection();
  const productRange = productCollection === "artificial" || productCollection === "demi-fine"
    ? productCollection : undefined;
  const range = (preferProductRange ? productRange : undefined) || selected || "home";
  return "/product/" + encodeURIComponent(slug) + "?range=" + range;
}
