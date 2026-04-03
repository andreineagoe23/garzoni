import { useMemo } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { WebView } from "react-native-webview";
import { getWebAppBaseUrl } from "../../src/bootstrap/webAppUrl";
import { useThemeColors } from "../../src/theme/ThemeContext";
import { spacing, typography } from "../../src/theme/tokens";

const PAGE_PATH: Record<string, string> = {
  terms: "/terms-of-service",
  "terms-of-service": "/terms-of-service",
  privacy: "/privacy-policy",
  "privacy-policy": "/privacy-policy",
  cookies: "/cookie-policy",
  "cookie-policy": "/cookie-policy",
  disclaimer: "/financial-disclaimer",
  "financial-disclaimer": "/financial-disclaimer",
};

function titleFor(slug: string): string {
  const s = slug.toLowerCase();
  if (s.includes("privacy")) return "Privacy";
  if (s.includes("cookie")) return "Cookies";
  if (s.includes("terms")) return "Terms";
  if (s.includes("disclaimer") || s.includes("financial")) return "Disclaimer";
  return "Legal";
}

export default function LegalPageScreen() {
  const { page } = useLocalSearchParams<{ page: string }>();
  const c = useThemeColors();
  const base = getWebAppBaseUrl();
  const path = PAGE_PATH[page?.toLowerCase() ?? ""] ?? `/${page ?? ""}`;
  const uri = useMemo(() => {
    if (!base) return "";
    return `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
  }, [base, path]);

  return (
    <>
      <Stack.Screen options={{ title: titleFor(page ?? "") }} />
      <View style={[styles.flex, { backgroundColor: c.bg }]}>
        {!uri ? (
          <View style={styles.center}>
            <Text style={[styles.msg, { color: c.text }]}>
              Configure EXPO_PUBLIC_WEB_APP_URL to view legal pages in-app.
            </Text>
          </View>
        ) : (
          <WebView
            source={{ uri }}
            startInLoadingState
            renderLoading={() => (
              <View style={styles.center}>
                <ActivityIndicator size="large" color={c.primary} />
              </View>
            )}
          />
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.xl },
  msg: { fontSize: typography.sm, textAlign: "center", lineHeight: 22 },
});
