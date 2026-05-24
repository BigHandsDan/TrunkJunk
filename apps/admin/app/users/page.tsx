import { getAdminSupabase } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export default async function Users() {
  const sb = getAdminSupabase();
  const { data: users } = await sb
    .from("profiles")
    .select("id, display_name, trust_tier, trust_score, seller_rating, buyer_rating, seller_tx_count, buyer_tx_count, is_banned, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div>
      <h2>Users</h2>
      <table>
        <thead>
          <tr>
            <th>Name</th><th>Tier</th><th>Score</th>
            <th>Seller ★</th><th>Buyer ★</th>
            <th>Tx (S/B)</th><th>Joined</th><th>Status</th>
          </tr>
        </thead>
        <tbody>
          {(users ?? []).map((u: any) => (
            <tr key={u.id}>
              <td>{u.display_name}</td>
              <td>{u.trust_tier}</td>
              <td>{u.trust_score}</td>
              <td>{u.seller_rating ?? "—"}</td>
              <td>{u.buyer_rating ?? "—"}</td>
              <td>{u.seller_tx_count}/{u.buyer_tx_count}</td>
              <td>{new Date(u.created_at).toLocaleDateString()}</td>
              <td>{u.is_banned ? "Banned" : "Active"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
