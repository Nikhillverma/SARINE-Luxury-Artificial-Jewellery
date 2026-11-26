const ALLOWED_FIELDS = new Set(["price", "compareAtPrice", "categoryId", "status", "productCollection"]);

export function validateBulkProductRequest(productIds, updates) {
  if (!Array.isArray(productIds) || productIds.length < 1 || productIds.length > 100) {
    return "Select between 1 and 100 products.";
  }
  if (productIds.some(id => typeof id !== "string" || !id.trim() || id.length > 64)) {
    return "Every selected product must have a valid ID.";
  }
  if (new Set(productIds).size !== productIds.length) {
    return "Duplicate product IDs are not allowed.";
  }
  if (!updates || typeof updates !== "object" || Array.isArray(updates)) {
    return "Choose at least one field to update.";
  }
  const fields = Object.keys(updates);
  if (!fields.length || fields.some(field => !ALLOWED_FIELDS.has(field))) {
    return "The bulk update contains an unsupported field.";
  }
  if (Object.hasOwn(updates, "price") &&
      (typeof updates.price !== "number" || !Number.isFinite(updates.price) || updates.price < 0 || updates.price > 99999999)) {
    return "Selling price must be a valid amount between ₹0 and ₹99,999,999.";
  }
  if (Object.hasOwn(updates, "compareAtPrice") && updates.compareAtPrice !== null &&
      (typeof updates.compareAtPrice !== "number" || !Number.isFinite(updates.compareAtPrice) || updates.compareAtPrice < 0 || updates.compareAtPrice > 99999999)) {
    return "Comparison price must be a valid amount or cleared.";
  }
  if (Object.hasOwn(updates, "categoryId") &&
      (typeof updates.categoryId !== "string" || !updates.categoryId.trim() || updates.categoryId.length > 64)) {
    return "Choose a valid category.";
  }
  if (Object.hasOwn(updates, "productCollection") && !["artificial", "demi-fine"].includes(updates.productCollection)) {
    return "Choose Artificial or Demi-Fine for the product range.";
  }
  if (Object.hasOwn(updates, "status") && !["active", "draft"].includes(updates.status)) {
    return "Bulk publication status must be active or draft. Archived products cannot be unarchived in bulk.";
  }
  return null;
}
