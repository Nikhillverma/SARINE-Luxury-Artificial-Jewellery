/**
 * Keep every stock-changing transaction on the same lock order:
 * parent product first, then variant, with products/variants sorted consistently.
 */
export function sortStockItems(items) {
  return [...items].sort((a, b) => {
    const productOrder = String(a.productId).localeCompare(String(b.productId));
    if (productOrder !== 0) return productOrder;
    return String(a.variantId || "").localeCompare(String(b.variantId || ""));
  });
}
