import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { syncAmoConnectionForDate } from "@/lib/amoSync";
import { toLocalDateStr } from "@/lib/period";

// amoCRM POSTs here the instant a lead is added or its status changes (once
// the URL below is registered in that account's Settings → Webhooks). We
// deliberately don't parse the request body — amoCRM's webhook payload
// format is form-encoded with bracket-nested keys that shift between API
// versions, and we don't need it: the payload only ever tells us "something
// changed for this account," so we just re-pull today's real numbers from
// the API, which is both simpler and more accurate than trusting whatever
// partial fields happened to be in that one event.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ connectionId: string; secret: string }> }
) {
  const { connectionId, secret } = await params;

  const rows = await sql`
    SELECT id, subdomain, access_token, webhook_secret FROM amo_connections WHERE id = ${connectionId}
  `;
  const connection = rows[0];
  if (!connection || connection.webhook_secret !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const todayStr = toLocalDateStr(Date.now());

  try {
    await syncAmoConnectionForDate(
      { id: connection.id, subdomain: connection.subdomain, access_token: connection.access_token },
      todayStr
    );
    return NextResponse.json({ ok: true, date: todayStr });
  } catch (err) {
    console.error(`amoCRM webhook sync failed for connection ${connectionId}:`, err);
    // Still 200 — amoCRM disables a webhook URL after too many non-2xx
    // responses, and the nightly cron will catch this connection regardless.
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
