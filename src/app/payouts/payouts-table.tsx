"use client";

import { useEffect, useState } from "react";
import { recentPeriods, formatPeriodShort } from "@/lib/period";
import FinanceAnalytics from "./finance-analytics";

type Assignment = {
  id: number;
  payout_rate: string;
  project_id: number;
  project_name: string;
  user_name: string;
};

type Payout = {
  project_assignment_id: number;
  period: string;
  status: string;
};

type Project = { id: number; name: string; status: string; revenue_amount: string };

const PERIODS = recentPeriods(6);
const CURRENT_PERIOD = PERIODS[PERIODS.length - 1];

export default function PayoutsTable() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch("/api/payouts/table");
    if (res.ok) {
      const data = await res.json();
      setAssignments(data.assignments);
      setPayouts(data.payouts);
      setProjects(data.projects ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time fetch on mount
    load();
  }, []);

  function statusFor(assignmentId: number, period: string) {
    return payouts.find((p) => p.project_assignment_id === assignmentId && p.period === period)?.status ?? "pending";
  }

  async function toggle(assignment: Assignment, period: string) {
    const next = statusFor(assignment.id, period) === "paid" ? "pending" : "paid";
    setPayouts((prev) => {
      const existing = prev.find((p) => p.project_assignment_id === assignment.id && p.period === period);
      if (existing) {
        return prev.map((p) => (p === existing ? { ...p, status: next } : p));
      }
      return [...prev, { project_assignment_id: assignment.id, period, status: next }];
    });

    await fetch("/api/payouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assignmentId: assignment.id,
        period,
        amount: Number(assignment.payout_rate),
        status: next,
      }),
    });
  }

  if (loading) return <p className="mt-6 text-gray-500">Загрузка...</p>;

  const monthlyFund = assignments.reduce((sum, a) => sum + Number(a.payout_rate), 0);
  const paidThisMonth = assignments
    .filter((a) => statusFor(a.id, CURRENT_PERIOD) === "paid")
    .reduce((sum, a) => sum + Number(a.payout_rate), 0);
  const pendingThisMonth = monthlyFund - paidThisMonth;

  let paidAllShown = 0;
  let totalAllShown = 0;
  for (const a of assignments) {
    for (const period of PERIODS) {
      totalAllShown += Number(a.payout_rate);
      if (statusFor(a.id, period) === "paid") paidAllShown += Number(a.payout_rate);
    }
  }

  const byProject = new Map<number, { name: string; rows: Assignment[] }>();
  for (const a of assignments) {
    const group = byProject.get(a.project_id) ?? { name: a.project_name, rows: [] };
    group.rows.push(a);
    byProject.set(a.project_id, group);
  }

  return (
    <div>
      <FinanceAnalytics projects={projects} assignments={assignments} payouts={payouts} periods={PERIODS} />

      <h2 className="text-lg font-medium">Статус выплат</h2>
      <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
          <p className="text-sm text-gray-500">Выплачено в этом месяце</p>
          <p className="mt-1 text-2xl font-semibold text-green-600">
            {paidThisMonth.toLocaleString("ru-RU")} ₸
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
          <p className="text-sm text-gray-500">Осталось в этом месяце</p>
          <p className="mt-1 text-2xl font-semibold text-amber-600">
            {pendingThisMonth.toLocaleString("ru-RU")} ₸
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
          <p className="text-sm text-gray-500">Выплачено за {PERIODS.length} мес.</p>
          <p className="mt-1 text-2xl font-semibold">
            {paidAllShown.toLocaleString("ru-RU")} <span className="text-sm text-gray-400">/ {totalAllShown.toLocaleString("ru-RU")} ₸</span>
          </p>
        </div>
      </div>

      {assignments.length === 0 ? (
        <p className="mt-6 text-sm text-gray-500">Пока нет назначений на проекты.</p>
      ) : (
        <div className="mt-6 flex flex-col gap-6">
          {[...byProject.entries()].map(([projectId, group]) => (
            <div key={projectId} className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-100 p-4">
                <p className="font-medium">{group.name}</p>
              </div>
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="p-3 text-left font-medium">Сотрудник</th>
                    {PERIODS.map((period) => (
                      <th key={period} className="p-3 text-center font-medium">
                        {formatPeriodShort(period)}
                      </th>
                    ))}
                    <th className="p-3 text-right font-medium">Выплачено всего</th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((a) => {
                    const rate = Number(a.payout_rate);
                    const paidCount = PERIODS.filter((p) => statusFor(a.id, p) === "paid").length;
                    return (
                      <tr key={a.id} className="border-b border-gray-50 last:border-0">
                        <td className="p-3">{a.user_name}</td>
                        {PERIODS.map((period) => {
                          const status = statusFor(a.id, period);
                          const isPaid = status === "paid";
                          return (
                            <td key={period} className="p-2 text-center">
                              <button
                                onClick={() => toggle(a, period)}
                                className={`w-full rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                                  isPaid
                                    ? "bg-green-50 text-green-700 hover:bg-green-100"
                                    : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                                }`}
                                title={isPaid ? "Выплачено — нажмите, чтобы отменить" : "Ожидает — нажмите, чтобы отметить выплаченным"}
                              >
                                {rate.toLocaleString("ru-RU")}
                              </button>
                            </td>
                          );
                        })}
                        <td className="p-3 text-right font-medium">
                          {(paidCount * rate).toLocaleString("ru-RU")} ₸
                          <span className="ml-1 text-xs text-gray-400">
                            ({paidCount}/{PERIODS.length})
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-100 bg-gray-50">
                    <td className="p-3 text-xs text-gray-500">Итого по проекту / мес.</td>
                    {PERIODS.map((period) => {
                      const monthTotal = group.rows.reduce((sum, a) => sum + Number(a.payout_rate), 0);
                      const monthPaid = group.rows
                        .filter((a) => statusFor(a.id, period) === "paid")
                        .reduce((sum, a) => sum + Number(a.payout_rate), 0);
                      return (
                        <td key={period} className="p-2 text-center text-xs text-gray-500">
                          {monthPaid.toLocaleString("ru-RU")}/{monthTotal.toLocaleString("ru-RU")}
                        </td>
                      );
                    })}
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          ))}
        </div>
      )}

      <p className="mt-4 text-xs text-gray-400">
        Нажмите на сумму в ячейке, чтобы отметить выплату за этот месяц как сделанную или отменить.
      </p>
    </div>
  );
}
