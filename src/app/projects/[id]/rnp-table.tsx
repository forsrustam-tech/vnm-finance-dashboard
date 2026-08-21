"use client";

import { useEffect, useState } from "react";

type RnpRow = {
  date: string;
  adSpendKzt: number;
  adSpendUnconverted: number;
  hasUnconvertedSpend: boolean;
  impressions: number;
  clicks: number;
  linkClicks: number;
  adLeads: number;
  amoNewLeads: number;
  amoLeadValue: number;
  amoWonCount: number;
  amoWonRevenue: number;
  bookings: number;
};

type Funnel = { connectionId: number; label: string; bookingStageName: string | null; stages: { name: string; count: number }[] };
type CurrencyNote = { currency: string; rate: number | null };
type Platform = { platform: string; adSpendKzt: number; impressions: number; clicks: number; adLeads: number };
type WeekBlock = {
  weekStart: string;
  weekEnd: string;
  adSpendKzt: number;
  impressions: number;
  clicks: number;
  linkClicks: number;
  adLeads: number;
  amoNewLeads: number;
  amoLeadValue: number;
  amoWonCount: number;
  amoWonRevenue: number;
  bookings: number;
  budgetPlan: number | null;
  leadsPlan: number | null;
};
type Target = { period: string; budgetPlan: number; leadsPlan: number };
type Note = { id: number; week_start: string; note: string; created_at: string; created_by_name: string | null };

// Shape a matrix column needs, regardless of whether it represents a week or a day.
type Col = {
  key: string;
  label: string;
  adSpendKzt: number;
  impressions: number;
  clicks: number;
  linkClicks: number;
  adLeads: number;
  amoNewLeads: number;
  amoLeadValue: number;
  amoWonCount: number;
  amoWonRevenue: number;
  bookings: number;
  budgetPlan: number | null;
  leadsPlan: number | null;
};

const DATE_FMT = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit" });
const money = (n: number) => `${Math.round(n).toLocaleString("ru-RU")} ₸`;
const PLATFORM_LABEL: Record<string, string> = { meta: "Meta (Facebook/Instagram)", tiktok: "TikTok", google: "Google Ads" };

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}
function daysAgoStr(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toDateStr(d);
}
function currentPeriod() {
  return toDateStr(new Date()).slice(0, 7);
}
function daysInMonth(period: string) {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export default function RnpTable({ projectId }: { projectId: number }) {
  const [rows, setRows] = useState<RnpRow[] | null>(null);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [currencyNotes, setCurrencyNotes] = useState<CurrencyNote[]>([]);
  const [weekBlocks, setWeekBlocks] = useState<WeekBlock[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [romi, setRomi] = useState<number | null>(null);
  const [hasAmo, setHasAmo] = useState(true);
  const [hasAds, setHasAds] = useState(true);
  const [fromDate, setFromDate] = useState(() => daysAgoStr(13));
  const [toDate, setToDate] = useState(() => toDateStr(new Date()));

  const [notes, setNotes] = useState<Note[]>([]);
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const [addingNoteFor, setAddingNoteFor] = useState<string | null>(null);

  const [editingPlan, setEditingPlan] = useState(false);
  const [planBudget, setPlanBudget] = useState("");
  const [planLeads, setPlanLeads] = useState("");
  const [savingPlan, setSavingPlan] = useState(false);

  async function load(from: string, to: string) {
    const [rnpRes, notesRes] = await Promise.all([
      fetch(`/api/projects/${projectId}/rnp?from=${from}&to=${to}`),
      fetch(`/api/projects/${projectId}/notes?from=${from}&to=${to}`),
    ]);
    if (rnpRes.ok) {
      const data = await rnpRes.json();
      setRows(data.rows);
      setPlatforms(data.platforms ?? []);
      setFunnels(data.funnels ?? []);
      setCurrencyNotes(data.currencyNotes ?? []);
      setWeekBlocks(data.weekBlocks ?? []);
      setTargets(data.targets ?? []);
      setRomi(data.romi ?? null);
      setHasAmo(data.hasAmoConnections);
      setHasAds(data.hasAdConnections);
    }
    if (notesRes.ok) {
      const data = await notesRes.json();
      setNotes(data.notes ?? []);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount and when the range changes
    load(fromDate, toDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, toDate]);

  function applyPreset(days: number) {
    setFromDate(daysAgoStr(days - 1));
    setToDate(toDateStr(new Date()));
  }
  function applyThisMonth() {
    const now = new Date();
    setFromDate(toDateStr(new Date(now.getFullYear(), now.getMonth(), 1)));
    setToDate(toDateStr(now));
  }

  const thisMonthTarget = targets.find((t) => t.period === currentPeriod());

  function startEditPlan() {
    setPlanBudget(thisMonthTarget ? String(thisMonthTarget.budgetPlan) : "");
    setPlanLeads(thisMonthTarget ? String(thisMonthTarget.leadsPlan) : "");
    setEditingPlan(true);
  }

  async function savePlan(e: React.FormEvent) {
    e.preventDefault();
    setSavingPlan(true);
    const res = await fetch(`/api/projects/${projectId}/targets`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ period: currentPeriod(), budgetPlan: Number(planBudget) || 0, leadsPlan: Number(planLeads) || 0 }),
    });
    if (res.ok) {
      setEditingPlan(false);
      load(fromDate, toDate);
    }
    setSavingPlan(false);
  }

  async function addNote(weekStart: string) {
    const text = noteDraft[weekStart]?.trim();
    if (!text) return;
    const res = await fetch(`/api/projects/${projectId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weekStart, note: text }),
    });
    if (res.ok) {
      setNoteDraft((prev) => ({ ...prev, [weekStart]: "" }));
      setAddingNoteFor(null);
      load(fromDate, toDate);
    }
  }

  if (!rows) return null;

  const t = rows.reduce(
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
      bookings: acc.bookings + r.bookings,
    }),
    { adSpendKzt: 0, impressions: 0, clicks: 0, linkClicks: 0, adLeads: 0, amoNewLeads: 0, amoLeadValue: 0, amoWonCount: 0, amoWonRevenue: 0, bookings: 0 }
  );
  const hasUnconverted = rows.some((r) => r.hasUnconvertedSpend);
  const hasBookingStage = funnels.some((f) => f.bookingStageName);

  const weekCols: Col[] = weekBlocks.map((w) => ({ key: w.weekStart, label: `${DATE_FMT.format(new Date(w.weekStart))}–${DATE_FMT.format(new Date(w.weekEnd))}`, ...w }));
  const dayCols: Col[] = [...rows].reverse().map((r) => {
    const period = r.date.slice(0, 7);
    const target = targets.find((tg) => tg.period === period);
    const dim = daysInMonth(period);
    return {
      key: r.date,
      label: DATE_FMT.format(new Date(r.date)),
      adSpendKzt: r.adSpendKzt,
      impressions: r.impressions,
      clicks: r.clicks,
      linkClicks: r.linkClicks,
      adLeads: r.adLeads,
      amoNewLeads: r.amoNewLeads,
      amoLeadValue: r.amoLeadValue,
      amoWonCount: r.amoWonCount,
      amoWonRevenue: r.amoWonRevenue,
      bookings: r.bookings,
      budgetPlan: target ? target.budgetPlan / dim : null,
      leadsPlan: target ? target.leadsPlan / dim : null,
    };
  });

  return (
    <section className="mt-6 rounded-xl border border-gray-200 bg-white shadow-sm p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-medium">РНП</h2>
        <a
          href={`/api/projects/${projectId}/rnp/export?from=${fromDate}&to=${toDate}`}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
        >
          Скачать отчёт (.xlsx)
        </a>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="flex gap-1 text-xs">
          {[7, 14, 30].map((d) => (
            <button key={d} onClick={() => applyPreset(d)} className="rounded-md px-2 py-1 text-gray-500 hover:bg-gray-100">
              {d} дней
            </button>
          ))}
          <button onClick={applyThisMonth} className="rounded-md px-2 py-1 text-gray-500 hover:bg-gray-100">
            Этот месяц
          </button>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <input type="date" value={fromDate} max={toDate} onChange={(e) => setFromDate(e.target.value)} className="rounded-md border border-gray-200 px-2 py-1" />
          <span>—</span>
          <input type="date" value={toDate} min={fromDate} max={toDateStr(new Date())} onChange={(e) => setToDate(e.target.value)} className="rounded-md border border-gray-200 px-2 py-1" />
        </div>
      </div>
      <p className="mt-1 text-xs text-gray-400">
        Ежедневный снепшот из amoCRM и рекламных кабинетов — те же данные уходят в WhatsApp-отчёт клиенту.
      </p>
      {hasUnconverted && (
        <p className="mt-2 text-xs text-amber-600">Часть расхода не удалось перевести в ₸ (не пришёл курс НБ РК) — показана только сконвертированная часть.</p>
      )}
      {currencyNotes.length > 0 && (
        <p className="mt-1 text-xs text-gray-400">
          Курс на сегодня: {currencyNotes.map((c) => (c.rate ? `1 ${c.currency} = ${c.rate.toFixed(2)} ₸` : `${c.currency} — курс недоступен`)).join(", ")}
        </p>
      )}

      {!hasAmo && !hasAds && (
        <p className="mt-4 text-sm text-gray-500">Нет подключений amoCRM или рекламного кабинета — таблица наполнится, как только что-то подключите.</p>
      )}

      {/* Monthly plan */}
      <div className="mt-5 rounded-lg border border-gray-200 p-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">План на {currentPeriod()}</p>
          {!editingPlan && (
            <button onClick={startEditPlan} className="text-xs text-gray-500 underline hover:text-gray-700">
              {thisMonthTarget ? "Изменить" : "Задать план"}
            </button>
          )}
        </div>
        {editingPlan ? (
          <form onSubmit={savePlan} className="mt-2 flex flex-wrap items-end gap-2">
            <div>
              <label className="block text-xs text-gray-500">Бюджет, ₸</label>
              <input value={planBudget} onChange={(e) => setPlanBudget(e.target.value)} type="number" min="0" className="mt-1 w-32 rounded-md border border-gray-200 px-2 py-1 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500">Лидов</label>
              <input value={planLeads} onChange={(e) => setPlanLeads(e.target.value)} type="number" min="0" className="mt-1 w-24 rounded-md border border-gray-200 px-2 py-1 text-sm" />
            </div>
            <button type="submit" disabled={savingPlan} className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50">
              Сохранить
            </button>
            <button type="button" onClick={() => setEditingPlan(false)} className="rounded-md border border-gray-200 px-3 py-1.5 text-xs text-gray-500">
              Отмена
            </button>
          </form>
        ) : thisMonthTarget ? (
          <div className="mt-2 flex gap-6 text-sm">
            <span>Бюджет: <b>{money(thisMonthTarget.budgetPlan)}</b></span>
            <span>Лидов: <b>{thisMonthTarget.leadsPlan}</b></span>
          </div>
        ) : (
          <p className="mt-2 text-xs text-gray-400">План не задан — % от плана не будут считаться.</p>
        )}
      </div>

      {platforms.length > 1 && (
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {platforms.map((p) => {
            const pCpl = p.adLeads > 0 ? p.adSpendKzt / p.adLeads : null;
            const pCtr = p.impressions > 0 ? (p.clicks / p.impressions) * 100 : null;
            return (
              <div key={p.platform} className="rounded-lg bg-gray-50 p-3 text-xs">
                <p className="text-sm font-medium">{PLATFORM_LABEL[p.platform] ?? p.platform}</p>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-gray-500">
                  <span>Расход: <b className="text-gray-800">{money(p.adSpendKzt)}</b></span>
                  <span>Лиды: <b className="text-gray-800">{p.adLeads}</b></span>
                  <span>CPL: <b className="text-gray-800">{pCpl !== null ? money(pCpl) : "—"}</b></span>
                  <span>CTR: <b className="text-gray-800">{pCtr !== null ? `${pCtr.toFixed(2)}%` : "—"}</b></span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <MetricsMatrix
        title="По неделям"
        cols={weekCols}
        totals={t}
        romi={romi}
        hasBookingStage={hasBookingStage}
        notes={notes}
        noteDraft={noteDraft}
        setNoteDraft={setNoteDraft}
        addingNoteFor={addingNoteFor}
        setAddingNoteFor={setAddingNoteFor}
        addNote={addNote}
      />

      <MetricsMatrix title="По дням" cols={dayCols} totals={t} romi={romi} hasBookingStage={hasBookingStage} />
    </section>
  );
}

// One matrix: metric labels down the left, one column per period (week or
// day) plus a totals column — same shape either way, just different columns.
function MetricsMatrix({
  title,
  cols,
  totals: t,
  romi,
  hasBookingStage,
  notes,
  noteDraft,
  setNoteDraft,
  addingNoteFor,
  setAddingNoteFor,
  addNote,
}: {
  title: string;
  cols: Col[];
  totals: {
    adSpendKzt: number; impressions: number; clicks: number; linkClicks: number; adLeads: number;
    amoNewLeads: number; amoLeadValue: number; amoWonCount: number; amoWonRevenue: number; bookings: number;
  };
  romi: number | null;
  hasBookingStage: boolean;
  notes?: Note[];
  noteDraft?: Record<string, string>;
  setNoteDraft?: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  addingNoteFor?: string | null;
  setAddingNoteFor?: (key: string | null) => void;
  addNote?: (key: string) => void;
}) {
  const budgetPlanTotal = sumOrNull(cols.map((c) => c.budgetPlan));
  const leadsPlanTotal = sumOrNull(cols.map((c) => c.leadsPlan));
  const cpl = t.adLeads > 0 ? t.adSpendKzt / t.adLeads : null;
  const cpm = t.impressions > 0 ? (t.adSpendKzt / t.impressions) * 1000 : null;
  const ctr = t.impressions > 0 ? (t.clicks / t.impressions) * 100 : null;
  const siteConversion = t.linkClicks > 0 ? (t.adLeads / t.linkClicks) * 100 : null;
  const opConversion = t.bookings > 0 ? (t.amoWonCount / t.bookings) * 100 : null;
  const closeRate = t.amoNewLeads > 0 ? (t.amoWonCount / t.amoNewLeads) * 100 : null;
  const avgDeal = t.amoNewLeads > 0 ? t.amoLeadValue / t.amoNewLeads : null;

  const showNotes = Boolean(notes && setNoteDraft && setAddingNoteFor && addNote);

  return (
    <div className="mt-6 overflow-x-auto">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{title}</h3>
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500">
            <th className="sticky left-0 z-10 border-r border-gray-200 bg-gray-50 p-2 text-left font-medium">Метрика</th>
            <th className="min-w-[110px] p-2 text-right font-medium">Итого</th>
            {cols.map((c) => (
              <th key={c.key} className="min-w-[90px] p-2 text-right font-medium">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <MetricRow label="Бюджет, план ₸" total={budgetPlanTotal} cells={cols.map((c) => c.budgetPlan)} fmt={money} />
          <MetricRow label="Бюджет, факт ₸" total={t.adSpendKzt} cells={cols.map((c) => c.adSpendKzt)} fmt={money} highlight />
          <MetricRow
            label="% выполнения (бюджет)"
            total={budgetPlanTotal ? (t.adSpendKzt / budgetPlanTotal) * 100 : null}
            cells={cols.map((c) => (c.budgetPlan && c.budgetPlan > 0 ? (c.adSpendKzt / c.budgetPlan) * 100 : null))}
            fmt={(n) => `${n.toFixed(0)}%`}
            muted
          />
          <MetricRow label="Показы" total={t.impressions} cells={cols.map((c) => c.impressions)} fmt={(n) => n.toLocaleString("ru-RU")} muted />
          <MetricRow label="Клики" total={t.clicks} cells={cols.map((c) => c.clicks)} fmt={(n) => n.toLocaleString("ru-RU")} muted />
          <MetricRow label="CTR, %" total={ctr} cells={cols.map((c) => (c.impressions > 0 ? (c.clicks / c.impressions) * 100 : null))} fmt={(n) => `${n.toFixed(2)}%`} muted />
          <MetricRow label="CPM, ₸" total={cpm} cells={cols.map((c) => (c.impressions > 0 ? (c.adSpendKzt / c.impressions) * 1000 : null))} fmt={money} muted />
          <MetricRow label="Лидов с рекламы" total={t.adLeads} cells={cols.map((c) => c.adLeads)} fmt={(n) => String(n)} />
          <MetricRow label="Цена лида, ₸" total={cpl} cells={cols.map((c) => (c.adLeads > 0 ? c.adSpendKzt / c.adLeads : null))} fmt={money} muted />
          <MetricRow label="Заявки, план" total={leadsPlanTotal} cells={cols.map((c) => c.leadsPlan)} fmt={(n) => String(Math.round(n))} />
          <MetricRow label="Заявки (amoCRM), факт" total={t.amoNewLeads} cells={cols.map((c) => c.amoNewLeads)} fmt={(n) => String(n)} highlight />
          <MetricRow
            label="% выполнения (заявки)"
            total={leadsPlanTotal ? (t.amoNewLeads / leadsPlanTotal) * 100 : null}
            cells={cols.map((c) => (c.leadsPlan && c.leadsPlan > 0 ? (c.amoNewLeads / c.leadsPlan) * 100 : null))}
            fmt={(n) => `${n.toFixed(0)}%`}
            muted
          />
          <MetricRow
            label="Конверсия сайта, %"
            total={siteConversion}
            cells={cols.map((c) => (c.linkClicks > 0 ? (c.adLeads / c.linkClicks) * 100 : null))}
            fmt={(n) => `${n.toFixed(1)}%`}
            muted
          />
          {hasBookingStage && (
            <>
              <MetricRow label="Записи" total={t.bookings} cells={cols.map((c) => c.bookings)} fmt={(n) => String(n)} highlight />
              <MetricRow
                label="Конверсия ОП (запись → оплата), %"
                total={opConversion}
                cells={cols.map((c) => (c.bookings > 0 ? (c.amoWonCount / c.bookings) * 100 : null))}
                fmt={(n) => `${n.toFixed(1)}%`}
                muted
              />
            </>
          )}
          <MetricRow
            label="Конверсия в продажу (заявка → оплата), %"
            total={closeRate}
            cells={cols.map((c) => (c.amoNewLeads > 0 ? (c.amoWonCount / c.amoNewLeads) * 100 : null))}
            fmt={(n) => `${n.toFixed(1)}%`}
            muted
          />
          <MetricRow label="Оплаты основной услуги, кол-во" total={t.amoWonCount} cells={cols.map((c) => c.amoWonCount)} fmt={(n) => String(n)} highlight />
          <MetricRow label="Оплаты основной услуги, ₸" total={t.amoWonRevenue} cells={cols.map((c) => c.amoWonRevenue)} fmt={money} highlight />
          <MetricRow
            label="Средний чек, ₸"
            total={avgDeal}
            cells={cols.map((c) => (c.amoNewLeads > 0 ? c.amoLeadValue / c.amoNewLeads : null))}
            fmt={money}
            muted
          />
          <MetricRow
            label="ROMI, %"
            total={romi}
            cells={cols.map((c) => (c.adSpendKzt > 0 ? ((c.amoWonRevenue - c.adSpendKzt) / c.adSpendKzt) * 100 : null))}
            fmt={(n) => `${n.toFixed(0)}%`}
          />
          {showNotes && (
            <tr className="border-t border-gray-100">
              <td className="sticky left-0 z-10 border-r border-gray-200 bg-white p-2 align-top text-xs font-medium text-gray-500">Решения</td>
              <td />
              {cols.map((c) => {
                const colNotes = notes!.filter((n) => n.week_start === c.key);
                return (
                  <td key={c.key} className="min-w-[160px] p-2 align-top">
                    {colNotes.map((n) => (
                      <p key={n.id} className="mb-1 text-[11px] text-gray-600">
                        <span className="text-gray-400">{n.created_by_name ?? "—"}:</span> {n.note}
                      </p>
                    ))}
                    {addingNoteFor === c.key ? (
                      <div className="flex flex-col gap-1">
                        <input
                          autoFocus
                          value={noteDraft?.[c.key] ?? ""}
                          onChange={(e) => setNoteDraft!((prev) => ({ ...prev, [c.key]: e.target.value }))}
                          onKeyDown={(e) => e.key === "Enter" && addNote!(c.key)}
                          placeholder="Заметка"
                          className="w-full rounded-md border border-gray-200 px-1.5 py-1 text-[11px]"
                        />
                        <button onClick={() => addNote!(c.key)} className="rounded-md bg-red-600 px-1.5 py-0.5 text-[11px] text-white hover:bg-red-700">
                          Добавить
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setAddingNoteFor!(c.key)} className="text-[11px] text-gray-400 underline hover:text-gray-600">
                        + заметка
                      </button>
                    )}
                  </td>
                );
              })}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function sumOrNull(values: (number | null)[]): number | null {
  const known = values.filter((v): v is number => v !== null);
  return known.length > 0 ? known.reduce((a, b) => a + b, 0) : null;
}

// One row of the metrics matrix: a label, a totals column, then one cell per
// period. `null` cells render as "—" (no plan set / no data yet).
function MetricRow({
  label,
  total,
  cells,
  fmt,
  highlight,
  muted,
}: {
  label: string;
  total: number | null;
  cells: (number | null)[];
  fmt: (n: number) => string;
  highlight?: boolean;
  muted?: boolean;
}) {
  const textClass = highlight ? "font-semibold text-gray-900" : muted ? "text-gray-500" : "text-gray-700";
  return (
    <tr className="border-b border-gray-50 last:border-0">
      <td className={`sticky left-0 z-10 border-r border-gray-200 bg-white p-2 text-xs ${muted ? "text-gray-400" : "text-gray-600"}`}>{label}</td>
      <td className={`p-2 text-right text-xs ${textClass}`}>{total !== null ? fmt(total) : "—"}</td>
      {cells.map((v, i) => (
        <td key={i} className={`p-2 text-right text-xs ${textClass}`}>
          {v !== null ? fmt(v) : "—"}
        </td>
      ))}
    </tr>
  );
}
