"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

type Project = {
  id: number;
  name: string;
  status: string;
  revenue_amount: string;
  payment_due_day: number | null;
  notes: string | null;
};

type Connection = {
  id: number;
  platform: string;
  ad_account_id: string;
  connected_at: string;
  summary: { spend: number; impressions: number; clicks: number; leads: number; days: number } | null;
};

type Document = {
  id: number;
  file_name: string;
  content_type: string | null;
  size_bytes: number | null;
  created_at: string;
};

type Assignment = {
  id: number;
  user_id: number;
  payout_rate: string;
  user_name: string;
};

type Targetolog = { id: number; name: string; role_name: string };

type MetaAccount = { id: string; name: string; account_id: string };

type AmoConnection = { subdomain: string } | null;

type AmoSummary = {
  totalLeads: number;
  byStage: { name: string; count: number }[];
  recentLeads: { name: string; price: number; stageName: string; createdAt: string }[];
};

export default function ProjectDetailClient({ projectId }: { projectId: number }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const metaSetup = searchParams.get("metaSetup");
  const metaError = searchParams.get("metaError");

  const [project, setProject] = useState<Project | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [targetologs, setTargetologs] = useState<Targetolog[]>([]);
  const [canManageProjects, setCanManageProjects] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncingId, setSyncingId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);

  const [metaAccounts, setMetaAccounts] = useState<MetaAccount[] | null>(null);
  const [selectedAccount, setSelectedAccount] = useState("");

  const [newUserId, setNewUserId] = useState("");
  const [newRate, setNewRate] = useState("");
  const [assignError, setAssignError] = useState("");
  const [rateDrafts, setRateDrafts] = useState<Record<number, string>>({});

  const [amoConnection, setAmoConnection] = useState<AmoConnection>(null);
  const [amoSummary, setAmoSummary] = useState<AmoSummary | null>(null);
  const [amoLoadingSummary, setAmoLoadingSummary] = useState(false);
  const [amoSubdomain, setAmoSubdomain] = useState("");
  const [amoToken, setAmoToken] = useState("");
  const [amoConnecting, setAmoConnecting] = useState(false);
  const [amoError, setAmoError] = useState("");

  async function load() {
    const res = await fetch(`/api/projects/${projectId}`);
    if (res.ok) {
      const data = await res.json();
      setProject(data.project);
      setConnections(data.connections);
      setDocuments(data.documents);
      setAssignments(data.assignments);
      setTargetologs(data.targetologs ?? []);
      setCanManageProjects(data.canManageProjects);
      setRateDrafts(Object.fromEntries(data.assignments.map((a: Assignment) => [a.id, a.payout_rate])));
      setAmoConnection(data.amoConnection ?? null);
    }
    setLoading(false);
  }

  async function loadAmoSummary() {
    setAmoLoadingSummary(true);
    setAmoError("");
    const res = await fetch(`/api/amo/summary?projectId=${projectId}`);
    if (res.ok) {
      const data = await res.json();
      setAmoSummary(data.summary);
    } else {
      const data = await res.json().catch(() => ({}));
      setAmoError(data.error ?? "Не удалось загрузить данные из amoCRM");
    }
    setAmoLoadingSummary(false);
  }

  async function connectAmo(e: React.FormEvent) {
    e.preventDefault();
    setAmoConnecting(true);
    setAmoError("");
    const res = await fetch("/api/amo/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, subdomain: amoSubdomain, accessToken: amoToken }),
    });
    if (res.ok) {
      setAmoSubdomain("");
      setAmoToken("");
      await load();
      loadAmoSummary();
    } else {
      const data = await res.json().catch(() => ({}));
      setAmoError(data.error ?? "Ошибка подключения");
    }
    setAmoConnecting(false);
  }

  async function disconnectAmo() {
    if (!confirm("Отключить amoCRM от этого проекта?")) return;
    await fetch(`/api/amo/connections/${projectId}`, { method: "DELETE" });
    setAmoSummary(null);
    load();
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time fetch on mount
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on connection change
    if (amoConnection) loadAmoSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amoConnection?.subdomain]);

  useEffect(() => {
    if (!metaSetup) return;
    fetch(`/api/meta/setup-info?token=${encodeURIComponent(metaSetup)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.accounts) setMetaAccounts(data.accounts);
      });
  }, [metaSetup]);

  async function confirmAccount() {
    if (!metaSetup || !selectedAccount) return;
    await fetch("/api/meta/select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ setupToken: metaSetup, adAccountId: selectedAccount }),
    });
    setMetaAccounts(null);
    router.replace(`/projects/${projectId}`);
    load();
  }

  async function syncConnection(connectionId: number) {
    setSyncingId(connectionId);
    await fetch("/api/meta/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connectionId }),
    });
    setSyncingId(null);
    load();
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("projectId", String(projectId));
    await fetch("/api/documents", { method: "POST", body: formData });
    setUploading(false);
    e.target.value = "";
    load();
  }

  async function deleteDocument(id: number) {
    if (!confirm("Удалить документ?")) return;
    await fetch(`/api/documents/${id}`, { method: "DELETE" });
    load();
  }

  async function addAssignment(e: React.FormEvent) {
    e.preventDefault();
    setAssignError("");
    const res = await fetch(`/api/projects/${projectId}/assignments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: Number(newUserId), payoutRate: Number(newRate) }),
    });
    if (res.ok) {
      setNewUserId("");
      setNewRate("");
      load();
    } else {
      const data = await res.json().catch(() => ({}));
      setAssignError(data.error ?? "Ошибка назначения");
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

  if (loading || !project) return <p className="text-gray-500">Загрузка...</p>;

  return (
    <div>
      <h1 className="text-2xl font-semibold">{project.name}</h1>

      {metaError && (
        <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          Не удалось подключить рекламный кабинет: {metaError}
        </div>
      )}

      {metaAccounts && (
        <div className="mt-4 rounded-xl border border-gray-200 bg-white shadow-sm p-4">
          <p className="font-medium">Выберите рекламный кабинет</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2"
            >
              <option value="">Выберите кабинет</option>
              {metaAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.account_id})
                </option>
              ))}
            </select>
            <button
              onClick={confirmAccount}
              disabled={!selectedAccount}
              className="rounded-lg bg-red-600 hover:bg-red-700 px-4 py-2 text-white disabled:opacity-50"
            >
              Подключить
            </button>
          </div>
        </div>
      )}

      {canManageProjects && (
        <section className="mt-6 rounded-xl border border-gray-200 bg-white shadow-sm p-5">
          <h2 className="text-lg font-medium">Команда и выплаты</h2>

          {assignments.length === 0 ? (
            <p className="mt-3 text-sm text-gray-500">На проект пока никто не назначен.</p>
          ) : (
            <div className="mt-3 divide-y divide-gray-100">
              {assignments.map((a) => (
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
                    <button
                      onClick={() => saveRate(a.id)}
                      className="rounded-lg border border-gray-300 px-2 py-1 text-xs"
                    >
                      Сохранить
                    </button>
                    <button
                      onClick={() => removeAssignment(a.id)}
                      className="text-xs text-red-600 underline"
                    >
                      Убрать
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {targetologs.filter((t) => !assignments.some((a) => a.user_id === t.id)).length > 0 && (
            <form onSubmit={addAssignment} className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
              <select
                required
                value={newUserId}
                onChange={(e) => setNewUserId(e.target.value)}
                className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
              >
                <option value="">Выберите сотрудника</option>
                {targetologs
                  .filter((t) => !assignments.some((a) => a.user_id === t.id))
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.role_name})
                    </option>
                  ))}
              </select>
              <input
                type="number"
                required
                min={0}
                placeholder="Ставка, ₸/мес"
                value={newRate}
                onChange={(e) => setNewRate(e.target.value)}
                className="w-36 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
              />
              <button type="submit" className="rounded-lg bg-red-600 hover:bg-red-700 px-3 py-1.5 text-sm text-white">
                Назначить
              </button>
              {assignError && <p className="w-full text-sm text-red-600">{assignError}</p>}
            </form>
          )}
        </section>
      )}

      <section className="mt-6 rounded-xl border border-gray-200 bg-white shadow-sm p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Рекламные кабинеты</h2>
          <div className="flex gap-2">
            <a
              href={`/api/projects/${projectId}/report`}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
            >
              Скачать отчёт
            </a>
            <a
              href={`/api/meta/connect?projectId=${projectId}`}
              className="rounded-lg bg-red-600 hover:bg-red-700 px-3 py-1.5 text-sm text-white"
            >
              Подключить рекламный кабинет
            </a>
          </div>
        </div>

        {connections.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">Кабинеты не подключены.</p>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            {connections.map((c) => (
              <div key={c.id} className="rounded-lg border border-gray-100 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Meta Ads — {c.ad_account_id}</p>
                  <button
                    onClick={() => syncConnection(c.id)}
                    disabled={syncingId === c.id}
                    className="rounded-lg border border-gray-300 px-3 py-1 text-xs disabled:opacity-50"
                  >
                    {syncingId === c.id ? "Синхронизация..." : "Синхронизировать"}
                  </button>
                </div>
                {c.summary ? (
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-gray-600 sm:grid-cols-4">
                    <p>Бюджет: ${c.summary.spend.toFixed(2)}</p>
                    <p>Показы: {c.summary.impressions.toLocaleString("ru-RU")}</p>
                    <p>
                      CPM: $
                      {c.summary.impressions > 0
                        ? ((c.summary.spend / c.summary.impressions) * 1000).toFixed(2)
                        : "0.00"}
                    </p>
                    <p>Клики: {c.summary.clicks.toLocaleString("ru-RU")}</p>
                    <p>
                      CPC: $
                      {c.summary.clicks > 0 ? (c.summary.spend / c.summary.clicks).toFixed(2) : "0.00"}
                    </p>
                    <p>
                      CTR:{" "}
                      {c.summary.impressions > 0
                        ? ((c.summary.clicks / c.summary.impressions) * 100).toFixed(2)
                        : "0.00"}
                      %
                    </p>
                    <p>Лиды: {c.summary.leads}</p>
                    <p>
                      Цена лида: $
                      {c.summary.leads > 0 ? (c.summary.spend / c.summary.leads).toFixed(2) : "0.00"}
                    </p>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-gray-400">
                    Данных пока нет — нажмите «Синхронизировать».
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-6 rounded-xl border border-gray-200 bg-white shadow-sm p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">amoCRM</h2>
          {amoConnection && (
            <div className="flex gap-2">
              <button
                onClick={loadAmoSummary}
                disabled={amoLoadingSummary}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50"
              >
                {amoLoadingSummary ? "Обновление..." : "Обновить"}
              </button>
              <button
                onClick={disconnectAmo}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-red-600"
              >
                Отключить
              </button>
            </div>
          )}
        </div>

        {!amoConnection ? (
          <form onSubmit={connectAmo} className="mt-3 flex flex-wrap gap-2">
            <input
              type="text"
              required
              placeholder="Поддомен (например clinic)"
              value={amoSubdomain}
              onChange={(e) => setAmoSubdomain(e.target.value)}
              className="w-56 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <input
              type="password"
              required
              placeholder="Долгосрочный токен"
              value={amoToken}
              onChange={(e) => setAmoToken(e.target.value)}
              className="flex-1 min-w-[220px] rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={amoConnecting}
              className="rounded-lg bg-red-600 hover:bg-red-700 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {amoConnecting ? "Подключение..." : "Подключить amoCRM"}
            </button>
            {amoError && <p className="w-full text-sm text-red-600">{amoError}</p>}
            <p className="w-full text-xs text-gray-400">
              Токен создаётся в amoCRM клиента: Настройки → Интеграции → Создать интеграцию →
              Приватная → вкладка «Ключи и доступы» → Долгосрочный токен.
            </p>
          </form>
        ) : (
          <div className="mt-3">
            <p className="text-sm text-gray-500">Подключено: {amoConnection.subdomain}.amocrm.ru</p>
            {amoError && <p className="mt-2 text-sm text-red-600">{amoError}</p>}
            {amoSummary && (
              <>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-gray-100 p-3">
                    <p className="text-xs text-gray-500">Заявок за 30 дней</p>
                    <p className="text-xl font-semibold">{amoSummary.totalLeads}</p>
                  </div>
                  {amoSummary.byStage.map((s) => (
                    <div key={s.name} className="rounded-lg border border-gray-100 p-3">
                      <p className="text-xs text-gray-500">{s.name}</p>
                      <p className="text-xl font-semibold">{s.count}</p>
                    </div>
                  ))}
                </div>
                {amoSummary.recentLeads.length > 0 && (
                  <div className="mt-4 divide-y divide-gray-100 border-t border-gray-100">
                    {amoSummary.recentLeads.map((l, i) => (
                      <div key={i} className="flex items-center justify-between py-2 text-sm">
                        <span>{l.name}</span>
                        <span className="text-gray-500">
                          {l.stageName} · {new Date(l.createdAt).toLocaleDateString("ru-RU")}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </section>

      <section className="mt-6 rounded-xl border border-gray-200 bg-white shadow-sm p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Документы и креативы</h2>
          <label className="cursor-pointer rounded-lg bg-red-600 hover:bg-red-700 px-3 py-1.5 text-sm text-white">
            {uploading ? "Загрузка..." : "Загрузить файл"}
            <input type="file" onChange={handleUpload} disabled={uploading} className="hidden" />
          </label>
        </div>
        {documents.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">Документов пока нет.</p>
        ) : (
          <div className="mt-3 divide-y divide-gray-100">
            {documents.map((d) => (
              <div key={d.id} className="flex items-center justify-between py-2">
                <a href={`/api/documents/${d.id}`} className="text-sm underline">
                  {d.file_name}
                </a>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">
                    {d.size_bytes ? `${Math.round(d.size_bytes / 1024)} КБ` : ""}
                  </span>
                  <button
                    onClick={() => deleteDocument(d.id)}
                    className="text-xs text-red-600 underline"
                  >
                    Удалить
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
