import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { recentDateStrs } from "@/lib/period";
import { getRnpData, getMonthlyTargets, groupIntoWeeks } from "@/lib/rnp";

async function canAccessProject(user: { id: number; canManageProjects: boolean }, projectId: string) {
  if (user.canManageProjects) return true;
  const rows = await sql`SELECT 1 FROM project_assignments WHERE user_id = ${user.id} AND project_id = ${projectId}`;
  return rows.length > 0;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!(await canAccessProject(user, id))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const fromParam = req.nextUrl.searchParams.get("from");
  const toParam = req.nextUrl.searchParams.get("to");

  let fromDate: string;
  let toDate: string;
  if (fromParam && toParam) {
    fromDate = fromParam;
    toDate = toParam;
  } else {
    const daysParam = Number(req.nextUrl.searchParams.get("days") ?? 14);
    const days = Math.min(Math.max(daysParam, 1), 366);
    const dates = recentDateStrs(days);
    fromDate = dates[0];
    toDate = dates[dates.length - 1];
  }

  const data = await getRnpData(id, fromDate, toDate);

  const periods = [...new Set(data.rows.map((r) => r.date.slice(0, 7)))];
  const targetsByPeriod = await getMonthlyTargets(id, periods);
  const weekBlocks = groupIntoWeeks(data.rows, targetsByPeriod);

  const totalSpend = data.rows.reduce((s, r) => s + r.adSpendKzt, 0);
  const totalRevenue = data.rows.reduce((s, r) => s + r.amoWonRevenue, 0);
  const romi = totalSpend > 0 ? ((totalRevenue - totalSpend) / totalSpend) * 100 : null;

  return NextResponse.json({
    ...data,
    weekBlocks,
    targets: [...targetsByPeriod.entries()].map(([period, t]) => ({ period, ...t })),
    romi,
  });
}
