# Deployment

## 1. Supabase (cloud)

```bash
# Once
supabase login
supabase link --project-ref YOUR-PROJECT-REF

# Apply schema
supabase db push

# Deploy Edge Functions
supabase functions deploy redact-message
supabase functions deploy reveal-address
supabase functions deploy recalc-trust
supabase functions deploy expire-bids
supabase functions deploy stripe-webhook --no-verify-jwt
supabase functions deploy create-payment-intent
```

**Set secrets:**

```bash
supabase secrets set \
  STRIPE_SECRET_KEY=sk_live_... \
  STRIPE_WEBHOOK_SECRET=whsec_... \
  OPENAI_API_KEY=sk-...
```

## 2. Stripe

1. Activate Connect (Standard or Express).
2. In Webhooks → add `https://YOUR-PROJECT.functions.supabase.co/stripe-webhook` and subscribe to:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.refunded`
   - `account.updated`
3. Copy webhook signing secret → `STRIPE_WEBHOOK_SECRET`.

## 3. Cloudflare R2

```bash
# Create bucket
wrangler r2 bucket create trunkjunk-media

# Configure CORS
wrangler r2 bucket cors put trunkjunk-media --rules='[{"AllowedOrigins":["*"],"AllowedMethods":["GET","PUT","POST","HEAD"],"MaxAgeSeconds":3600}]'
```

Then attach a `media.trunkjunk.app` custom domain in the R2 dashboard.

## 4. Mobile (Expo Application Services)

```bash
# Once
npm i -g eas-cli
eas login
cd apps/mobile
eas build:configure

# Build
eas build --profile production --platform ios
eas build --profile production --platform android

# Submit
eas submit -p ios --latest
eas submit -p android --latest
```

## 5. Admin (Vercel)

```bash
cd apps/admin
vercel --prod
```

Set the same Supabase + admin env vars in Vercel project settings. The admin app should be on a separate domain (e.g., `admin.trunkjunk.app`) and protected by an SSO or IP allowlist.

## 6. Post-deploy smoke test

```bash
# Apply migrations, seed
supabase db reset --linked

# Run a synthetic E2E
node scripts/smoke.js
```

See `scripts/smoke.js` (TBD) for the synthetic flow: sign up → list → bid → accept → fund escrow → confirm pickup → rate.
