import { z } from "zod";

export const ListingCategory = z.enum([
  "standard",
  "scrap",
  "parts",
  "electronics",
  "household",
]);
export type ListingCategory = z.infer<typeof ListingCategory>;

export const ListingCondition = z.enum(["new", "like_new", "good", "fair", "parts"]);
export type ListingCondition = z.infer<typeof ListingCondition>;

export const ListingStatus = z.enum([
  "draft",
  "active",
  "pending_pickup",
  "sold",
  "cancelled",
  "flagged",
  "expired",
]);
export type ListingStatus = z.infer<typeof ListingStatus>;

export const TrustTier = z.enum(["new", "bronze", "silver", "gold", "platinum"]);
export type TrustTier = z.infer<typeof TrustTier>;

export const Listing = z.object({
  id: z.string().uuid(),
  seller_id: z.string().uuid(),
  seller_name: z.string().optional(),
  seller_tier: TrustTier.optional(),
  seller_rating: z.number().nullable().optional(),
  title: z.string(),
  category: ListingCategory,
  condition: ListingCondition,
  ask_price: z.number().nullable(),
  min_bid: z.number().nullable(),
  buy_now_price: z.number().nullable(),
  thumbnail_key: z.string().nullable(),
  distance_mi: z.number().nullable().optional(),
  bid_count: z.number(),
  view_count: z.number(),
  created_at: z.string(),
});
export type Listing = z.infer<typeof Listing>;

export const CreateListingInput = z.object({
  title: z.string().min(4).max(80),
  description: z.string().min(10).max(4000),
  category: ListingCategory,
  condition: ListingCondition,
  ask_price: z.number().nonnegative().nullable(),
  min_bid: z.number().nonnegative().nullable(),
  buy_now_price: z.number().nonnegative().nullable(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  weight_lbs: z.number().int().nonnegative().optional(),
});
export type CreateListingInput = z.infer<typeof CreateListingInput>;

export const Bid = z.object({
  id: z.string().uuid(),
  listing_id: z.string().uuid(),
  buyer_id: z.string().uuid(),
  amount: z.number(),
  status: z.enum(["active", "accepted", "rejected", "withdrawn", "expired", "outbid"]),
  expires_at: z.string(),
  message: z.string().nullable(),
  is_buy_now: z.boolean(),
  created_at: z.string(),
});
export type Bid = z.infer<typeof Bid>;

export const Message = z.object({
  id: z.string().uuid(),
  thread_id: z.string().uuid(),
  sender_id: z.string().uuid(),
  body_clean: z.string(),
  flagged: z.boolean(),
  created_at: z.string(),
});
export type Message = z.infer<typeof Message>;

export const Profile = z.object({
  id: z.string().uuid(),
  display_name: z.string(),
  avatar_url: z.string().nullable(),
  trust_tier: TrustTier,
  trust_score: z.number().int().min(0).max(100).optional(),
  seller_rating: z.number().nullable(),
  buyer_rating: z.number().nullable(),
  seller_tx_count: z.number(),
  buyer_tx_count: z.number(),
  phone_verified: z.boolean(),
  email_verified: z.boolean(),
  id_verified: z.boolean(),
});
export type Profile = z.infer<typeof Profile>;
