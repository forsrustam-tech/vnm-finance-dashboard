import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

const createSchema = z.object({
  name: z.string().min(2),
  revenueAmount: z.coerce.number().min(0),
  paymentDueDay: z.coerce.number().min(1).max(31).nullable().optional(),
  notes: z.string().optional(),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.canManageProjects) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const projects = await sql`SELECT * FROM projects ORDER BY created_at DESC`;
  const assignments = await sql`
    SELECT pa.id, pa.project_id, pa.user_id, pa.payout_rate, u.name AS user_name
    FROM project_assignments pa
    JOIN users u ON u.id = pa.user_id
  `;
  const targetologs = await sql`
    SELECT u.id, u.name, r.name AS role_name
    FROM users u
    JOIN roles r ON r.id = u.role_id
    ORDER BY u.name
  `;

  return NextResponse.json({ projects, assignments, targetologs });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.canManageProjects) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });
  }
  const { name, revenueAmount, paymentDueDay, notes } = parsed.data;

  const rows = await sql`
    INSERT INTO projects (name, revenue_amount, payment_due_day, notes)
    VALUES (${name}, ${revenueAmount}, ${paymentDueDay ?? null}, ${notes ?? null})
    RETURNING *
  `;
  return NextResponse.json({ project: rows[0] });
}
