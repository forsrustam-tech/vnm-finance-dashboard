import Link from "next/link";
import type { CurrentUser } from "@/lib/auth";
import LogoutButton from "./logout-button";

export default function Nav({ user }: { user: CurrentUser }) {
  return (
    <header className="border-b border-gray-200">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <nav className="flex items-center gap-5 text-sm">
          <Link href="/dashboard" className="font-semibold">
            VNM
          </Link>
          {user.canViewAllFinance && (
            <Link href="/projects" className="text-gray-600 hover:text-black">
              Проекты
            </Link>
          )}
          {user.canManageUsers && (
            <Link href="/team" className="text-gray-600 hover:text-black">
              Команда
            </Link>
          )}
          {user.canManageRoles && (
            <Link href="/roles" className="text-gray-600 hover:text-black">
              Роли
            </Link>
          )}
        </nav>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">
            {user.name} · {user.roleName}
          </span>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
