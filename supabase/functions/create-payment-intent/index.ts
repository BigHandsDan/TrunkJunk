// =============================================================================
// create-payment-intent: buyer kicks off escrow for an accepted bid
// Uses Stripe Connect destination charges with manual capture.
// =============================================================================
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@15.7.0?target=deno";
import { corsHeaders } from "../_shared/cors.ts";
import { serviceClient, userClient } from "../_shared/supabase.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const auth = req.headers.get("Authorization") ?? "";
  const { tx_id } = await req.json();
  if (!tx_id) return new Response("tx_id required", { status: 400, headers: corsHeaders });

  const user = userClient(auth);
  const { data: { user: u } } = await user.auth.getUser();
  if (!u) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  const svc = serviceClient();
  const { data: tx } = await svc.from("transactions")
    .select("id, seller_id, buyer_id, gross_amount, platform_fee_amount, payout_amount, state, stripe_payment_intent_id")
    .eq("id", tx_id).single();

  if (!tx) return new Response("Not found", { status: 404, headers: corsHeaders });
  if (tx.buyer_id !== u.id) return new Response("Forbidden", { status: 403, headers: corsHeaders });
  if (tx.state !== "pending") {
    return new Response(JSON.stringify({ error: `Tx in state ${tx.state}` }), {
      status: 409,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: seller } = await svc.from("profiles")
    .select("stripe_account_id, stripe_onboarded")
    .eq("id", tx.seller_id).single();
  if (!seller?.stripe_account_id || !seller.stripe_onboarded) {
    return new Response(JSON.stringify({ error: "Seller has not completed payout setup" }), {
      status: 409,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const intent = await stripe.paymentIntents.create({
    amount: Math.round(Number(tx.gross_amount) * 100),
    currency: "usd",
    capture_method: "automatic",
    application_fee_amount: Math.round(Number(tx.platform_fee_amount) * 100),
    transfer_data: { destination: seller.stripe_account_id },
    metadata: { tx_id: tx.id, seller_id: tx.seller_id, buyer_id: tx.buyer_id },
  });

  await svc.from("transactions")
    .update({ stripe_payment_intent_id: intent.id })
    .eq("id", tx_id);

  return new Response(
    JSON.stringify({ client_secret: intent.client_secret, payment_intent_id: intent.id }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
