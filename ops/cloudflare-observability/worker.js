// Garzoni Observability Dashboard — Cloudflare Worker
// Queries the GraphQL Analytics API for zone garzoni.app and renders a
// self-contained HTML dashboard (no external deps).
//
// Secrets: CF_API_TOKEN (Zone Analytics Read), DASHBOARD_TOKEN (?token=),
//          DASHBOARD_PATH (secret URL segment).
// Free-plan datasets retain ~72h, so the window is fixed at 72 hours.

const ZONE_TAG = "bfa87ed9030cf1e84aed5bbbfc12cf93";
const WINDOW_HOURS = 23; // free-plan adaptive datasets cap the range at 1 day
const CACHED = new Set(["hit", "stale", "updating", "revalidated", "dynamic-cached"]);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== `/${env.DASHBOARD_PATH}`) return new Response("Not Found", { status: 404 });
    if (!env.DASHBOARD_TOKEN || url.searchParams.get("token") !== env.DASHBOARD_TOKEN)
      return new Response("Unauthorized", { status: 401 });

    const now = new Date();
    const since = new Date(now.getTime() - WINDOW_HOURS * 3600 * 1000);
    const S = since.toISOString(), U = now.toISOString();

    // Traffic + firewall are separate requests so a firewall permission gap
    // (Analytics Read token without WAF scope) can't blank the whole page.
    let payload = null, err = null, fw = null, fwErr = null;
    try { payload = await gql(env.CF_API_TOKEN, buildQuery(S, U)); }
    catch (e) { err = String(e); }
    try { fw = await gql(env.CF_API_TOKEN, buildFwQuery(S, U)); }
    catch (e) { fwErr = String(e); }

    return new Response(renderHTML({ payload, fw, err, fwErr, S, U }), {
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
    });
  },
};

function buildQuery(S, U) {
  const t = `datetime_geq: "${S}", datetime_leq: "${U}"`;
  return `{ viewer { zones(filter: { zoneTag: "${ZONE_TAG}" }) {
    summary: httpRequestsAdaptiveGroups(filter: { ${t} } limit: 1) {
      count sum { edgeResponseBytes }
    }
    cache: httpRequestsAdaptiveGroups(filter: { ${t} } limit: 20 orderBy: [count_DESC]) {
      count dimensions { cacheStatus }
    }
    overTime: httpRequestsAdaptiveGroups(filter: { ${t} } limit: 300 orderBy: [datetimeHour_ASC]) {
      count dimensions { datetimeHour }
    }
    topPaths: httpRequestsAdaptiveGroups(filter: { ${t} } limit: 25 orderBy: [count_DESC]) {
      count dimensions { clientRequestPath }
    }
    topCountries: httpRequestsAdaptiveGroups(filter: { ${t} } limit: 15 orderBy: [count_DESC]) {
      count dimensions { clientCountryName }
    }
    status: httpRequestsAdaptiveGroups(filter: { ${t} } limit: 30 orderBy: [count_DESC]) {
      count dimensions { edgeResponseStatus }
    }
    tls: httpRequestsAdaptiveGroups(filter: { ${t} } limit: 10 orderBy: [count_DESC]) {
      count dimensions { clientSSLProtocol }
    }
    errorPaths: httpRequestsAdaptiveGroups(filter: { ${t}, edgeResponseStatus_geq: 400 } limit: 15 orderBy: [count_DESC]) {
      count dimensions { clientRequestPath edgeResponseStatus }
    }
  } } }`;
}

function buildFwQuery(S, U) {
  const t = `datetime_geq: "${S}", datetime_leq: "${U}"`;
  return `{ viewer { zones(filter: { zoneTag: "${ZONE_TAG}" }) {
    fwActions: firewallEventsAdaptiveGroups(filter: { ${t} } limit: 20 orderBy: [count_DESC]) {
      count dimensions { action }
    }
    fwPaths: firewallEventsAdaptiveGroups(filter: { ${t} } limit: 15 orderBy: [count_DESC]) {
      count dimensions { clientRequestPath action }
    }
    fwIPs: firewallEventsAdaptiveGroups(filter: { ${t} } limit: 15 orderBy: [count_DESC]) {
      count dimensions { clientIP clientCountryName clientASNDescription }
    }
  } } }`;
}

async function gql(token, query) {
  const r = await fetch("https://api.cloudflare.com/client/v4/graphql", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const j = await r.json();
  if (j.errors && j.errors.length) throw new Error(j.errors.map(e => e.message).join("; "));
  return (j.data && j.data.viewer && j.data.viewer.zones[0]) || {};
}

// ── rendering ──
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmt = n => (n ?? 0).toLocaleString("en-US");
const bytes = n => { n = n || 0; const u = ["B", "KB", "MB", "GB", "TB"]; let i = 0; while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; } return n.toFixed(1) + " " + u[i]; };

function rows(items, label, get, max) {
  if (!items || !items.length) return `<p class="empty">No data in window.</p>`;
  const top = Math.max(...items.map(get), 1);
  return `<table>${items.slice(0, max || 25).map(it => {
    const v = get(it);
    return `<tr><td class="lbl">${label(it)}</td><td class="barcell"><span class="bar" style="width:${(v / top * 100).toFixed(1)}%"></span></td><td class="num">${fmt(v)}</td></tr>`;
  }).join("")}</table>`;
}

function renderHTML({ payload, fw, err, fwErr, S, U }) {
  const z = payload || {};
  const fz = fw || {};
  const s0 = (z.summary && z.summary[0]) || {};
  const reqs = s0.count || 0;
  const respBytes = (s0.sum && s0.sum.edgeResponseBytes) || 0;
  const errCount = (z.status || []).filter(x => Number(x.dimensions.edgeResponseStatus) >= 400).reduce((a, x) => a + x.count, 0);
  const errRatio = reqs ? (errCount / reqs * 100).toFixed(1) : "0.0";

  const cacheTotal = (z.cache || []).reduce((a, x) => a + x.count, 0);
  const cacheHit = (z.cache || []).filter(x => CACHED.has((x.dimensions.cacheStatus || "").toLowerCase())).reduce((a, x) => a + x.count, 0);
  const cacheRatio = cacheTotal ? (cacheHit / cacheTotal * 100).toFixed(1) : "0.0";
  const fwTotal = (fz.fwActions || []).reduce((a, x) => a + x.count, 0);
  const fwNote = fwErr
    ? `<p class="empty">Security dataset needs WAF read scope on the API token — view WAF events in Cloudflare → Security → Analytics.</p>`
    : null;

  const series = (z.overTime || []).map(p => p.count);
  const sparkMax = Math.max(...series, 1);
  const spark = series.length
    ? `<div class="spark">${series.map(v => `<span style="height:${(v / sparkMax * 100).toFixed(1)}%" title="${fmt(v)}"></span>`).join("")}</div>`
    : `<p class="empty">No traffic in window.</p>`;

  const card = (title, body) => `<section class="card"><h2>${title}</h2>${body}</section>`;
  const stat = (label, val, sub) => `<div class="stat"><div class="v">${val}</div><div class="l">${label}</div>${sub ? `<div class="s">${sub}</div>` : ""}</div>`;

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Garzoni — Observability</title><style>
:root{--bg:#0b0e14;--card:#141925;--line:#232a3a;--txt:#e6e9f0;--dim:#8a93a6;--accent:#f38020;--bar:#3b82f6}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--txt);font:14px/1.5 -apple-system,Segoe UI,Roboto,sans-serif}
header{padding:20px 24px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:8px}
header h1{margin:0;font-size:18px}header .meta{color:var(--dim);font-size:12px}
.wrap{padding:20px 24px;max-width:1200px;margin:0 auto}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:20px}
.stat{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px}
.stat .v{font-size:22px;font-weight:600}.stat .l{color:var(--dim);font-size:12px;margin-top:2px}.stat .s{color:var(--dim);font-size:11px;margin-top:4px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:16px}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px}
.card h2{margin:0 0 12px;font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:var(--dim)}
table{width:100%;border-collapse:collapse}td{padding:3px 0;vertical-align:middle}
td.lbl{max-width:210px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}
td.barcell{width:42%;padding:0 8px}td.num{text-align:right;font-variant-numeric:tabular-nums;color:var(--dim);font-size:12px}
.bar{display:block;height:8px;background:var(--bar);border-radius:4px;min-width:2px}
.spark{display:flex;align-items:flex-end;gap:2px;height:70px}.spark span{flex:1;background:var(--accent);border-radius:2px 2px 0 0;min-height:1px;opacity:.85}
.empty{color:var(--dim);font-size:12px;margin:4px 0}
.err{background:#3a1516;border:1px solid #ef4444;color:#fca5a5;padding:12px;border-radius:8px;margin-bottom:16px;font-size:12px}
.tag{display:inline-block;padding:1px 6px;border-radius:4px;font-size:11px;margin-left:6px}
.tag.block{background:#3a1516;color:#fca5a5}.tag.ok{background:#12261a;color:#86efac}
</style></head><body>
<header><h1>🛰️ Garzoni Observability <span class="meta">garzoni.app</span></h1>
<div class="meta">Last ${WINDOW_HOURS}h &middot; ${esc(S.slice(0, 16))} → ${esc(U.slice(0, 16))} UTC</div></header>
<div class="wrap">
${err ? `<div class="err">GraphQL error: ${esc(err)}</div>` : ""}
<div class="stats">
  ${stat("Requests", fmt(reqs), `${bytes(respBytes)} served`)}
  ${stat("Cache hit ratio", cacheRatio + "%", `${fmt(cacheHit)} / ${fmt(cacheTotal)}`)}
  ${stat("Errors (4xx/5xx)", fmt(errCount), errRatio + "% of requests")}
  ${stat("Security events", fmt(fwTotal), "WAF / rate-limit / bots")}
</div>
${card("Requests over time (hourly)", spark)}
<div style="height:16px"></div>
<div class="grid">
  ${card("Top paths", rows(z.topPaths, it => esc(it.dimensions.clientRequestPath), it => it.count))}
  ${card("Top countries", rows(z.topCountries, it => esc(it.dimensions.clientCountryName || "—"), it => it.count, 15))}
  ${card("Response status", rows(z.status, it => statusTag(it.dimensions.edgeResponseStatus), it => it.count, 15))}
  ${card("TLS versions", rows(z.tls, it => esc(it.dimensions.clientSSLProtocol || "—"), it => it.count, 10))}
  ${card("Top error paths (4xx/5xx)", rows(z.errorPaths, it => `${esc(it.dimensions.clientRequestPath)} <span class="tag block">${esc(it.dimensions.edgeResponseStatus)}</span>`, it => it.count, 15))}
  ${card("Security: actions", fwNote || rows(fz.fwActions, it => fwTag(it.dimensions.action), it => it.count, 20))}
  ${card("Security: targeted paths", fwNote || rows(fz.fwPaths, it => `${esc(it.dimensions.clientRequestPath)} <span class="tag block">${esc(it.dimensions.action)}</span>`, it => it.count, 15))}
  ${card("Security: top offending IPs", fwNote || rows(fz.fwIPs, it => `${esc(it.dimensions.clientIP)} <span class="meta">${esc(it.dimensions.clientCountryName || "")} · ${esc((it.dimensions.clientASNDescription || "").slice(0, 24))}</span>`, it => it.count, 15))}
</div>
<p class="meta" style="margin-top:20px">Mobile traffic appears here only once it routes through api.garzoni.app. Free-plan analytics retain ~72h.</p>
</div></body></html>`;
}

function statusTag(code) {
  const c = Number(code);
  const cls = c >= 400 ? "block" : (c >= 200 && c < 300) ? "ok" : "";
  return `<span class="tag ${cls}">${esc(code)}</span>`;
}
function fwTag(a) {
  const ok = ["allow", "log", "skip"].includes(a);
  return `<span class="tag ${ok ? "ok" : "block"}">${esc(a)}</span>`;
}
