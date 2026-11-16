export function formatVariantLabel(option1Name, option1Value, option2Name, option2Value) {
  const first = typeof option1Value === "string" && option1Value.trim()
    ? (option1Name ? `${option1Name.trim()}: ${option1Value.trim()}` : option1Value.trim())
    : "";
  const second = typeof option2Value === "string" && option2Value.trim()
    ? (option2Name ? `${option2Name.trim()}: ${option2Value.trim()}` : option2Value.trim())
    : "";
  return [first, second].filter(Boolean).join(" / ");
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
