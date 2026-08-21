import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

async function canAccessConnection(user: { id: number; canManageProjects: boolean }, projectId: number) {
  if (user.canManageProjects) return true;
  const rows = await sql`SELECT 1 FROM project_assignments WHERE user_id = ${user.id} AND project_id = ${projectId}`;
  return rows.length > 0;
}

const patchSchema = z.object({
  bookingStageName: z.string().nullable(),
  bookingStageId: z.number().nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const rows = await sql`SELECT project_id FROM amo_connections WHERE id = ${id}`;
  const connection = rows[0];
  if (!connection) return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  if (!(await canAccessConnection(user, connection.project_id))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });

  await sql`
    UPDATE amo_connections
    SET booking_stage_name = ${parsed.data.bookingStageName}, booking_stage_id = ${parsed.data.bookingStageId ?? null}
    WHERE id = ${id}
  `;
  return NextResponse.json({ ok: true });
}

// [id] here is the amo_connections.id (a project can have more than one connection).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const rows = await sql`SELECT project_id FROM amo_connections WHERE id = ${id}`;
  const connection = rows[0];
  if (!connection) return NextResponse.json({ error: "Не найдено" }, { status: 404 });

  const canAccess =
    user.canManageProjects ||
    (await sql`SELECT 1 FROM project_assignments WHERE user_id = ${user.id} AND project_id = ${connection.project_id}`)
      .length > 0;
  if (!canAccess) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await sql`DELETE FROM amo_connections WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}
