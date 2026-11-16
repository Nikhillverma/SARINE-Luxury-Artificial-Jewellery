export function formatVariantLabel(option1Value, option2Value) {
  return [option1Value, option2Value].filter(value => typeof value === "string" && value.trim()).map(value => value.trim()).join(" / ");
}

export function isValidVariantSku(value) {
  return typeof value === "string" && /^[A-Z0-9][A-Z0-9._-]{1,99}$/.test(value);
}

export function validateVariantSelection(hasActiveVariants, requestedVariantId) {
  if (hasActiveVariants && (!requestedVariantId || typeof requestedVariantId !== "string")) {
    return "Please choose an available product option.";
  }
  if (!hasActiveVariants && requestedVariantId) {
    return "The selected product option is no longer available. Please refresh your bag.";
  }
  return null;
}

export function getVariantStockKey(productId, variantId) {
  return variantId ? `variant:${variantId}` : `product:${productId}`;
}
