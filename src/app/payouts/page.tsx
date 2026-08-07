import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import Nav from "@/components/nav";
import PayoutsTable from "./payouts-table";

export default async function PayoutsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.canViewAllFinance) redirect("/dashboard");

  return (
    <>
      <Nav user={user} />
      <main className="mx-auto max-w-5xl px-6 py-8">
        <h1 className="text-2xl font-semibold">Выплаты по месяцам</h1>
        <PayoutsTable />
      </main>
    </>
  );
}
