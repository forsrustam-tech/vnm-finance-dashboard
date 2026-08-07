import { NextRequest, NextResponse } from "next/server";
import { SignJWT } from "jose";
import {
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  listAdAccounts,
  verifyOAuthState,
} from "@/lib/meta";

function getSecret() {
  return new TextEncoder().encode(process.env.AUTH_SECRET!);
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const errorParam = req.nextUrl.searchParams.get("error_description");

  if (errorParam) {
    return NextResponse.redirect(new URL(`/dashboard?metaError=${encodeURIComponent(errorParam)}`, req.url));
  }
  if (!code || !state) {
    return NextResponse.redirect(new URL("/dashboard?metaError=missing_code", req.url));
  }

  try {
    const { projectId } = await verifyOAuthState(state);
    const redirectUri = new URL("/api/meta/callback", req.url).toString();

    const shortLivedToken = await exchangeCodeForToken(code, redirectUri);
    const accessToken = await exchangeForLongLivedToken(shortLivedToken);
    const accounts = await listAdAccounts(accessToken);

    const setupToken = await new SignJWT({ projectId, accessToken, accounts })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("15m")
      .sign(getSecret());

    return NextResponse.redirect(
      new URL(`/projects/${projectId}?metaSetup=${encodeURIComponent(setupToken)}`, req.url)
    );
  } catch (err) {
    console.error("Meta OAuth callback error:", err);
    return NextResponse.redirect(new URL("/dashboard?metaError=oauth_failed", req.url));
  }
}
