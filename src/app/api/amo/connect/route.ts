import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";
import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { testAmoConnection } from "@/lib/amocrm";

const schema = z.object({
  projectId: z.coerce.number(),
  label: z.string().min(1),
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
  const { projectId, label, subdomain, accessToken } = parsed.data;

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

  const webhookSecret = randomBytes(16).toString("hex");

  await sql`
    INSERT INTO amo_connections (project_id, label, subdomain, access_token, webhook_secret, connected_by)
    VALUES (${projectId}, ${label}, ${cleanSubdomain}, ${accessToken}, ${webhookSecret}, ${user.id})
  `;

  return NextResponse.json({ ok: true });
}
