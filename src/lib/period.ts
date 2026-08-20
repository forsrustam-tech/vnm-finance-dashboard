const MONTH_NAMES = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

export function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function formatPeriod(period: string): string {
  const [year, month] = period.split("-").map(Number);
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

export function formatPeriodShort(period: string): string {
  const [year, month] = period.split("-").map(Number);
  return `${MONTH_NAMES[month - 1].slice(0, 3)} ${String(year).slice(2)}`;
}

export function recentPeriods(count: number): string[] {
  const now = new Date();
  const periods: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    periods.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return periods;
}

// 'YYYY-MM' strings sort correctly as plain strings, so this is safe for comparisons.
export function periodOf(date: string | Date): string {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Kazakhstan (Asia/Almaty) is a fixed UTC+5 with no daylight saving, so a
// constant offset is accurate here without pulling in a timezone library.
const TZ_OFFSET_MS = 5 * 3600 * 1000;

function startOfLocalDayUtcMs(utcMs: number): number {
  const shifted = new Date(utcMs + TZ_OFFSET_MS);
  const localMidnightShifted = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
  return localMidnightShifted - TZ_OFFSET_MS;
}

export function toLocalDateStr(ms: number): string {
  const shifted = new Date(ms + TZ_OFFSET_MS);
  return shifted.toISOString().slice(0, 10); // YYYY-MM-DD, matches a Postgres DATE column
}

// Yesterday's date (Almaty-local) as a 'YYYY-MM-DD' string.
export function yesterdayDateStr(): string {
  const todayStart = startOfLocalDayUtcMs(Date.now());
  return toLocalDateStr(todayStart - 24 * 3600 * 1000);
}

// Almaty-local day range in ms, e.g. for building an amoCRM created_at/closed_at filter.
export function localDayRangeMs(dateStr: string): { fromMs: number; toMs: number } {
  const [y, m, d] = dateStr.split("-").map(Number);
  const fromMs = Date.UTC(y, m - 1, d) - TZ_OFFSET_MS;
  return { fromMs, toMs: fromMs + 24 * 3600 * 1000 - 1 };
}

// Last N calendar dates (Almaty-local) ending today, oldest first — for RNP tables.
export function recentDateStrs(count: number): string[] {
  const todayStart = startOfLocalDayUtcMs(Date.now());
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    out.push(toLocalDateStr(todayStart - i * 24 * 3600 * 1000));
  }
  return out;
}
