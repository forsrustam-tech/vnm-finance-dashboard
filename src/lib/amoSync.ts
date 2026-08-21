import { sql } from "@/lib/db";
import { fetchDailyAmoSnapshot, fetchStageEntrySummary } from "@/lib/amocrm";
import { localDayRangeMs } from "@/lib/period";

// Shared by both the daily cron job (backfills yesterday for every
// connection) and the webhook receiver (resyncs today for one connection the
// instant amoCRM notifies us of a change) — same aggregation, same table,
// just triggered differently.
export async function syncAmoConnectionForDate(
  connection: { id: number; subdomain: string; access_token: string; booking_stage_id?: number | null },
  dateStr: string
) {
  const { fromMs, toMs } = localDayRangeMs(dateStr);
  const snap = await fetchDailyAmoSnapshot(connection.subdomain, connection.access_token, fromMs, toMs);

  const booking = connection.booking_stage_id
    ? await fetchStageEntrySummary(connection.subdomain, connection.access_token, connection.booking_stage_id, fromMs, toMs)
    : { count: 0, revenue: 0 };

  await sql`
    INSERT INTO amo_daily_snapshots (connection_id, date, new_leads, total_lead_value, won_count, won_revenue, booking_count, booking_value, by_stage)
    VALUES (${connection.id}, ${dateStr}, ${snap.newLeads}, ${snap.totalLeadValue}, ${snap.wonCount}, ${snap.wonRevenue}, ${booking.count}, ${booking.revenue}, ${JSON.stringify(snap.byStage)})
    ON CONFLICT (connection_id, date)
    DO UPDATE SET new_leads = ${snap.newLeads}, total_lead_value = ${snap.totalLeadValue},
                   won_count = ${snap.wonCount}, won_revenue = ${snap.wonRevenue},
                   booking_count = ${booking.count}, booking_value = ${booking.revenue}, by_stage = ${JSON.stringify(snap.byStage)}
  `;

  return { ...snap, bookingCount: booking.count, bookingValue: booking.revenue };
}
