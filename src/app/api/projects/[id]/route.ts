import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

const patchSchema = z.object({
  status: z.enum(["active", "paused", "finished"]).optional(),
  revenueAmount: z.coerce.number().min(0).optional(),
  paymentDueDay: z.coerce.number().min(1).max(31).nullable().optional(),
  notes: z.string().optional(),
});

async function canAccessProject(user: { id: number; canManageProjects: boolean }, projectId: string) {
  if (user.canManageProjects) return true;
  const rows = await sql`
    SELECT 1 FROM project_assignments WHERE user_id = ${user.id} AND project_id = ${projectId}
  `;
  return rows.length > 0;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!(await canAccessProject(user, id))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const projects = await sql`SELECT * FROM projects WHERE id = ${id}`;
  const rawProject = projects[0];
  if (!rawProject) return NextResponse.json({ error: "Проект не найден" }, { status: 404 });

  // Revenue and payment dates are agency finances — only Owner/Director see them.
  const project = user.canManageProjects
    ? rawProject
    : { id: rawProject.id, name: rawProject.name, status: rawProject.status };

  const allAssignments = await sql`
    SELECT pa.id, pa.user_id, pa.payout_rate, u.name AS user_name
    FROM project_assignments pa
    JOIN users u ON u.id = pa.user_id
    WHERE pa.project_id = ${id}
  `;
  // Targetologs only see their own payout, not teammates'.
  const assignments = user.canManageProjects
    ? allAssignments
    : allAssignments.filter((a) => a.user_id === user.id);

  const connections = await sql`
    SELECT id, platform, ad_account_id, connected_at
    FROM ad_account_connections
    WHERE project_id = ${id}
    ORDER BY created_at DESC
  `;

  const connectionIds = connections.map((c) => c.id);
  const summaries: Record<number, { spend: number; impressions: number; clicks: number; leads: number; days: number }> = {};
  if (connectionIds.length > 0) {
    const snapshots = await sql`
      SELECT connection_id, spend, impressions, clicks, leads
      FROM ad_spend_snapshots
      WHERE connection_id = ANY(${connectionIds})
      AND date >= now() - interval '30 days'
    `;
    for (const s of snapshots) {
      const acc = summaries[s.connection_id] ?? { spend: 0, impressions: 0, clicks: 0, leads: 0, days: 0 };
      acc.spend += Number(s.spend);
      acc.impressions += Number(s.impressions);
      acc.clicks += Number(s.clicks);
      acc.leads += Number(s.leads);
      acc.days += 1;
      summaries[s.connection_id] = acc;
    }
  }

  const documents = await sql`
    SELECT id, file_name, content_type, size_bytes, created_at
    FROM project_documents
    WHERE project_id = ${id}
    ORDER BY created_at DESC
  `;

  const targetologs = user.canManageProjects
    ? await sql`
        SELECT u.id, u.name, r.name AS role_name
        FROM users u
        JOIN roles r ON r.id = u.role_id
        ORDER BY u.name
      `
    : [];

  const amoConnections = await sql`
    SELECT id, label, subdomain FROM amo_connections WHERE project_id = ${id} ORDER BY created_at
  `;

  return NextResponse.json({
    project,
    assignments,
    connections: connections.map((c) => ({ ...c, summary: summaries[c.id] ?? null })),
    documents,
    targetologs,
    amoConnections,
    canManageProjects: user.canManageProjects,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || !user.canManageProjects) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });
  }
  const { id } = await params;
  const { status, revenueAmount, paymentDueDay, notes } = parsed.data;

  if (status !== undefined) {
    await sql`UPDATE projects SET status = ${status} WHERE id = ${id}`;
  }
  if (revenueAmount !== undefined) {
    await sql`UPDATE projects SET revenue_amount = ${revenueAmount} WHERE id = ${id}`;
  }
  if (paymentDueDay !== undefined) {
    await sql`UPDATE projects SET payment_due_day = ${paymentDueDay} WHERE id = ${id}`;
  }
  if (notes !== undefined) {
    await sql`UPDATE projects SET notes = ${notes} WHERE id = ${id}`;
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || !user.canManageProjects) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await sql`DELETE FROM projects WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}
