import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";
import { createSession, hashPassword } from "@/lib/auth";

const schema = z.object({
  phone: z.string().min(5),
  password: z.string().min(6),
});

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });
  }
  const { phone, password } = parsed.data;

  const rows = await sql`SELECT id, password_hash FROM users WHERE phone = ${phone}`;
  const user = rows[0];

  if (!user) {
    return NextResponse.json(
      { error: "Пользователь с таким номером не найден. Обратитесь к руководителю." },
      { status: 404 }
    );
  }
  if (user.password_hash) {
    return NextResponse.json(
      { error: "Аккаунт уже зарегистрирован. Используйте вход." },
      { status: 409 }
    );
  }

  const passwordHash = await hashPassword(password);
  await sql`UPDATE users SET password_hash = ${passwordHash} WHERE id = ${user.id}`;

  await createSession(user.id);
  return NextResponse.json({ ok: true });
}
