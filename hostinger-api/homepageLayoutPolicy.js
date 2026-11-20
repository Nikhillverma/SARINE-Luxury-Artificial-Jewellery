export const HOMEPAGE_SECTION_IDS = Object.freeze([
  "hero", "categories", "new-arrivals", "best-sellers", "curated-favourites",
  "occasions", "price", "our-story", "editorial", "care-guide", "stay-in-touch"
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
    const cardsPerView = section.cardsPerView === undefined ? undefined : section.cardsPerView;
    if (cardsPerView !== undefined && (!Number.isInteger(cardsPerView) || cardsPerView < 2 || cardsPerView > 8)) {
      throw new Error("Carousel cards per view must be a whole number from 2 to 8.");
    }
    const carouselEnabled = section.carouselEnabled === undefined ? undefined : section.carouselEnabled;
    if (carouselEnabled !== undefined && typeof carouselEnabled !== "boolean") {
      throw new Error("Carousel enabled setting must be true or false.");
    }
    return {
      id: section.id,
      enabled: section.enabled,
      sortOrder: section.sortOrder,
      ...(cardsPerView === undefined ? {} : { cardsPerView }),
      ...(carouselEnabled === undefined ? {} : { carouselEnabled })
    };
  });
  const positions = new Set(sections.map((section) => section.sortOrder));
  if (positions.size !== HOMEPAGE_SECTION_IDS.length) throw new Error("Homepage section positions must be unique.");
  sections.sort((a, b) => a.sortOrder - b.sortOrder);
  return { version: 1, sections };
}
