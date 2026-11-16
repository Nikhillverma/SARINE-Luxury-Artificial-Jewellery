export const HOMEPAGE_SECTION_IDS = Object.freeze([
  "categories", "new-arrivals", "best-sellers", "curated-favourites", "occasions",
  "price", "our-story", "editorial"
]);

export const DEFAULT_HOMEPAGE_LAYOUT = Object.freeze({
  version: 1,
  sections: HOMEPAGE_SECTION_IDS.map((id, sortOrder) => ({ id, enabled: true, sortOrder }))
});

export function validateHomepageLayout(input) {
  if (!input || typeof input !== "object" || !Array.isArray(input.sections)) {
    throw new Error("Homepage layout must contain a sections array.");
  }
  if (input.sections.length !== HOMEPAGE_SECTION_IDS.length) {
    throw new Error("Include every supported homepage section exactly once.");
  }
  const seen = new Set();
  const sections = input.sections.map((section) => {
    if (!section || typeof section !== "object" || !HOMEPAGE_SECTION_IDS.includes(section.id)) {
      throw new Error("Homepage layout contains an unsupported section.");
    }
    if (seen.has(section.id)) throw new Error("Homepage sections cannot be duplicated.");
    if (typeof section.enabled !== "boolean") throw new Error("Each homepage section needs an enabled setting.");
    if (!Number.isInteger(section.sortOrder) || section.sortOrder < 0 || section.sortOrder >= HOMEPAGE_SECTION_IDS.length) {
      throw new Error("Homepage section order is invalid.");
    }
    seen.add(section.id);
    return { id: section.id, enabled: section.enabled, sortOrder: section.sortOrder };
  });
  const positions = new Set(sections.map((section) => section.sortOrder));
  if (positions.size !== HOMEPAGE_SECTION_IDS.length) throw new Error("Homepage section positions must be unique.");
  sections.sort((a, b) => a.sortOrder - b.sortOrder);
  return { version: 1, sections };
}
