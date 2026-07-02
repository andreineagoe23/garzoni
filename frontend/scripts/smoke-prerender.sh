#!/usr/bin/env bash
# Post-deploy smoke test for bot-facing prerendered snapshots (Phase 1, C1).
#
# Verifies that lesson/guide URLs return a real prerendered page (200, >1KB) to
# a crawler UA — the exact failure mode that silently 404'd 56 of 68 sitemap
# URLs. Run AFTER a production deploy:
#
#   BASE_URL=https://www.garzoni.app ./frontend/scripts/smoke-prerender.sh
#
# Exits non-zero if any checked URL returns non-200 or a body under MIN_BYTES.
set -euo pipefail

BASE_URL="${BASE_URL:-https://www.garzoni.app}"
UA="${UA:-Mozilla/5.0 (compatible; GPTBot/1.1; +https://openai.com/gptbot)}"
MIN_BYTES="${MIN_BYTES:-1000}"

# A representative sample of nested content routes plus the section indexes.
PATHS=(
  "/learn"
  "/guides"
  "/learn/how-compound-interest-works"
  "/guides/garzoni-vs-ynab"
)

fail=0
for path in "${PATHS[@]}"; do
  url="${BASE_URL}${path}"
  body="$(curl -sS -A "$UA" "$url" || true)"
  code="$(curl -sS -o /dev/null -w '%{http_code}' -A "$UA" "$url" || echo 000)"
  bytes="${#body}"
  if [[ "$code" != "200" || "$bytes" -lt "$MIN_BYTES" ]]; then
    echo "✗ $path — HTTP $code, ${bytes} bytes (expected 200, >=${MIN_BYTES})"
    fail=1
  else
    echo "✓ $path — HTTP $code, ${bytes} bytes"
  fi
done

if [[ "$fail" -ne 0 ]]; then
  echo "Prerender smoke test FAILED — bots are seeing broken pages."
  exit 1
fi
echo "All prerender smoke checks passed."
