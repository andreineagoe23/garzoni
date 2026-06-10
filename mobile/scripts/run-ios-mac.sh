#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

DEVICE_ID="$(
  xcodebuild -showdestinations -scheme Garzoni -project ios/Garzoni.xcodeproj 2>/dev/null \
    | rg 'platform:macOS' \
    | rg -o 'id:[0-9A-F-]+' \
    | head -1 \
    | cut -d: -f2
)"

if [[ -z "${DEVICE_ID}" ]]; then
  echo "No 'Designed for iPad/iPhone' Mac destination found. Open Xcode → Settings → Platforms and ensure macOS support is installed." >&2
  exit 1
fi

echo "Running Garzoni on Mac destination ${DEVICE_ID}"
exec pnpm exec expo run:ios --device "${DEVICE_ID}"
