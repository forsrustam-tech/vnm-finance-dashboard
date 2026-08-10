"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { formatPeriodShort, periodOf } from "@/lib/period";

type Project = { id: number; name: string; status: string; revenue_amount: string; created_at: string };
type Assignment = { id: number; payout_rate: string; project_id: number };
type Payout = { project_assignment_id: number; period: string; status: string };

const REVENUE_COLOR = "#111827"; // near-black
const EXPENSE_COLOR = "#dc2626"; // brand red
const PIE_COLORS = ["#dc2626", "#f87171", "#111827", "#6b7280", "#fca5a5", "#374151", "#9ca3af"];

export default function FinanceAnalytics({
  projects,
  assignments,
  payouts,
  periods,
}: {
  projects: Project[];
  assignments: Assignment[];
  payouts: Payout[];
  periods: string[];
}) {
  const activeProjects = projects.filter((p) => p.status === "active");
  const monthlyRevenue = activeProjects.reduce((sum, p) => sum + Number(p.revenue_amount), 0);
  const monthlyPayroll = assignments.reduce((sum, a) => sum + Number(a.payout_rate), 0);
  const monthlyProfit = monthlyRevenue - monthlyPayroll;

  const chartData = periods.map((period) => {
    const revenue = activeProjects
      .filter((p) => periodOf(p.created_at) <= period)
      .reduce((sum, p) => sum + Number(p.revenue_amount), 0);
    const paid = assignments
      .filter((a) =>
        payouts.some((p) => p.project_assignment_id === a.id && p.period === period && p.status === "paid")
      )
      .reduce((sum, a) => sum + Number(a.payout_rate), 0);
    return {
      period: formatPeriodShort(period),
      Доход: revenue,
      Расход: paid,
    };
  });

  const revenueByProject = activeProjects
    .map((p) => ({ name: p.name, value: Number(p.revenue_amount) }))
    .filter((p) => p.value > 0)
    .sort((a, b) => b.value - a.value);

  return (
    <div className="mb-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
          <p className="text-sm text-gray-500">Доход в месяц</p>
          <p className="mt-1 text-2xl font-semibold">{monthlyRevenue.toLocaleString("ru-RU")} ₸</p>
          <p className="mt-1 text-xs text-gray-400">{activeProjects.length} активных проектов</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
          <p className="text-sm text-gray-500">Расход на команду в месяц</p>
          <p className="mt-1 text-2xl font-semibold text-red-600">
            {monthlyPayroll.toLocaleString("ru-RU")} ₸
          </p>
          <p className="mt-1 text-xs text-gray-400">{assignments.length} назначений на проекты</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
          <p className="text-sm text-gray-500">Прибыль в месяц</p>
          <p className={`mt-1 text-2xl font-semibold ${monthlyProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
            {monthlyProfit.toLocaleString("ru-RU")} ₸
          </p>
          <p className="mt-1 text-xs text-gray-400">
            {monthlyRevenue > 0 ? `${Math.round((monthlyProfit / monthlyRevenue) * 100)}% маржа` : "—"}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5 lg:col-span-2">
          <p className="text-sm font-medium text-gray-700">Доход vs выплаты команде</p>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barGap={6}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="period" tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 12, fill: "#6b7280" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${(v / 1000).toLocaleString("ru-RU")}k`}
                />
                <Tooltip
                  formatter={(value) => `${Number(value).toLocaleString("ru-RU")} ₸`}
                  contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 13 }}
                />
                <Legend wrapperStyle={{ fontSize: 13 }} />
                <Bar dataKey="Доход" fill={REVENUE_COLOR} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="Расход" fill={EXPENSE_COLOR} radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-xs text-gray-400">
            Доход учитывает только проекты, которые уже существовали в этом месяце (по текущей ставке —
            история изменений суммы дохода не отслеживается). Расход — фактически выплаченные суммы за месяц.
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
          <p className="text-sm font-medium text-gray-700">Доход по проектам</p>
          <div className="mt-2 h-64">
            {revenueByProject.length === 0 ? (
              <p className="mt-8 text-center text-sm text-gray-400">Нет данных</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={revenueByProject}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={45}
                    outerRadius={80}
                    paddingAngle={2}
                    isAnimationActive={false}
                  >
                    {revenueByProject.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `${Number(value).toLocaleString("ru-RU")} ₸`} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="mt-2 flex flex-col gap-1">
            {revenueByProject.slice(0, 5).map((p, i) => (
              <div key={p.name} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-gray-600">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                  />
                  {p.name}
                </span>
                <span className="text-gray-400">{p.value.toLocaleString("ru-RU")} ₸</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
