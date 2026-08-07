import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const projectId = formData.get("projectId") as string | null;
  if (!file || !projectId) {
    return NextResponse.json({ error: "Файл и projectId обязательны" }, { status: 400 });
  }

  const canAccess =
    user.canManageProjects ||
    (await sql`SELECT 1 FROM project_assignments WHERE user_id = ${user.id} AND project_id = ${projectId}`)
      .length > 0;
  if (!canAccess) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const blob = await put(`projects/${projectId}/${Date.now()}-${file.name}`, file, {
    access: "private",
    addRandomSuffix: false,
  });

  const rows = await sql`
    INSERT INTO project_documents (project_id, file_name, pathname, content_type, size_bytes, uploaded_by)
    VALUES (${projectId}, ${file.name}, ${blob.pathname}, ${file.type}, ${file.size}, ${user.id})
    RETURNING id
  `;

  return NextResponse.json({ id: rows[0].id, url: blob.url });
}
