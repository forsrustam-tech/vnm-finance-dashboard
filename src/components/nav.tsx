import Link from "next/link";
import type { CurrentUser } from "@/lib/auth";
import LogoutButton from "./logout-button";

export default function Nav({ user }: { user: CurrentUser }) {
  return (
    <header className="border-b-2 border-red-600 bg-white shadow-sm">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/dashboard" className="flex items-center gap-1.5 font-bold tracking-tight">
            <span className="inline-block h-2 w-2 rounded-full bg-red-600" />
            VNM
          </Link>
          {user.canViewAllFinance && (
            <Link href="/projects" className="font-medium text-gray-600 hover:text-red-600">
              Проекты
            </Link>
          )}
          {user.canViewAllFinance && (
            <Link href="/payouts" className="font-medium text-gray-600 hover:text-red-600">
              Выплаты
            </Link>
          )}
          {user.canManageUsers && (
            <Link href="/team" className="font-medium text-gray-600 hover:text-red-600">
              Команда
            </Link>
          )}
          {user.canManageRoles && (
            <Link href="/roles" className="font-medium text-gray-600 hover:text-red-600">
              Роли
            </Link>
          )}
        </nav>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">
            {user.name} · <span className="font-medium text-red-600">{user.roleName}</span>
          </span>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
