import { sql } from "@/lib/db";
import { fetchDailyAmoSnapshot } from "@/lib/amocrm";
import { localDayRangeMs } from "@/lib/period";

// Shared by both the daily cron job (backfills yesterday for every
// connection) and the webhook receiver (resyncs today for one connection the
// instant amoCRM notifies us of a change) — same aggregation, same table,
// just triggered differently.
export async function syncAmoConnectionForDate(
  connection: { id: number; subdomain: string; access_token: string },
  dateStr: string
) {
  const { fromMs, toMs } = localDayRangeMs(dateStr);
  const snap = await fetchDailyAmoSnapshot(connection.subdomain, connection.access_token, fromMs, toMs);

  await sql`
    INSERT INTO amo_daily_snapshots (connection_id, date, new_leads, total_lead_value, won_count, won_revenue, by_stage)
    VALUES (${connection.id}, ${dateStr}, ${snap.newLeads}, ${snap.totalLeadValue}, ${snap.wonCount}, ${snap.wonRevenue}, ${JSON.stringify(snap.byStage)})
    ON CONFLICT (connection_id, date)
    DO UPDATE SET new_leads = ${snap.newLeads}, total_lead_value = ${snap.totalLeadValue},
                   won_count = ${snap.wonCount}, won_revenue = ${snap.wonRevenue}, by_stage = ${JSON.stringify(snap.byStage)}
  `;

  return snap;
}
