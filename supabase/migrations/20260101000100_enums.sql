-- =============================================================================
-- Enums
-- =============================================================================
-- Junk-type taxonomy. See packages/shared/src/categories.ts for full definitions,
-- example items, and detection keywords.
--   standard    -- whole, usable items in fair-to-good shape
--   scrap       -- items valued for recyclable metal/material (priced by weight)
--   parts       -- broken/incomplete items kept for harvestable components
--   electronics -- anything that plugs in or runs on batteries
--   household   -- everyday non-powered house items (kitchenware, textiles, decor)
create type listing_category as enum (
  'standard', 'scrap', 'parts', 'electronics', 'household'
);

create type listing_condition as enum (
  'new', 'like_new', 'good', 'fair', 'parts'
);

create type listing_status as enum (
  'draft', 'active', 'pending_pickup', 'sold', 'cancelled', 'flagged', 'expired'
);

create type bid_status as enum (
  'active', 'accepted', 'rejected', 'withdrawn', 'expired', 'outbid'
);

create type thread_state as enum (
  'open', 'escrowed', 'completed', 'disputed', 'closed'
);

create type transaction_state as enum (
  'pending', 'escrowed', 'released', 'refunded', 'disputed', 'cancelled'
);

create type trust_tier as enum (
  'new', 'bronze', 'silver', 'gold', 'platinum'
);

create type trust_event_type as enum (
  'tx_completed', 'rating_received', 'phone_verified', 'email_verified',
  'id_verified', 'dispute_won', 'dispute_lost', 'flag_upheld',
  'cancellation', 'first_rating_bonus', 'streak_bonus', 'referral_bonus'
);
