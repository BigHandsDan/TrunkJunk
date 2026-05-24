import { getAdminSupabase } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export default async function Disputes() {
  const sb = getAdminSupabase();
  const { data: txs } = await sb
    .from("transactions")
    .select("id, gross_amount, state, dispute_opened_at, seller_id, buyer_id, created_at")
    .eq("state", "disputed")
    .order("dispute_opened_at", { ascending: false });

  return (
    <div>
      <h2>Open disputes</h2>
      <table>
        <thead>
          <tr><th>Opened</th><th>Tx ID</th><th>Amount</th><th>Seller</th><th>Buyer</th></tr>
        </thead>
        <tbody>
          {(txs ?? []).map((t: any) => (
            <tr key={t.id}>
              <td>{t.dispute_opened_at ? new Date(t.dispute_opened_at).toLocaleString() : "—"}</td>
              <td>{t.id.slice(0, 8)}…</td>
              <td>${Number(t.gross_amount).toFixed(2)}</td>
              <td>{t.seller_id.slice(0, 8)}…</td>
              <td>{t.buyer_id.slice(0, 8)}…</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
