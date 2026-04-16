# tiny.tt

Tiny URL shortener for `tiny.tt`, with click stats and a public dashboard. Deployed as a Cloudflare Worker.

- **Add a link**: edit [`_redirects`](./_redirects) and open a PR.
- **Dashboard**: <https://tiny.tt/_dashboard>
- **JSON API**: <https://tiny.tt/_dashboard/api/stats>

## How it works

```
GET tiny.tt/<slug>      ->  302 to mapped URL  +  click logged to Analytics Engine
GET tiny.tt/_dashboard  ->  HTML dashboard, fetches /_dashboard/api/stats
GET tiny.tt/            ->  302 to https://tinytapeout.com/   (the catchall in _redirects)
GET tiny.tt/<unknown>   ->  302 to https://tinytapeout.com/   (also the catchall)
```

The `_redirects` file uses Cloudflare Pages / Netlify standard syntax, so the file is portable. The catchall `/* https://tinytapeout.com/ 302` is required.

## Adding or changing a link

1. Edit [`_redirects`](./_redirects).
2. Open a PR. CI runs `npm run validate` (parses + checks every line) and the rest of the lint suite.
3. After merge, the Cloudflare Workers Git integration redeploys automatically.

Format (one line per link):

```
/<slug>  https://destination.example  [302|301|307|308]
```

Status defaults to `302`. Slugs are `[a-zA-Z0-9_-]+`. Reserved: `_dashboard`, `robots.txt`, `favicon.ico`.

## Local development

```sh
npm install
npm run dev          # runs wrangler dev (auto-runs the build/validate step)
```

Useful scripts:

| Command             | What it does                                                            |
| ------------------- | ----------------------------------------------------------------------- |
| `npm run validate`  | Parse + validate `_redirects`, regenerate `src/_redirects.generated.ts` |
| `npm run typecheck` | `tsc --noEmit`                                                          |
| `npm run lint`      | ESLint                                                                  |
| `npm run format`    | Prettier write                                                          |
| `npm run check`     | Everything CI runs (validate, format, lint, typecheck)                  |
| `npm run deploy`    | `wrangler deploy` (validates first via wrangler `build.command`)        |

A pre-commit hook (Husky + lint-staged) auto-formats staged files and re-validates `_redirects` if it was touched.

## Deploying

This repo is set up for **Cloudflare Workers' Git integration**.

One-time setup:

1. In the Cloudflare dashboard, go to **Workers & Pages > Create > Connect to Git** and select this repo. CF auto-runs `npm install && wrangler deploy` on every push to `main`.
2. Attach the domain `tiny.tt` in the worker's settings.
3. Configure runtime variables in the dashboard at **Worker > Settings > Variables and Secrets** (see below). Nothing account-specific lives in the repo, so it stays clean for public mirroring.

### Runtime variables

Set these in **Worker > Settings > Variables and Secrets**:

| Name               | Type                 | Required  | Purpose                                                      |
| ------------------ | -------------------- | --------- | ------------------------------------------------------------ |
| `CF_ACCOUNT_ID`    | Variable (plaintext) | for stats | Your Cloudflare account ID, needed to query Analytics Engine |
| `CF_API_TOKEN`     | Secret (encrypted)   | for stats | API token with **Account Analytics: Read** permission        |
| `DASHBOARD_SECRET` | Secret (encrypted)   | optional  | If set, gates the dashboard (see next section)               |

Without `CF_ACCOUNT_ID` + `CF_API_TOKEN`, redirects keep working but `/_dashboard/api/stats` returns a 500. Click events still get recorded; they're just not queryable until the token is set.

### Optional: gate the dashboard

The dashboard and stats API are **public by default** (read-only). To restrict access, set a worker secret:

```sh
wrangler secret put DASHBOARD_SECRET
```

Once set, the dashboard requires either:

- a query param: `https://tiny.tt/_dashboard?key=<secret>` (sets a cookie so subsequent navigation works), or
- an `Authorization: Bearer <secret>` header (for API clients).

Unset the secret to make it public again: `wrangler secret delete DASHBOARD_SECRET`.

## Architecture

| Piece                    | What                                                                            |
| ------------------------ | ------------------------------------------------------------------------------- |
| `_redirects`             | Source of truth for all slug to URL mappings                                    |
| `scripts/validate.mjs`   | Build step: parses `_redirects`, validates, emits `src/_redirects.generated.ts` |
| `src/index.ts`           | Worker: routes the redirect, dashboard, and stats API                           |
| `src/stats.ts`           | Queries Workers Analytics Engine via the CF SQL API                             |
| `src/dashboard.ts`       | Inline HTML/JS for the dashboard page                                           |
| Workers Analytics Engine | Stores click events; 90-day retention, free tier covers a lot                   |

## License

[Apache-2.0](./LICENSE) © Tiny Tapeout
