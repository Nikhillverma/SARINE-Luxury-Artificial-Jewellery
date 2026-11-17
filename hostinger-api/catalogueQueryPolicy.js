export const MAX_CATALOGUE_PAGE = 10_000;
export const MAX_CATALOGUE_PAGE_SIZE = 100;
export const MAX_CATALOGUE_SEARCH_LENGTH = 100;
export const MAX_CATALOGUE_PRICE = 2_147_483_647;

function readOptionalText(query, key, maxLength) {
  const raw = query[key];
  if (raw === undefined) return { value: undefined, error: null };
  if (typeof raw !== "string") return { value: undefined, error: "Invalid " + key + " filter." };
  const value = raw.trim();
  if (value.length > maxLength) return { value: undefined, error: key + " filter is too long." };
  return { value: value || undefined, error: null };
}

function readBoundedInteger(query, key, fallback, maximum) {
  const raw = query[key];
  if (raw === undefined) return { value: fallback, error: null };
  if (typeof raw !== "string" || !/^[0-9]+$/.test(raw)) {
    return { value: undefined, error: "Enter a valid " + key + " value." };
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) {
    return { value: undefined, error: key + " must be between 1 and " + maximum + "." };
  }
  return { value, error: null };
}

function readOptionalPrice(query, key) {
  const raw = query[key];
  if (raw === undefined) return { value: undefined, error: null };
  if (typeof raw !== "string" || !/^[0-9]+$/.test(raw)) {
    return { value: undefined, error: "Enter a valid " + key + " price." };
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value > MAX_CATALOGUE_PRICE) {
    return { value: undefined, error: key + " price is outside the supported range." };
  }
  return { value, error: null };
}

/** Validate and bound untrusted public catalogue query parameters before SQL work. */
export function parseCatalogueQuery(query = {}) {
  const textFilters = { categorySlug: 120, categoryId: 191, jewelleryType: 80, collectionSlug: 120, search: MAX_CATALOGUE_SEARCH_LENGTH };
  const filters = {};
  for (const [key, maxLength] of Object.entries(textFilters)) {
    const parsed = readOptionalText(query, key, maxLength);
    if (parsed.error) return { filters: null, error: parsed.error };
    filters[key] = parsed.value;
  }
  const page = readBoundedInteger(query, "page", 1, MAX_CATALOGUE_PAGE);
  if (page.error) return { filters: null, error: page.error };
  const pageSize = readBoundedInteger(query, "pageSize", 24, MAX_CATALOGUE_PAGE_SIZE);
  if (pageSize.error) return { filters: null, error: pageSize.error };
  const minPrice = readOptionalPrice(query, "minPrice");
  if (minPrice.error) return { filters: null, error: minPrice.error };
  const maxPrice = readOptionalPrice(query, "maxPrice");
  if (maxPrice.error) return { filters: null, error: maxPrice.error };
  if (minPrice.value !== undefined && maxPrice.value !== undefined && minPrice.value > maxPrice.value) {
    return { filters: null, error: "Minimum price cannot exceed maximum price." };
  }
  const sortBy = typeof query.sortBy === "string" ? query.sortBy : undefined;
  filters.page = page.value;
  filters.pageSize = pageSize.value;
  filters.minPrice = minPrice.value;
  filters.maxPrice = maxPrice.value;
  filters.inStockOnly = query.inStockOnly === "true";
  filters.sortBy = ["newest", "price-asc", "price-desc"].includes(sortBy) ? sortBy : "newest";
  return { filters, error: null };
}
