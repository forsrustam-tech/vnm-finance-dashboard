import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { fetchDailyAmoSnapshot } from "@/lib/amocrm";
import { fetchDailyInsights } from "@/lib/meta";
import { yesterdayDateStr, localDayRangeMs } from "@/lib/period";

// Runs once a day (see vercel.json) and fills the shared RNP data both the
// dashboard's per-project table and whatsapp-report-bot read from — neither
// of those call amoCRM/Meta directly, only this job does.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dateStr = yesterdayDateStr();
  const { fromMs, toMs } = localDayRangeMs(dateStr);

  const amoConnections = await sql`SELECT id, subdomain, access_token FROM amo_connections`;
  const amoResults: { connectionId: number; ok: boolean; error?: string }[] = [];

  for (const conn of amoConnections) {
    try {
      const snap = await fetchDailyAmoSnapshot(conn.subdomain, conn.access_token, fromMs, toMs);
      await sql`
        INSERT INTO amo_daily_snapshots (connection_id, date, new_leads, total_lead_value, won_count, won_revenue, by_stage)
        VALUES (${conn.id}, ${dateStr}, ${snap.newLeads}, ${snap.totalLeadValue}, ${snap.wonCount}, ${snap.wonRevenue}, ${JSON.stringify(snap.byStage)})
        ON CONFLICT (connection_id, date)
        DO UPDATE SET new_leads = ${snap.newLeads}, total_lead_value = ${snap.totalLeadValue},
                       won_count = ${snap.wonCount}, won_revenue = ${snap.wonRevenue}, by_stage = ${JSON.stringify(snap.byStage)}
      `;
      amoResults.push({ connectionId: conn.id, ok: true });
    } catch (err) {
      amoResults.push({ connectionId: conn.id, ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  }

  const adConnections = await sql`SELECT id, ad_account_id, access_token FROM ad_account_connections WHERE access_token IS NOT NULL`;
  const adResults: { connectionId: number; ok: boolean; error?: string }[] = [];

  for (const conn of adConnections) {
    try {
      const daily = await fetchDailyInsights(conn.ad_account_id, conn.access_token, 2);
      for (const day of daily) {
        await sql`
          INSERT INTO ad_spend_snapshots (connection_id, date, spend, impressions, clicks, link_clicks, leads)
          VALUES (${conn.id}, ${day.date}, ${day.spend}, ${day.impressions}, ${day.clicks}, ${day.linkClicks}, ${day.leads})
          ON CONFLICT (connection_id, date)
          DO UPDATE SET spend = ${day.spend}, impressions = ${day.impressions}, clicks = ${day.clicks},
                         link_clicks = ${day.linkClicks}, leads = ${day.leads}
        `;
      }
      adResults.push({ connectionId: conn.id, ok: true });
    } catch (err) {
      adResults.push({ connectionId: conn.id, ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return NextResponse.json({ date: dateStr, amo: amoResults, ads: adResults });
}
