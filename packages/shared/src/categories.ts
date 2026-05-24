import type { ListingCategory } from "./types";

export const CATEGORY_LABELS: Record<ListingCategory, string> = {
  furniture: "Furniture",
  electronics: "Electronics",
  appliance: "Appliances",
  tools: "Tools",
  fitness: "Fitness Equipment",
  home_goods: "Home Goods",
  outdoor: "Outdoor",
  other: "Other",
};

export const CATEGORY_ICONS: Record<ListingCategory, string> = {
  furniture: "sofa-outline",
  electronics: "cellphone",
  appliance: "fridge-outline",
  tools: "tools",
  fitness: "dumbbell",
  home_goods: "lamp",
  outdoor: "grill-outline",
  other: "package-variant",
};

// MVP target tiers from the market analysis spreadsheet
export const TIER_1_CATEGORIES: ListingCategory[] = [
  "furniture",
  "appliance",
  "electronics",
];
