export const MAX_EXPLORE_PRODUCTS = 100;
export const EXPLORE_DISPLAY_COUNTS = Object.freeze([4, 6, 8, 10, 12, 16, 20, 24]);
export const EMPTY_EXPLORE_NOW = Object.freeze({
  version: 1,
  productIds: [],
  displayCount: 8,
  configured: false
});

export function validateExploreNow(input) {
  if (!input || typeof input !== "object" || !Array.isArray(input.productIds)) {
    throw new Error("Explore Now must contain a productIds array.");
  }
  if (input.productIds.length > MAX_EXPLORE_PRODUCTS) {
    throw new Error("Choose no more than " + MAX_EXPLORE_PRODUCTS + " products.");
  }
  const productIds = input.productIds.map((id) => {
    if (typeof id !== "string" || !id.trim() || id.trim().length > 64) {
      throw new Error("Every Explore Now product must have a valid product ID.");
    }
    return id.trim();
  });
  if (new Set(productIds).size !== productIds.length) {
    throw new Error("A product cannot be added to Explore Now more than once.");
  }
  const displayCount = Number(input.displayCount);
  if (!EXPLORE_DISPLAY_COUNTS.includes(displayCount)) {
    throw new Error("Choose a valid initial Explore Now product count.");
  }
  return { version: 1, productIds, displayCount, configured: productIds.length > 0 };
}
