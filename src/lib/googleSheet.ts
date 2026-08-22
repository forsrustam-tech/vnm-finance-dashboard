// Reads the agency's own РНП spreadsheet (Google Sheets) for clients where a
// live ad-account API connection isn't set up yet — one tab per month, named
// in Russian ("Август"), with a day-per-column daily breakdown and a fixed
// set of labeled metric rows (the same template as РНП BioRise.xlsx). No
// auth needed as long as the sheet is shared "anyone with the link can view"
// — the CSV export endpoint works unauthenticated in that case.

const RU_MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

// The exact row labels this template uses for the metrics we need — matched
// against column D (index 3) of the export, not by row position, since a
// tab's row layout can shift between months.
const ROW_LABELS = {
  spendKzt: "Общий рекламный бюджет - (тенге) ₸",
  impressions: "Показы,Кол-во",
  clicks: "Клики Кол-во,шт",
  leads: "Получено Лидов",
};

export type SheetDaySnapshot = {
  date: string; // 'YYYY-MM-DD'
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
};

function parseRuNumber(raw: string): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/[^\d,.-]/g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

// Minimal CSV parser — handles quoted fields with embedded commas, which
// Google's CSV export uses for any cell containing a comma (e.g. "1,234").
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

async function fetchTabCsv(sheetId: string, tabName: string): Promise<string[][]> {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Google Sheets fetch failed: ${res.status}`);
  const text = await res.text();
  return parseCsv(text);
}

// The month tab (e.g. "Август") for a given 'YYYY-MM-DD' local date string.
function monthTabName(dateStr: string): string {
  const month = Number(dateStr.slice(5, 7)); // 1-12
  return RU_MONTHS[month - 1];
}

// Parses one month's tab into a day snapshot for every day column that has
// spend data filled in. Rows are matched by label, not position; day columns
// are matched by their "D.M, weekday" header against the tab's own month.
export function parseMonthTab(csvRows: string[][], year: number, month: number): SheetDaySnapshot[] {
  if (csvRows.length === 0) return [];
  const header = csvRows[0];

  const dayCols: { colIndex: number; date: string }[] = [];
  for (let i = 0; i < header.length; i++) {
    const m = header[i].trim().match(/^(\d{1,2})\.(\d{1,2}),/);
    if (!m) continue;
    const day = Number(m[1]);
    const headerMonth = Number(m[2]);
    if (headerMonth !== month) continue;
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    dayCols.push({ colIndex: i, date });
  }

  const rowByLabel = new Map<string, string[]>();
  for (const row of csvRows) {
    const label = (row[3] ?? "").trim();
    if (label) rowByLabel.set(label, row);
  }

  const spendRow = rowByLabel.get(ROW_LABELS.spendKzt);
  const impressionsRow = rowByLabel.get(ROW_LABELS.impressions);
  const clicksRow = rowByLabel.get(ROW_LABELS.clicks);
  const leadsRow = rowByLabel.get(ROW_LABELS.leads);
  if (!spendRow) return [];

  const out: SheetDaySnapshot[] = [];
  for (const { colIndex, date } of dayCols) {
    const spend = parseRuNumber(spendRow[colIndex] ?? "");
    const impressions = impressionsRow ? parseRuNumber(impressionsRow[colIndex] ?? "") : 0;
    const clicks = clicksRow ? parseRuNumber(clicksRow[colIndex] ?? "") : 0;
    const leads = leadsRow ? parseRuNumber(leadsRow[colIndex] ?? "") : 0;
    // Skip days with nothing filled in yet (future days, or before the
    // campaign started) rather than writing a false zero.
    if (spend === 0 && impressions === 0 && clicks === 0 && leads === 0) continue;
    out.push({ date, spend, impressions, clicks, leads });
  }
  return out;
}

// Fetches and parses the month tab containing `dateStr` ('YYYY-MM-DD').
export async function fetchSheetMonthSnapshots(sheetId: string, dateStr: string): Promise<SheetDaySnapshot[]> {
  const year = Number(dateStr.slice(0, 4));
  const month = Number(dateStr.slice(5, 7));
  const tabName = monthTabName(dateStr);
  const csvRows = await fetchTabCsv(sheetId, tabName);
  return parseMonthTab(csvRows, year, month);
}
