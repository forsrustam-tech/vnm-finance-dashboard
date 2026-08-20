import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { recentDateStrs } from "@/lib/period";

async function canAccessProject(user: { id: number; canManageProjects: boolean }, projectId: string) {
  if (user.canManageProjects) return true;
  const rows = await sql`SELECT 1 FROM project_assignments WHERE user_id = ${user.id} AND project_id = ${projectId}`;
  return rows.length > 0;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!(await canAccessProject(user, id))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const daysParam = Number(req.nextUrl.searchParams.get("days") ?? 14);
  const days = Math.min(Math.max(daysParam, 1), 90);
  const dates = recentDateStrs(days);
  const fromDate = dates[0];

  const amoRows = await sql`
    SELECT s.date, s.new_leads, s.won_count, s.won_revenue
    FROM amo_daily_snapshots s
    JOIN amo_connections c ON c.id = s.connection_id
    WHERE c.project_id = ${id} AND s.date >= ${fromDate}
  `;

  const adRows = await sql`
    SELECT s.date, s.spend, s.leads
    FROM ad_spend_snapshots s
    JOIN ad_account_connections c ON c.id = s.connection_id
    WHERE c.project_id = ${id} AND s.date >= ${fromDate}
  `;

  const byDate = new Map<string, { adSpend: number; adLeads: number; amoNewLeads: number; amoWonCount: number; amoWonRevenue: number }>();
  for (const date of dates) {
    byDate.set(date, { adSpend: 0, adLeads: 0, amoNewLeads: 0, amoWonCount: 0, amoWonRevenue: 0 });
  }
  for (const row of amoRows) {
    const key = row.date instanceof Date ? row.date.toISOString().slice(0, 10) : String(row.date);
    const entry = byDate.get(key);
    if (!entry) continue;
    entry.amoNewLeads += Number(row.new_leads);
    entry.amoWonCount += Number(row.won_count);
    entry.amoWonRevenue += Number(row.won_revenue);
  }
  for (const row of adRows) {
    const key = row.date instanceof Date ? row.date.toISOString().slice(0, 10) : String(row.date);
    const entry = byDate.get(key);
    if (!entry) continue;
    entry.adSpend += Number(row.spend);
    entry.adLeads += Number(row.leads);
  }

  const rows = dates.map((date) => ({ date, ...byDate.get(date)! }));
  const hasAmoConnections = (await sql`SELECT 1 FROM amo_connections WHERE project_id = ${id} LIMIT 1`).length > 0;
  const hasAdConnections = (await sql`SELECT 1 FROM ad_account_connections WHERE project_id = ${id} LIMIT 1`).length > 0;

  return NextResponse.json({ rows, hasAmoConnections, hasAdConnections });
}
