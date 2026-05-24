import type { ListingCategory, TrustTier } from "./types";

export const TIER_LABELS: Record<TrustTier, string> = {
  new: "New",
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  platinum: "Platinum",
};

export const TIER_COLORS: Record<TrustTier, string> = {
  new: "#7A7974",
  bronze: "#A84B2F",
  silver: "#9BA1A6",
  gold: "#D19900",
  platinum: "#01696F",
};

export const TIER_FEE_BPS: Record<TrustTier, number> = {
  new: 800,
  bronze: 800,
  silver: 700,
  gold: 600,
  platinum: 500,
};

/**
 * Per-category fee adjustments (basis points, applied as deltas to the tier fee).
 * Negative values = discount (attract supply/demand in that category).
 *
 *   scrap:       -200 bps (6.0% for new sellers, 3.0% for platinum) — scrapper margins are thin
 *   parts:       -100 bps — encourage rather-than-trash listings
 *   household:   -100 bps — high volume, low ticket
 *   electronics: +0     — base rate, highest realized GMV per listing
 *   standard:    +0     — base rate
 *
 * Floor enforced at 250 bps so we never go below cost-of-payments.
 */
export const CATEGORY_FEE_DELTA_BPS: Record<ListingCategory, number> = {
  standard: 0,
  electronics: 0,
  household: -100,
  parts: -100,
  scrap: -200,
};

export const MIN_FEE_BPS = 250;

export function effectiveFeeBps(tier: TrustTier, category: ListingCategory): number {
  const base = TIER_FEE_BPS[tier];
  const delta = CATEGORY_FEE_DELTA_BPS[category];
  return Math.max(MIN_FEE_BPS, base + delta);
}

export function feePct(tier: TrustTier, category?: ListingCategory): string {
  const bps = category ? effectiveFeeBps(tier, category) : TIER_FEE_BPS[tier];
  return `${(bps / 100).toFixed(1)}%`;
}

export function scoreToTier(score: number): TrustTier {
  if (score >= 80) return "platinum";
  if (score >= 60) return "gold";
  if (score >= 40) return "silver";
  if (score >= 20) return "bronze";
  return "new";
}
