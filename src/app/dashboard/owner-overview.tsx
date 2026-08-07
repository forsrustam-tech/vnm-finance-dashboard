"use client";

import { useState } from "react";
import Link from "next/link";
import { formatPeriod } from "@/lib/period";

export type Project = {
  id: number;
  name: string;
  status: string;
  revenue_amount: string;
  payment_due_day: number | null;
  notes: string | null;
};

export type Assignment = {
  id: number;
  project_id: number;
  user_id: number;
  payout_rate: string;
  user_name: string;
  payout_status: string;
};

export default function OwnerOverview({
  projects,
  assignments,
  period,
}: {
  projects: Project[];
  assignments: Assignment[];
  period: string;
}) {
  const [statuses, setStatuses] = useState<Record<number, string>>(
    Object.fromEntries(assignments.map((a) => [a.id, a.payout_status]))
  );

  const activeProjects = projects.filter((p) => p.status === "active");
  const totalRevenue = activeProjects.reduce((sum, p) => sum + Number(p.revenue_amount), 0);

  const activeProjectIds = new Set(activeProjects.map((p) => p.id));
  const activeAssignments = assignments.filter((a) => activeProjectIds.has(a.project_id));
  const totalPayouts = activeAssignments.reduce((sum, a) => sum + Number(a.payout_rate), 0);
  const totalPaid = activeAssignments
    .filter((a) => statuses[a.id] === "paid")
    .reduce((sum, a) => sum + Number(a.payout_rate), 0);

  async function toggleStatus(assignment: Assignment) {
    const next = statuses[assignment.id] === "paid" ? "pending" : "paid";
    setStatuses((prev) => ({ ...prev, [assignment.id]: next }));
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

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Обзор — {formatPeriod(period)}</h1>
        <Link href="/projects" className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white">
          Управлять проектами
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Активных проектов</p>
          <p className="mt-1 text-3xl font-semibold">{activeProjects.length}</p>
        </div>
        <div className="rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Доход в месяц</p>
          <p className="mt-1 text-3xl font-semibold">{totalRevenue.toLocaleString("ru-RU")} ₸</p>
        </div>
        <div className="rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Выплачено за период</p>
          <p className="mt-1 text-3xl font-semibold text-green-600">
            {totalPaid.toLocaleString("ru-RU")} ₸
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Осталось выплатить</p>
          <p className="mt-1 text-3xl font-semibold text-amber-600">
            {(totalPayouts - totalPaid).toLocaleString("ru-RU")} ₸
          </p>
        </div>
      </div>

      <h2 className="mt-8 text-lg font-medium">Проекты</h2>
      <div className="mt-3 flex flex-col gap-4">
        {projects.length === 0 && (
          <p className="text-sm text-gray-500">
            Проектов пока нет. <Link href="/projects" className="underline">Добавьте первый.</Link>
          </p>
        )}
        {projects.map((p) => {
          const projectAssignments = assignments.filter((a) => a.project_id === p.id);
          return (
            <div key={p.id} className="rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-sm text-gray-500">
                    {p.status === "active" ? "Активен" : p.status === "paused" ? "На паузе" : "Завершён"}
                    {" · "}
                    Доход: {Number(p.revenue_amount).toLocaleString("ru-RU")} ₸
                    {p.payment_due_day && ` · Оплата до ${p.payment_due_day} числа`}
                  </p>
                </div>
              </div>
              {projectAssignments.length > 0 && (
                <div className="mt-3 divide-y divide-gray-100 border-t border-gray-100">
                  {projectAssignments.map((a) => (
                    <div key={a.id} className="flex items-center justify-between py-2">
                      <p className="text-sm">
                        {a.user_name} — {Number(a.payout_rate).toLocaleString("ru-RU")} ₸
                      </p>
                      <button
                        onClick={() => toggleStatus(a)}
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          statuses[a.id] === "paid"
                            ? "bg-green-50 text-green-600"
                            : "bg-amber-50 text-amber-600"
                        }`}
                      >
                        {statuses[a.id] === "paid" ? "Выплачено" : "Ожидает выплаты"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
