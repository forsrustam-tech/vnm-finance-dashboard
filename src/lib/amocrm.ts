// amoCRM integration — private-integration long-lived token per client account.
// Docs: https://www.amocrm.ru/developers/content/crm_platform/leads-api

export async function testAmoConnection(subdomain: string, token: string) {
  const res = await fetch(`https://${subdomain}.amocrm.ru/api/v4/account`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`amoCRM connection test failed: ${res.status}`);
  return res.json();
}

type PipelineStatus = { id: number; name: string };
type Pipeline = { id: number; name: string; _embedded: { statuses: PipelineStatus[] } };

export type AmoSummary = {
  totalLeads: number;
  byStage: { name: string; count: number }[];
  recentLeads: { name: string; price: number; stageName: string; createdAt: string }[];
};

type AmoEvent = { entity_id: number; created_at: number; value_after?: { lead_status?: { id: number } }[] };

// Lead ids that transitioned INTO `statusId` within [fromMs, toMs), by the
// actual moment of transition (via the Events API), not by created_at or
// current status — a lead created last week but moved into this stage today
// should count today, and a lead that later moves OUT of this stage should
// still count for the day it entered, which a leads-list filtered by
// created_at/closed_at + current status_id can never tell you correctly.
async function fetchStageEntryLeadIds(
  subdomain: string,
  token: string,
  statusId: number,
  fromMs: number,
  toMs: number
): Promise<number[]> {
  const headers = { Authorization: `Bearer ${token}` };
  const base = `https://${subdomain}.amocrm.ru/api/v4`;
  const from = Math.floor(fromMs / 1000);
  const to = Math.floor(toMs / 1000);

  const ids = new Set<number>();
  let page = 1;
  // Guard against an unbounded loop on a very busy pipeline — 10 pages of
  // 250 is 2500 status-change events in one day, far beyond any realistic
  // single-connection volume this dashboard serves.
  for (; page <= 10; page++) {
    const res = await fetch(
      `${base}/events?filter[type]=lead_status_changed&filter[entity]=lead&filter[created_at][from]=${from}&filter[created_at][to]=${to}&limit=250&page=${page}`,
      { headers }
    );
    if (res.status === 204) break; // amoCRM returns 204 (no body) once a filtered page is empty
    if (!res.ok) throw new Error(`amoCRM events fetch failed: ${res.status}`);
    const data = await res.json();
    const events: AmoEvent[] = data._embedded?.events ?? [];
    if (events.length === 0) break;
    for (const ev of events) {
      if (ev.value_after?.[0]?.lead_status?.id === statusId) ids.add(ev.entity_id);
    }
    if (events.length < 250) break;
  }
  return [...ids];
}

// Sums the current `price` of a batch of leads by id — used to turn a list of
// "entered this stage today" lead ids into a ₸ total (bookings sum, won revenue).
async function fetchLeadsPriceSum(subdomain: string, token: string, leadIds: number[]): Promise<number> {
  if (leadIds.length === 0) return 0;
  const headers = { Authorization: `Bearer ${token}` };
  const base = `https://${subdomain}.amocrm.ru/api/v4`;
  const batchSize = 50;
  let total = 0;
  for (let i = 0; i < leadIds.length; i += batchSize) {
    const batch = leadIds.slice(i, i + batchSize);
    const qs = batch.map((id) => `filter[id][]=${id}`).join("&");
    const res = await fetch(`${base}/leads?${qs}&limit=250`, { headers });
    if (res.status === 204) continue;
    if (!res.ok) throw new Error(`amoCRM leads-by-id fetch failed: ${res.status}`);
    const data = await res.json();
    const leads: { price: number }[] = data._embedded?.leads ?? [];
    for (const lead of leads) total += Number(lead.price) || 0;
  }
  return total;
}

// Count + ₸ total of leads that entered `statusId` within [fromMs, toMs),
// dated by actual transition moment. Used for both the booking stage and the
// won stage — same shape of question ("how many, and worth how much, entered
// this stage today"), just a different statusId.
export async function fetchStageEntrySummary(
  subdomain: string,
  token: string,
  statusId: number,
  fromMs: number,
  toMs: number
): Promise<{ count: number; revenue: number }> {
  const ids = await fetchStageEntryLeadIds(subdomain, token, statusId, fromMs, toMs);
  const revenue = await fetchLeadsPriceSum(subdomain, token, ids);
  return { count: ids.length, revenue };
}

export async function fetchAmoSummary(subdomain: string, token: string): Promise<AmoSummary> {
  const headers = { Authorization: `Bearer ${token}` };
  const base = `https://${subdomain}.amocrm.ru/api/v4`;

  const pipelinesRes = await fetch(`${base}/leads/pipelines`, { headers });
  if (!pipelinesRes.ok) throw new Error(`amoCRM pipelines fetch failed: ${pipelinesRes.status}`);
  const pipelinesData = await pipelinesRes.json();
  const pipelines: Pipeline[] = pipelinesData._embedded?.pipelines ?? [];

  const stageNames = new Map<number, string>();
  for (const pipeline of pipelines) {
    for (const status of pipeline._embedded?.statuses ?? []) {
      stageNames.set(status.id, status.name);
    }
  }

  const since = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
  const leadsRes = await fetch(
    `${base}/leads?filter[created_at][from]=${since}&order[created_at]=desc&limit=250`,
    { headers }
  );
  if (!leadsRes.ok) throw new Error(`amoCRM leads fetch failed: ${leadsRes.status}`);
  const leadsData = await leadsRes.json();
  const leads: { id: number; name: string; price: number; status_id: number; created_at: number }[] =
    leadsData._embedded?.leads ?? [];

  const stageCounts = new Map<string, number>();
  for (const lead of leads) {
    const stageName = stageNames.get(lead.status_id) ?? "Неизвестный этап";
    stageCounts.set(stageName, (stageCounts.get(stageName) ?? 0) + 1);
  }

  return {
    totalLeads: leads.length,
    byStage: [...stageCounts.entries()].map(([name, count]) => ({ name, count })),
    recentLeads: leads.slice(0, 20).map((l) => ({
      name: l.name,
      price: l.price,
      stageName: stageNames.get(l.status_id) ?? "Неизвестный этап",
      createdAt: new Date(l.created_at * 1000).toISOString(),
    })),
  };
}

// amoCRM reserves status_id 142 for "closed won" on every pipeline.
const WON_STATUS_ID = 142;

export type DailyAmoSnapshot = {
  newLeads: number;
  totalLeadValue: number;
  byStage: { name: string; count: number }[];
  wonCount: number;
  wonRevenue: number;
};

// For the "which stage counts as a booking" picker — one flat list across
// all of the account's pipelines, since amoCRM stage names aren't globally
// unique but the picker just needs something a human can read and pick.
export async function fetchPipelineStages(subdomain: string, token: string): Promise<{ id: number; name: string; pipelineName: string }[]> {
  const headers = { Authorization: `Bearer ${token}` };
  const base = `https://${subdomain}.amocrm.ru/api/v4`;
  const res = await fetch(`${base}/leads/pipelines`, { headers });
  if (!res.ok) throw new Error(`amoCRM pipelines fetch failed: ${res.status}`);
  const data = await res.json();
  const pipelines: Pipeline[] = data._embedded?.pipelines ?? [];
  const stages: { id: number; name: string; pipelineName: string }[] = [];
  for (const pipeline of pipelines) {
    for (const status of pipeline._embedded?.statuses ?? []) {
      stages.push({ id: status.id, name: status.name, pipelineName: pipeline.name });
    }
  }
  return stages;
}

async function fetchStageNames(base: string, headers: Record<string, string>): Promise<Map<number, string>> {
  const res = await fetch(`${base}/leads/pipelines`, { headers });
  if (!res.ok) throw new Error(`amoCRM pipelines fetch failed: ${res.status}`);
  const data = await res.json();
  const pipelines: Pipeline[] = data._embedded?.pipelines ?? [];
  const names = new Map<number, string>();
  for (const pipeline of pipelines) {
    for (const status of pipeline._embedded?.statuses ?? []) {
      names.set(status.id, status.name);
    }
  }
  return names;
}

// Feeds amo_daily_snapshots: new leads created on this single day (with their
// current stage), plus deals that actually entered the won status that day —
// by the Events API, not by closed_at + current status_id. A lead whose
// closed_at falls today but that later moved on to some other stage (e.g. a
// post-sale/upsell pipeline) would silently vanish from a closed_at+current-
// status filter even though it was genuinely won today.
export async function fetchDailyAmoSnapshot(
  subdomain: string,
  token: string,
  fromMs: number,
  toMs: number
): Promise<DailyAmoSnapshot> {
  const headers = { Authorization: `Bearer ${token}` };
  const base = `https://${subdomain}.amocrm.ru/api/v4`;
  const from = Math.floor(fromMs / 1000);
  const to = Math.floor(toMs / 1000);

  const [stageNames, createdRes, won] = await Promise.all([
    fetchStageNames(base, headers),
    fetch(`${base}/leads?filter[created_at][from]=${from}&filter[created_at][to]=${to}&limit=250`, { headers }),
    fetchStageEntrySummary(subdomain, token, WON_STATUS_ID, fromMs, toMs),
  ]);
  if (!createdRes.ok) throw new Error(`amoCRM leads fetch failed: ${createdRes.status}`);

  const createdData = await createdRes.json();
  const createdLeads: { status_id: number; price: number }[] = createdData._embedded?.leads ?? [];

  const stageCounts = new Map<string, number>();
  let totalLeadValue = 0;
  for (const lead of createdLeads) {
    const name = stageNames.get(lead.status_id) ?? "Неизвестный этап";
    stageCounts.set(name, (stageCounts.get(name) ?? 0) + 1);
    totalLeadValue += Number(lead.price) || 0;
  }

  return {
    newLeads: createdLeads.length,
    totalLeadValue,
    byStage: [...stageCounts.entries()].map(([name, count]) => ({ name, count })),
    wonCount: won.count,
    wonRevenue: won.revenue,
  };
}
