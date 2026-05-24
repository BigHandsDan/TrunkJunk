import { getAdminSupabase } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const sb = getAdminSupabase();
  const [{ count: users }, { count: listings }, { count: tx }, { count: openReports }] =
    await Promise.all([
      sb.from("profiles").select("*", { count: "exact", head: true }),
      sb.from("listings").select("*", { count: "exact", head: true }).eq("status", "active"),
      sb.from("transactions").select("*", { count: "exact", head: true }).eq("state", "released"),
      sb.from("reports").select("*", { count: "exact", head: true }).eq("status", "open"),
    ]);

  return (
    <div>
      <h2>Overview</h2>
      <div className="kpi-row">
        <div className="kpi"><div className="kpi-label">Users</div><div className="kpi-value">{users ?? 0}</div></div>
        <div className="kpi"><div className="kpi-label">Active listings</div><div className="kpi-value">{listings ?? 0}</div></div>
        <div className="kpi"><div className="kpi-label">Released transactions</div><div className="kpi-value">{tx ?? 0}</div></div>
        <div className="kpi"><div className="kpi-label">Open reports</div><div className="kpi-value">{openReports ?? 0}</div></div>
      </div>
    </div>
  );
}
