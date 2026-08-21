import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

async function canAccessProject(user: { id: number; canManageProjects: boolean }, projectId: string) {
  if (user.canManageProjects) return true;
  const rows = await sql`SELECT 1 FROM project_assignments WHERE user_id = ${user.id} AND project_id = ${projectId}`;
  return rows.length > 0;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!(await canAccessProject(user, id))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const fromDate = req.nextUrl.searchParams.get("from");
  const toDate = req.nextUrl.searchParams.get("to");

  const rows = fromDate && toDate
    ? await sql`
        SELECT n.id, n.week_start, n.note, n.created_at, u.name AS created_by_name
        FROM project_notes n
        LEFT JOIN users u ON u.id = n.created_by
        WHERE n.project_id = ${id} AND n.week_start >= ${fromDate} AND n.week_start <= ${toDate}
        ORDER BY n.week_start DESC, n.created_at DESC
      `
    : await sql`
        SELECT n.id, n.week_start, n.note, n.created_at, u.name AS created_by_name
        FROM project_notes n
        LEFT JOIN users u ON u.id = n.created_by
        WHERE n.project_id = ${id}
        ORDER BY n.week_start DESC, n.created_at DESC
        LIMIT 50
      `;
  return NextResponse.json({ notes: rows });
}

const postSchema = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().min(1),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || !user.canManageProjects) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = postSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });
  }
  const { id } = await params;
  const { weekStart, note } = parsed.data;

  const rows = await sql`
    INSERT INTO project_notes (project_id, week_start, note, created_by)
    VALUES (${id}, ${weekStart}, ${note}, ${user.id})
    RETURNING id, week_start, note, created_at
  `;
  return NextResponse.json({ note: rows[0] });
}
