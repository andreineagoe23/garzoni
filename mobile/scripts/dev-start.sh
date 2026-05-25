#!/usr/bin/env bash
# dev-start.sh — auto-detect Mac LAN IP, write to .env.development.local, start Expo for physical device.
# Usage: pnpm dev  (from mobile/)
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_LOCAL="$MOBILE_DIR/.env.development.local"

# Try common macOS Wi-Fi / Ethernet interfaces in order
LAN_IP=""
for iface in en0 en1 en2 en3; do
  IP="$(ipconfig getifaddr "$iface" 2>/dev/null || true)"
  if [[ -n "$IP" ]]; then
    LAN_IP="$IP"
    DETECTED_IFACE="$iface"
    break
  fi
done

if [[ -z "$LAN_IP" ]]; then
  echo "⚠️  Could not detect LAN IP. Falling back to 127.0.0.1 (simulator only)."
  LAN_IP="127.0.0.1"
else
  echo "✅ Detected LAN IP: $LAN_IP (interface: $DETECTED_IFACE)"
fi

BACKEND_URL="http://$LAN_IP:8000/api"
echo "📝 Writing EXPO_PUBLIC_BACKEND_URL=$BACKEND_URL → $ENV_LOCAL"

# Preserve any existing lines except EXPO_PUBLIC_BACKEND_URL
if [[ -f "$ENV_LOCAL" ]]; then
  TMP="$(grep -v '^EXPO_PUBLIC_BACKEND_URL=' "$ENV_LOCAL" || true)"
  printf '%s\n' "$TMP" > "$ENV_LOCAL"
fi
echo "EXPO_PUBLIC_BACKEND_URL=$BACKEND_URL" >> "$ENV_LOCAL"

echo ""
echo "📱 Simulator: always uses http://127.0.0.1:8000/api (no config needed)"
echo "📱 Physical iPhone: will use $BACKEND_URL"
echo ""

cd "$MOBILE_DIR"
exec npx expo start --host lan "$@"
