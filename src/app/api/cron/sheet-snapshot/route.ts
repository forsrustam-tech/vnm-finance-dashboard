import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { fetchSheetMonthSnapshots, fetchSheetMonthFunnel } from "@/lib/googleSheet";
import { yesterdayDateStr } from "@/lib/period";

// Runs daily (see vercel.json). Two independent sources read from the same
// kind of agency РНП spreadsheet:
//   - ad_account_connections with platform = 'google_sheet' — ad spend only,
//     for clients whose CRM works fine via API but whose ad account isn't
//     wired up yet.
//   - amo_connections with source = 'google_sheet' — the full sales funnel
//     (Заявки/Записи/Оплаты) into amo_daily_snapshots, for clients whose CRM
//     has no API at all, so the sheet is the only source of that data too.
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

  const adConnections = await sql`
    SELECT id, ad_account_id FROM ad_account_connections WHERE platform = 'google_sheet' AND ad_account_id IS NOT NULL
  `;
  const adResults: { connectionId: number; ok: boolean; daysSynced?: number; error?: string }[] = [];

  for (const conn of adConnections) {
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
      adResults.push({ connectionId: conn.id, ok: true, daysSynced: days.length });
    } catch (err) {
      adResults.push({ connectionId: conn.id, ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  }

  const funnelConnections = await sql`
    SELECT id, sheet_id FROM amo_connections WHERE source = 'google_sheet' AND sheet_id IS NOT NULL
  `;
  const funnelResults: { connectionId: number; ok: boolean; daysSynced?: number; error?: string }[] = [];

  for (const conn of funnelConnections) {
    try {
      const days = await fetchSheetMonthFunnel(conn.sheet_id, dateStr);
      for (const day of days) {
        await sql`
          INSERT INTO amo_daily_snapshots (connection_id, date, new_leads, total_lead_value, won_count, won_revenue, booking_count, booking_value, by_stage)
          VALUES (${conn.id}, ${day.date}, ${day.newLeads}, 0, ${day.wonCount}, ${day.wonRevenue}, ${day.bookingCount}, ${day.bookingValue}, '[]')
          ON CONFLICT (connection_id, date)
          DO UPDATE SET new_leads = ${day.newLeads}, won_count = ${day.wonCount}, won_revenue = ${day.wonRevenue},
                         booking_count = ${day.bookingCount}, booking_value = ${day.bookingValue}
        `;
      }
      funnelResults.push({ connectionId: conn.id, ok: true, daysSynced: days.length });
    } catch (err) {
      funnelResults.push({ connectionId: conn.id, ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return NextResponse.json({ date: dateStr, ads: adResults, funnels: funnelResults });
}
