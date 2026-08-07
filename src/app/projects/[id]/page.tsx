import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import Nav from "@/components/nav";
import ProjectDetailClient from "./project-detail-client";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;

  if (!user.canManageProjects) {
    const assigned = await sql`
      SELECT 1 FROM project_assignments WHERE user_id = ${user.id} AND project_id = ${id}
    `;
    if (assigned.length === 0) redirect("/dashboard");
  }

  const projects = await sql`SELECT id, name FROM projects WHERE id = ${id}`;
  if (!projects[0]) notFound();

  return (
    <>
      <Nav user={user} />
      <main className="mx-auto max-w-4xl px-6 py-8">
        <ProjectDetailClient projectId={Number(id)} />
      </main>
    </>
  );
}
