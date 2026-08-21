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
  const rows = await sql`
    SELECT period, budget_plan, leads_plan FROM project_monthly_targets WHERE project_id = ${id} ORDER BY period DESC
  `;
  return NextResponse.json({ targets: rows });
}

const putSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/),
  budgetPlan: z.coerce.number().min(0),
  leadsPlan: z.coerce.number().min(0),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || !user.canManageProjects) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = putSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });
  }
  const { id } = await params;
  const { period, budgetPlan, leadsPlan } = parsed.data;

  await sql`
    INSERT INTO project_monthly_targets (project_id, period, budget_plan, leads_plan)
    VALUES (${id}, ${period}, ${budgetPlan}, ${leadsPlan})
    ON CONFLICT (project_id, period)
    DO UPDATE SET budget_plan = ${budgetPlan}, leads_plan = ${leadsPlan}, updated_at = now()
  `;
  return NextResponse.json({ ok: true });
}
