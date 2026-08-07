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
