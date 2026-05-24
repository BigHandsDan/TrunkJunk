-- =============================================================================
-- Enums
-- =============================================================================
create type listing_category as enum (
  'furniture', 'electronics', 'appliance', 'tools',
  'fitness', 'home_goods', 'outdoor', 'other'
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
