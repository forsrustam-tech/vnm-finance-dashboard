import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { fetchPipelineStages } from "@/lib/amocrm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const rows = await sql`SELECT subdomain, access_token, project_id, booking_stage_name FROM amo_connections WHERE id = ${id}`;
  const connection = rows[0];
  if (!connection) return NextResponse.json({ error: "Подключение не найдено" }, { status: 404 });

  const canAccess =
    user.canManageProjects ||
    (await sql`SELECT 1 FROM project_assignments WHERE user_id = ${user.id} AND project_id = ${connection.project_id}`)
      .length > 0;
  if (!canAccess) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const stages = await fetchPipelineStages(connection.subdomain, connection.access_token);
    return NextResponse.json({ stages, bookingStageName: connection.booking_stage_name });
  } catch {
    return NextResponse.json({ error: "Не удалось получить этапы из amoCRM" }, { status: 502 });
  }
}
