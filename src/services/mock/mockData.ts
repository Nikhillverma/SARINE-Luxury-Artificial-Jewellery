/**
 * Seed data for SARINE Indian artificial and fashion jewellery.
 * Contains 5 categories and 16 realistic products with no unverified claims.
 */

import { Product } from '../../types/product';
import { Category } from '../../types/category';

export const initialCategories: Category[] = [
  {
    id: 'cat-earrings',
    slug: 'earrings',
    name: 'Earrings',
    description: 'Statement jhumkas, chandelier drops, and minimalist everyday studs crafted for modern and traditional ensembles.',
    image: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=800&q=80',
    isActive: true,
    sortOrder: 1
  },
  {
    id: 'cat-necklaces',
    slug: 'necklaces',
    name: 'Necklaces',
    description: 'Festive chokers, layered chains, and heritage temple motifs designed to elevate neckline silhouettes.',
    image: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=800&q=80',
    isActive: true,
    sortOrder: 2
  },
  {
    id: 'cat-bracelets',
    slug: 'bracelets',
    name: 'Bracelets & Bangles',
    description: 'Delicate coin link bracelets, open filigree cuffs, and contemporary textured wristwear.',
    image: 'https://images.unsplash.com/photo-1611591475152-47eac98068c3?auto=format&fit=crop&w=800&q=80',
    isActive: true,
    sortOrder: 3
  },
  {
    id: 'cat-rings',
    slug: 'rings',
    name: 'Rings',
    description: 'Adjustable statement cocktail rings, geometric bands, and solitaire-inspired accents.',
    image: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=800&q=80',
    isActive: true,
    sortOrder: 4
  },
  {
    id: 'cat-sets',
    slug: 'sets',
    name: 'Jewellery Sets',
    description: 'Coordinated necklace and earring pairings created for festive celebrations and wedding gatherings.',
    image: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=800&q=80',
    isActive: true,
    sortOrder: 5
  }
];

export const initialProducts: Product[] = [
  {
    id: 'prod-001',
    slug: 'noor-crescent-kundan-choker',
    name: 'Noor Crescent Kundan Choker',
    description: 'A regal crescent silhouette adorned with faceted glass kundan settings, finished with clusters of ivory seed pearls and an adjustable zari drawstring cord.',
    shortDescription: 'Regal crescent choker with kundan-inspired motifs and pearl drops.',
    price: 1899,
    compareAtPrice: 2499,
    images: [
      'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1617038220319-276d3cfab638?auto=format&fit=crop&w=1000&q=80'
    ],
    categoryId: 'cat-necklaces',
    collectionSlugs: ['festive', 'heritage'],
    jewelleryType: 'necklace',
    stock: 14,
    status: 'active',
    createdAt: '2026-02-15T09:00:00.000Z',
    tags: ['choker', 'kundan', 'pearl', 'festive', 'wedding'],
    baseMetal: 'Brass alloy',
    platingFinish: 'Micron gold-tone plating',
    stoneType: 'Simulated glass kundan and faux pearls',
    closureType: 'Adjustable woven drawstring',
    careInstructions: ['Store in the provided velvet pouch', 'Avoid moisture, perfume, and hairspray', 'Wipe gently with a clean microfibre cloth']
  },
  {
    id: 'prod-002',
    slug: 'meera-polki-bell-jhumkas',
    name: 'Meera Polki Bell Jhumkas',
    description: 'Traditional bell jhumkas featuring floral stud caps and layered hanging bells trimmed with miniature pearl beads and champagne stone embellishments.',
    shortDescription: 'Floral-capped polki motif bell jhumkas with pearl tassels.',
    price: 1299,
    compareAtPrice: 1699,
    images: [
      'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1630019852942-f89202989a59?auto=format&fit=crop&w=1000&q=80'
    ],
    categoryId: 'cat-earrings',
    collectionSlugs: ['festive', 'heritage'],
    jewelleryType: 'earrings',
    stock: 20,
    status: 'active',
    createdAt: '2026-02-12T11:30:00.000Z',
    tags: ['jhumka', 'polki', 'earrings', 'festive', 'pearl'],
    baseMetal: 'Copper-brass alloy',
    platingFinish: 'Antique gold-tone lacquer',
    stoneType: 'Polki-inspired simulated crystals and faux pearls',
    closureType: 'Post and push back',
    careInstructions: ['Keep inside a dry compartment', 'Wipe with soft cloth after wearing']
  },
  {
    id: 'prod-003',
    slug: 'ananya-temple-coin-bracelet',
    name: 'Ananya Temple Coin Bracelet',
    description: 'Graceful link bracelet composed of embossed medallion coins inspired by South Indian temple architecture, linked with double jump rings and an extender chain.',
    shortDescription: 'Embossed medallion coin bracelet with extension links.',
    price: 899,
    images: [
      'https://images.unsplash.com/photo-1611591475152-47eac98068c3?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1573408301185-9146fe634ad0?auto=format&fit=crop&w=1000&q=80'
    ],
    categoryId: 'cat-bracelets',
    collectionSlugs: ['everyday', 'heritage'],
    jewelleryType: 'bracelet',
    stock: 18,
    status: 'active',
    createdAt: '2026-02-10T14:15:00.000Z',
    tags: ['bracelet', 'coin', 'temple', 'everyday'],
    baseMetal: 'Brass alloy',
    platingFinish: 'Matte gold-tone finish',
    closureType: 'Lobster claw with 3cm extender',
    careInstructions: ['Store flat in a dry pouch', 'Remove prior to bathing or exercising']
  },
  {
    id: 'prod-004',
    slug: 'gulabi-filigree-cocktail-ring',
    name: 'Gulabi Filigree Cocktail Ring',
    description: 'An openwork lotus filigree cocktail ring featuring a faceted ruby-toned glass centre stone flanked by pavé-set clear cubic zirconia.',
    shortDescription: 'Lotus filigree statement ring with simulated ruby centerpiece.',
    price: 749,
    compareAtPrice: 999,
    images: [
      'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1603561591411-07134e71a2a9?auto=format&fit=crop&w=1000&q=80'
    ],
    categoryId: 'cat-rings',
    collectionSlugs: ['festive', 'cocktail'],
    jewelleryType: 'ring',
    stock: 12,
    status: 'active',
    createdAt: '2026-02-08T16:00:00.000Z',
    tags: ['ring', 'filigree', 'cocktail', 'statement'],
    baseMetal: 'Brass alloy',
    platingFinish: 'Champagne gold-tone plating',
    stoneType: 'Faux ruby crystal and cubic zirconia',
    closureType: 'Adjustable comfort-fit band',
    careInstructions: ['Store individually to avoid surface scratches', 'Keep away from alcohol-based sanitizer']
  },
  {
    id: 'prod-005',
    slug: 'roshni-chandbali-statement-earrings',
    name: 'Roshni Chandbali Statement Earrings',
    description: 'Sculpted crescent moon chandbalis patterned with fine jaali work, suspended pearl drops, and delicate floral motifs at the lobe.',
    shortDescription: 'Crescent moon chandbali earrings with delicate jaali filigree.',
    price: 1499,
    compareAtPrice: 1999,
    images: [
      'https://images.unsplash.com/photo-1630019852942-f89202989a59?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=1000&q=80'
    ],
    categoryId: 'cat-earrings',
    collectionSlugs: ['festive', 'heritage'],
    jewelleryType: 'earrings',
    stock: 16,
    status: 'active',
    createdAt: '2026-02-06T10:00:00.000Z',
    tags: ['chandbali', 'earrings', 'jaali', 'pearl', 'festive'],
    baseMetal: 'Brass alloy',
    platingFinish: 'Gold-tone finish',
    stoneType: 'Cubic zirconia and synthetic seed pearls',
    closureType: 'Post back with push latch',
    careInstructions: ['Store in an airtight pouch', 'Avoid contact with liquids']
  },
  {
    id: 'prod-006',
    slug: 'sitara-minimalist-solitaire-studs',
    name: 'Sitara Minimalist Solitaire Studs',
    description: 'Classic round brilliant-cut simulated cubic zirconia stones set in four-prong basket mountings, sized for everyday elegance and subtle sparkle.',
    shortDescription: 'Four-prong round cubic zirconia everyday stud earrings.',
    price: 399,
    images: [
      'https://images.unsplash.com/photo-1588444837495-c6cfeb53f32d?auto=format&fit=crop&w=1000&q=80'
    ],
    categoryId: 'cat-earrings',
    collectionSlugs: ['everyday', 'minimalist'],
    jewelleryType: 'earrings',
    stock: 25,
    status: 'active',
    createdAt: '2026-02-04T08:30:00.000Z',
    tags: ['studs', 'solitaire', 'cz', 'everyday', 'minimalist'],
    baseMetal: 'Brass alloy',
    platingFinish: 'Rhodium-tone silver finish',
    stoneType: 'Faceted cubic zirconia (6mm diameter)',
    closureType: 'Post with butterfly back',
    careInstructions: ['Wipe clean with a dry lens cloth', 'Store in a jewelry box']
  },
  {
    id: 'prod-007',
    slug: 'kavya-layered-pearl-festive-necklace',
    name: 'Kavya Layered Pearl Festive Necklace',
    description: 'Triple strand glass pearl necklace structured with an ornate side brooch fixture set in champagne stones and emerald-toned faux accents.',
    shortDescription: 'Triple-strand glass pearl necklace with an ornate side brooch.',
    price: 2199,
    compareAtPrice: 2499,
    images: [
      'https://images.unsplash.com/photo-1599643477877-530eb83abc8e?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=1000&q=80'
    ],
    categoryId: 'cat-necklaces',
    collectionSlugs: ['festive', 'heritage'],
    jewelleryType: 'necklace',
    stock: 7,
    status: 'active',
    createdAt: '2026-02-02T13:45:00.000Z',
    tags: ['pearl', 'necklace', 'layered', 'festive', 'emerald'],
    baseMetal: 'Mixed brass findings',
    platingFinish: 'Vintage gold tone',
    stoneType: 'Simulated glass pearls and crystals',
    closureType: 'Fishhook clasp with safety catch',
    careInstructions: ['Store laid flat to prevent thread stretching', 'Do not submerge in water']
  },
  {
    id: 'prod-008',
    slug: 'zoya-open-cuff-leaf-bangle',
    name: 'Zoya Open Cuff Leaf Bangle',
    description: 'Hand-carved botanical leaf engravings along a sleek curved cuff, finished with rounded ball terminals for smooth wear and easy adjustment.',
    shortDescription: 'Engraved botanical open cuff bangle with smooth terminal ends.',
    price: 999,
    compareAtPrice: 1299,
    images: [
      'https://images.unsplash.com/photo-1611591475152-47eac98068c3?auto=format&fit=crop&w=1000&q=80'
    ],
    categoryId: 'cat-bracelets',
    collectionSlugs: ['everyday', 'botanical'],
    jewelleryType: 'bracelet',
    stock: 15,
    status: 'active',
    createdAt: '2026-01-30T17:10:00.000Z',
    tags: ['cuff', 'bangle', 'leaf', 'botanical', 'gold'],
    baseMetal: 'Brass alloy',
    platingFinish: 'Matte champagne gold-tone',
    closureType: 'Flexible open cuff (fits wrists 5.5 to 7 inches)',
    careInstructions: ['Gently flex when putting on; avoid severe bending', 'Store in pouch']
  },
  {
    id: 'prod-009',
    slug: 'tara-geometric-stacking-ring-set',
    name: 'Tara Geometric Stacking Ring Set',
    description: 'Set of two harmonizing slender bands: one carved with chevron notches and the other set with miniature pavé cubic zirconia.',
    shortDescription: 'Duo of chevron textured and pavé cubic zirconia stacking rings.',
    price: 599,
    images: [
      'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=1000&q=80'
    ],
    categoryId: 'cat-rings',
    collectionSlugs: ['everyday', 'minimalist'],
    jewelleryType: 'ring',
    stock: 22,
    status: 'active',
    createdAt: '2026-01-28T11:00:00.000Z',
    tags: ['ring', 'stacking', 'minimalist', 'geometric', 'cz'],
    baseMetal: 'Brass alloy',
    platingFinish: 'Champagne gold-tone',
    stoneType: 'Cubic zirconia',
    closureType: 'Fixed ring band (standard size 7)',
    careInstructions: ['Avoid exposure to harsh chemicals', 'Wipe with dry cloth']
  },
  {
    id: 'prod-010',
    slug: 'samara-royal-kundan-jewellery-set',
    name: 'Samara Royal Kundan Jewellery Set',
    description: 'A curated wedding celebration set comprising a choker necklace with emerald-toned simulated drop beads, matching dome jhumkas, and a delicate maang tikka.',
    shortDescription: 'Matching festive kundan choker, bell jhumkas, and tikka set.',
    price: 2499,
    compareAtPrice: 3199,
    images: [
      'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=1000&q=80'
    ],
    categoryId: 'cat-sets',
    collectionSlugs: ['festive', 'bridal', 'heritage'],
    jewelleryType: 'set',
    stock: 9,
    status: 'active',
    createdAt: '2026-01-25T15:20:00.000Z',
    tags: ['set', 'kundan', 'bridal', 'jhumka', 'necklace', 'festive'],
    baseMetal: 'High-density brass alloy',
    platingFinish: '22k tone micron plating',
    stoneType: 'Simulated glass kundan, faux pearls, green teardrops',
    closureType: 'Necklace: adjustable dori; Earrings: post back',
    careInstructions: ['Store components wrapped separately in tissue inside box', 'Keep away from moisture']
  },
  {
    id: 'prod-011',
    slug: 'aarohi-delicate-solitaire-pendant',
    name: 'Aarohi Delicate Solitaire Pendant',
    description: 'A fine cable chain suspending a floating cushion-cut simulated solitaire diamond in a bezel setting, subtle and versatile for daily styling.',
    shortDescription: 'Floating cushion-cut simulated solitaire pendant on cable chain.',
    price: 499,
    compareAtPrice: 699,
    images: [
      'https://images.unsplash.com/photo-1599643477877-530eb83abc8e?auto=format&fit=crop&w=1000&q=80'
    ],
    categoryId: 'cat-necklaces',
    collectionSlugs: ['everyday', 'minimalist'],
    jewelleryType: 'necklace',
    stock: 30,
    status: 'active',
    createdAt: '2026-01-22T09:15:00.000Z',
    tags: ['pendant', 'necklace', 'minimalist', 'solitaire', 'everyday'],
    baseMetal: 'Brass alloy',
    platingFinish: 'Warm gold-tone finish',
    stoneType: 'Faceted cubic zirconia',
    closureType: 'Spring ring clasp with 5cm extension',
    careInstructions: ['Store hung or in pouch to avoid chain knotting', 'Dry immediately if exposed to water']
  },
  {
    id: 'prod-012',
    slug: 'divya-fluted-dome-cocktail-ring',
    name: 'Divya Fluted Dome Cocktail Ring',
    description: 'An architectural fluted dome cocktail ring with radiating polished ribs and a smooth satin inner band for all-day comfort.',
    shortDescription: 'Architectural fluted dome cocktail ring with satin finish.',
    price: 649,
    images: [
      'https://images.unsplash.com/photo-1603561591411-07134e71a2a9?auto=format&fit=crop&w=1000&q=80'
    ],
    categoryId: 'cat-rings',
    collectionSlugs: ['everyday', 'cocktail'],
    jewelleryType: 'ring',
    stock: 14,
    status: 'active',
    createdAt: '2026-01-20T12:00:00.000Z',
    tags: ['ring', 'dome', 'gold', 'cocktail', 'modern'],
    baseMetal: 'Brass alloy',
    platingFinish: 'Polished gold-tone',
    closureType: 'Semi-adjustable inner shank (fits sizes 6-8)',
    careInstructions: ['Store in provided pouch', 'Wipe with soft cloth after use']
  },
  {
    id: 'prod-013',
    slug: 'leela-pearl-cluster-earrings',
    name: 'Leela Pearl Cluster Earrings',
    description: 'Petite stud earrings blossoming into a floral bunch of faux rice pearls gathered around a central champagne crystal.',
    shortDescription: 'Floral cluster faux rice pearl and champagne crystal stud earrings.',
    price: 299,
    compareAtPrice: 399,
    images: [
      'https://images.unsplash.com/photo-1588444837495-c6cfeb53f32d?auto=format&fit=crop&w=1000&q=80'
    ],
    categoryId: 'cat-earrings',
    collectionSlugs: ['everyday', 'botanical'],
    jewelleryType: 'earrings',
    stock: 28,
    status: 'active',
    createdAt: '2026-01-18T10:30:00.000Z',
    tags: ['earrings', 'pearl', 'stud', 'floral', 'everyday'],
    baseMetal: 'Brass alloy',
    platingFinish: 'Gold-tone finish',
    stoneType: 'Simulated rice pearls and glass crystal',
    closureType: 'Push back',
    careInstructions: ['Store dry in cotton pouch', 'Wipe gently']
  },
  // 1 Archived Product (tests includeAll flag)
  {
    id: 'prod-014',
    slug: 'guttapusalu-heritage-choker-archived',
    name: 'Guttapusalu Heritage Festive Choker',
    description: 'Traditional heritage choker strung with rich fringe clusters of faux pearls and rubies. Currently archived in catalog.',
    shortDescription: 'Heritage guttapusalu choker with pearl fringe clusters.',
    price: 2299,
    images: [
      'https://images.unsplash.com/photo-1617038220319-276d3cfab638?auto=format&fit=crop&w=1000&q=80'
    ],
    categoryId: 'cat-necklaces',
    collectionSlugs: ['heritage'],
    jewelleryType: 'necklace',
    stock: 0,
    status: 'archived',
    createdAt: '2025-11-10T10:00:00.000Z',
    tags: ['choker', 'archived', 'heritage', 'guttapusalu'],
    baseMetal: 'Copper alloy',
    platingFinish: 'Antique gold-tone',
    closureType: 'Drawstring cord',
    careInstructions: ['Archived reference item']
  },
  // 2 Draft Products (tests includeAll flag)
  {
    id: 'prod-015',
    slug: 'maya-peacock-meenakari-cuff-draft',
    name: 'Maya Peacock Motif Enamel Cuff',
    description: 'Open cuff bangle showcasing hand-painted royal blue and teal meenakari enamel peacock motifs. Currently in drafting stage for upcoming collection.',
    shortDescription: 'Meenakari enamel peacock cuff in development.',
    price: 1349,
    compareAtPrice: 1799,
    images: [
      'https://images.unsplash.com/photo-1573408301185-9146fe634ad0?auto=format&fit=crop&w=1000&q=80'
    ],
    categoryId: 'cat-bracelets',
    collectionSlugs: ['festive', 'draft'],
    jewelleryType: 'bracelet',
    stock: 5,
    status: 'draft',
    createdAt: '2026-02-18T08:00:00.000Z',
    tags: ['cuff', 'enamel', 'meenakari', 'peacock', 'draft'],
    baseMetal: 'Brass alloy',
    platingFinish: 'Gold-tone with enamel filling',
    closureType: 'Open cuff',
    careInstructions: ['Draft catalogue sample']
  },
  {
    id: 'prod-016',
    slug: 'neelam-floral-halo-ring-draft',
    name: 'Neelam Sapphire-Tone Halo Ring',
    description: 'Cocktail ring featuring an oval faux sapphire blue crystal framed by a micropavé halo of clear cubic zirconia. In design review.',
    shortDescription: 'Oval blue crystal cocktail ring with micropavé halo.',
    price: 799,
    images: [
      'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=1000&q=80'
    ],
    categoryId: 'cat-rings',
    collectionSlugs: ['cocktail', 'draft'],
    jewelleryType: 'ring',
    stock: 10,
    status: 'draft',
    createdAt: '2026-02-18T09:00:00.000Z',
    tags: ['ring', 'sapphire', 'halo', 'cocktail', 'draft'],
    baseMetal: 'Brass alloy',
    platingFinish: 'Silver-rhodium tone',
    closureType: 'Adjustable band',
    careInstructions: ['Draft catalogue sample']
  }
];
