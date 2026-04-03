import { Platform, StyleSheet, Text, View } from "react-native";
import { getBackendUrl } from "@monevo/core";
import { useThemeColors } from "../theme/ThemeContext";
import { spacing, typography, radius } from "../theme/tokens";

/**
 * Explains local API URLs: fine for iOS Simulator (Mac Django), often wrong on a physical device
 * or Android emulator unless you use the host alias (e.g. 10.0.2.2).
 */
export default function AuthBackendBanner() {
  const c = useThemeColors();
  const url = getBackendUrl();
  const isLocal =
    url.includes("127.0.0.1") ||
    url.includes("localhost") ||
    url.includes("10.0.2.2");

  if (!isLocal || Platform.OS === "web") {
    return null;
  }

  const androidLocal = Platform.OS === "android" && isLocal;

  return (
    <View
      style={[
        styles.box,
        {
          backgroundColor: androidLocal ? c.errorBg : c.accentMuted,
          borderColor: androidLocal ? c.error : c.border,
        },
      ]}
    >
      <Text
        style={[
          styles.title,
          { color: androidLocal ? c.error : c.primary },
        ]}
      >
        {androidLocal ? "Check API URL (Android)" : "Using a local API URL"}
      </Text>
      <Text style={[styles.body, { color: c.text }]}>
        Current API base: <Text style={{ fontWeight: "700" }}>{url}</Text>
      </Text>
      <Text style={[styles.body, { color: c.textMuted, marginTop: spacing.xs }]}>
        {androidLocal
          ? "Android emulator: localhost is the emulator itself. Use http://10.0.2.2:8000 or your Railway HTTPS URL in EXPO_PUBLIC_BACKEND_URL."
          : "iOS Simulator can reach Django on your Mac via localhost. On a physical iPhone or iPad, set EXPO_PUBLIC_BACKEND_URL to your public API (e.g. https://…railway.app), restart Expo with --clear, and rebuild if needed."}
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
