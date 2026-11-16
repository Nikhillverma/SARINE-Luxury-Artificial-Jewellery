const TEXT_LIMITS = {
  description: 5000,
  shortDescription: 240,
  baseMetal: 120,
  platingFinish: 120,
  stoneType: 160,
  closureType: 120
};

const LIST_LIMITS = {
  tags: { count: 20, length: 48 },
  collectionSlugs: { count: 20, length: 80 },
  careInstructions: { count: 20, length: 300 },
  images: { count: 8, length: 2048 }
};

export function normalizeStringList(value) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map(item => String(item).trim()).filter(Boolean)));
}

export function validateProductFields(body = {}) {
  const errors = [];

  for (const [field, maxLength] of Object.entries(TEXT_LIMITS)) {
    if (body[field] === undefined) continue;
    if (typeof body[field] !== "string") {
      errors.push(field + " must be text.");
    } else if (body[field].length > maxLength) {
      errors.push(field + " must be " + maxLength + " characters or fewer.");
    }
  }

  for (const [field, limits] of Object.entries(LIST_LIMITS)) {
    if (body[field] === undefined) continue;
    if (!Array.isArray(body[field])) {
      errors.push(field + " must be an array.");
      continue;
    }
    if (body[field].length > limits.count) {
      errors.push(field + " cannot contain more than " + limits.count + " items.");
      continue;
    }
    if (body[field].some(item => typeof item !== "string" || item.trim().length > limits.length)) {
      errors.push(field + " items must be text of " + limits.length + " characters or fewer.");
    }
  }

  if (body.compareAtPrice !== undefined && body.compareAtPrice !== null) {
    const comparisonPrice = Number(body.compareAtPrice);
    if (!Number.isFinite(comparisonPrice) || comparisonPrice < 0 || comparisonPrice > 99999999) {
      errors.push("Comparison price must be a valid non-negative amount.");
    } else if (body.price !== undefined && comparisonPrice <= Number(body.price)) {
      errors.push("Comparison price must be higher than the selling price.");
    }
  }

  return errors;
}
