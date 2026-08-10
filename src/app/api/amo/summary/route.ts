import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { fetchAmoSummary } from "@/lib/amocrm";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const connectionId = req.nextUrl.searchParams.get("connectionId");
  if (!connectionId) return NextResponse.json({ error: "connectionId обязателен" }, { status: 400 });

  const rows = await sql`
    SELECT project_id, subdomain, access_token FROM amo_connections WHERE id = ${connectionId}
  `;
  const connection = rows[0];
  if (!connection) {
    return NextResponse.json({ error: "amoCRM не подключена" }, { status: 404 });
  }

  const canAccess =
    user.canManageProjects ||
    (await sql`SELECT 1 FROM project_assignments WHERE user_id = ${user.id} AND project_id = ${connection.project_id}`)
      .length > 0;
  if (!canAccess) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await fetchAmoSummary(connection.subdomain, connection.access_token);
    return NextResponse.json({ summary });
  } catch (err) {
    console.error("amoCRM summary error:", err);
    return NextResponse.json({ error: "Не удалось получить данные из amoCRM" }, { status: 502 });
  }
}
