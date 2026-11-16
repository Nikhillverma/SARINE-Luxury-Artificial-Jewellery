import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_HOMEPAGE_LAYOUT, validateHomepageLayout } from "../homepageLayoutPolicy.js";

test("default homepage layout contains each supported section once in order", () => {
  const layout = validateHomepageLayout(DEFAULT_HOMEPAGE_LAYOUT);
  assert.deepEqual(layout.sections.map((section) => section.id), [
    "categories", "new-arrivals", "best-sellers", "curated-favourites", "occasions",
    "price", "our-story", "editorial"
  ]);
});

test("layout rejects missing, duplicate and unsupported sections", () => {
  assert.throws(() => validateHomepageLayout({ sections: [] }), /every supported/);
  const duplicate = structuredClone(DEFAULT_HOMEPAGE_LAYOUT);
  duplicate.sections[1].id = duplicate.sections[0].id;
  assert.throws(() => validateHomepageLayout(duplicate), /duplicated/);
  const unsupported = structuredClone(DEFAULT_HOMEPAGE_LAYOUT);
  unsupported.sections[0].id = "made-up";
  assert.throws(() => validateHomepageLayout(unsupported), /unsupported/);
});

test("layout requires unique positions and boolean visibility", () => {
  const duplicatePosition = structuredClone(DEFAULT_HOMEPAGE_LAYOUT);
  duplicatePosition.sections[1].sortOrder = 0;
  assert.throws(() => validateHomepageLayout(duplicatePosition), /positions must be unique/);
  const invalidEnabled = structuredClone(DEFAULT_HOMEPAGE_LAYOUT);
  invalidEnabled.sections[0].enabled = "yes";
  assert.throws(() => validateHomepageLayout(invalidEnabled), /enabled setting/);
});

test("valid layouts are sorted and normalized", () => {
  const input = structuredClone(DEFAULT_HOMEPAGE_LAYOUT);
  input.sections.reverse();
  input.sections.forEach((section, index) => { section.sortOrder = index; });
  const result = validateHomepageLayout(input);
  assert.equal(result.sections[0].id, "editorial");
  assert.equal(result.sections[0].sortOrder, 0);
});
