// Official daily KZT rates from the National Bank of Kazakhstan — used to
// show ad spend in ₸ when the ad account bills in another currency (Meta
// accounts are commonly USD/EUR). Cached in-memory per day since the rate
// only changes once a day and this can be called many times per request.

const cache = new Map<string, { rate: number; fetchedOn: string }>();

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function fetchNbkRate(currency: string): Promise<number | null> {
  try {
    const now = new Date();
    const fdate = `${String(now.getDate()).padStart(2, "0")}.${String(now.getMonth() + 1).padStart(2, "0")}.${now.getFullYear()}`;
    const res = await fetch(`https://www.nationalbank.kz/rss/get_rates.cfm?fdate=${fdate}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const xml = await res.text();
    // <item><title>USD</title><description>450.12</description>...</item>
    const match = xml.match(new RegExp(`<title>${currency}</title>\\s*<description>([\\d.]+)</description>`));
    return match ? Number(match[1]) : null;
  } catch {
    return null;
  }
}

// Rate to multiply an amount in `currency` by to get ₸. Returns null if the
// currency is already KZT or the rate couldn't be fetched (caller should
// fall back to showing the original currency amount, never silently show a
// wrong number as if it were ₸).
export async function getKztRate(currency: string | null | undefined): Promise<number | null> {
  if (!currency || currency === "KZT") return 1;

  const key = `${currency}:${todayKey()}`;
  const cached = cache.get(key);
  if (cached) return cached.rate;

  const rate = await fetchNbkRate(currency);
  if (rate) cache.set(key, { rate, fetchedOn: todayKey() });
  return rate;
}
