import { getAdminSupabase } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export default async function Reports() {
  const sb = getAdminSupabase();
  const { data: reports } = await sb
    .from("reports")
    .select("id, target_kind, target_id, reason, details, status, created_at, reporter:reporter_id(display_name)")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div>
      <h2>Reports queue</h2>
      <table>
        <thead>
          <tr><th>Created</th><th>Reporter</th><th>Kind</th><th>Reason</th><th>Status</th><th>Details</th></tr>
        </thead>
        <tbody>
          {(reports ?? []).map((r: any) => (
            <tr key={r.id}>
              <td>{new Date(r.created_at).toLocaleString()}</td>
              <td>{r.reporter?.display_name ?? "—"}</td>
              <td>{r.target_kind}</td>
              <td>{r.reason}</td>
              <td>{r.status}</td>
              <td style={{ maxWidth: 360 }}>{r.details}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
