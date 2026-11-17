export const MAX_CHECKOUT_LINES = 50;
export const MAX_CHECKOUT_QUANTITY_PER_LINE = 99;

/**
 * Bound the work a public checkout request can trigger before any database
 * schema checks, locks, stock reads, or payment-gateway calls are performed.
 */
export function validateCheckoutItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return "Your shopping bag is empty.";
  }
  if (items.length > MAX_CHECKOUT_LINES) {
    return `Your order can contain at most ${MAX_CHECKOUT_LINES} different cart lines.`;
  }

  for (const item of items) {
    if (!item || typeof item !== "object" || Array.isArray(item) ||
        typeof item.productId !== "string" || !item.productId.trim() ||
        item.productId.length > 191) {
      return "Invalid product in order list.";
    }

    const quantity = Number(item.quantity);
    if (!Number.isSafeInteger(quantity) || quantity <= 0 ||
        quantity > MAX_CHECKOUT_QUANTITY_PER_LINE) {
      return `Each product quantity must be a whole number between 1 and ${MAX_CHECKOUT_QUANTITY_PER_LINE}.`;
    }
  }

  return null;
}
