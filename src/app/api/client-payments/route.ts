import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

const schema = z.object({
  projectId: z.number(),
  period: z.string().min(7),
  amount: z.number(),
  status: z.enum(["paid", "pending"]),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.canViewAllFinance) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });
  }
  const { projectId, period, amount, status } = parsed.data;

  await sql`
    INSERT INTO client_payments (project_id, period, amount, status, paid_at)
    VALUES (${projectId}, ${period}, ${amount}, ${status}, ${status === "paid" ? new Date().toISOString() : null})
    ON CONFLICT (project_id, period)
    DO UPDATE SET status = ${status}, amount = ${amount}, paid_at = ${status === "paid" ? new Date().toISOString() : null}
  `;

  return NextResponse.json({ ok: true });
}
