"use client";

import { useEffect, useState } from "react";

type Role = {
  id: number;
  name: string;
  can_view_all_finance: boolean;
  can_manage_projects: boolean;
  can_manage_users: boolean;
  can_manage_roles: boolean;
  is_system: boolean;
};

const PERMISSION_LABELS: { key: keyof Role; label: string }[] = [
  { key: "can_view_all_finance", label: "Видит все финансы" },
  { key: "can_manage_projects", label: "Управляет проектами" },
  { key: "can_manage_users", label: "Управляет командой" },
  { key: "can_manage_roles", label: "Управляет ролями" },
];

export default function RolesClient() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch("/api/roles");
    if (res.ok) {
      const data = await res.json();
      setRoles(data.roles);
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
    const res = await fetch("/api/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        canViewAllFinance: false,
        canManageProjects: false,
        canManageUsers: false,
        canManageRoles: false,
      }),
    });
    if (res.ok) {
      setName("");
      load();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Ошибка добавления");
    }
  }

  async function togglePermission(role: Role, key: keyof Role) {
    const value = !role[key];
    setRoles((prev) => prev.map((r) => (r.id === role.id ? { ...r, [key]: value } : r)));
    await fetch(`/api/roles/${role.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [toCamelKey(key)]: value }),
    });
  }

  async function removeRole(id: number) {
    if (!confirm("Удалить роль?")) return;
    const res = await fetch(`/api/roles/${id}`, { method: "DELETE" });
    if (res.ok) {
      load();
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Не удалось удалить роль");
    }
  }

  if (loading) return <p className="mt-6 text-gray-500">Загрузка...</p>;

  return (
    <div>
      <form onSubmit={handleAdd} className="mt-6 flex gap-3 rounded-xl border border-gray-200 bg-white shadow-sm p-4">
        <input
          type="text"
          required
          placeholder="Название новой роли"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-red-500"
        />
        <button type="submit" className="rounded-lg bg-red-600 hover:bg-red-700 px-4 py-2 font-medium text-white">
          Добавить роль
        </button>
        {error && <p className="w-full text-sm text-red-600">{error}</p>}
      </form>

      <div className="mt-6 flex flex-col gap-4">
        {roles.map((role) => (
          <div key={role.id} className="rounded-xl border border-gray-200 bg-white shadow-sm p-4">
            <div className="flex items-center justify-between">
              <p className="font-medium">
                {role.name} {role.is_system && <span className="text-xs text-gray-400">(системная)</span>}
              </p>
              {!role.is_system && (
                <button onClick={() => removeRole(role.id)} className="text-sm text-red-600 underline">
                  Удалить
                </button>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-4">
              {PERMISSION_LABELS.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(role[key])}
                    disabled={role.is_system}
                    onChange={() => togglePermission(role, key)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function toCamelKey(key: string): string {
  return key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}
