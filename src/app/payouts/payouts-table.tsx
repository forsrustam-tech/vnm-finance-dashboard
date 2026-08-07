"use client";

import { useEffect, useState } from "react";
import { recentPeriods, formatPeriodShort } from "@/lib/period";

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

const PERIODS = recentPeriods(6);

export default function PayoutsTable() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch("/api/payouts/table");
    if (res.ok) {
      const data = await res.json();
      setAssignments(data.assignments);
      setPayouts(data.payouts);
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

  return (
    <div className="mt-6 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full min-w-[700px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="p-3 text-left font-medium">Проект</th>
            <th className="p-3 text-left font-medium">Сотрудник</th>
            <th className="p-3 text-right font-medium">Ставка</th>
            {PERIODS.map((period) => (
              <th key={period} className="p-3 text-center font-medium">
                {formatPeriodShort(period)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {assignments.length === 0 && (
            <tr>
              <td colSpan={3 + PERIODS.length} className="p-4 text-center text-gray-500">
                Пока нет назначений на проекты.
              </td>
            </tr>
          )}
          {assignments.map((a) => (
            <tr key={a.id} className="border-b border-gray-100">
              <td className="p-3">{a.project_name}</td>
              <td className="p-3">{a.user_name}</td>
              <td className="p-3 text-right">{Number(a.payout_rate).toLocaleString("ru-RU")} ₸</td>
              {PERIODS.map((period) => {
                const status = statusFor(a.id, period);
                return (
                  <td key={period} className="p-2 text-center">
                    <button
                      onClick={() => toggle(a, period)}
                      className={`h-6 w-6 rounded-full ${
                        status === "paid" ? "bg-green-500" : "bg-gray-200"
                      }`}
                      title={status === "paid" ? "Выплачено" : "Ожидает выплаты"}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
