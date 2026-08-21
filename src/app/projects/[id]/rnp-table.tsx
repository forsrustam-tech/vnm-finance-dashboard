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
};

type Funnel = { connectionId: number; label: string; stages: { name: string; count: number }[] };
type CurrencyNote = { currency: string; rate: number | null };
type Platform = { platform: string; adSpendKzt: number; impressions: number; clicks: number; adLeads: number };
type WeekBlock = {
  weekStart: string;
  weekEnd: string;
  adSpendKzt: number;
  amoNewLeads: number;
  amoWonRevenue: number;
  budgetPlan: number | null;
  leadsPlan: number | null;
};
type Target = { period: string; budgetPlan: number; leadsPlan: number };
type Note = { id: number; week_start: string; note: string; created_at: string; created_by_name: string | null };

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
    }),
    { adSpendKzt: 0, impressions: 0, clicks: 0, linkClicks: 0, adLeads: 0, amoNewLeads: 0, amoLeadValue: 0, amoWonCount: 0, amoWonRevenue: 0 }
  );
  const hasUnconverted = rows.some((r) => r.hasUnconvertedSpend);

  const cpl = t.adLeads > 0 ? t.adSpendKzt / t.adLeads : null;
  const cpm = t.impressions > 0 ? (t.adSpendKzt / t.impressions) * 1000 : null;
  const ctr = t.impressions > 0 ? (t.clicks / t.impressions) * 100 : null;
  const siteConversion = t.linkClicks > 0 ? (t.adLeads / t.linkClicks) * 100 : null;
  const closeRate = t.amoNewLeads > 0 ? (t.amoWonCount / t.amoNewLeads) * 100 : null;
  const avgDeal = t.amoNewLeads > 0 ? t.amoLeadValue / t.amoNewLeads : null;

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
          <p className="mt-2 text-xs text-gray-400">План не задан — недельные % от плана не будут считаться.</p>
        )}
      </div>

      <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-gray-400">Реклама</h3>
      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Расход" value={money(t.adSpendKzt)} />
        <Stat label="Показы" value={t.impressions.toLocaleString("ru-RU")} />
        <Stat label="Клики" value={t.clicks.toLocaleString("ru-RU")} />
        <Stat label="CTR" value={ctr !== null ? `${ctr.toFixed(2)}%` : "—"} />
        <Stat label="CPM" value={cpm !== null ? money(cpm) : "—"} />
      </div>

      {platforms.length > 1 && (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
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

      <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-gray-400">Заявки и воронка</h3>
      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Лидов с рекламы" value={String(t.adLeads)} />
        <Stat label="Цена лида" value={cpl !== null ? money(cpl) : "—"} />
        <Stat label="Конверсия сайта" value={siteConversion !== null ? `${siteConversion.toFixed(1)}%` : "—"} hint="лиды / переходы по ссылке" />
        <Stat label="Новых лидов (amo)" value={String(t.amoNewLeads)} />
        <Stat label="Сумма в воронке" value={money(t.amoLeadValue)} hint="цена карточек новых лидов" />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Закрыто сделок" value={String(t.amoWonCount)} />
        <Stat label="Конверсия в продажу" value={closeRate !== null ? `${closeRate.toFixed(1)}%` : "—"} />
        <Stat label="Выручка (закрытые)" value={money(t.amoWonRevenue)} />
        <Stat label="Средний чек" value={avgDeal !== null ? money(avgDeal) : "—"} />
        <Stat label="ROMI" value={romi !== null ? `${romi.toFixed(0)}%` : "—"} hint="(выручка − расход) / расход" />
      </div>

      {/* Weekly plan/fact table */}
      {weekBlocks.length > 0 && (
        <div className="mt-6">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">По неделям — план / факт</h3>
          <div className="mt-2 flex flex-col gap-3">
            {weekBlocks.map((w) => {
              const budgetPct = w.budgetPlan && w.budgetPlan > 0 ? (w.adSpendKzt / w.budgetPlan) * 100 : null;
              const leadsPct = w.leadsPlan && w.leadsPlan > 0 ? (w.amoNewLeads / w.leadsPlan) * 100 : null;
              const weekNotes = notes.filter((n) => n.week_start === w.weekStart);
              return (
                <div key={w.weekStart} className="rounded-lg border border-gray-200 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">
                      {DATE_FMT.format(new Date(w.weekStart))} — {DATE_FMT.format(new Date(w.weekEnd))}
                    </p>
                    <p className="text-sm text-gray-500">Выручка: <b className="text-gray-800">{money(w.amoWonRevenue)}</b></p>
                  </div>
                  <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <PlanFactBar label="Бюджет" plan={w.budgetPlan} fact={w.adSpendKzt} pct={budgetPct} fmt={money} />
                    <PlanFactBar label="Лиды" plan={w.leadsPlan} fact={w.amoNewLeads} pct={leadsPct} fmt={(n) => String(Math.round(n))} />
                  </div>

                  <div className="mt-3 border-t border-gray-100 pt-2">
                    <p className="text-xs font-medium text-gray-500">Решения</p>
                    {weekNotes.length > 0 && (
                      <ul className="mt-1 flex flex-col gap-1">
                        {weekNotes.map((n) => (
                          <li key={n.id} className="text-xs text-gray-600">
                            <span className="text-gray-400">{n.created_by_name ?? "—"}:</span> {n.note}
                          </li>
                        ))}
                      </ul>
                    )}
                    {addingNoteFor === w.weekStart ? (
                      <div className="mt-1 flex gap-2">
                        <input
                          autoFocus
                          value={noteDraft[w.weekStart] ?? ""}
                          onChange={(e) => setNoteDraft((prev) => ({ ...prev, [w.weekStart]: e.target.value }))}
                          onKeyDown={(e) => e.key === "Enter" && addNote(w.weekStart)}
                          placeholder="Что решили по этой неделе"
                          className="flex-1 rounded-md border border-gray-200 px-2 py-1 text-xs"
                        />
                        <button onClick={() => addNote(w.weekStart)} className="rounded-md bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700">
                          Добавить
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setAddingNoteFor(w.weekStart)} className="mt-1 text-xs text-gray-400 underline hover:text-gray-600">
                        + добавить заметку
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-6 overflow-x-auto">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">По дням</h3>
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500">
              <th className="p-2 text-left font-medium">Дата</th>
              <th className="p-2 text-right font-medium">Расход</th>
              <th className="p-2 text-right font-medium">Показы</th>
              <th className="p-2 text-right font-medium">CTR</th>
              <th className="p-2 text-right font-medium">Лиды с рекламы</th>
              <th className="p-2 text-right font-medium">Новые (amo)</th>
              <th className="p-2 text-right font-medium">Закрыто</th>
              <th className="p-2 text-right font-medium">Выручка</th>
            </tr>
          </thead>
          <tbody>
            {[...rows].reverse().map((r) => {
              const rowCtr = r.impressions > 0 ? (r.clicks / r.impressions) * 100 : null;
              return (
                <tr key={r.date} className="border-b border-gray-50 last:border-0">
                  <td className="p-2 text-gray-500">{DATE_FMT.format(new Date(r.date))}</td>
                  <td className="p-2 text-right">{r.adSpendKzt > 0 ? money(r.adSpendKzt) : "—"}</td>
                  <td className="p-2 text-right">{r.impressions > 0 ? r.impressions.toLocaleString("ru-RU") : "—"}</td>
                  <td className="p-2 text-right">{rowCtr !== null ? `${rowCtr.toFixed(1)}%` : "—"}</td>
                  <td className="p-2 text-right">{r.adLeads > 0 ? r.adLeads : "—"}</td>
                  <td className="p-2 text-right">{r.amoNewLeads > 0 ? r.amoNewLeads : "—"}</td>
                  <td className="p-2 text-right">{r.amoWonCount > 0 ? r.amoWonCount : "—"}</td>
                  <td className="p-2 text-right">{r.amoWonRevenue > 0 ? money(r.amoWonRevenue) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {funnels.length > 0 && (
        <div className="mt-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Воронка по этапам (amoCRM)</h3>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {funnels.map((f) => {
              const total = f.stages.reduce((s, x) => s + x.count, 0);
              return (
                <div key={f.connectionId} className="rounded-lg bg-gray-50 p-3">
                  <p className="text-sm font-medium">{f.label}</p>
                  {f.stages.length === 0 ? (
                    <p className="mt-1 text-xs text-gray-400">Нет данных за период</p>
                  ) : (
                    <div className="mt-2 flex flex-col gap-1.5">
                      {f.stages.map((s) => (
                        <div key={s.name} className="flex items-center gap-2 text-xs">
                          <span className="w-28 shrink-0 truncate text-gray-500">{s.name}</span>
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200">
                            <div className="h-full rounded-full bg-red-500" style={{ width: `${total > 0 ? (s.count / total) * 100 : 0}%` }} />
                          </div>
                          <span className="w-6 shrink-0 text-right font-medium">{s.count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg bg-gray-50 p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-base font-semibold">{value}</p>
      {hint && <p className="mt-0.5 text-[10px] text-gray-400">{hint}</p>}
    </div>
  );
}

function PlanFactBar({
  label,
  plan,
  fact,
  pct,
  fmt,
}: {
  label: string;
  plan: number | null;
  fact: number;
  pct: number | null;
  fmt: (n: number) => string;
}) {
  return (
    <div className="rounded-md bg-gray-50 p-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-500">{label}</span>
        <span className="font-medium">
          {fmt(fact)} {plan !== null && <span className="text-gray-400">/ {fmt(plan)}</span>}
        </span>
      </div>
      {pct !== null && (
        <>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-200">
            <div
              className={`h-full rounded-full ${pct >= 100 ? "bg-green-500" : "bg-red-500"}`}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
          <p className="mt-1 text-right text-[10px] text-gray-400">{pct.toFixed(0)}% от плана</p>
        </>
      )}
    </div>
  );
}
