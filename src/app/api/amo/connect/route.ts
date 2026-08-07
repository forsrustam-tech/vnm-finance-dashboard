import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { testAmoConnection } from "@/lib/amocrm";

const schema = z.object({
  projectId: z.coerce.number(),
  subdomain: z.string().min(1),
  accessToken: z.string().min(10),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });
  }
  const { projectId, subdomain, accessToken } = parsed.data;

  const canAccess =
    user.canManageProjects ||
    (await sql`SELECT 1 FROM project_assignments WHERE user_id = ${user.id} AND project_id = ${projectId}`)
      .length > 0;
  if (!canAccess) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cleanSubdomain = subdomain.replace(/\.amocrm\.ru.*$/i, "").trim();

  try {
    await testAmoConnection(cleanSubdomain, accessToken);
  } catch {
    return NextResponse.json(
      { error: "Не удалось подключиться. Проверьте поддомен и токен." },
      { status: 400 }
    );
  }

  await sql`
    INSERT INTO amo_connections (project_id, subdomain, access_token, connected_by)
    VALUES (${projectId}, ${cleanSubdomain}, ${accessToken}, ${user.id})
    ON CONFLICT (project_id)
    DO UPDATE SET subdomain = ${cleanSubdomain}, access_token = ${accessToken}, connected_by = ${user.id}, connected_at = now()
  `;

  return NextResponse.json({ ok: true });
}
