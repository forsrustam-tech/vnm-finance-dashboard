import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import Nav from "@/components/nav";
import ProjectsClient from "./projects-client";

export default async function ProjectsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.canManageProjects) redirect("/dashboard");

  return (
    <>
      <Nav user={user} />
      <main className="mx-auto max-w-5xl px-6 py-8">
        <h1 className="text-2xl font-semibold">Проекты</h1>
        <ProjectsClient />
      </main>
    </>
  );
}
