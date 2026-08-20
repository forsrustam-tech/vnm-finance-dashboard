import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { recentDateStrs } from "@/lib/period";
import { getKztRate } from "@/lib/currency";

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

  const adConnections = await sql`
    SELECT id, ad_account_id, currency FROM ad_account_connections WHERE project_id = ${id}
  `;
  // One rate lookup per distinct currency, not per connection/day — the NBK
  // rate is the same for every account billing in that currency today.
  const rateByCurrency = new Map<string, number | null>();
  for (const conn of adConnections) {
    const cur = conn.currency ?? "KZT";
    if (!rateByCurrency.has(cur)) rateByCurrency.set(cur, await getKztRate(cur));
  }

  const amoRows = await sql`
    SELECT s.date, s.new_leads, s.total_lead_value, s.won_count, s.won_revenue
    FROM amo_daily_snapshots s
    JOIN amo_connections c ON c.id = s.connection_id
    WHERE c.project_id = ${id} AND s.date >= ${fromDate}
  `;

  const adRows = await sql`
    SELECT s.connection_id, s.date, s.spend, s.impressions, s.clicks, s.link_clicks, s.leads
    FROM ad_spend_snapshots s
    JOIN ad_account_connections c ON c.id = s.connection_id
    WHERE c.project_id = ${id} AND s.date >= ${fromDate}
  `;
  const currencyByConnection = new Map(adConnections.map((c) => [c.id, c.currency ?? "KZT"]));

  const byDate = new Map<
    string,
    {
      adSpendKzt: number;
      adSpendUnconverted: number;
      hasUnconvertedSpend: boolean;
      impressions: number;
      clicks: number;
      linkClicks: number;
      adLeads: number;
      amoNewLeads: number;
      amoLeadValue: number;
      amoWonCount: number;
      amoWonRevenue: number;
    }
  >();
  for (const date of dates) {
    byDate.set(date, {
      adSpendKzt: 0,
      adSpendUnconverted: 0,
      hasUnconvertedSpend: false,
      impressions: 0,
      clicks: 0,
      linkClicks: 0,
      adLeads: 0,
      amoNewLeads: 0,
      amoLeadValue: 0,
      amoWonCount: 0,
      amoWonRevenue: 0,
    });
  }
  const dateKey = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v));

  for (const row of amoRows) {
    const entry = byDate.get(dateKey(row.date));
    if (!entry) continue;
    entry.amoNewLeads += Number(row.new_leads);
    entry.amoLeadValue += Number(row.total_lead_value);
    entry.amoWonCount += Number(row.won_count);
    entry.amoWonRevenue += Number(row.won_revenue);
  }
  for (const row of adRows) {
    const entry = byDate.get(dateKey(row.date));
    if (!entry) continue;
    const currency = currencyByConnection.get(row.connection_id) ?? "KZT";
    const rate = rateByCurrency.get(currency);
    const spend = Number(row.spend);
    if (rate) {
      entry.adSpendKzt += spend * rate;
    } else {
      entry.adSpendUnconverted += spend;
      entry.hasUnconvertedSpend = true;
    }
    entry.impressions += Number(row.impressions);
    entry.clicks += Number(row.clicks);
    entry.linkClicks += Number(row.link_clicks);
    entry.adLeads += Number(row.leads);
  }

  const rows = dates.map((date) => ({ date, ...byDate.get(date)! }));

  // Stage breakdown, summed over the whole selected period, per amoCRM
  // connection — not meaningful to show per-day, so returned separately.
  const amoConnections = await sql`SELECT id, label FROM amo_connections WHERE project_id = ${id} ORDER BY label`;
  const stageSnapshotRows = await sql`
    SELECT s.connection_id, s.by_stage
    FROM amo_daily_snapshots s
    JOIN amo_connections c ON c.id = s.connection_id
    WHERE c.project_id = ${id} AND s.date >= ${fromDate}
  `;
  const stagesByConnection = new Map<number, Map<string, number>>();
  for (const row of stageSnapshotRows) {
    const stages = typeof row.by_stage === "string" ? JSON.parse(row.by_stage) : row.by_stage ?? [];
    const acc = stagesByConnection.get(row.connection_id) ?? new Map<string, number>();
    for (const s of stages as { name: string; count: number }[]) {
      acc.set(s.name, (acc.get(s.name) ?? 0) + Number(s.count));
    }
    stagesByConnection.set(row.connection_id, acc);
  }
  const funnels = amoConnections.map((c) => ({
    connectionId: c.id,
    label: c.label,
    stages: [...(stagesByConnection.get(c.id)?.entries() ?? [])]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
  }));

  const currencyNotes = [...rateByCurrency.entries()]
    .filter(([cur]) => cur !== "KZT")
    .map(([cur, rate]) => ({ currency: cur, rate }));

  return NextResponse.json({
    rows,
    funnels,
    currencyNotes,
    hasAmoConnections: amoConnections.length > 0,
    hasAdConnections: adConnections.length > 0,
  });
}
