import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import Nav from "@/components/nav";
import TrainingClient from "./training-client";

export default async function TrainingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <>
      <Nav user={user} />
      <main className="mx-auto max-w-5xl px-6 py-8">
        <h1 className="text-2xl font-semibold">Обучение</h1>
        <p className="mt-1 text-sm text-gray-500">Видео для команды — вставьте ссылку на YouTube, остальное подтянется само.</p>
        <TrainingClient canManage={user.canManageProjects} />
      </main>
    </>
  );
}
