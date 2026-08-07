import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

function getSecret() {
  return new TextEncoder().encode(process.env.AUTH_SECRET!);
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "token обязателен" }, { status: 400 });

  try {
    const { payload } = await jwtVerify(token, getSecret());
    const { projectId, accounts } = payload as {
      projectId: number;
      accounts: { id: string; name: string; account_id: string }[];
    };
    return NextResponse.json({ projectId, accounts });
  } catch {
    return NextResponse.json({ error: "Ссылка истекла" }, { status: 400 });
  }
}
