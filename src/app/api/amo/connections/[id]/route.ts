import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const canAccess =
    user.canManageProjects ||
    (await sql`SELECT 1 FROM project_assignments WHERE user_id = ${user.id} AND project_id = ${projectId}`)
      .length > 0;
  if (!canAccess) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await sql`DELETE FROM amo_connections WHERE project_id = ${projectId}`;
  return NextResponse.json({ ok: true });
}
