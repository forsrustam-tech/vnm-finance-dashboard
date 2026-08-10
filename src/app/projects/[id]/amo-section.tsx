"use client";

import { useEffect, useState } from "react";

export type AmoConnection = { id: number; label: string; subdomain: string };

type AmoSummary = {
  totalLeads: number;
  byStage: { name: string; count: number }[];
  recentLeads: { name: string; price: number; stageName: string; createdAt: string }[];
};

export default function AmoSection({
  projectId,
  connections,
  onChange,
}: {
  projectId: number;
  connections: AmoConnection[];
  onChange: () => void;
}) {
  const [label, setLabel] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [token, setToken] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    setConnecting(true);
    setError("");
    const res = await fetch("/api/amo/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, label, subdomain, accessToken: token }),
    });
    if (res.ok) {
      setLabel("");
      setSubdomain("");
      setToken("");
      onChange();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Ошибка подключения");
    }
    setConnecting(false);
  }

  return (
    <section className="mt-6 rounded-xl border border-gray-200 bg-white shadow-sm p-5">
      <h2 className="text-lg font-medium">amoCRM</h2>

      {connections.length === 0 ? (
        <p className="mt-3 text-sm text-gray-500">Пока не подключено ни одного аккаунта.</p>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          {connections.map((c) => (
            <AmoConnectionCard key={c.id} connection={c} onChange={onChange} />
          ))}
        </div>
      )}

      <form onSubmit={connect} className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
        <input
          type="text"
          required
          placeholder="Название (например Астана)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="w-44 rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          type="text"
          required
          placeholder="Поддомен (например clinic)"
          value={subdomain}
          onChange={(e) => setSubdomain(e.target.value)}
          className="w-44 rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          type="password"
          required
          placeholder="Долгосрочный токен"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          className="flex-1 min-w-[220px] rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={connecting}
          className="rounded-lg bg-red-600 hover:bg-red-700 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {connecting ? "Подключение..." : "Добавить аккаунт amoCRM"}
        </button>
        {error && <p className="w-full text-sm text-red-600">{error}</p>}
        <p className="w-full text-xs text-gray-400">
          Если у клиента несколько городов/филиалов с разными amoCRM — подключи каждый отдельно
          со своим названием (например «Астана», «Алматы»). Токен создаётся в amoCRM клиента:
          Настройки → Интеграции → Создать интеграцию → Приватная → «Ключи и доступы» →
          Долгосрочный токен.
        </p>
      </form>
    </section>
  );
}

function AmoConnectionCard({
  connection,
  onChange,
}: {
  connection: AmoConnection;
  onChange: () => void;
}) {
  const [summary, setSummary] = useState<AmoSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [error, setError] = useState("");

  async function loadSummary() {
    setLoadingSummary(true);
    setError("");
    const res = await fetch(`/api/amo/summary?connectionId=${connection.id}`);
    if (res.ok) {
      const data = await res.json();
      setSummary(data.summary);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Не удалось загрузить данные из amoCRM");
    }
    setLoadingSummary(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time fetch on mount
    loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection.id]);

  async function disconnect() {
    if (!confirm(`Отключить amoCRM «${connection.label}» от этого проекта?`)) return;
    await fetch(`/api/amo/connections/${connection.id}`, { method: "DELETE" });
    onChange();
  }

  return (
    <div className="rounded-lg border border-gray-100 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">{connection.label}</p>
          <p className="text-xs text-gray-400">{connection.subdomain}.amocrm.ru</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadSummary}
            disabled={loadingSummary}
            className="rounded-lg border border-gray-300 px-3 py-1 text-xs disabled:opacity-50"
          >
            {loadingSummary ? "Обновление..." : "Обновить"}
          </button>
          <button onClick={disconnect} className="rounded-lg border border-gray-300 px-3 py-1 text-xs text-red-600">
            Отключить
          </button>
        </div>
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {summary && (
        <>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-gray-500">Заявок за 30 дней</p>
              <p className="text-xl font-semibold">{summary.totalLeads}</p>
            </div>
            {summary.byStage.map((s) => (
              <div key={s.name} className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-500">{s.name}</p>
                <p className="text-xl font-semibold">{s.count}</p>
              </div>
            ))}
          </div>
          {summary.recentLeads.length > 0 && (
            <div className="mt-4 divide-y divide-gray-100 border-t border-gray-100">
              {summary.recentLeads.map((l, i) => (
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
  );
}
