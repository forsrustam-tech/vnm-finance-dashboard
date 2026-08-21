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
  bookings: number;
  bookingsValue: number;
};

export type RnpFunnel = {
  connectionId: number;
  label: string;
  bookingStageName: string | null;
  stages: { name: string; count: number }[];
};
export type RnpCurrencyNote = { currency: string; rate: number | null };
export type RnpPlatform = { platform: string; adSpendKzt: number; impressions: number; clicks: number; adLeads: number };

export type RnpData = {
  rows: RnpRow[];
  platforms: RnpPlatform[];
  funnels: RnpFunnel[];
  currencyNotes: RnpCurrencyNote[];
  hasAmoConnections: boolean;
  hasAdConnections: boolean;
};

export type WeekBlock = {
  weekStart: string; // Monday, 'YYYY-MM-DD'
  weekEnd: string; // Sunday, or range end if the range is shorter
  adSpendKzt: number;
  impressions: number;
  clicks: number;
  linkClicks: number;
  adLeads: number;
  amoNewLeads: number;
  amoLeadValue: number;
  amoWonCount: number;
  amoWonRevenue: number;
  bookings: number;
  bookingsValue: number;
  budgetPlan: number | null;
  leadsPlan: number | null;
};

// Groups daily rows into Monday–Sunday week blocks and, if a monthly plan
// exists for a week's month, prorates that month's plan by the fraction of
// the month's days that fall in this week (a week can straddle two months).
export function groupIntoWeeks(
  rows: RnpRow[],
  targetsByPeriod: Map<string, { budgetPlan: number; leadsPlan: number }>
): WeekBlock[] {
  if (rows.length === 0) return [];

  const byWeekStart = new Map<string, RnpRow[]>();
  for (const row of rows) {
    const d = new Date(`${row.date}T00:00:00Z`);
    const dow = d.getUTCDay(); // 0 Sun..6 Sat
    const daysSinceMonday = (dow + 6) % 7;
    const monday = new Date(d);
    monday.setUTCDate(d.getUTCDate() - daysSinceMonday);
    const key = monday.toISOString().slice(0, 10);
    const list = byWeekStart.get(key) ?? [];
    list.push(row);
    byWeekStart.set(key, list);
  }

  const daysInMonth = (period: string) => {
    const [y, m] = period.split("-").map(Number);
    return new Date(Date.UTC(y, m, 0)).getUTCDate();
  };

  return [...byWeekStart.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, weekRows]) => {
      const sorted = [...weekRows].sort((a, b) => a.date.localeCompare(b.date));
      const weekEnd = sorted[sorted.length - 1].date;

      // Prorate plan per day by that day's month, then sum — handles a week
      // that spans two calendar months without double counting either plan.
      let budgetPlan = 0;
      let leadsPlan = 0;
      let anyPlan = false;
      for (const row of sorted) {
        const period = row.date.slice(0, 7);
        const target = targetsByPeriod.get(period);
        if (!target) continue;
        anyPlan = true;
        const dim = daysInMonth(period);
        budgetPlan += target.budgetPlan / dim;
        leadsPlan += target.leadsPlan / dim;
      }

      return {
        weekStart,
        weekEnd,
        adSpendKzt: sorted.reduce((s, r) => s + r.adSpendKzt, 0),
        impressions: sorted.reduce((s, r) => s + r.impressions, 0),
        clicks: sorted.reduce((s, r) => s + r.clicks, 0),
        linkClicks: sorted.reduce((s, r) => s + r.linkClicks, 0),
        adLeads: sorted.reduce((s, r) => s + r.adLeads, 0),
        amoNewLeads: sorted.reduce((s, r) => s + r.amoNewLeads, 0),
        amoLeadValue: sorted.reduce((s, r) => s + r.amoLeadValue, 0),
        amoWonCount: sorted.reduce((s, r) => s + r.amoWonCount, 0),
        amoWonRevenue: sorted.reduce((s, r) => s + r.amoWonRevenue, 0),
        bookings: sorted.reduce((s, r) => s + r.bookings, 0),
        bookingsValue: sorted.reduce((s, r) => s + r.bookingsValue, 0),
        budgetPlan: anyPlan ? budgetPlan : null,
        leadsPlan: anyPlan ? Math.round(leadsPlan) : null,
      };
    });
}

export async function getMonthlyTargets(projectId: string, periods: string[]) {
  if (periods.length === 0) return new Map<string, { budgetPlan: number; leadsPlan: number }>();
  const rows = await sql`
    SELECT period, budget_plan, leads_plan FROM project_monthly_targets
    WHERE project_id = ${projectId} AND period = ANY(${periods})
  `;
  return new Map(rows.map((r) => [r.period, { budgetPlan: Number(r.budget_plan), leadsPlan: Number(r.leads_plan) }]));
}

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
    SELECT id, ad_account_id, currency, platform FROM ad_account_connections WHERE project_id = ${projectId}
  `;
  const rateByCurrency = new Map<string, number | null>();
  for (const conn of adConnections) {
    const cur = conn.currency ?? "KZT";
    if (!rateByCurrency.has(cur)) rateByCurrency.set(cur, await getKztRate(cur));
  }

  const amoConnections = await sql`
    SELECT id, label, booking_stage_name FROM amo_connections WHERE project_id = ${projectId} ORDER BY label
  `;

  const amoRows = await sql`
    SELECT s.connection_id, s.date, s.new_leads, s.total_lead_value, s.won_count, s.won_revenue, s.booking_count, s.booking_value, s.by_stage
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
  const platformByConnection = new Map(adConnections.map((c) => [c.id, c.platform ?? "meta"]));
  const byPlatform = new Map<string, RnpPlatform>();

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
      bookings: 0,
      bookingsValue: 0,
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
    entry.bookings += Number(row.booking_count);
    entry.bookingsValue += Number(row.booking_value);
  }
  for (const row of adRows) {
    const currency = currencyByConnection.get(row.connection_id) ?? "KZT";
    const rate = rateByCurrency.get(currency);
    const spend = Number(row.spend);
    const spendKzt = rate ? spend * rate : 0;
    const platform = platformByConnection.get(row.connection_id) ?? "meta";

    const entry = byDate.get(dateKey(row.date));
    if (entry) {
      if (rate) {
        entry.adSpendKzt += spendKzt;
      } else {
        entry.adSpendUnconverted += spend;
        entry.hasUnconvertedSpend = true;
      }
      entry.impressions += Number(row.impressions);
      entry.clicks += Number(row.clicks);
      entry.linkClicks += Number(row.link_clicks);
      entry.adLeads += Number(row.leads);
    }

    const platEntry = byPlatform.get(platform) ?? { platform, adSpendKzt: 0, impressions: 0, clicks: 0, adLeads: 0 };
    platEntry.adSpendKzt += spendKzt;
    platEntry.impressions += Number(row.impressions);
    platEntry.clicks += Number(row.clicks);
    platEntry.adLeads += Number(row.leads);
    byPlatform.set(platform, platEntry);
  }

  const rows = dates.map((date) => ({ date, ...byDate.get(date)! }));
  const platforms = [...byPlatform.values()].sort((a, b) => b.adSpendKzt - a.adSpendKzt);

  const stagesByConnection = new Map<number, Map<string, number>>();
  for (const row of amoRows) {
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
    bookingStageName: c.booking_stage_name as string | null,
    stages: [...(stagesByConnection.get(c.id)?.entries() ?? [])]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
  }));

  const currencyNotes = [...rateByCurrency.entries()]
    .filter(([cur]) => cur !== "KZT")
    .map(([cur, rate]) => ({ currency: cur, rate }));

  return {
    rows,
    platforms,
    funnels,
    currencyNotes,
    hasAmoConnections: amoConnections.length > 0,
    hasAdConnections: adConnections.length > 0,
  };
}
