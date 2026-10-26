import type { ListingCategory } from "./types";

/**
 * TrunkJunk junk-type taxonomy.
 *
 * Sellers pick ONE category. Each category has a clear definition,
 * example items, and detection keywords used by:
 *   - the Create Listing screen (helper text + smart-suggest)
 *   - the redact-message Edge Function (off-platform context)
 *   - moderation (mis-categorization flags)
 */

export const CATEGORY_LABELS: Record<ListingCategory, string> = {
  standard: "Standard Junk",
  scrap: "Scrap Junk",
  parts: "Parts Junk",
  electronics: "Electronics Junk",
  household: "Household Junk",
};

export const CATEGORY_ICONS: Record<ListingCategory, string> = {
  standard: "package-variant",
  scrap: "scale-balance",
  parts: "cog-outline",
  electronics: "power-plug",
  household: "home-outline",
};

export const CATEGORY_SHORT: Record<ListingCategory, string> = {
  standard: "Whole, usable items in fair-to-good shape.",
  scrap: "Items valued for the metal/material that can be recycled.",
  parts: "Broken or incomplete items kept for harvestable parts.",
  electronics: "Anything that plugs in or runs on batteries.",
  household: "Everyday house items — décor, kitchenware, textiles.",
};

export interface CategoryDef {
  id: ListingCategory;
  label: string;
  icon: string;
  /** One-line tagline for the picker. */
  short: string;
  /** Long-form definition shown when seller taps "What goes here?" */
  description: string;
  /** Examples shown as chips on the picker. */
  examples: string[];
  /** Things that DO NOT belong (shown as warnings). */
  excludes: string[];
  /** Lowercase keywords used to auto-suggest this category from title/description. */
  keywords: string[];
  /** Whether listing should require weight (lbs) in addition to / instead of price. */
  weightRequired?: boolean;
  /** Whether photos must show a model/serial sticker (helps buyers vet electronics). */
  requireSerialPhoto?: boolean;
}

export const CATEGORIES: Record<ListingCategory, CategoryDef> = {
  standard: {
    id: "standard",
    label: "Standard Junk",
    icon: "package-variant",
    short: "Whole, usable items in fair-to-good shape.",
    description:
      "Intact items someone would buy and use as-is. No power required, no major damage. If it works the way it's supposed to and looks presentable, list it here.",
    examples: [
      "Coffee table",
      "Bookshelf",
      "Dresser",
      "Office chair",
      "Bike",
      "Patio set",
      "Mirror",
      "Area rug",
    ],
    excludes: [
      "Anything that plugs in (use Electronics)",
      "Broken-but-useful-for-parts items (use Parts)",
    ],
    keywords: [
      "table", "chair", "desk", "shelf", "bookcase", "dresser", "couch", "sofa",
      "bed frame", "mattress", "nightstand", "bike", "bicycle", "rug", "mirror",
      "lamp base", "patio", "wardrobe", "armoire", "ottoman", "stool",
    ],
  },

  scrap: {
    id: "scrap",
    label: "Scrap Junk",
    icon: "scale-balance",
    short: "Items valued for the metal/material that can be recycled.",
    description:
      "Items priced by weight or recyclable material, not by function. Copper wire, aluminum siding, steel rebar, brass fixtures, catalytic converters, old radiators — anything a scrap yard pays for. Buyers here are usually scrappers and metal recyclers.",
    examples: [
      "Copper pipe / wire",
      "Aluminum cans / siding",
      "Steel / iron",
      "Brass fittings",
      "Stainless sinks",
      "Old radiators",
      "Lead",
      "Cast iron tubs",
    ],
    excludes: [
      "Working appliances (use Electronics or Household)",
      "Items priced for resale, not weight (use Standard or Parts)",
    ],
    keywords: [
      "scrap", "copper", "aluminum", "brass", "steel", "iron", "lead", "tin",
      "stainless", "cast iron", "rebar", "wire", "pipe", "radiator", "metal",
      "catalytic", "lbs", "per pound", "by weight", "recycle",
    ],
    weightRequired: true,
  },

  parts: {
    id: "parts",
    label: "Parts Junk",
    icon: "cog-outline",
    short: "Broken or incomplete items kept for harvestable parts.",
    description:
      "Items that don't fully work but contain valuable components a buyer can pull. Engines, transmissions, broken appliances with good compressors, dead laptops with intact screens, bike frames missing wheels. Sellers must clearly state what's broken and what's salvageable.",
    examples: [
      "Engine block",
      "Transmission",
      "Broken washer (good motor)",
      "Dead laptop (screen ok)",
      "Frame-only bike",
      "Donor furniture (good hardware)",
      "Sewing machine for parts",
    ],
    excludes: [
      "Fully working items (use the matching category)",
      "Pure metal scrap with no usable parts (use Scrap)",
    ],
    keywords: [
      "parts only", "for parts", "donor", "salvage", "rebuild", "core", "broken",
      "not working", "as-is", "engine", "transmission", "compressor", "motor only",
      "no power", "doesn't turn on", "missing", "incomplete",
    ],
  },

  electronics: {
    id: "electronics",
    label: "Electronics Junk",
    icon: "power-plug",
    short: "Anything that plugs in or runs on batteries.",
    description:
      "Any item that requires a power source — wall plug, battery, solar — to function. Includes working and broken electronics. TVs, computers, phones, power tools, gaming consoles, kitchen small-appliances, hairdryers, e-bikes, drones, smart-home devices. Listings should include a photo of the model/serial sticker when possible.",
    examples: [
      "TV / monitor",
      "Laptop / desktop",
      "Phone / tablet",
      "Game console",
      "Power tool (battery or corded)",
      "Microwave / air fryer",
      "Vacuum",
      "E-bike / scooter",
      "Speakers / soundbar",
    ],
    excludes: [
      "Battery-dead-but-priced-for-parts items (use Parts)",
      "Pure metal value with no working components (use Scrap)",
    ],
    keywords: [
      "tv", "television", "monitor", "laptop", "desktop", "pc", "computer",
      "phone", "iphone", "android", "tablet", "ipad", "console", "ps5", "ps4",
      "xbox", "nintendo", "switch", "drill", "saw", "power tool", "battery",
      "charger", "speaker", "soundbar", "headphones", "earbuds", "camera",
      "drone", "printer", "router", "microwave", "air fryer", "blender",
      "toaster", "vacuum", "robot", "smart", "alexa", "echo", "watt", "volt",
      "lithium", "rechargeable", "plug", "cord", "corded", "cordless",
    ],
    requireSerialPhoto: true,
  },

  household: {
    id: "household",
    label: "Household Junk",
    icon: "home-outline",
    short: "Everyday house items — décor, kitchenware, textiles.",
    description:
      "Non-powered home items used day-to-day. Pots and pans, dishes, linens, decor, small furniture pieces, hand tools, garden items, books in bulk. If it lives inside a house and doesn't plug in, this is usually the right home.",
    examples: [
      "Pots and pans set",
      "Dish set",
      "Bedding / linens",
      "Curtains",
      "Wall art / frames",
      "Hand tools",
      "Garden pots",
      "Books (bulk)",
      "Holiday decor",
    ],
    excludes: [
      "Anything powered (use Electronics)",
      "Major furniture pieces (use Standard)",
    ],
    keywords: [
      "pots", "pans", "dishes", "plates", "silverware", "cutlery", "linens",
      "sheets", "comforter", "blanket", "towels", "curtains", "decor",
      "frame", "art", "vase", "candle", "books", "garden", "planter",
      "hand tool", "hammer", "screwdriver", "wrench", "kitchen", "bath",
    ],
  },
};

export const CATEGORY_ORDER: ListingCategory[] = [
  "standard",
  "electronics",
  "household",
  "parts",
  "scrap",
];

// MVP target tiers from the market analysis spreadsheet —
// the highest-margin junk types on the resale side.
export const TIER_1_CATEGORIES: ListingCategory[] = [
  "electronics",
  "standard",
  "parts",
];

/**
 * Heuristically suggest a category from free-text title + description.
 * Returns the best match or null if no keyword matches.
 * The mobile create-listing screen uses this to pre-select the picker.
 */
export function suggestCategory(text: string): ListingCategory | null {
  const t = text.toLowerCase();
  let best: { id: ListingCategory; score: number } | null = null;
  for (const cat of Object.values(CATEGORIES)) {
    let score = 0;
    for (const kw of cat.keywords) {
      // word-ish boundary so "tv" doesn't match "tvilight"
      const re = new RegExp(`(^|[^a-z])${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`, "i");
      if (re.test(t)) score += 1;
    }
    if (score > 0 && (!best || score > best.score)) best = { id: cat.id, score };
  }
  return best?.id ?? null;
}

export function getCategoryDef(id: ListingCategory): CategoryDef {
  return CATEGORIES[id];
}
