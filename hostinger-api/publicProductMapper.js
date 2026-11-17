function parseJson(value, fallback = []) {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

/** Explicit allowlist for the public storefront; never expose internal cost data. */
export function mapPublicProduct(row) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description || "",
    shortDescription: row.short_description || "",
    price: Number(row.price),
    compareAtPrice: row.compare_at_price === null ? undefined : Number(row.compare_at_price),
    images: parseJson(row.images),
    categoryId: row.category_id,
    collectionSlugs: parseJson(row.collection_slugs),
    jewelleryType: row.jewellery_type,
    stock: Number(row.stock),
    status: row.status,
    tags: parseJson(row.tags),
    baseMetal: row.base_metal || undefined,
    platingFinish: row.plating_finish || undefined,
    stoneType: row.stone_type || undefined,
    closureType: row.closure_type || undefined,
    careInstructions: parseJson(row.care_instructions),
    variants: [],
    createdAt: row.created_at
  };
}
