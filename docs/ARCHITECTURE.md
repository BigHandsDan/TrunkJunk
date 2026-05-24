# Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                  React Native (Expo) App                      │
│   Seller mode  ⇄  Buyer mode  (single user, role toggle)     │
└──────────────────────────────────────────────────────────────┘
        │ HTTPS              │ WebSocket          │ HTTPS
        ▼                    ▼                    ▼
┌──────────────┐    ┌────────────────┐    ┌──────────────────┐
│  Supabase    │    │   Supabase     │    │  Cloudflare R2   │
│  PostgREST   │    │   Realtime     │    │  + Images CDN    │
└──────┬───────┘    └────────┬───────┘    └──────────────────┘
       ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│      Postgres 15 + PostGIS + RLS + pg_cron                  │
│  profiles · listings · bids · threads · messages · ratings  │
│  transactions · trust_events · reports · device_fingerprints│
└─────────────────────────────────────────────────────────────┘
       ▼
┌──────────────────┐  ┌────────────────┐  ┌─────────────────┐
│  Edge Functions  │  │ Stripe Connect │  │ Twilio · Expo   │
│  redact-message  │  │ create-payment │  │ Push · Sentry   │
│  recalc-trust    │  │ stripe-webhook │  │ PostHog         │
│  reveal-address  │  │                │  │                 │
│  expire-bids     │  │                │  │                 │
└──────────────────┘  └────────────────┘  └─────────────────┘
```

## Request paths

### Browsing the feed
1. Client calls `supabase.rpc('listings_feed', { viewer_lat, viewer_lng, ... })`.
2. Postgres `security definer` function returns active listings within radius, with **distance snapped to 0.1 mi** and H3 hex string only — never raw coords.

### Creating a listing
1. Client uploads photos to R2 via signed URLs (or Supabase Storage in dev).
2. Client calls `rpc('create_listing', { lat, lng, h3_r8, ... })`.
3. Server validates ranges, computes H3 in-app, stores `geography(point)` + cell.

### Placing a bid
1. `rpc('place_bid', ...)` — atomic: marks any lower active bids `outbid`, withdraws caller's prior bid, opens or updates `threads` row.
2. Realtime channel notifies seller.

### Accepting a bid → escrow → pickup
1. Seller calls `rpc('accept_bid', bid_id)` → creates `transactions` row in `pending`, computes fee based on `trust_tier`.
2. Buyer client calls Edge Function `create-payment-intent` → Stripe Connect destination charge.
3. Stripe webhook `payment_intent.succeeded` → tx state `escrowed` → address-reveal Edge Function unlocks address + OTP.
4. Both parties enter OTP via `rpc('confirm_pickup', tx_id, otp)`. When both confirm: tx state `released`, listing `sold`, Stripe transfer fires automatically (destination charge).
5. T+2h push notification: rate the other party. `rpc('submit_rating', ...)` writes hidden rating; trigger flips both visible once both sides rated.

### Messaging
1. Client invokes Edge Function `redact-message`. Direct INSERT on `messages` is **blocked by RLS** (no policy granted).
2. Function applies regex pass, optional LLM pass, blocks off-platform payment keywords.
3. Persists `body_clean` to `messages` and `body_raw` to `messages_audit` (30-day TTL).
4. Realtime broadcasts to thread participants.

## Why these choices

- **Postgres + PostGIS** is the cheapest path to credible geo without standing up Elasticsearch.
- **RLS** turns nearly every authorization check into a single declarative SQL policy. Easier to audit than imperative middleware.
- **Edge Functions** run only the few flows that must use service-role privileges (redact, reveal, Stripe webhook).
- **Stripe Connect with destination charges** keeps you off the hook for KYC and 1099-K issuance on high-volume sellers.

See [DATA_MODEL.md](DATA_MODEL.md) for full schema, [SECURITY.md](SECURITY.md) for the privacy model.
