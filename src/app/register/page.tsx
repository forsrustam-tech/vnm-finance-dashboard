"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, password }),
    });

    if (res.ok) {
      router.push("/dashboard");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Ошибка регистрации");
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold">Регистрация</h1>
      <p className="mt-1 text-sm text-gray-500">
        Номер телефона должен быть добавлен руководителем.
      </p>
      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <input
          type="tel"
          required
          placeholder="Телефон"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
        />
        <input
          type="password"
          required
          minLength={6}
          placeholder="Придумайте пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-black px-4 py-3 font-medium text-white disabled:opacity-50"
        >
          {loading ? "..." : "Зарегистрироваться"}
        </button>
      </form>
      <p className="mt-4 text-sm text-gray-500">
        Уже есть аккаунт?{" "}
        <Link href="/login" className="text-black underline">
          Войти
        </Link>
      </p>
    </main>
  );
}
