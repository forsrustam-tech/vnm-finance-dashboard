import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

const createSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(5),
  roleId: z.coerce.number(),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.canManageUsers) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await sql`
    SELECT u.id, u.name, u.phone, u.password_hash IS NOT NULL AS activated,
           r.id AS role_id, r.name AS role_name
    FROM users u
    JOIN roles r ON r.id = u.role_id
    ORDER BY u.created_at DESC
  `;
  const roles = await sql`SELECT id, name FROM roles ORDER BY id`;

  return NextResponse.json({ users, roles });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.canManageUsers) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });
  }
  const { name, phone, roleId } = parsed.data;

  try {
    const rows = await sql`
      INSERT INTO users (name, phone, role_id)
      VALUES (${name}, ${phone}, ${roleId})
      RETURNING id
    `;
    return NextResponse.json({ id: rows[0].id });
  } catch {
    return NextResponse.json(
      { error: "Пользователь с таким номером уже существует" },
      { status: 409 }
    );
  }
}
