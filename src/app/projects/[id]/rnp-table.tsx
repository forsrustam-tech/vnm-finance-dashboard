"use client";

import { useEffect, useState } from "react";

type RnpRow = {
  date: string;
  adSpend: number;
  adLeads: number;
  amoNewLeads: number;
  amoWonCount: number;
  amoWonRevenue: number;
};

const DATE_FMT = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit" });

export default function RnpTable({ projectId }: { projectId: number }) {
  const [rows, setRows] = useState<RnpRow[] | null>(null);
  const [hasAmo, setHasAmo] = useState(true);
  const [hasAds, setHasAds] = useState(true);
  const [days, setDays] = useState(14);

  async function load(d: number) {
    const res = await fetch(`/api/projects/${projectId}/rnp?days=${d}`);
    if (res.ok) {
      const data = await res.json();
      setRows(data.rows);
      setHasAmo(data.hasAmoConnections);
      setHasAds(data.hasAdConnections);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount and when the day range changes
    load(days);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  if (!rows) return null;

  const totals = rows.reduce(
    (acc, r) => ({
      adSpend: acc.adSpend + r.adSpend,
      adLeads: acc.adLeads + r.adLeads,
      amoNewLeads: acc.amoNewLeads + r.amoNewLeads,
      amoWonCount: acc.amoWonCount + r.amoWonCount,
      amoWonRevenue: acc.amoWonRevenue + r.amoWonRevenue,
    }),
    { adSpend: 0, adLeads: 0, amoNewLeads: 0, amoWonCount: 0, amoWonRevenue: 0 }
  );
  const cpl = totals.adLeads > 0 ? totals.adSpend / totals.adLeads : null;

  return (
    <section className="mt-6 rounded-xl border border-gray-200 bg-white shadow-sm p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">РНП</h2>
        <div className="flex gap-1 text-xs">
          {[7, 14, 30].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`rounded-md px-2 py-1 ${days === d ? "bg-red-600 text-white" : "text-gray-500 hover:bg-gray-100"}`}
            >
              {d} дней
            </button>
          ))}
        </div>
      </div>
      <p className="mt-1 text-xs text-gray-400">
        Ежедневный снепшот из amoCRM и рекламных кабинетов — те же данные уходят в WhatsApp-отчёт клиенту.
      </p>

      {!hasAmo && !hasAds && (
        <p className="mt-4 text-sm text-gray-500">
          Нет подключений amoCRM или рекламного кабинета — таблица наполнится, как только что-то подключите.
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Расход на рекламу" value={`${totals.adSpend.toLocaleString("ru-RU")} ₸`} />
        <Stat label="Цена лида" value={cpl ? `${cpl.toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ₸` : "—"} />
        <Stat label="Новых лидов (amoCRM)" value={String(totals.amoNewLeads)} />
        <Stat label="Выручка (закрытые)" value={`${totals.amoWonRevenue.toLocaleString("ru-RU")} ₸`} />
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500">
              <th className="p-2 text-left font-medium">Дата</th>
              <th className="p-2 text-right font-medium">Расход</th>
              <th className="p-2 text-right font-medium">Лиды с рекламы</th>
              <th className="p-2 text-right font-medium">Новые (amo)</th>
              <th className="p-2 text-right font-medium">Закрыто</th>
              <th className="p-2 text-right font-medium">Выручка</th>
            </tr>
          </thead>
          <tbody>
            {[...rows].reverse().map((r) => (
              <tr key={r.date} className="border-b border-gray-50 last:border-0">
                <td className="p-2 text-gray-500">{DATE_FMT.format(new Date(r.date))}</td>
                <td className="p-2 text-right">{r.adSpend > 0 ? `${r.adSpend.toLocaleString("ru-RU")} ₸` : "—"}</td>
                <td className="p-2 text-right">{r.adLeads > 0 ? r.adLeads : "—"}</td>
                <td className="p-2 text-right">{r.amoNewLeads > 0 ? r.amoNewLeads : "—"}</td>
                <td className="p-2 text-right">{r.amoWonCount > 0 ? r.amoWonCount : "—"}</td>
                <td className="p-2 text-right">{r.amoWonRevenue > 0 ? `${r.amoWonRevenue.toLocaleString("ru-RU")} ₸` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-50 p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-base font-semibold">{value}</p>
    </div>
  );
}
