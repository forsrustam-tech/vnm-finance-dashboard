import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

const schema = z.object({
  name: z.string().min(2),
  canViewAllFinance: z.boolean(),
  canManageProjects: z.boolean(),
  canManageUsers: z.boolean(),
  canManageRoles: z.boolean(),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.canManageRoles) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const roles = await sql`SELECT * FROM roles ORDER BY id`;
  return NextResponse.json({ roles });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.canManageRoles) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });
  }
  const { name, canViewAllFinance, canManageProjects, canManageUsers, canManageRoles } =
    parsed.data;

  try {
    const rows = await sql`
      INSERT INTO roles (name, can_view_all_finance, can_manage_projects, can_manage_users, can_manage_roles)
      VALUES (${name}, ${canViewAllFinance}, ${canManageProjects}, ${canManageUsers}, ${canManageRoles})
      RETURNING id
    `;
    return NextResponse.json({ id: rows[0].id });
  } catch {
    return NextResponse.json({ error: "Роль с таким именем уже существует" }, { status: 409 });
  }
}
