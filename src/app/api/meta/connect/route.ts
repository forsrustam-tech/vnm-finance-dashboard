import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { buildMetaOAuthUrl, isMetaConfigured, signOAuthState } from "@/lib/meta";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));

  const projectId = Number(req.nextUrl.searchParams.get("projectId"));
  if (!projectId) {
    return NextResponse.json({ error: "projectId обязателен" }, { status: 400 });
  }

  if (!isMetaConfigured()) {
    return NextResponse.json(
      { error: "Meta App ещё не настроен (META_APP_ID / META_APP_SECRET)" },
      { status: 503 }
    );
  }

  const canAccess = user.canManageProjects || (await isAssignedToProject(user.id, projectId));
  if (!canAccess) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const state = await signOAuthState(projectId, user.id);
  const redirectUri = new URL("/api/meta/callback", req.url).toString();
  const oauthUrl = buildMetaOAuthUrl(state, redirectUri);

  return NextResponse.redirect(oauthUrl);
}

async function isAssignedToProject(userId: number, projectId: number) {
  const rows = await sql`
    SELECT 1 FROM project_assignments WHERE user_id = ${userId} AND project_id = ${projectId}
  `;
  return rows.length > 0;
}
