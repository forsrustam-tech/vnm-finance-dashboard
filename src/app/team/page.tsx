import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import Nav from "@/components/nav";
import TeamClient from "./team-client";

export default async function TeamPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.canManageUsers) redirect("/dashboard");

  return (
    <>
      <Nav user={user} />
      <main className="mx-auto max-w-3xl px-6 py-8">
        <h1 className="text-2xl font-semibold">Команда</h1>
        <TeamClient />
      </main>
    </>
  );
}
