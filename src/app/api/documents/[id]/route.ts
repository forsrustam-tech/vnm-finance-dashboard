import { NextRequest, NextResponse } from "next/server";
import { get, del } from "@vercel/blob";
import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

async function loadDocumentWithAccess(id: string, user: { id: number; canManageProjects: boolean }) {
  const rows = await sql`SELECT * FROM project_documents WHERE id = ${id}`;
  const doc = rows[0];
  if (!doc) return null;

  const canAccess =
    user.canManageProjects ||
    (await sql`SELECT 1 FROM project_assignments WHERE user_id = ${user.id} AND project_id = ${doc.project_id}`)
      .length > 0;

  return canAccess ? doc : null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const doc = await loadDocumentWithAccess(id, user);
  if (!doc) return NextResponse.json({ error: "Не найдено" }, { status: 404 });

  const blob = await get(doc.pathname, { access: "private" });
  if (!blob) return NextResponse.json({ error: "Файл не найден в хранилище" }, { status: 404 });

  return new Response(blob.stream, {
    headers: {
      "Content-Type": doc.content_type ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(doc.file_name)}"`,
    },
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const doc = await loadDocumentWithAccess(id, user);
  if (!doc) return NextResponse.json({ error: "Не найдено" }, { status: 404 });

  await del(doc.pathname);
  await sql`DELETE FROM project_documents WHERE id = ${id}`;

  return NextResponse.json({ ok: true });
}
