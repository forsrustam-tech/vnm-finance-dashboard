import { formatPeriod } from "@/lib/period";

type Project = {
  id: number;
  name: string;
  status: string;
};

type Assignment = {
  id: number;
  project_id: number;
  payout_rate: string;
  payout_status: string;
};

export default function TargetologCabinet({
  projects,
  assignments,
  period,
}: {
  projects: Project[];
  assignments: Assignment[];
  period: string;
}) {
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const myProjects = assignments
    .map((a) => ({ ...a, project: projectById.get(a.project_id) }))
    .filter((a) => a.project);

  const totalEarned = myProjects.reduce((sum, a) => sum + Number(a.payout_rate), 0);
  const totalPaid = myProjects
    .filter((a) => a.payout_status === "paid")
    .reduce((sum, a) => sum + Number(a.payout_rate), 0);

  return (
    <div>
      <h1 className="text-2xl font-semibold">Мои проекты — {formatPeriod(period)}</h1>

      <div className="mt-6 grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Проектов</p>
          <p className="mt-1 text-3xl font-semibold">{myProjects.length}</p>
        </div>
        <div className="rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Всего за месяц</p>
          <p className="mt-1 text-3xl font-semibold">{totalEarned.toLocaleString("ru-RU")} ₸</p>
        </div>
        <div className="rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Выплачено</p>
          <p className="mt-1 text-3xl font-semibold text-green-600">
            {totalPaid.toLocaleString("ru-RU")} ₸
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        {myProjects.length === 0 && (
          <p className="text-sm text-gray-500">Пока нет назначенных проектов.</p>
        )}
        {myProjects.map((a) => (
          <div
            key={a.id}
            className="flex items-center justify-between rounded-xl border border-gray-200 p-5"
          >
            <div>
              <p className="font-medium">{a.project!.name}</p>
              <p className="text-sm text-gray-500">
                {a.project!.status === "active" ? "Активен" : a.project!.status === "paused" ? "На паузе" : "Завершён"}
              </p>
            </div>
            <div className="text-right">
              <p className="font-semibold">{Number(a.payout_rate).toLocaleString("ru-RU")} ₸</p>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  a.payout_status === "paid"
                    ? "bg-green-50 text-green-600"
                    : "bg-amber-50 text-amber-600"
                }`}
              >
                {a.payout_status === "paid" ? "Выплачено" : "Ожидает выплаты"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
