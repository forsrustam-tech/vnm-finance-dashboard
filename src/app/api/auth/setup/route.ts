import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";
import { createSession, hashPassword } from "@/lib/auth";

const schema = z.object({
  name: z.string().min(2),
  phone: z.string().min(5),
  password: z.string().min(6),
});

export async function POST(req: NextRequest) {
  const existing = await sql`SELECT id FROM users LIMIT 1`;
  if (existing.length > 0) {
    return NextResponse.json(
      { error: "Настройка уже завершена. Используйте вход." },
      { status: 409 }
    );
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });
  }
  const { name, phone, password } = parsed.data;

  const ownerRole = await sql`SELECT id FROM roles WHERE name = 'Владелец' LIMIT 1`;
  if (!ownerRole[0]) {
    return NextResponse.json({ error: "Роль «Владелец» не найдена" }, { status: 500 });
  }

  const passwordHash = await hashPassword(password);
  const rows = await sql`
    INSERT INTO users (name, phone, password_hash, role_id)
    VALUES (${name}, ${phone}, ${passwordHash}, ${ownerRole[0].id})
    RETURNING id
  `;

  await createSession(rows[0].id);
  return NextResponse.json({ ok: true });
}
