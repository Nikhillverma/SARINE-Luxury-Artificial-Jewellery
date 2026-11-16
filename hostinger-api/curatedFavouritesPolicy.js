export const MAX_CURATED_PRODUCTS = 12;
export const EMPTY_CURATED_FAVOURITES = Object.freeze({ version: 1, productIds: [], configured: false });

export function validateCuratedFavourites(input) {
  if (!input || typeof input !== "object" || !Array.isArray(input.productIds)) {
    throw new Error("Curated Favourites must contain a productIds array.");
  }
  if (input.productIds.length > MAX_CURATED_PRODUCTS) {
    throw new Error("Choose no more than " + MAX_CURATED_PRODUCTS + " products.");
  }
  const productIds = input.productIds.map((id) => {
    if (typeof id !== "string" || !id.trim() || id.trim().length > 64) {
      throw new Error("Every curated product must have a valid product ID.");
    }
    return id.trim();
  });
  if (new Set(productIds).size !== productIds.length) {
    throw new Error("A product cannot be added to Curated Favourites more than once.");
  }
  return { version: 1, productIds, configured: true };
}
