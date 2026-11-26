import type { ProductCollection } from "../types/product";

/** Keep a product detail URL tied to the product range, even after a range switch. */
export function getProductDetailHref(slug: string, productCollection?: ProductCollection | null): string {
  const fromUrl = new URLSearchParams(window.location.search).get("range");
  const stored = window.sessionStorage.getItem("sarine_product_range");
  const selected = fromUrl === "artificial" || fromUrl === "demi-fine" ? fromUrl
    : stored === "artificial" || stored === "demi-fine" ? stored : undefined;
  const range = productCollection === "artificial" || productCollection === "demi-fine" ? productCollection : selected;
  return "/product/" + encodeURIComponent(slug) + (range ? "?range=" + range : "");
}
