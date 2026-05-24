# Data Model

All tables live in the `public` schema. Every table has `id uuid pk`, `created_at`, `updated_at` (where mutable). All migrations are versioned in `supabase/migrations/`.

## Core tables

| Table | Purpose | Key columns |
|---|---|---|
| `profiles` | One per `auth.users` row. Public profile + reputation. | `home_point` (private), `home_h3_r8`, `trust_score`, `trust_tier`, `stripe_account_id` |
| `listings` | Items for sale. | `pickup_point` (private), `pickup_h3_r8`, `status`, `ask_price`, `min_bid`, `buy_now_price` |
| `listing_media` | Photos in R2. | `r2_key`, `display_order`, `ai_safe` |
| `bids` | One active bid per buyer per listing. | `amount`, `status`, `expires_at` |
| `threads` | Listing-scoped chat between seller and one buyer. | `state`, `unread_seller`, `unread_buyer` |
| `messages` | Redacted message bodies. | `body_clean`, `redactions`, `flagged` |
| `messages_audit` | Original message bodies, 30-day TTL. | `body_raw`, `purge_after` |
| `transactions` | Escrow lifecycle. | `state`, `gross_amount`, `platform_fee_amount`, `meet_otp` |
| `ratings` | Two-sided ratings with blind reveal. | `stars`, `tags`, `is_visible` |
| `rating_tags` | Allowed tags + polarity. | `tag`, `polarity` |
| `trust_events` | Audit trail for reputation score deltas. | `event_type`, `delta` |
| `reports` | Abuse reports. | `target_kind`, `target_id`, `status` |
| `device_fingerprints` | Sybil defense. | `fp_hash`, `ip_inet` |

## RPCs (PostgREST-exposed)

| RPC | Caller | Returns |
|---|---|---|
| `listings_feed(viewer_lat, viewer_lng, ...)` | authenticated | Active listings within radius with **distance + H3 only**, never coords. |
| `create_listing(...)` | authenticated | New listing id; server stamps `pickup_point`. |
| `place_bid(listing_id, amount, message, is_buy_now)` | authenticated | Bid id; atomically marks lower bids outbid and opens thread. |
| `accept_bid(bid_id)` | seller | Transaction id; creates pending tx with fee-tier pricing. |
| `confirm_pickup(tx_id, otp)` | seller or buyer | New tx state; releases funds once both confirm. |
| `submit_rating(tx_id, stars, tags, comment)` | seller or buyer | Rating id; auto-reveals when both sides have rated. |
| `recalc_trust_score(profile_id)` | service-role (or self via Edge Function) | New trust score; updates denormalized fields on `profiles`. |
| `decode_pickup_point(listing_id)` | service-role only | `(lat, lng)` for the `reveal-address` Edge Function. |

## Cron jobs (pg_cron)

| Job | Schedule | What it does |
|---|---|---|
| `recalc-trust-nightly` | `0 4 * * *` | Recompute trust scores for all non-banned profiles. |
| `expire-bids` | `*/15 * * * *` | Set `bids.status = 'expired'` past `expires_at`. |
| `expire-listings` | `0 * * * *` | Set `listings.status = 'expired'` past `expires_at`. |
| `purge-audits` | `30 4 * * *` | Delete `messages_audit` rows past `purge_after`. |
| `auto-reveal-ratings` | `0 5 * * *` | Flip stale unrevealed ratings visible after 7 days. |

## RLS summary

| Table | Read | Write |
|---|---|---|
| `profiles` | Self only (use `public_profiles` view for others) | Self |
| `listings` | Anyone, when status = active; owner sees own drafts | Owner |
| `bids` | Buyer (own) + seller (on own listings) | Buyer inserts/withdraws; accepting via RPC |
| `threads` | Participants | Participants |
| `messages` | Participants | **No direct insert** — only via `redact-message` Edge Function |
| `messages_audit` | None (service role only) | None |
| `transactions` | Participants | Via RPCs / Edge Functions only |
| `ratings` | Visible or own | Self |
| `trust_events` | Self | Service role only |
| `reports` | Self | Self insert |

See `supabase/migrations/20260101000600_rls.sql` for full policy definitions.
