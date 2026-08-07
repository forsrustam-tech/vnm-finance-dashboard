import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export default async function Home() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  const existing = await sql`SELECT id FROM users LIMIT 1`;
  if (existing.length === 0) redirect("/setup");

  redirect("/login");
}
