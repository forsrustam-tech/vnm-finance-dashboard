"use client";

import { useEffect, useState } from "react";

type User = {
  id: number;
  name: string;
  phone: string;
  activated: boolean;
  role_id: number;
  role_name: string;
};

type Role = { id: number; name: string };

export default function TeamClient() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [roleId, setRoleId] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch("/api/team");
    if (res.ok) {
      const data = await res.json();
      setUsers(data.users);
      setRoles(data.roles);
      if (!roleId && data.roles.length > 0) setRoleId(String(data.roles.at(-1).id));
    }
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time fetch on mount
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone, roleId: Number(roleId) }),
    });
    if (res.ok) {
      setName("");
      setPhone("");
      load();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Ошибка добавления");
    }
  }

  async function changeRole(id: number, newRoleId: string) {
    await fetch(`/api/team/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roleId: Number(newRoleId) }),
    });
    load();
  }

  async function removeUser(id: number) {
    if (!confirm("Удалить сотрудника?")) return;
    await fetch(`/api/team/${id}`, { method: "DELETE" });
    load();
  }

  if (loading) return <p className="mt-6 text-gray-500">Загрузка...</p>;

  return (
    <div>
      <form onSubmit={handleAdd} className="mt-6 flex flex-wrap gap-3 rounded-xl border border-gray-200 p-4">
        <input
          type="text"
          required
          placeholder="Имя"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 min-w-[160px] rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-black"
        />
        <input
          type="tel"
          required
          placeholder="Телефон"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="flex-1 min-w-[160px] rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-black"
        />
        <select
          required
          value={roleId}
          onChange={(e) => setRoleId(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2"
        >
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded-lg bg-black px-4 py-2 font-medium text-white">
          Добавить
        </button>
        {error && <p className="w-full text-sm text-red-600">{error}</p>}
      </form>

      <div className="mt-6 divide-y divide-gray-100 rounded-xl border border-gray-200">
        {users.map((u) => (
          <div key={u.id} className="flex items-center justify-between p-4">
            <div>
              <p className="font-medium">{u.name}</p>
              <p className="text-sm text-gray-500">{u.phone}</p>
              <p className="text-sm">
                {u.activated ? (
                  <span className="text-green-600">Аккаунт активирован</span>
                ) : (
                  <span className="text-amber-600">Ждёт регистрации</span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={u.role_id}
                onChange={(e) => changeRole(u.id, e.target.value)}
                className="rounded-lg border border-gray-300 px-2 py-1 text-sm"
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              <button onClick={() => removeUser(u.id)} className="text-sm text-red-600 underline">
                Удалить
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
