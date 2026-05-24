// =============================================================================
// reveal-address: returns the seller's pickup address ONLY when:
//   - Caller is a party to the transaction
//   - Transaction is in 'escrowed' state
// Audits the reveal event.
// =============================================================================
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { serviceClient, userClient } from "../_shared/supabase.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const auth = req.headers.get("Authorization") ?? "";
  const { tx_id } = await req.json();
  if (!tx_id) return new Response("tx_id required", { status: 400, headers: corsHeaders });

  const user = userClient(auth);
  const { data: { user: u } } = await user.auth.getUser();
  if (!u) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  const svc = serviceClient();
  const { data: tx } = await svc
    .from("transactions")
    .select("id, seller_id, buyer_id, listing_id, state, pickup_address_revealed_at, meet_otp")
    .eq("id", tx_id)
    .single();

  if (!tx) return new Response("Not found", { status: 404, headers: corsHeaders });
  if (tx.seller_id !== u.id && tx.buyer_id !== u.id) {
    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }
  if (tx.state !== "escrowed") {
    return new Response(JSON.stringify({ error: "Funds not in escrow yet" }), {
      status: 409,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Fetch full address via service role (RLS blocks normal queries from doing this)
  const { data: listing } = await svc
    .from("listings")
    .select("pickup_point, pickup_h3_r8, title, seller_id")
    .eq("id", tx.listing_id)
    .single();

  if (!listing) return new Response("Listing missing", { status: 404, headers: corsHeaders });

  // Decode geography to lat/lng using PostGIS RPC for safety
  const { data: coords } = await svc.rpc("decode_pickup_point", { p_listing: tx.listing_id });

  // Mark reveal
  if (!tx.pickup_address_revealed_at) {
    await svc.from("transactions")
      .update({ pickup_address_revealed_at: new Date().toISOString() })
      .eq("id", tx_id);
  }

  return new Response(
    JSON.stringify({
      title: listing.title,
      lat: coords?.lat,
      lng: coords?.lng,
      meet_otp: tx.meet_otp,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
