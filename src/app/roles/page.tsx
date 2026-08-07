import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import Nav from "@/components/nav";
import RolesClient from "./roles-client";

export default async function RolesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.canManageRoles) redirect("/dashboard");

  return (
    <>
      <Nav user={user} />
      <main className="mx-auto max-w-3xl px-6 py-8">
        <h1 className="text-2xl font-semibold">Роли</h1>
        <p className="mt-1 text-sm text-gray-500">
          Управляйте правами доступа. По мере роста команды можно добавлять новые роли.
        </p>
        <RolesClient />
      </main>
    </>
  );
}
