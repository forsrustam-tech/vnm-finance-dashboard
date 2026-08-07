import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";
import { createSession, verifyPassword } from "@/lib/auth";

const schema = z.object({
  phone: z.string().min(5),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });
  }
  const { phone, password } = parsed.data;

  const rows = await sql`SELECT id, password_hash FROM users WHERE phone = ${phone}`;
  const user = rows[0];

  if (!user || !user.password_hash) {
    return NextResponse.json({ error: "Неверный номер или пароль" }, { status: 401 });
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return NextResponse.json({ error: "Неверный номер или пароль" }, { status: 401 });
  }

  await createSession(user.id);
  return NextResponse.json({ ok: true });
}
