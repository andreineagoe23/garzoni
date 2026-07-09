# Garzoni Observability Dashboard (Cloudflare Worker)

A self-contained Worker that queries the Cloudflare GraphQL Analytics API for
the `garzoni.app` zone and renders a single HTML dashboard: traffic, top
paths/countries, response status, TLS versions, cache ratio, error paths, and
(when the token has WAF scope) security events.

Live URL is gated by a secret path + `?token=` query param — see the secrets
below. Without a valid token/path it returns 401/404.

## Deploy

```bash
cd ops/cloudflare-observability
wrangler deploy
```

## Secrets (set once, never commit them)

```bash
wrangler secret put CF_API_TOKEN      # scoped CF API token, zone-scoped to garzoni.app:
                                      #   - Analytics Read           (traffic/error data)
                                      #   - Firewall Services Read    ] optional — needed only
                                      #   - Zone WAF Read             ] for the Security cards
wrangler secret put DASHBOARD_TOKEN   # random string, required as ?token=...
wrangler secret put DASHBOARD_PATH    # secret URL segment, e.g. obs-1a2b3c4d
```

The live URL is then:
`https://garzoni-observability.<subdomain>.workers.dev/<DASHBOARD_PATH>?token=<DASHBOARD_TOKEN>`

## Free-plan constraints (baked into the code)

- Adaptive analytics datasets cap the query range at **1 day** → window fixed at 23h.
- `avg.originResponseDurationMs` and `firewallEventsAdaptiveGroups` require more
  than a plain Analytics-Read token; the firewall query is isolated so a missing
  WAF scope degrades gracefully (Security cards show a hint instead of blanking
  the page).
- Request counts use `count` (not `sum.requests`); bytes use `sum.edgeResponseBytes`.

## Notes

- `ZONE_TAG` in `worker.js` is the public zone id (not a secret).
- Mobile app traffic only appears here once it is routed through
  `api.garzoni.app` (proxied through Cloudflare). Until then only web + web-API
  traffic is visible.
