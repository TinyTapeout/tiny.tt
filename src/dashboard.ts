export const DASHBOARD_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>tiny.tt</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    margin: 0;
    padding: 2rem 1rem 4rem;
    max-width: 64rem;
    margin-inline: auto;
    color: CanvasText;
    background: Canvas;
  }
  h1 { margin: 0 0 .25rem; font-size: 1.5rem; letter-spacing: -0.01em; }
  header p { margin: 0 0 2rem; color: GrayText; }
  .summary { display: flex; gap: 2.5rem; margin-bottom: 2rem; flex-wrap: wrap; }
  .summary div b { display: block; font-size: 1.6rem; font-weight: 600; font-variant-numeric: tabular-nums; }
  .summary div span { color: GrayText; font-size: .8rem; text-transform: uppercase; letter-spacing: .05em; }
  table { width: 100%; border-collapse: collapse; }
  th, td {
    padding: .65rem .5rem;
    text-align: left;
    border-bottom: 1px solid color-mix(in srgb, currentColor 12%, transparent);
    vertical-align: top;
  }
  th { font-size: .75rem; text-transform: uppercase; letter-spacing: .05em; color: GrayText; font-weight: 500; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  td.slug a { color: inherit; text-decoration: none; }
  td.slug a:hover { text-decoration: underline; }
  td.slug code { font-size: .95em; }
  td.dest { max-width: 28rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  td.dest a { color: GrayText; text-decoration: none; }
  td.dest a:hover { text-decoration: underline; }
  .err {
    color: #c33;
    padding: 1rem;
    border: 1px solid color-mix(in srgb, #c33 50%, transparent);
    border-radius: 6px;
    background: color-mix(in srgb, #c33 6%, transparent);
  }
  .muted { color: GrayText; }
  footer { margin-top: 3rem; color: GrayText; font-size: .85rem; }
  footer a { color: inherit; }
</style>
</head>
<body>
<header>
  <h1>tiny.tt</h1>
  <p>Short link redirects · <span id="link-count" class="muted">…</span></p>
</header>

<div class="summary">
  <div><b id="total-clicks">-</b><span>Clicks (90d)</span></div>
  <div><b id="clicks-7d">-</b><span>Clicks (7d)</span></div>
  <div><b id="clicks-24h">-</b><span>Clicks (24h)</span></div>
</div>

<div id="content" class="muted">Loading…</div>

<footer>
  Edit <a href="https://github.com/TinyTapeout/tiny.tt/blob/main/_redirects">_redirects</a> to add a link · <a href="/_dashboard/api/stats">JSON API</a>
</footer>

<script>
const fmt = new Intl.NumberFormat();
function relTime(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 60) return Math.round(s) + "s ago";
  if (s < 3600) return Math.round(s / 60) + "m ago";
  if (s < 86400) return Math.round(s / 3600) + "h ago";
  return Math.round(s / 86400) + "d ago";
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

(async () => {
  const el = document.getElementById("content");
  let data;
  try {
    const res = await fetch("/_dashboard/api/stats", { credentials: "same-origin" });
    data = await res.json();
    if (!res.ok) throw new Error(data.error || res.statusText);
  } catch (e) {
    el.className = "";
    el.innerHTML = '<div class="err">Failed to load stats: ' + esc(e.message || e) + "</div>";
    return;
  }

  const rows = data.links;
  document.getElementById("link-count").textContent =
    rows.length + " link" + (rows.length === 1 ? "" : "s");
  document.getElementById("total-clicks").textContent = fmt.format(rows.reduce((a, r) => a + r.clicks, 0));
  document.getElementById("clicks-7d").textContent = fmt.format(rows.reduce((a, r) => a + r.clicks_7d, 0));
  document.getElementById("clicks-24h").textContent = fmt.format(rows.reduce((a, r) => a + r.clicks_24h, 0));

  if (!rows.length) {
    el.innerHTML = '<p class="muted">No links yet.</p>';
    return;
  }

  const host = location.host;
  el.className = "";
  el.innerHTML =
    "<table><thead><tr>" +
    "<th>Short link</th><th>Destination</th>" +
    '<th class="num">90d</th><th class="num">7d</th><th class="num">24h</th>' +
    "<th>Last click</th>" +
    "</tr></thead><tbody>" +
    rows
      .map(
        (r) =>
          "<tr>" +
          '<td class="slug"><a href="/' + encodeURIComponent(r.slug) + '"><code>' +
          esc(host) + "/" + esc(r.slug) + "</code></a></td>" +
          '<td class="dest"><a href="' + esc(r.url) + '" rel="noreferrer">' + esc(r.url) + "</a></td>" +
          '<td class="num">' + fmt.format(r.clicks) + "</td>" +
          '<td class="num">' + fmt.format(r.clicks_7d) + "</td>" +
          '<td class="num">' + fmt.format(r.clicks_24h) + "</td>" +
          '<td class="muted">' + esc(relTime(r.last_click)) + "</td>" +
          "</tr>",
      )
      .join("") +
    "</tbody></table>";
})();
</script>
</body>
</html>`;
