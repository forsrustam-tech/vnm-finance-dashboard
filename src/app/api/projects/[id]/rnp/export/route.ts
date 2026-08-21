import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getRnpData } from "@/lib/rnp";

async function canAccessProject(user: { id: number; canManageProjects: boolean }, projectId: string) {
  if (user.canManageProjects) return true;
  const rows = await sql`SELECT 1 FROM project_assignments WHERE user_id = ${user.id} AND project_id = ${projectId}`;
  return rows.length > 0;
}

const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3EFEB" } };
const money = (n: number) => Math.round(n);

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

  const fromDate = req.nextUrl.searchParams.get("from");
  const toDate = req.nextUrl.searchParams.get("to");
  if (!fromDate || !toDate) {
    return NextResponse.json({ error: "Нужны параметры from и to" }, { status: 400 });
  }

  const projects = await sql`SELECT name FROM projects WHERE id = ${id}`;
  let projectName = projects[0]?.name ?? `Проект ${id}`;

  const connectionIdParam = req.nextUrl.searchParams.get("connectionId");
  const connectionId = connectionIdParam ? Number(connectionIdParam) : null;

  const data = await getRnpData(id, fromDate, toDate, connectionId);
  if (connectionId) {
    const label = data.amoConnectionsList.find((c) => c.id === connectionId)?.label;
    if (label) projectName = `${projectName} — ${label}`;
  }

  const workbook = new ExcelJS.Workbook();

  // --- Sheet 1: daily РНП ---
  const sheet = workbook.addWorksheet("РНП");
  sheet.addRow([`РНП — ${projectName}`]).font = { bold: true, size: 14 };
  sheet.addRow([`Период: ${fromDate} — ${toDate}`]);
  sheet.addRow([`Сформировано: ${new Date().toLocaleString("ru-RU")}`]);
  sheet.addRow([]);

  const t = data.rows.reduce(
    (acc, r) => ({
      adSpendKzt: acc.adSpendKzt + r.adSpendKzt,
      impressions: acc.impressions + r.impressions,
      clicks: acc.clicks + r.clicks,
      linkClicks: acc.linkClicks + r.linkClicks,
      adLeads: acc.adLeads + r.adLeads,
      amoNewLeads: acc.amoNewLeads + r.amoNewLeads,
      amoLeadValue: acc.amoLeadValue + r.amoLeadValue,
      amoWonCount: acc.amoWonCount + r.amoWonCount,
      amoWonRevenue: acc.amoWonRevenue + r.amoWonRevenue,
    }),
    { adSpendKzt: 0, impressions: 0, clicks: 0, linkClicks: 0, adLeads: 0, amoNewLeads: 0, amoLeadValue: 0, amoWonCount: 0, amoWonRevenue: 0 }
  );
  const cpl = t.adLeads > 0 ? t.adSpendKzt / t.adLeads : null;
  const cpm = t.impressions > 0 ? (t.adSpendKzt / t.impressions) * 1000 : null;
  const ctr = t.impressions > 0 ? (t.clicks / t.impressions) * 100 : null;
  const siteConversion = t.linkClicks > 0 ? (t.adLeads / t.linkClicks) * 100 : null;
  const closeRate = t.amoNewLeads > 0 ? (t.amoWonCount / t.amoNewLeads) * 100 : null;
  const avgDeal = t.amoNewLeads > 0 ? t.amoLeadValue / t.amoNewLeads : null;

  sheet.addRow(["Итого за период"]).font = { bold: true };
  const summaryRows: [string, string | number][] = [
    ["Расход на рекламу, ₸", money(t.adSpendKzt)],
    ["Показы", t.impressions],
    ["Клики", t.clicks],
    ["CTR, %", ctr !== null ? Number(ctr.toFixed(2)) : "—"],
    ["CPM, ₸", cpm !== null ? money(cpm) : "—"],
    ["Лидов с рекламы", t.adLeads],
    ["Цена лида, ₸", cpl !== null ? money(cpl) : "—"],
    ["Конверсия сайта, %", siteConversion !== null ? Number(siteConversion.toFixed(1)) : "—"],
    ["Новых лидов (amoCRM)", t.amoNewLeads],
    ["Сумма в воронке, ₸", money(t.amoLeadValue)],
    ["Закрыто сделок", t.amoWonCount],
    ["Конверсия в продажу, %", closeRate !== null ? Number(closeRate.toFixed(1)) : "—"],
    ["Выручка (закрытые), ₸", money(t.amoWonRevenue)],
    ["Средний чек, ₸", avgDeal !== null ? money(avgDeal) : "—"],
  ];
  for (const [label, value] of summaryRows) sheet.addRow([label, value]);
  sheet.addRow([]);

  const headerRowIndex = sheet.rowCount + 1;
  sheet.addRow([
    "Дата", "Расход, ₸", "Показы", "Клики", "CTR, %", "Лиды с рекламы",
    "Новые (amoCRM)", "Сумма в воронке, ₸", "Закрыто", "Выручка, ₸",
  ]);
  const headerRow = sheet.getRow(headerRowIndex);
  headerRow.font = { bold: true };
  headerRow.fill = HEADER_FILL;

  for (const r of data.rows) {
    const rowCtr = r.impressions > 0 ? (r.clicks / r.impressions) * 100 : null;
    sheet.addRow([
      r.date,
      money(r.adSpendKzt),
      r.impressions,
      r.clicks,
      rowCtr !== null ? Number(rowCtr.toFixed(2)) : "—",
      r.adLeads,
      r.amoNewLeads,
      money(r.amoLeadValue),
      r.amoWonCount,
      money(r.amoWonRevenue),
    ]);
  }
  sheet.columns.forEach((col) => { col.width = 18; });

  // --- Sheet 2: funnel by stage, per amoCRM connection ---
  const funnelSheet = workbook.addWorksheet("Воронка");
  funnelSheet.addRow([`Воронка по этапам — ${projectName}`]).font = { bold: true, size: 14 };
  funnelSheet.addRow([`Период: ${fromDate} — ${toDate}`]);
  funnelSheet.addRow([]);

  for (const f of data.funnels) {
    funnelSheet.addRow([f.label]).font = { bold: true };
    const headIdx = funnelSheet.rowCount + 1;
    funnelSheet.addRow(["Этап", "Лидов"]);
    funnelSheet.getRow(headIdx).font = { bold: true };
    funnelSheet.getRow(headIdx).fill = HEADER_FILL;
    if (f.stages.length === 0) {
      funnelSheet.addRow(["Нет данных за период", ""]);
    } else {
      for (const s of f.stages) funnelSheet.addRow([s.name, s.count]);
    }
    funnelSheet.addRow([]);
  }
  if (data.funnels.length === 0) {
    funnelSheet.addRow(["amoCRM не подключён для этого проекта."]);
  }
  funnelSheet.columns.forEach((col) => { col.width = 30; });

  const buffer = await workbook.xlsx.writeBuffer();
  const safeName = projectName.replace(/[^\p{L}\p{N}_-]+/gu, "_");

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="rnp-${safeName}-${fromDate}-${toDate}.xlsx"`,
    },
  });
}
