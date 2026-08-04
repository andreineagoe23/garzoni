# Cloudflare cache rule for `/api/public/*`

Status: **not applied** (dashboard action — see §4).
Owner action, ~2 minutes. Written 2026-08-04 as the open half of
[`docs/audit/platform-audit-2026-08.md`](../audit/platform-audit-2026-08.md) §2.1.

---

## 1. The problem, measured

The backend already sends correct shared-cache headers on public content — that work
shipped with the July perf audit:

```
$ curl -sS -o /dev/null -D - https://api.garzoni.app/api/public/lessons/how-compound-interest-works/
HTTP/2 200
cache-control: public, s-maxage=600, stale-while-revalidate=300
server: cloudflare
cf-cache-status: DYNAMIC        ← Cloudflare is not caching this at all
```

`s-maxage` is an instruction to a *shared* cache. Cloudflare does not cache responses
for paths like these by default — its default cache behaviour keys off file extension,
and an extensionless API path is treated as dynamic no matter what the origin asks for.
So the header is currently inert: every request, from every crawler and every user,
goes to Railway.

That is what produces the cold-start numbers in the audit: 2.5–4.7s for the first
request per lesson slug after a container boot, settling to 16–39ms once warm.

The `railway.json` healthcheck gate (shipped) fixes the **502s** during rollover. It
does nothing for this latency. This rule is the other half.

## 2. Why this is safe to cache

`/api/public/*` is the SEO surface — `public_lesson_list`, `public_lesson_detail`,
`public_article_list`, `public_article_detail` in
[`backend/education/views_public.py`](../../backend/education/views_public.py). All four:

- are `AllowAny` and **unauthenticated by design** — they never read a session, a JWT,
  or per-user state, so there is no risk of caching one user's response for another;
- deliberately expose only publishable content (title, prose, image, sources) and are
  the same for every caller;
- are explicitly throttle-exempt (`@throttle_classes([])`) because crawlers and the
  prerender hit them in bursts — which is exactly the traffic a cache absorbs.

Nothing else lives under `/api/public/`. Do **not** widen the expression beyond that
prefix; every other `/api/` path is user-scoped.

## 3. The rule

Cloudflare dashboard → **Caching → Cache Rules → Create rule**.

| Field | Value |
|---|---|
| Rule name | `Cache public content API` |
| When incoming requests match | `(starts_with(http.request.uri.path, "/api/public/"))` |
| Cache eligibility | **Eligible for cache** |
| Edge TTL | **Use cache-control header if present, use default otherwise** — default `10 minutes` |
| Browser TTL | **Respect origin TTL** |

Leave Cache Key on defaults. These responses do not vary by cookie, header, or query
string; adding cache-key dimensions would only fragment the cache.

Deploying content does **not** require a purge: edge TTL is 10 minutes and
`stale-while-revalidate=300` lets the edge serve slightly-stale content while it
refreshes in the background. If you need a change live immediately (a factual
correction, say), purge by prefix rather than purging everything.

## 4. Why it is not applied yet

Cache Rules are Cloudflare-side configuration, not repository state — there is no file
in this repo that can express them. The Cloudflare MCP connector was unauthenticated in
the session that wrote this, so it could not be applied programmatically either.

## 5. Verifying it worked

```bash
# First request populates the edge; second should be served from it.
for i in 1 2; do
  curl -sS -o /dev/null -D - \
    https://api.garzoni.app/api/public/lessons/how-compound-interest-works/ \
    | grep -iE '^(HTTP|cf-cache-status|age|cache-control)'
  echo "---"
done
```

Expect `cf-cache-status: MISS` then `HIT` (with an `age` header). Anything still
reporting `DYNAMIC` means the rule did not match — check the path prefix first.

Also re-check the two other public prefixes if you extend this later:
`/api/public/articles/` is covered by the same expression; `/sitemap.xml` is already
served with `@cache_page(60 * 60)` at the Django layer and needs nothing.
