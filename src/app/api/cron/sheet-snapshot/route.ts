import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { fetchSheetMonthSnapshots } from "@/lib/googleSheet";
import { yesterdayDateStr } from "@/lib/period";

// Runs daily (see vercel.json) for every ad_account_connections row with
// platform = 'google_sheet' — clients whose ad spend isn't wired to a live
// API yet, but whose numbers the agency already tracks in a Google Sheet.
// Re-syncs the WHOLE current month's tab each run (not just yesterday): it's
// one extra CSV fetch, and it means a correction the team makes to an
// earlier day in the sheet gets picked up automatically instead of staying
// stuck with whatever was true the first time that day was synced.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dateStr = yesterdayDateStr();

  const connections = await sql`
    SELECT id, ad_account_id FROM ad_account_connections WHERE platform = 'google_sheet' AND ad_account_id IS NOT NULL
  `;

  const results: { connectionId: number; ok: boolean; daysSynced?: number; error?: string }[] = [];

  for (const conn of connections) {
    try {
      const days = await fetchSheetMonthSnapshots(conn.ad_account_id, dateStr);
      for (const day of days) {
        await sql`
          INSERT INTO ad_spend_snapshots (connection_id, date, spend, impressions, clicks, link_clicks, leads)
          VALUES (${conn.id}, ${day.date}, ${day.spend}, ${day.impressions}, ${day.clicks}, 0, ${day.leads})
          ON CONFLICT (connection_id, date)
          DO UPDATE SET spend = ${day.spend}, impressions = ${day.impressions}, clicks = ${day.clicks}, leads = ${day.leads}
        `;
      }
      results.push({ connectionId: conn.id, ok: true, daysSynced: days.length });
    } catch (err) {
      results.push({ connectionId: conn.id, ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return NextResponse.json({ date: dateStr, results });
}
