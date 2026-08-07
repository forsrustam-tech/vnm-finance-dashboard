import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

const schema = z.object({
  canViewAllFinance: z.boolean().optional(),
  canManageProjects: z.boolean().optional(),
  canManageUsers: z.boolean().optional(),
  canManageRoles: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || !user.canManageRoles) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });
  }
  const { id } = await params;
  const data = parsed.data;

  if (data.canViewAllFinance !== undefined) {
    await sql`UPDATE roles SET can_view_all_finance = ${data.canViewAllFinance} WHERE id = ${id}`;
  }
  if (data.canManageProjects !== undefined) {
    await sql`UPDATE roles SET can_manage_projects = ${data.canManageProjects} WHERE id = ${id}`;
  }
  if (data.canManageUsers !== undefined) {
    await sql`UPDATE roles SET can_manage_users = ${data.canManageUsers} WHERE id = ${id}`;
  }
  if (data.canManageRoles !== undefined) {
    await sql`UPDATE roles SET can_manage_roles = ${data.canManageRoles} WHERE id = ${id}`;
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || !user.canManageRoles) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const role = await sql`SELECT is_system FROM roles WHERE id = ${id}`;
  if (role[0]?.is_system) {
    return NextResponse.json({ error: "Системную роль нельзя удалить" }, { status: 400 });
  }

  const usersWithRole = await sql`SELECT id FROM users WHERE role_id = ${id} LIMIT 1`;
  if (usersWithRole.length > 0) {
    return NextResponse.json(
      { error: "На эту роль назначены сотрудники, сначала смените им роль" },
      { status: 400 }
    );
  }

  await sql`DELETE FROM roles WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}
