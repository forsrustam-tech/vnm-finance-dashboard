import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const canAccess =
    user.canManageProjects ||
    (await sql`SELECT 1 FROM project_assignments WHERE user_id = ${user.id} AND project_id = ${id}`)
      .length > 0;
  if (!canAccess) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projects = await sql`SELECT * FROM projects WHERE id = ${id}`;
  const project = projects[0];
  if (!project) return NextResponse.json({ error: "Проект не найден" }, { status: 404 });

  const connections = await sql`SELECT id, ad_account_id FROM ad_account_connections WHERE project_id = ${id}`;
  const connectionIds = connections.map((c) => c.id);

  const snapshots =
    connectionIds.length > 0
      ? await sql`
          SELECT date, spend, impressions, clicks, leads
          FROM ad_spend_snapshots
          WHERE connection_id = ANY(${connectionIds})
          ORDER BY date ASC
        `
      : [];

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Отчёт");

  sheet.addRow([`Маркетинговый отчёт — ${project.name}`]);
  sheet.addRow([`Сформировано: ${new Date().toLocaleDateString("ru-RU")}`]);
  sheet.addRow([]);

  sheet.addRow(["Дата", "Бюджет ($)", "Показы", "CPM ($)", "Клики", "CPC ($)", "CTR (%)", "Лиды", "Цена лида ($)"]);
  sheet.getRow(4).font = { bold: true };

  let totalSpend = 0;
  let totalImpressions = 0;
  let totalClicks = 0;
  let totalLeads = 0;

  for (const s of snapshots) {
    const spend = Number(s.spend);
    const impressions = Number(s.impressions);
    const clicks = Number(s.clicks);
    const leads = Number(s.leads);
    totalSpend += spend;
    totalImpressions += impressions;
    totalClicks += clicks;
    totalLeads += leads;

    sheet.addRow([
      new Date(s.date).toLocaleDateString("ru-RU"),
      spend.toFixed(2),
      impressions,
      impressions > 0 ? ((spend / impressions) * 1000).toFixed(2) : 0,
      clicks,
      clicks > 0 ? (spend / clicks).toFixed(2) : 0,
      impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) : 0,
      leads,
      leads > 0 ? (spend / leads).toFixed(2) : 0,
    ]);
  }

  sheet.addRow([]);
  sheet.addRow([
    "Итого",
    totalSpend.toFixed(2),
    totalImpressions,
    totalImpressions > 0 ? ((totalSpend / totalImpressions) * 1000).toFixed(2) : 0,
    totalClicks,
    totalClicks > 0 ? (totalSpend / totalClicks).toFixed(2) : 0,
    totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : 0,
    totalLeads,
    totalLeads > 0 ? (totalSpend / totalLeads).toFixed(2) : 0,
  ]).font = { bold: true };

  sheet.columns.forEach((col) => {
    col.width = 16;
  });

  const buffer = await workbook.xlsx.writeBuffer();

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="report-${project.name}.xlsx"`,
    },
  });
}
