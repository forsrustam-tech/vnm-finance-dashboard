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
