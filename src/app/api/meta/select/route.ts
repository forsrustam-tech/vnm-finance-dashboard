import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { z } from "zod";
import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

function getSecret() {
  return new TextEncoder().encode(process.env.AUTH_SECRET!);
}

const schema = z.object({
  setupToken: z.string(),
  adAccountId: z.string(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });
  }

  let payload;
  try {
    const { payload: p } = await jwtVerify(parsed.data.setupToken, getSecret());
    payload = p as { projectId: number; accessToken: string; accounts: { id: string; name: string }[] };
  } catch {
    return NextResponse.json({ error: "Ссылка для подключения истекла, попробуйте снова" }, { status: 400 });
  }

  const account = payload.accounts.find((a) => a.id === parsed.data.adAccountId);
  if (!account) {
    return NextResponse.json({ error: "Кабинет не найден" }, { status: 400 });
  }

  await sql`
    INSERT INTO ad_account_connections (project_id, platform, ad_account_id, access_token, connected_by, connected_at)
    VALUES (${payload.projectId}, 'meta', ${account.id}, ${payload.accessToken}, ${user.id}, now())
  `;

  return NextResponse.json({ ok: true });
}
