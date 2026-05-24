// =============================================================================
// stripe-webhook: handles Stripe events
//   - payment_intent.succeeded → mark tx escrowed, reveal address path opens
//   - charge.refunded → mark tx refunded
//   - account.updated → mark profile.stripe_onboarded
// =============================================================================
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@15.7.0?target=deno";
import { serviceClient } from "../_shared/supabase.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});
const cryptoProvider = Stripe.createSubtleCryptoProvider();

serve(async (req) => {
  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("Missing signature", { status: 400 });

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      raw,
      sig,
      Deno.env.get("STRIPE_WEBHOOK_SECRET")!,
      undefined,
      cryptoProvider,
    );
  } catch (e) {
    return new Response(`Bad signature: ${String(e)}`, { status: 400 });
  }

  const svc = serviceClient();

  switch (event.type) {
    case "payment_intent.succeeded": {
      const pi = event.data.object as Stripe.PaymentIntent;
      const txId = pi.metadata?.tx_id;
      if (txId) {
        await svc.from("transactions")
          .update({
            state: "escrowed",
            escrowed_at: new Date().toISOString(),
            stripe_charge_id: typeof pi.latest_charge === "string" ? pi.latest_charge : undefined,
          })
          .eq("id", txId);
      }
      break;
    }
    case "charge.refunded": {
      const c = event.data.object as Stripe.Charge;
      const pi = typeof c.payment_intent === "string" ? c.payment_intent : c.payment_intent?.id;
      if (pi) {
        await svc.from("transactions")
          .update({ state: "refunded", refunded_at: new Date().toISOString() })
          .eq("stripe_payment_intent_id", pi);
      }
      break;
    }
    case "account.updated": {
      const acct = event.data.object as Stripe.Account;
      const onboarded = !!acct.details_submitted && !!acct.charges_enabled && !!acct.payouts_enabled;
      await svc.from("profiles")
        .update({ stripe_onboarded: onboarded })
        .eq("stripe_account_id", acct.id);
      break;
    }
    default:
      break;
  }

  return new Response("ok", { status: 200 });
});
