// =============================================================================
// recalc-trust: manual trigger to recompute a user's trust score
// =============================================================================
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { serviceClient, userClient } from "../_shared/supabase.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const auth = req.headers.get("Authorization") ?? "";
  const { profile_id } = await req.json().catch(() => ({}));

  const user = userClient(auth);
  const { data: { user: u } } = await user.auth.getUser();
  if (!u) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  // Only allow user to recompute themselves (or admin via service role direct call)
  const target = profile_id ?? u.id;
  if (target !== u.id) {
    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }

  const svc = serviceClient();
  const { data, error } = await svc.rpc("recalc_trust_score", { p_profile: target });
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return new Response(JSON.stringify({ trust_score: data }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
