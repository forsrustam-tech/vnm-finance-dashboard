import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { fetchDailyInsights } from "@/lib/meta";

const schema = z.object({ connectionId: z.number() });

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });
  }

  const rows = await sql`
    SELECT id, project_id, ad_account_id, access_token
    FROM ad_account_connections
    WHERE id = ${parsed.data.connectionId}
  `;
  const connection = rows[0];
  if (!connection) {
    return NextResponse.json({ error: "Подключение не найдено" }, { status: 404 });
  }

  const canAccess =
    user.canManageProjects ||
    (await sql`SELECT 1 FROM project_assignments WHERE user_id = ${user.id} AND project_id = ${connection.project_id}`)
      .length > 0;
  if (!canAccess) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const daily = await fetchDailyInsights(connection.ad_account_id, connection.access_token, 30);
    for (const day of daily) {
      await sql`
        INSERT INTO ad_spend_snapshots (connection_id, date, spend, impressions, clicks, leads)
        VALUES (${connection.id}, ${day.date}, ${day.spend}, ${day.impressions}, ${day.clicks}, ${day.leads})
        ON CONFLICT (connection_id, date)
        DO UPDATE SET spend = ${day.spend}, impressions = ${day.impressions}, clicks = ${day.clicks}, leads = ${day.leads}
      `;
    }
    return NextResponse.json({ ok: true, days: daily.length });
  } catch (err) {
    console.error("Meta sync error:", err);
    return NextResponse.json({ error: "Не удалось синхронизировать данные из Meta" }, { status: 502 });
  }
}
