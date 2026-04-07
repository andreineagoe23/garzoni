import { Platform, StyleSheet, Text, View } from "react-native";
import { getBackendUrl } from "@garzoni/core";
import { useThemeColors } from "../theme/ThemeContext";
import { spacing, typography, radius } from "../theme/tokens";

function isLanHostname(hostname: string): boolean {
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  const m = /^172\.(\d{1,3})\./.exec(hostname);
  if (m) {
    const n = parseInt(m[1], 10);
    if (n >= 16 && n <= 31) return true;
  }
  return false;
}

/** True for loopback, Android emulator host alias, or typical LAN IPs (Docker on Mac). */
function isLocalDevBackendUrl(urlStr: string): boolean {
  if (
    urlStr.includes("127.0.0.1") ||
    urlStr.includes("localhost") ||
    urlStr.includes("10.0.2.2")
  ) {
    return true;
  }
  try {
    const u = new URL(urlStr);
    return isLanHostname(u.hostname);
  } catch {
    return false;
  }
}

function isLanBackendUrl(urlStr: string): boolean {
  try {
    const u = new URL(urlStr);
    return isLanHostname(u.hostname);
  } catch {
    return false;
  }
}

/** localhost / 127.0.0.1 on Android point at the emulator, not the host machine. */
function isAndroidLocalhostMistake(urlStr: string): boolean {
  return (
    Platform.OS === "android" &&
    (urlStr.includes("127.0.0.1") || urlStr.includes("localhost"))
  );
}

/**
 * Explains local API URLs: iOS Simulator → Mac, Android emulator → 10.0.2.2,
 * physical device + Docker → machine LAN IP (same Wi‑Fi).
 */
export default function AuthBackendBanner() {
  const c = useThemeColors();
  const url = getBackendUrl();
  const isDevBackend = isLocalDevBackendUrl(url);
  const androidBad = isAndroidLocalhostMistake(url);
  const onLan = isLanBackendUrl(url);

  if (!isDevBackend || Platform.OS === "web") {
    return null;
  }

  return (
    <View
      style={[
        styles.box,
        {
          backgroundColor: androidBad ? c.errorBg : c.accentMuted,
          borderColor: androidBad ? c.error : c.border,
        },
      ]}
    >
      <Text
        style={[
          styles.title,
          { color: androidBad ? c.error : c.primary },
        ]}
      >
        {androidBad
          ? "Check API URL (Android)"
          : onLan
            ? "Using Docker / LAN API"
            : "Using a local API URL"}
      </Text>
      <Text style={[styles.body, { color: c.text }]}>
        Current API base: <Text style={{ fontWeight: "700" }}>{url}</Text>
      </Text>
      <Text style={[styles.body, { color: c.textMuted, marginTop: spacing.xs }]}>
        {androidBad
          ? "On the Android emulator, localhost is the emulator itself, not your Mac. Use http://10.0.2.2:8000/api for Django in Docker on the host, or a public HTTPS API URL in EXPO_PUBLIC_BACKEND_URL."
          : onLan
            ? "This targets your machine on the local network (typical for docker compose -f docker-compose.dev.yml). Phone and Mac must be on the same Wi‑Fi. For http:// on a physical iPhone, use a dev client build with EXPO_PUBLIC_APP_ENV=development so ATS allows local networking, then rebuild native (expo run:ios)."
            : "iOS Simulator can use http://127.0.0.1:8000/api to reach Django on your Mac. For a physical device, use your Mac’s LAN IP and port 8000 instead of localhost."}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  title: { fontSize: typography.sm, fontWeight: "800", marginBottom: spacing.xs },
  body: { fontSize: typography.sm, lineHeight: 20 },
});
