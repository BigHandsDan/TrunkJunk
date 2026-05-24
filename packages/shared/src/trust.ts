import type { TrustTier } from "./types";

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

export function feePct(tier: TrustTier): string {
  return `${(TIER_FEE_BPS[tier] / 100).toFixed(1)}%`;
}

export function scoreToTier(score: number): TrustTier {
  if (score >= 80) return "platinum";
  if (score >= 60) return "gold";
  if (score >= 40) return "silver";
  if (score >= 20) return "bronze";
  return "new";
}
