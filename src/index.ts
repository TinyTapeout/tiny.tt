import { RULES, FALLBACK } from "./_redirects.generated";
import { fetchStats } from "./stats";
import { DASHBOARD_HTML } from "./dashboard";

interface Env {
  CLICKS: AnalyticsEngineDataset;
  CF_ACCOUNT_ID?: string;
  CF_API_TOKEN?: string;
  DASHBOARD_SECRET?: string;
}

const COOKIE_NAME = "tt_dash";

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const { pathname } = url;

    if (pathname === "/_dashboard" || pathname === "/_dashboard/") {
      return handleDashboard(req, env, url);
    }
    if (pathname === "/_dashboard/api/stats") {
      return handleStats(req, env, url);
    }
    if (pathname === "/robots.txt") {
      return new Response("User-agent: *\nDisallow: /\n", {
        headers: { "content-type": "text/plain" },
      });
    }
    if (pathname === "/favicon.ico") {
      return new Response(null, { status: 204 });
    }

    // A slug is a single path segment (matching CF Pages _redirects behavior
    // for non-wildcard rules). Root, multi-segment, and unknown slugs all
    // fall through to the catchall.
    const slug = pathname.slice(1).replace(/\/$/, "");
    const rule = slug && !slug.includes("/") ? RULES[slug] : undefined;
    if (rule) {
      env.CLICKS.writeDataPoint({
        blobs: [
          slug,
          req.cf?.country ?? "",
          req.headers.get("referer") ?? "",
          req.headers.get("user-agent")?.slice(0, 256) ?? "",
        ],
        doubles: [1],
        indexes: [slug],
      });
      return Response.redirect(rule.destination, rule.status);
    }
    return Response.redirect(FALLBACK.destination, FALLBACK.status);
  },
} satisfies ExportedHandler<Env>;

function isAuthed(
  req: Request,
  url: URL,
  secret: string | undefined,
): { ok: boolean; setCookie?: string } {
  if (!secret) return { ok: true };

  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ") && auth.slice(7) === secret) return { ok: true };

  const queryKey = url.searchParams.get("key");
  if (queryKey === secret) {
    return {
      ok: true,
      setCookie: `${COOKIE_NAME}=${encodeURIComponent(secret)}; HttpOnly; Secure; SameSite=Strict; Path=/_dashboard; Max-Age=2592000`,
    };
  }

  const cookie = req.headers.get("cookie") ?? "";
  const m = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  if (m && decodeURIComponent(m[1]) === secret) return { ok: true };

  return { ok: false };
}

function handleDashboard(req: Request, env: Env, url: URL): Response {
  const auth = isAuthed(req, url, env.DASHBOARD_SECRET);
  if (!auth.ok) {
    return new Response("Unauthorized. Append ?key=<secret> to the URL.\n", {
      status: 401,
      headers: { "content-type": "text/plain" },
    });
  }
  const headers: Record<string, string> = {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
  };
  if (auth.setCookie) headers["set-cookie"] = auth.setCookie;
  return new Response(DASHBOARD_HTML, { headers });
}

async function handleStats(req: Request, env: Env, url: URL): Promise<Response> {
  const auth = isAuthed(req, url, env.DASHBOARD_SECRET);
  if (!auth.ok) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }
  if (!env.CF_ACCOUNT_ID || !env.CF_API_TOKEN) {
    return jsonResponse(
      {
        error:
          "stats unavailable: configure CF_ACCOUNT_ID and CF_API_TOKEN in the worker's Variables and Secrets",
      },
      500,
    );
  }

  try {
    const stats = await fetchStats(env.CF_ACCOUNT_ID, env.CF_API_TOKEN);
    const statsBySlug = new Map(stats.map((s) => [s.slug, s]));

    const rows = Object.entries(RULES).map(([slug, rule]) => {
      const s = statsBySlug.get(slug);
      return {
        slug,
        url: rule.destination,
        status: rule.status,
        clicks: s?.clicks ?? 0,
        clicks_7d: s?.clicks_7d ?? 0,
        clicks_24h: s?.clicks_24h ?? 0,
        last_click: s?.last_click ?? null,
      };
    });
    rows.sort((a, b) => b.clicks - a.clicks);

    return jsonResponse({
      links: rows,
      fallback: FALLBACK,
      generated_at: new Date().toISOString(),
    });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
