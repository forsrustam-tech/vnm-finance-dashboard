"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Project = {
  id: number;
  name: string;
  status: string;
  revenue_amount: string;
  payment_due_day: number | null;
  notes: string | null;
};

type Assignment = {
  id: number;
  project_id: number;
  user_id: number;
  payout_rate: string;
  user_name: string;
};

export default function ProjectsClient() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [revenue, setRevenue] = useState("");
  const [dueDay, setDueDay] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch("/api/projects");
    if (res.ok) {
      const data = await res.json();
      setProjects(data.projects);
      setAssignments(data.assignments);
    }
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time fetch on mount
    load();
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        revenueAmount: Number(revenue),
        paymentDueDay: dueDay ? Number(dueDay) : null,
      }),
    });
    if (res.ok) {
      setName("");
      setRevenue("");
      setDueDay("");
      load();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Ошибка добавления");
    }
  }

  async function updateStatus(id: number, status: string) {
    await fetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  }

  async function deleteProject(id: number) {
    if (!confirm("Удалить проект? Все назначения и выплаты по нему тоже удалятся.")) return;
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    load();
  }

  if (loading) return <p className="mt-6 text-gray-500">Загрузка...</p>;

  return (
    <div>
      <form onSubmit={handleAdd} className="mt-6 flex flex-wrap gap-3 rounded-xl border border-gray-200 bg-white shadow-sm p-4">
        <input
          type="text"
          required
          placeholder="Название проекта / клиента"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 min-w-[200px] rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-red-500"
        />
        <input
          type="number"
          required
          min={0}
          placeholder="Доход в месяц, ₸"
          value={revenue}
          onChange={(e) => setRevenue(e.target.value)}
          className="w-44 rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-red-500"
        />
        <input
          type="number"
          min={1}
          max={31}
          placeholder="День оплаты"
          value={dueDay}
          onChange={(e) => setDueDay(e.target.value)}
          className="w-36 rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-red-500"
        />
        <button type="submit" className="rounded-lg bg-red-600 hover:bg-red-700 px-4 py-2 font-medium text-white">
          Добавить проект
        </button>
        {error && <p className="w-full text-sm text-red-600">{error}</p>}
      </form>

      <div className="mt-6 flex flex-col gap-4">
        {projects.map((p) => {
          const teamCount = assignments.filter((a) => a.project_id === p.id).length;
          return (
            <div key={p.id} className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
              <div className="flex items-center justify-between">
                <div>
                  <Link href={`/projects/${p.id}`} className="font-medium underline">
                    {p.name}
                  </Link>
                  <p className="text-sm text-gray-500">
                    Доход: {Number(p.revenue_amount).toLocaleString("ru-RU")} ₸
                    {p.payment_due_day && ` · Оплата до ${p.payment_due_day} числа`}
                    {" · "}
                    {teamCount === 0 ? "команда не назначена" : `в команде: ${teamCount}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={p.status}
                    onChange={(e) => updateStatus(p.id, e.target.value)}
                    className="rounded-lg border border-gray-300 px-2 py-1 text-sm"
                  >
                    <option value="active">Активен</option>
                    <option value="paused">На паузе</option>
                    <option value="finished">Завершён</option>
                  </select>
                  <Link href={`/projects/${p.id}`} className="text-sm underline">
                    Открыть
                  </Link>
                  <button onClick={() => deleteProject(p.id)} className="text-sm text-red-600 underline">
                    Удалить
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
