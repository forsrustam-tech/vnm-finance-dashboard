// Meta Marketing API integration.
// Requires a Meta App (developers.facebook.com) with Marketing API access.
// Docs: https://developers.facebook.com/docs/marketing-api/insights

import { SignJWT, jwtVerify } from "jose";

const GRAPH_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function signOAuthState(projectId: number, userId: number) {
  return new SignJWT({ projectId, userId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("15m")
    .sign(getSecret());
}

export async function verifyOAuthState(token: string) {
  const { payload } = await jwtVerify(token, getSecret());
  return payload as { projectId: number; userId: number };
}

export function isMetaConfigured() {
  return Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET);
}

export function buildMetaOAuthUrl(state: string, redirectUri: string) {
  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID!,
    redirect_uri: redirectUri,
    state,
    scope: "ads_read,business_management",
    response_type: "code",
  });
  return `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
}

export async function exchangeCodeForToken(code: string, redirectUri: string) {
  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID!,
    client_secret: process.env.META_APP_SECRET!,
    redirect_uri: redirectUri,
    code,
  });
  const res = await fetch(`${GRAPH_BASE}/oauth/access_token?${params.toString()}`);
  if (!res.ok) throw new Error(`Meta token exchange failed: ${await res.text()}`);
  const data = await res.json();
  return data.access_token as string;
}

export async function exchangeForLongLivedToken(shortLivedToken: string) {
  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: process.env.META_APP_ID!,
    client_secret: process.env.META_APP_SECRET!,
    fb_exchange_token: shortLivedToken,
  });
  const res = await fetch(`${GRAPH_BASE}/oauth/access_token?${params.toString()}`);
  if (!res.ok) throw new Error(`Meta long-lived token exchange failed: ${await res.text()}`);
  const data = await res.json();
  return data.access_token as string;
}

export async function listAdAccounts(accessToken: string) {
  const params = new URLSearchParams({
    access_token: accessToken,
    fields: "id,name,account_id,currency",
  });
  const res = await fetch(`${GRAPH_BASE}/me/adaccounts?${params.toString()}`);
  if (!res.ok) throw new Error(`Meta ad accounts fetch failed: ${await res.text()}`);
  const data = await res.json();
  return data.data as { id: string; name: string; account_id: string; currency: string }[];
}

export type DailyInsight = {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
};

export async function fetchDailyInsights(
  adAccountId: string,
  accessToken: string,
  daysBack = 30
): Promise<DailyInsight[]> {
  const params = new URLSearchParams({
    access_token: accessToken,
    level: "account",
    time_increment: "1",
    date_preset: daysBack <= 7 ? "last_7d" : daysBack <= 30 ? "last_30d" : "last_90d",
    fields: "spend,impressions,clicks,actions",
  });
  const res = await fetch(`${GRAPH_BASE}/${adAccountId}/insights?${params.toString()}`);
  if (!res.ok) throw new Error(`Meta insights fetch failed: ${await res.text()}`);
  const data = await res.json();

  return (data.data ?? []).map((row: Record<string, unknown>) => {
    const actions = (row.actions as { action_type: string; value: string }[] | undefined) ?? [];
    const leadAction = actions.find((a) => a.action_type === "lead" || a.action_type === "offsite_conversion.fb_pixel_lead");
    return {
      date: row.date_start as string,
      spend: Number(row.spend ?? 0),
      impressions: Number(row.impressions ?? 0),
      clicks: Number(row.clicks ?? 0),
      leads: leadAction ? Number(leadAction.value) : 0,
    };
  });
}
