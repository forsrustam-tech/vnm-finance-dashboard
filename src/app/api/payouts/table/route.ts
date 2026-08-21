import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.canViewAllFinance) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const assignments = await sql`
    SELECT pa.id, pa.user_id, pa.payout_rate, pa.created_at, p.id AS project_id, p.name AS project_name, u.name AS user_name
    FROM project_assignments pa
    JOIN projects p ON p.id = pa.project_id
    JOIN users u ON u.id = pa.user_id
    ORDER BY p.name, u.name
  `;

  const payouts = await sql`SELECT project_assignment_id, period, status FROM payouts`;

  const projects = await sql`
    SELECT id, name, status, revenue_amount, payment_due_day, created_at FROM projects ORDER BY name
  `;

  const clientPayments = await sql`SELECT project_id, period, status FROM client_payments`;

  // Only needed to populate the "add to team" picker — skip the extra query
  // for viewers who can't manage assignments anyway.
  const allUsers = user.canManageProjects
    ? await sql`
        SELECT u.id, u.name, r.name AS role_name
        FROM users u
        JOIN roles r ON r.id = u.role_id
        ORDER BY u.name
      `
    : [];

  return NextResponse.json({
    assignments,
    payouts,
    projects,
    clientPayments,
    allUsers,
    canManageProjects: user.canManageProjects,
  });
}
