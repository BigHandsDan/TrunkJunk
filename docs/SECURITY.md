# Security & Privacy

## Distance-only geo privacy

| Stage | Buyer sees | Seller sees | Server has |
|---|---|---|---|
| Browsing feed | Distance (snapped 0.1 mi) + H3 hex on map | — | True point |
| Listing detail | Same | — | True point |
| Bid placed | Same | Buyer's H3 hex + distance | Both true points |
| Bid accepted, escrow funded | **Real address** + OTP | **Real address** + OTP | Both + reveal event logged |
| Post-pickup | Address hidden | Address hidden | Retained 90 days |

### How it's enforced

1. **`pickup_point` column** is `geography(point, 4326)`. **No view or RPC exposes it.** Even RLS would be insufficient — we never select it into a return type.
2. **`listings_feed` RPC** is `security definer` and returns only the snapped distance + H3 cell.
3. **`decode_pickup_point` function** is the only path to raw coords. It is **revoked** from `anon` and `authenticated` and grantable only via service role.
4. **`reveal-address` Edge Function** uses the service role and refuses to return coords unless caller is a party to the transaction AND `state = 'escrowed'`. Logs every reveal to `transactions.pickup_address_revealed_at`.
5. **Rate limits** — feed RPC limited to 120 calls/min per user to prevent triangulation attacks.

## Messaging — PII redaction

Direct `INSERT` on `messages` is **blocked by RLS** (we deliberately do not create an insert policy for normal users). The only path is the `redact-message` Edge Function:

1. Regex pass — phone, email, URL, social handle, US street address.
2. Off-platform payment keyword filter — Venmo, Zelle, CashApp, PayPal F&F, wire, BTC, Western Union, MoneyGram.
3. Optional LLM pass (gpt-4o-mini) when length > 40 chars and no regex hits — catches phonetic phones ("five oh five…") and rephrased "meet at my house" attempts.
4. Hard-block messages whose visible content (after redaction) is < 3 chars.
5. Audit table `messages_audit` retains the raw body for 30 days, then `pg_cron` purges. Only service role can read it.

## Payments

- **Stripe Connect** destination charges with `transfer_data.destination` = seller's connected account.
- Platform fee is enforced server-side based on the **seller's trust tier at moment of acceptance** (5–8%, scoring matrix).
- Funds remain in escrow on the platform until both parties enter the 6-digit `meet_otp`.
- Refunds, disputes, and chargebacks routed through Stripe; mirrored to our `transactions` table via `stripe-webhook`.

## Authentication

- Phone OTP via Twilio Verify (primary).
- Email verification optional (Stripe Identity recommended for sellers > $500 ticket).
- Session refresh handled by Supabase client.

## Anti-fraud

- **Self-bidding** blocked by `guard_self_bid` trigger.
- **Sybil/cluster detection** — `device_fingerprints` table joins by `fp_hash` and `/24` IP block. Ratings from accounts sharing fingerprints with the rated user are weighted 0.1× during trust recompute.
- **Listing image moderation** — `ai_safe` flag set by moderation pipeline; flagged listings hidden from feed.

## Compliance posture

| Area | Today (MVP) | Phase 2 |
|---|---|---|
| 1099-K issuance | Stripe Connect handles | Stripe Connect handles |
| GDPR/CCPA delete | Supabase RPC cascades + Stripe Customer delete | Self-serve in-app |
| Stolen-goods listings | Manual report → admin review | Reverse-image search + serial-number capture for electronics |
| Age | 18+ enforced at signup | Stripe Identity for sellers > $500 |
