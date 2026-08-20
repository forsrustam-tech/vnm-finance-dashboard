import { sql } from "@/lib/db";
import { getKztRate } from "@/lib/currency";

export type RnpRow = {
  date: string;
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
};

export type RnpFunnel = { connectionId: number; label: string; stages: { name: string; count: number }[] };
export type RnpCurrencyNote = { currency: string; rate: number | null };

export type RnpData = {
  rows: RnpRow[];
  funnels: RnpFunnel[];
  currencyNotes: RnpCurrencyNote[];
  hasAmoConnections: boolean;
  hasAdConnections: boolean;
};

// Inclusive list of 'YYYY-MM-DD' strings between fromDate and toDate.
function dateRange(fromDate: string, toDate: string): string[] {
  const out: string[] = [];
  const cursor = new Date(`${fromDate}T00:00:00Z`);
  const end = new Date(`${toDate}T00:00:00Z`);
  while (cursor.getTime() <= end.getTime()) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

export async function getRnpData(projectId: string, fromDate: string, toDate: string): Promise<RnpData> {
  const dates = dateRange(fromDate, toDate);

  const adConnections = await sql`
    SELECT id, ad_account_id, currency FROM ad_account_connections WHERE project_id = ${projectId}
  `;
  const rateByCurrency = new Map<string, number | null>();
  for (const conn of adConnections) {
    const cur = conn.currency ?? "KZT";
    if (!rateByCurrency.has(cur)) rateByCurrency.set(cur, await getKztRate(cur));
  }

  const amoRows = await sql`
    SELECT s.date, s.new_leads, s.total_lead_value, s.won_count, s.won_revenue
    FROM amo_daily_snapshots s
    JOIN amo_connections c ON c.id = s.connection_id
    WHERE c.project_id = ${projectId} AND s.date >= ${fromDate} AND s.date <= ${toDate}
  `;

  const adRows = await sql`
    SELECT s.connection_id, s.date, s.spend, s.impressions, s.clicks, s.link_clicks, s.leads
    FROM ad_spend_snapshots s
    JOIN ad_account_connections c ON c.id = s.connection_id
    WHERE c.project_id = ${projectId} AND s.date >= ${fromDate} AND s.date <= ${toDate}
  `;
  const currencyByConnection = new Map(adConnections.map((c) => [c.id, c.currency ?? "KZT"]));

  const byDate = new Map<string, Omit<RnpRow, "date">>();
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

  const amoConnections = await sql`
    SELECT id, label FROM amo_connections WHERE project_id = ${projectId} ORDER BY label
  `;
  const stageSnapshotRows = await sql`
    SELECT s.connection_id, s.by_stage
    FROM amo_daily_snapshots s
    JOIN amo_connections c ON c.id = s.connection_id
    WHERE c.project_id = ${projectId} AND s.date >= ${fromDate} AND s.date <= ${toDate}
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

  return {
    rows,
    funnels,
    currencyNotes,
    hasAmoConnections: amoConnections.length > 0,
    hasAdConnections: adConnections.length > 0,
  };
}
