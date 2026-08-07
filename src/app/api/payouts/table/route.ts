import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.canViewAllFinance) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const assignments = await sql`
    SELECT pa.id, pa.payout_rate, p.id AS project_id, p.name AS project_name, u.name AS user_name
    FROM project_assignments pa
    JOIN projects p ON p.id = pa.project_id
    JOIN users u ON u.id = pa.user_id
    ORDER BY p.name, u.name
  `;

  const payouts = await sql`SELECT project_assignment_id, period, status FROM payouts`;

  return NextResponse.json({ assignments, payouts });
}
