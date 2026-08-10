"use client";

import { useState } from "react";
import { formatPeriodShort, periodOf } from "@/lib/period";

type Project = {
  id: number;
  name: string;
  status: string;
  revenue_amount: string;
  payment_due_day: number | null;
  created_at: string;
};

type ClientPayment = { project_id: number; period: string; status: string };

export default function ClientPaymentsTable({
  projects,
  clientPayments,
  periods,
  onChange,
}: {
  projects: Project[];
  clientPayments: ClientPayment[];
  periods: string[];
  onChange: () => void;
}) {
  const [statuses, setStatuses] = useState<ClientPayment[]>(clientPayments);
  const currentPeriod = periods[periods.length - 1];

  const billable = projects.filter((p) => Number(p.revenue_amount) > 0);

  function statusFor(projectId: number, period: string) {
    return statuses.find((s) => s.project_id === projectId && s.period === period)?.status ?? "pending";
  }

  function existedAt(project: Project, period: string) {
    return periodOf(project.created_at) <= period;
  }

  async function toggle(project: Project, period: string) {
    const next = statusFor(project.id, period) === "paid" ? "pending" : "paid";
    setStatuses((prev) => {
      const existing = prev.find((s) => s.project_id === project.id && s.period === period);
      if (existing) return prev.map((s) => (s === existing ? { ...s, status: next } : s));
      return [...prev, { project_id: project.id, period, status: next }];
    });

    await fetch("/api/client-payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: project.id,
        period,
        amount: Number(project.revenue_amount),
        status: next,
      }),
    });
    onChange();
  }

  const paidThisMonth = billable.filter((p) => statusFor(p.id, currentPeriod) === "paid");
  const unpaidThisMonth = billable.filter(
    (p) => existedAt(p, currentPeriod) && statusFor(p.id, currentPeriod) !== "paid"
  );

  return (
    <div className="mb-6">
      <h2 className="text-lg font-medium">Оплаты от клиентов</h2>
      <p className="mt-1 text-xs text-gray-400">
        Кто из клиентов уже оплатил агентству в этом месяце, а кто ещё должен.
      </p>

      <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4">
          <p className="text-sm text-gray-500">Оплатили в этом месяце</p>
          <p className="mt-1 text-lg font-medium text-green-600">
            {paidThisMonth.length} из {billable.filter((p) => existedAt(p, currentPeriod)).length}
          </p>
          {paidThisMonth.length > 0 && (
            <p className="mt-1 text-xs text-gray-400">{paidThisMonth.map((p) => p.name).join(", ")}</p>
          )}
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
          <p className="text-sm text-gray-500">Ещё не оплатили</p>
          <p className="mt-1 text-lg font-medium text-amber-600">{unpaidThisMonth.length}</p>
          {unpaidThisMonth.length > 0 && (
            <p className="mt-1 text-xs text-gray-600">{unpaidThisMonth.map((p) => p.name).join(", ")}</p>
          )}
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="p-3 text-left font-medium">Клиент</th>
              <th className="p-3 text-left font-medium">Оплата до</th>
              {periods.map((period) => (
                <th key={period} className="p-3 text-center font-medium">
                  {formatPeriodShort(period)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {billable.map((p) => (
              <tr key={p.id} className="border-b border-gray-50 last:border-0">
                <td className="p-3">{p.name}</td>
                <td className="p-3 text-gray-500">{p.payment_due_day ? `${p.payment_due_day} числа` : "—"}</td>
                {periods.map((period) => {
                  if (!existedAt(p, period)) {
                    return (
                      <td key={period} className="p-2 text-center">
                        <span className="block text-xs text-gray-300">—</span>
                      </td>
                    );
                  }
                  const isPaid = statusFor(p.id, period) === "paid";
                  return (
                    <td key={period} className="p-2 text-center">
                      <button
                        onClick={() => toggle(p, period)}
                        className={`w-full rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                          isPaid
                            ? "bg-green-50 text-green-700 hover:bg-green-100"
                            : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                        }`}
                        title={isPaid ? "Оплачено — нажмите, чтобы отменить" : "Не оплачено — нажмите, чтобы отметить оплаченным"}
                      >
                        {isPaid ? "Оплачено" : "Ждём"}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
