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

const DATE_FMT = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit" });
const money = (n: number) => `${Math.round(n).toLocaleString("ru-RU")} ₸`;

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}
function daysAgoStr(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toDateStr(d);
}

export default function RnpTable({ projectId }: { projectId: number }) {
  const [rows, setRows] = useState<RnpRow[] | null>(null);
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [currencyNotes, setCurrencyNotes] = useState<CurrencyNote[]>([]);
  const [hasAmo, setHasAmo] = useState(true);
  const [hasAds, setHasAds] = useState(true);
  const [fromDate, setFromDate] = useState(() => daysAgoStr(13));
  const [toDate, setToDate] = useState(() => toDateStr(new Date()));

  async function load(from: string, to: string) {
    const res = await fetch(`/api/projects/${projectId}/rnp?from=${from}&to=${to}`);
    if (res.ok) {
      const data = await res.json();
      setRows(data.rows);
      setFunnels(data.funnels ?? []);
      setCurrencyNotes(data.currencyNotes ?? []);
      setHasAmo(data.hasAmoConnections);
      setHasAds(data.hasAdConnections);
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
            <button
              key={d}
              onClick={() => applyPreset(d)}
              className="rounded-md px-2 py-1 text-gray-500 hover:bg-gray-100"
            >
              {d} дней
            </button>
          ))}
          <button onClick={applyThisMonth} className="rounded-md px-2 py-1 text-gray-500 hover:bg-gray-100">
            Этот месяц
          </button>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <input
            type="date"
            value={fromDate}
            max={toDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="rounded-md border border-gray-200 px-2 py-1"
          />
          <span>—</span>
          <input
            type="date"
            value={toDate}
            min={fromDate}
            max={toDateStr(new Date())}
            onChange={(e) => setToDate(e.target.value)}
            className="rounded-md border border-gray-200 px-2 py-1"
          />
        </div>
      </div>
      <p className="mt-1 text-xs text-gray-400">
        Ежедневный снепшот из amoCRM и рекламных кабинетов — те же данные уходят в WhatsApp-отчёт клиенту.
      </p>
      {hasUnconverted && (
        <p className="mt-2 text-xs text-amber-600">
          Часть расхода не удалось перевести в ₸ (не пришёл курс НБ РК) — показана только сконвертированная часть.
        </p>
      )}
      {currencyNotes.length > 0 && (
        <p className="mt-1 text-xs text-gray-400">
          Курс на сегодня: {currencyNotes.map((c) => (c.rate ? `1 ${c.currency} = ${c.rate.toFixed(2)} ₸` : `${c.currency} — курс недоступен`)).join(", ")}
        </p>
      )}

      {!hasAmo && !hasAds && (
        <p className="mt-4 text-sm text-gray-500">
          Нет подключений amoCRM или рекламного кабинета — таблица наполнится, как только что-то подключите.
        </p>
      )}

      <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-gray-400">Реклама</h3>
      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Расход" value={money(t.adSpendKzt)} />
        <Stat label="Показы" value={t.impressions.toLocaleString("ru-RU")} />
        <Stat label="Клики" value={t.clicks.toLocaleString("ru-RU")} />
        <Stat label="CTR" value={ctr !== null ? `${ctr.toFixed(2)}%` : "—"} />
        <Stat label="CPM" value={cpm !== null ? money(cpm) : "—"} />
      </div>

      <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-gray-400">Заявки и воронка</h3>
      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Лидов с рекламы" value={String(t.adLeads)} />
        <Stat label="Цена лида" value={cpl !== null ? money(cpl) : "—"} />
        <Stat label="Конверсия сайта" value={siteConversion !== null ? `${siteConversion.toFixed(1)}%` : "—"} hint="лиды / переходы по ссылке" />
        <Stat label="Новых лидов (amo)" value={String(t.amoNewLeads)} />
        <Stat label="Сумма в воронке" value={money(t.amoLeadValue)} hint="цена карточек новых лидов" />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Закрыто сделок" value={String(t.amoWonCount)} />
        <Stat label="Конверсия в продажу" value={closeRate !== null ? `${closeRate.toFixed(1)}%` : "—"} />
        <Stat label="Выручка (закрытые)" value={money(t.amoWonRevenue)} />
        <Stat label="Средний чек" value={avgDeal !== null ? money(avgDeal) : "—"} />
      </div>

      <div className="mt-5 overflow-x-auto">
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
                            <div
                              className="h-full rounded-full bg-red-500"
                              style={{ width: `${total > 0 ? (s.count / total) * 100 : 0}%` }}
                            />
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
