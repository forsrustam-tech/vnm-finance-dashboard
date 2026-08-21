import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { fetchDailyInsights } from "@/lib/meta";
import { yesterdayDateStr } from "@/lib/period";
import { syncAmoConnectionForDate } from "@/lib/amoSync";

// Runs once a day (see vercel.json) and backfills yesterday for every
// amoCRM/ad connection — the safety net behind the webhook receiver
// (src/app/api/webhooks/amo/[connectionId]/[secret]/route.ts), which keeps
// today's snapshot live in real time. If a webhook is missed or a connection
// has none configured yet, this still catches it by the next morning.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dateStr = yesterdayDateStr();

  const amoConnections = await sql`SELECT id, subdomain, access_token FROM amo_connections`;
  const amoResults: { connectionId: number; ok: boolean; error?: string }[] = [];

  for (const conn of amoConnections) {
    try {
      await syncAmoConnectionForDate(conn as { id: number; subdomain: string; access_token: string }, dateStr);
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
