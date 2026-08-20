"use client";

import { useState } from "react";

export type WhatsAppReportGroup = {
  id: number;
  group_jid: string;
  group_label: string | null;
  enabled: boolean;
} | null;

export default function WhatsAppReportSection({
  projectId,
  group,
  onChange,
}: {
  projectId: number;
  group: WhatsAppReportGroup;
  onChange: () => void;
}) {
  const [editing, setEditing] = useState(!group);
  const [jid, setJid] = useState(group?.group_jid ?? "");
  const [label, setLabel] = useState(group?.group_label ?? "");
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState("");

  async function patch(body: Record<string, unknown>) {
    const res = await fetch(`/api/projects/${projectId}/whatsapp-report`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? "Ошибка сохранения");
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await patch({ groupJid: jid, groupLabel: label });
      setEditing(false);
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения");
    }
    setSaving(false);
  }

  async function toggleEnabled() {
    if (!group) return;
    setToggling(true);
    try {
      await patch({ enabled: !group.enabled });
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения");
    }
    setToggling(false);
  }

  return (
    <section className="mt-6 rounded-xl border border-gray-200 bg-white shadow-sm p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">WhatsApp-отчёт клиенту</h2>
        {group && (
          <button
            onClick={toggleEnabled}
            disabled={toggling}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
              group.enabled ? "bg-green-600" : "bg-gray-300"
            }`}
            title={group.enabled ? "Ежедневная отправка включена — нажмите, чтобы выключить" : "Выключено — нажмите, чтобы включить"}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                group.enabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        )}
      </div>

      <p className="mt-1 text-xs text-gray-400">
        Ежедневная сводка по лидам из amoCRM (и расходам на рекламу, когда подключено) — уходит автоматически
        в рабочую WhatsApp-группу с клиентом.
      </p>

      {group && !editing ? (
        <div className="mt-3 flex items-center justify-between rounded-lg bg-gray-50 p-3">
          <div>
            <p className="text-sm font-medium">{group.group_label || "Без названия"}</p>
            <p className="text-xs text-gray-400">{group.group_jid}</p>
            <p className="mt-1 text-xs">
              {group.enabled ? (
                <span className="text-green-700">Отправка включена</span>
              ) : (
                <span className="text-gray-400">Отправка выключена</span>
              )}
            </p>
          </div>
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-gray-500 underline hover:text-gray-700"
          >
            Изменить группу
          </button>
        </div>
      ) : (
        <form onSubmit={save} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="block text-xs text-gray-500">Название группы (для себя)</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Neo Clinic — рабочая группа"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-500">JID группы</label>
            <input
              value={jid}
              onChange={(e) => setJid(e.target.value)}
              placeholder="120363...@g.us"
              required
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              Сохранить
            </button>
            {group && (
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setJid(group.group_jid);
                  setLabel(group.group_label ?? "");
                }}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-500"
              >
                Отмена
              </button>
            )}
          </div>
        </form>
      )}

      <p className="mt-2 text-xs text-gray-400">
        JID группы узнаётся командой <code className="rounded bg-gray-100 px-1">npm run list-groups</code> в
        боте whatsapp-report-bot — он должен уже состоять в этой группе.
      </p>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </section>
  );
}
