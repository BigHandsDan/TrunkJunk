# TrunkJunk

**Turn what you'd throw away into cash.**

TrunkJunk is a peer-to-peer marketplace at the intersection of the $15B US junk-removal market and the projected $78B US resale market. Sellers list items they would otherwise pay to dispose of; buyers bid or buy outright. Pickups are coordinated in-app with distance-only geo privacy, redacted messaging, escrowed payments, and a two-sided reputation system.

---

## Monorepo layout

```
TrunkJunk/
├─ apps/
│  ├─ mobile/          React Native (Expo) — iOS + Android, customer-facing
│  └─ admin/           Next.js — internal moderation & ops dashboard
├─ packages/
│  └─ shared/          Shared types, geo + trust helpers
├─ supabase/
│  ├─ migrations/      Versioned SQL (schema, RLS, RPCs, triggers, cron)
│  ├─ functions/       Deno Edge Functions (redact-message, stripe-webhook, …)
│  └─ seed/            Local-dev seed data
├─ docs/               Architecture, deployment, security
├─ scripts/            One-off dev/ops scripts
└─ .github/workflows/  CI
```

---

## Quick start

### Prerequisites

- Node 20+, npm 10+
- [Supabase CLI](https://supabase.com/docs/guides/cli) `>=1.150`
- [Expo CLI](https://docs.expo.dev/get-started/installation/) (run via `npx expo`)
- Stripe + Twilio + Cloudflare R2 accounts (see `.env.example`)

### 1. Install

```bash
npm install
cp .env.example .env
# Fill in real values
```

### 2. Local Supabase

```bash
supabase start                # spins up Postgres + Studio at :54323
supabase db reset             # applies migrations + seed
supabase functions serve      # serves Edge Functions
```

### 3. Mobile app

```bash
npm run dev:mobile            # Expo Dev Tools
# Press i for iOS sim, a for Android, w for web
```

### 4. Admin

```bash
npm run dev:admin             # http://localhost:3001
```

---

## Key features

| Feature | How it works |
|---|---|
| **Distance-only geo** | Real coords stored as `geography(point)`; only an H3 r=8 hex (~0.46 mi²) and a snapped distance are returned by the public RPC. Real address revealed only after Stripe escrow funds. |
| **Redacted in-app chat** | Every message passes through the `redact-message` Edge Function (regex + LLM) before storage. Phone numbers, emails, addresses, social handles, and off-platform payment keywords are masked. Originals retained 30 days in `messages_audit` for abuse review. |
| **Escrowed payments** | Stripe Connect destination charges with `transfer_data`. Funds release to the seller's connected account only when both parties confirm pickup with a 6-digit OTP. |
| **Two-sided reputation** | Sellers and buyers rated separately. Blind reveal: ratings hidden until both submit or 7 days elapse. Composite trust score 0–100 → 5 tiers driving fee discounts (8% → 5%). |
| **Anti-sybil** | Device fingerprint + IP + payment-instrument graph; ratings from suspect clusters weighted at 0.1×. |

---

## Documentation

- [Architecture overview](docs/ARCHITECTURE.md)
- [Data model](docs/DATA_MODEL.md)
- [Security & privacy](docs/SECURITY.md)
- [Deployment guide](docs/DEPLOYMENT.md)
- [Roadmap & sprints](docs/ROADMAP.md)

---

## License

UNLICENSED — Private repository. All rights reserved.
