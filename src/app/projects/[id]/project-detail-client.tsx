"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import AmoSection, { type AmoConnection } from "./amo-section";
import WhatsAppReportSection, { type WhatsAppReportGroup } from "./whatsapp-report-section";
import RnpTable from "./rnp-table";

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
  currency: string | null;
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

type MetaAccount = { id: string; name: string; account_id: string };

export default function ProjectDetailClient({ projectId }: { projectId: number }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const metaSetup = searchParams.get("metaSetup");
  const metaError = searchParams.get("metaError");

  const [project, setProject] = useState<Project | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [canManageProjects, setCanManageProjects] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncingId, setSyncingId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);

  const [metaAccounts, setMetaAccounts] = useState<MetaAccount[] | null>(null);
  const [selectedAccount, setSelectedAccount] = useState("");

  const [amoConnections, setAmoConnections] = useState<AmoConnection[]>([]);
  const [whatsappReportGroup, setWhatsappReportGroup] = useState<WhatsAppReportGroup>(null);

  async function load() {
    const res = await fetch(`/api/projects/${projectId}`);
    if (res.ok) {
      const data = await res.json();
      setProject(data.project);
      setConnections(data.connections);
      setDocuments(data.documents);
      setCanManageProjects(data.canManageProjects);
      setAmoConnections(data.amoConnections ?? []);
      setWhatsappReportGroup(data.whatsappReportGroup ?? null);
    }
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time fetch on mount
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  if (loading || !project) return <p className="text-gray-500">Загрузка...</p>;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{project.name}</h1>
        {canManageProjects && (
          <a href="/payouts" className="text-sm text-gray-500 underline hover:text-gray-700">
            Команда и выплаты → Финансы
          </a>
        )}
      </div>

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
              (() => {
                const currency = c.currency || "KZT";
                const fmtMoney = (n: number) =>
                  currency === "KZT"
                    ? `${n.toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ₸`
                    : `${currency} ${n.toFixed(2)}`;
                const platformLabel =
                  c.platform === "meta" ? "Meta Ads" : c.platform === "google_sheet" ? "Google Таблица" : c.platform === "manual" ? "Вручную" : c.platform;
                return (
                  <div key={c.id} className="rounded-lg border border-gray-100 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{platformLabel}</p>
                      {c.platform !== "manual" && c.platform !== "google_sheet" && (
                        <button
                          onClick={() => syncConnection(c.id)}
                          disabled={syncingId === c.id}
                          className="rounded-lg border border-gray-300 px-3 py-1 text-xs disabled:opacity-50"
                        >
                          {syncingId === c.id ? "Синхронизация..." : "Синхронизировать"}
                        </button>
                      )}
                    </div>
                    {c.summary ? (
                      <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-gray-600 sm:grid-cols-4">
                        <p>Бюджет: {fmtMoney(c.summary.spend)}</p>
                        <p>Показы: {c.summary.impressions.toLocaleString("ru-RU")}</p>
                        <p>
                          CPM: {fmtMoney(c.summary.impressions > 0 ? (c.summary.spend / c.summary.impressions) * 1000 : 0)}
                        </p>
                        <p>Клики: {c.summary.clicks.toLocaleString("ru-RU")}</p>
                        <p>CPC: {fmtMoney(c.summary.clicks > 0 ? c.summary.spend / c.summary.clicks : 0)}</p>
                        <p>
                          CTR:{" "}
                          {c.summary.impressions > 0
                            ? ((c.summary.clicks / c.summary.impressions) * 100).toFixed(2)
                            : "0.00"}
                          %
                        </p>
                        <p>Лиды: {c.summary.leads}</p>
                        <p>Цена лида: {fmtMoney(c.summary.leads > 0 ? c.summary.spend / c.summary.leads : 0)}</p>
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-gray-400">
                        Данных пока нет — нажмите «Синхронизировать».
                      </p>
                    )}
                  </div>
                );
              })()
            ))}
          </div>
        )}
      </section>

      <RnpTable projectId={projectId} />

      <AmoSection projectId={projectId} connections={amoConnections} onChange={load} />

      {canManageProjects && (
        <WhatsAppReportSection projectId={projectId} group={whatsappReportGroup} onChange={load} />
      )}

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
