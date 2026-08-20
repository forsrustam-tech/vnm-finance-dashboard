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
// current stage), plus deals actually won that day (filtered by closed_at,
// not created_at — a lead created earlier but won today should still count).
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

  const stageNames = await fetchStageNames(base, headers);

  const [createdRes, closedRes] = await Promise.all([
    fetch(`${base}/leads?filter[created_at][from]=${from}&filter[created_at][to]=${to}&limit=250`, { headers }),
    fetch(`${base}/leads?filter[closed_at][from]=${from}&filter[closed_at][to]=${to}&limit=250`, { headers }),
  ]);
  if (!createdRes.ok) throw new Error(`amoCRM leads fetch failed: ${createdRes.status}`);
  if (!closedRes.ok) throw new Error(`amoCRM won-revenue fetch failed: ${closedRes.status}`);

  const createdData = await createdRes.json();
  const createdLeads: { status_id: number; price: number }[] = createdData._embedded?.leads ?? [];

  const closedData = await closedRes.json();
  const closedLeads: { status_id: number; price: number }[] = closedData._embedded?.leads ?? [];

  const stageCounts = new Map<string, number>();
  let totalLeadValue = 0;
  for (const lead of createdLeads) {
    const name = stageNames.get(lead.status_id) ?? "Неизвестный этап";
    stageCounts.set(name, (stageCounts.get(name) ?? 0) + 1);
    totalLeadValue += Number(lead.price) || 0;
  }

  let wonCount = 0;
  let wonRevenue = 0;
  for (const lead of closedLeads) {
    if (lead.status_id === WON_STATUS_ID) {
      wonCount += 1;
      wonRevenue += Number(lead.price) || 0;
    }
  }

  return {
    newLeads: createdLeads.length,
    totalLeadValue,
    byStage: [...stageCounts.entries()].map(([name, count]) => ({ name, count })),
    wonCount,
    wonRevenue,
  };
}
