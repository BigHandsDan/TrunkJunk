// Synthetic smoke test — run after a fresh deploy.
// Usage: SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/smoke.js
// (Service-role keys must NEVER be passed in here.)

const { createClient } = require("@supabase/supabase-js");

async function main() {
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

  // 1. RPC reachability
  const { data, error } = await sb.rpc("listings_feed", {
    viewer_lat: 25.77,
    viewer_lng: -80.19,
    radius_mi: 50,
    limit_n: 5,
  });
  if (error) throw error;
  console.log(`✓ listings_feed reachable, ${data?.length ?? 0} rows`);

  // 2. Verify pickup_point is NOT in any returned row (security check)
  for (const row of data ?? []) {
    if ("pickup_point" in row) {
      console.error("✗ SECURITY VIOLATION: pickup_point leaked in feed");
      process.exit(2);
    }
  }
  console.log("✓ No pickup_point exposure in feed");

  console.log("Smoke test passed.");
}

main().catch((e) => { console.error(e); process.exit(1); });
