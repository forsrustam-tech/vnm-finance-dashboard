import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import Nav from "@/components/nav";
import { currentPeriod } from "@/lib/period";
import OwnerOverview, { type Project, type Assignment } from "./owner-overview";
import TargetologCabinet from "./targetolog-cabinet";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const period = currentPeriod();

  const projects = await sql`
    SELECT id, name, status, revenue_amount, payment_due_day, notes
    FROM projects
    ORDER BY created_at DESC
  `;

  const assignmentsQuery = user.canViewAllFinance
    ? sql`
        SELECT pa.id, pa.project_id, pa.user_id, pa.payout_rate, u.name AS user_name,
               COALESCE(pay.status, 'pending') AS payout_status
        FROM project_assignments pa
        JOIN users u ON u.id = pa.user_id
        LEFT JOIN payouts pay ON pay.project_assignment_id = pa.id AND pay.period = ${period}
      `
    : sql`
        SELECT pa.id, pa.project_id, pa.user_id, pa.payout_rate, u.name AS user_name,
               COALESCE(pay.status, 'pending') AS payout_status
        FROM project_assignments pa
        JOIN users u ON u.id = pa.user_id
        LEFT JOIN payouts pay ON pay.project_assignment_id = pa.id AND pay.period = ${period}
        WHERE pa.user_id = ${user.id}
      `;

  const typedProjects = projects as unknown as Project[];
  const typedAssignments = (await assignmentsQuery) as unknown as Assignment[];

  return (
    <>
      <Nav user={user} />
      <main className="mx-auto max-w-5xl px-6 py-8">
        {user.canViewAllFinance ? (
          <OwnerOverview
            projects={typedProjects}
            assignments={typedAssignments}
            period={period}
            currentUserId={user.id}
          />
        ) : (
          <TargetologCabinet projects={typedProjects} assignments={typedAssignments} period={period} />
        )}
      </main>
    </>
  );
}
