export const PRODUCT_COLLECTIONS = Object.freeze(["artificial", "demi-fine"]);

export function normalizeProductCollection(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return PRODUCT_COLLECTIONS.includes(normalized) ? normalized : null;
}

export function validateProductCollection(value, { required = false } = {}) {
  if (value === undefined) {
    return required ? "Choose Artificial or Demi-Fine for this product." : null;
  }
  if (value === "" || value === null) return "Product collection must be artificial or demi-fine.";
  return normalizeProductCollection(value) ? null : "Product collection must be artificial or demi-fine.";
}
