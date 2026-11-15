/**
 * Combine repeated product IDs into a single quantity before checking or
 * decrementing stock. Input validation is performed by the caller.
 */
export function aggregateOrderItems(items) {
  const quantitiesByProduct = new Map();

  for (const item of items) {
    const productId = item.productId;
    const quantity = Number(item.quantity);
    const combinedQuantity = (quantitiesByProduct.get(productId) || 0) + quantity;

    if (!Number.isSafeInteger(combinedQuantity) || combinedQuantity <= 0) {
      throw new RangeError("Combined product quantity is invalid.");
    }

    quantitiesByProduct.set(productId, combinedQuantity);
  }

  return Array.from(quantitiesByProduct, ([productId, quantity]) => ({
    productId,
    quantity
  }));
}
