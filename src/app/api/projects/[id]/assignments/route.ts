import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

const schema = z.object({
  userId: z.coerce.number(),
  payoutRate: z.coerce.number().min(0),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || !user.canManageProjects) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });
  }
  const { id } = await params;
  const { userId, payoutRate } = parsed.data;

  try {
    const rows = await sql`
      INSERT INTO project_assignments (project_id, user_id, payout_rate)
      VALUES (${id}, ${userId}, ${payoutRate})
      RETURNING id
    `;
    return NextResponse.json({ id: rows[0].id });
  } catch {
    return NextResponse.json(
      { error: "Этот сотрудник уже назначен на проект" },
      { status: 409 }
    );
  }
}
