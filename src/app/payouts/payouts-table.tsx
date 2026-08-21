"use client";

import { useEffect, useState, type FormEvent } from "react";
import { recentPeriods, formatPeriodShort, periodOf } from "@/lib/period";
import FinanceAnalytics from "./finance-analytics";
import ClientPaymentsTable from "./client-payments-table";

type Assignment = {
  id: number;
  user_id: number;
  payout_rate: string;
  project_id: number;
  project_name: string;
  user_name: string;
  created_at: string;
};

type TeamMember = { id: number; name: string; role_name: string };

type Payout = {
  project_assignment_id: number;
  period: string;
  status: string;
};

type Project = {
  id: number;
  name: string;
  status: string;
  revenue_amount: string;
  payment_due_day: number | null;
  created_at: string;
};

type ClientPayment = { project_id: number; period: string; status: string };

const PERIODS = recentPeriods(6);
const CURRENT_PERIOD = PERIODS[PERIODS.length - 1];

export default function PayoutsTable() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [clientPayments, setClientPayments] = useState<ClientPayment[]>([]);
  const [allUsers, setAllUsers] = useState<TeamMember[]>([]);
  const [canManageProjects, setCanManageProjects] = useState(false);
  const [loading, setLoading] = useState(true);

  const [rateDrafts, setRateDrafts] = useState<Record<number, string>>({});
  const [newUserId, setNewUserId] = useState<Record<number, string>>({});
  const [newRate, setNewRate] = useState<Record<number, string>>({});
  const [assignError, setAssignError] = useState<Record<number, string>>({});

  async function load() {
    const res = await fetch("/api/payouts/table");
    if (res.ok) {
      const data = await res.json();
      setAssignments(data.assignments);
      setPayouts(data.payouts);
      setProjects(data.projects ?? []);
      setClientPayments(data.clientPayments ?? []);
      setAllUsers(data.allUsers ?? []);
      setCanManageProjects(data.canManageProjects ?? false);
      setRateDrafts(Object.fromEntries((data.assignments as Assignment[]).map((a) => [a.id, a.payout_rate])));
    }
    setLoading(false);
  }

  async function addAssignment(projectId: number, e: FormEvent) {
    e.preventDefault();
    setAssignError((prev) => ({ ...prev, [projectId]: "" }));
    const res = await fetch(`/api/projects/${projectId}/assignments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: Number(newUserId[projectId]), payoutRate: Number(newRate[projectId]) }),
    });
    if (res.ok) {
      setNewUserId((prev) => ({ ...prev, [projectId]: "" }));
      setNewRate((prev) => ({ ...prev, [projectId]: "" }));
      load();
    } else {
      const data = await res.json().catch(() => ({}));
      setAssignError((prev) => ({ ...prev, [projectId]: data.error ?? "Ошибка назначения" }));
    }
  }

  async function saveRate(assignmentId: number) {
    const value = rateDrafts[assignmentId];
    await fetch(`/api/assignments/${assignmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payoutRate: Number(value) }),
    });
    load();
  }

  async function removeAssignment(assignmentId: number) {
    await fetch(`/api/assignments/${assignmentId}`, { method: "DELETE" });
    load();
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time fetch on mount
    load();
  }, []);

  function statusFor(assignmentId: number, period: string) {
    return payouts.find((p) => p.project_assignment_id === assignmentId && p.period === period)?.status ?? "pending";
  }

  function existedAt(assignment: Assignment, period: string) {
    return periodOf(assignment.created_at) <= period;
  }

  function applicablePeriods(assignment: Assignment) {
    return PERIODS.filter((p) => existedAt(assignment, p));
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
    for (const period of applicablePeriods(a)) {
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
  // Managers see every project, even ones with no team yet, so they can add
  // the first person; read-only viewers only see projects that already have
  // assignments (nothing else to look at otherwise).
  const projectBlocks = canManageProjects
    ? projects.map((p) => ({ id: p.id, name: p.name, rows: byProject.get(p.id)?.rows ?? [] }))
    : [...byProject.entries()].map(([id, group]) => ({ id, name: group.name, rows: group.rows }));

  return (
    <div>
      <FinanceAnalytics projects={projects} assignments={assignments} payouts={payouts} periods={PERIODS} />

      <ClientPaymentsTable
        projects={projects}
        clientPayments={clientPayments}
        periods={PERIODS}
        onChange={load}
      />

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

      {projectBlocks.length === 0 ? (
        <p className="mt-6 text-sm text-gray-500">Пока нет назначений на проекты.</p>
      ) : (
        <div className="mt-6 flex flex-col gap-6">
          {projectBlocks.map((group) => (
            <div key={group.id} className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-100 p-4">
                <p className="font-medium">
                  {group.name} {group.rows.length > 0 && <span className="text-sm font-normal text-gray-400">({group.rows.length})</span>}
                </p>
              </div>

              {canManageProjects && (
                <div className="border-b border-gray-100 bg-gray-50/60 p-4">
                  {group.rows.length > 0 && (
                    <div className="flex flex-col divide-y divide-gray-100">
                      {group.rows.map((a) => (
                        <div key={a.id} className="flex items-center justify-between gap-3 py-2">
                          <span className="text-sm">{a.user_name}</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={0}
                              value={rateDrafts[a.id] ?? ""}
                              onChange={(e) => setRateDrafts((prev) => ({ ...prev, [a.id]: e.target.value }))}
                              className="w-32 rounded-lg border border-gray-300 px-2 py-1 text-sm"
                            />
                            <span className="text-xs text-gray-400">₸/мес</span>
                            <button onClick={() => saveRate(a.id)} className="rounded-lg border border-gray-300 px-2 py-1 text-xs">
                              Сохранить
                            </button>
                            <button onClick={() => removeAssignment(a.id)} className="text-xs text-red-600 underline">
                              Убрать
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {(() => {
                    const available = allUsers.filter((u) => !group.rows.some((a) => a.user_id === u.id));
                    if (available.length === 0) {
                      return group.rows.length === 0 ? (
                        <p className="text-sm text-gray-500">
                          В команде пока нет ни одного сотрудника.{" "}
                          <a href="/team" className="underline">
                            Добавьте сотрудников
                          </a>
                          , потом сможете назначить их сюда.
                        </p>
                      ) : (
                        <p className="text-sm text-gray-500">Все сотрудники уже назначены на этот проект.</p>
                      );
                    }
                    return (
                      <form
                        onSubmit={(e) => addAssignment(group.id, e)}
                        className={`flex flex-wrap items-center gap-2 ${group.rows.length > 0 ? "mt-3 border-t border-gray-100 pt-3" : ""}`}
                      >
                        <select
                          required
                          value={newUserId[group.id] ?? ""}
                          onChange={(e) => setNewUserId((prev) => ({ ...prev, [group.id]: e.target.value }))}
                          className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                        >
                          <option value="">Выберите сотрудника</option>
                          {available.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name} ({u.role_name})
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          required
                          min={0}
                          placeholder="Ставка, ₸/мес"
                          value={newRate[group.id] ?? ""}
                          onChange={(e) => setNewRate((prev) => ({ ...prev, [group.id]: e.target.value }))}
                          className="w-36 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                        />
                        <button type="submit" className="rounded-lg bg-red-600 hover:bg-red-700 px-3 py-1.5 text-sm text-white">
                          + Добавить в команду
                        </button>
                        {assignError[group.id] && <p className="w-full text-sm text-red-600">{assignError[group.id]}</p>}
                      </form>
                    );
                  })()}
                </div>
              )}

              {group.rows.length > 0 && (
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
                    const applicable = applicablePeriods(a);
                    const paidCount = applicable.filter((p) => statusFor(a.id, p) === "paid").length;
                    return (
                      <tr key={a.id} className="border-b border-gray-50 last:border-0">
                        <td className="p-3">{a.user_name}</td>
                        {PERIODS.map((period) => {
                          if (!existedAt(a, period)) {
                            return (
                              <td key={period} className="p-2 text-center">
                                <span className="block w-full rounded-lg px-2 py-1.5 text-xs text-gray-300" title="Ещё не был назначен на проект">
                                  —
                                </span>
                              </td>
                            );
                          }
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
                            ({paidCount}/{applicable.length})
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
                      const rowsThatMonth = group.rows.filter((a) => existedAt(a, period));
                      const monthTotal = rowsThatMonth.reduce((sum, a) => sum + Number(a.payout_rate), 0);
                      const monthPaid = rowsThatMonth
                        .filter((a) => statusFor(a.id, period) === "paid")
                        .reduce((sum, a) => sum + Number(a.payout_rate), 0);
                      return (
                        <td key={period} className="p-2 text-center text-xs text-gray-500">
                          {rowsThatMonth.length === 0 ? "—" : `${monthPaid.toLocaleString("ru-RU")}/${monthTotal.toLocaleString("ru-RU")}`}
                        </td>
                      );
                    })}
                    <td />
                  </tr>
                </tfoot>
              </table>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="mt-4 text-xs text-gray-400">
        Нажмите на сумму в ячейке, чтобы отметить выплату за этот месяц как сделанную или отменить. Прочерк
        «—» означает, что в этом месяце сотрудник ещё не был назначен на проект.
      </p>
    </div>
  );
}
