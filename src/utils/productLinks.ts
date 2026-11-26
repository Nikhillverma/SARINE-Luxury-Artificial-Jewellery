import type { ProductCollection } from "../types/product";

export function getCurrentProductCollection(): ProductCollection | undefined {
  const fromUrl = new URLSearchParams(window.location.search).get("range");
  if (fromUrl === "artificial" || fromUrl === "demi-fine") {
    window.sessionStorage.setItem("sarine_product_range", fromUrl);
    return fromUrl;
  }
  const stored = window.sessionStorage.getItem("sarine_product_range");
  return stored === "artificial" || stored === "demi-fine" ? stored : undefined;
}

/** Keep a product detail URL tied to the product range, even after a range switch. */
export function getProductDetailHref(slug: string, productCollection?: ProductCollection | null): string {
  const selected = getCurrentProductCollection();
  const range = productCollection === "artificial" || productCollection === "demi-fine" ? productCollection : selected;
  return "/product/" + encodeURIComponent(slug) + (range ? "?range=" + range : "");
}
