export interface SlugStat {
  slug: string;
  clicks: number;
  clicks_7d: number;
  clicks_24h: number;
  last_click: string | null;
}

interface AEResponse {
  data: Array<{
    slug: string;
    clicks: number | string;
    clicks_7d: number | string;
    clicks_24h: number | string;
    last_click: string | null;
  }>;
}

// Must match analytics_engine_datasets.dataset in wrangler.jsonc.
const DATASET = "tiny_tt_clicks";

/**
 * Query Workers Analytics Engine for per-slug click counts over the last 90 days.
 * Returns one row per slug that has had clicks; slugs with zero clicks are absent.
 */
export async function fetchStats(accountId: string, apiToken: string): Promise<SlugStat[]> {
  const sql = `
    SELECT
      blob1 AS slug,
      SUM(_sample_interval) AS clicks,
      SUM(IF(timestamp > NOW() - INTERVAL '7' DAY, _sample_interval, 0)) AS clicks_7d,
      SUM(IF(timestamp > NOW() - INTERVAL '1' DAY, _sample_interval, 0)) AS clicks_24h,
      MAX(timestamp) AS last_click
    FROM ${DATASET}
    WHERE timestamp > NOW() - INTERVAL '90' DAY
    GROUP BY slug
    ORDER BY clicks DESC
    FORMAT JSON
  `.trim();

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/analytics_engine/sql`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${apiToken}` },
      body: sql,
    },
  );

  if (!res.ok) {
    throw new Error(`Analytics Engine query failed: ${res.status} ${await res.text()}`);
  }

  const json = (await res.json()) as AEResponse;
  return (json.data ?? []).map((row) => ({
    slug: row.slug,
    clicks: Number(row.clicks ?? 0),
    clicks_7d: Number(row.clicks_7d ?? 0),
    clicks_24h: Number(row.clicks_24h ?? 0),
    last_click: row.last_click ?? null,
  }));
}
