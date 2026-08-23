import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import LoadingSpinner from "../../src/components/ui/LoadingSpinner";
import { Stack, useLocalSearchParams } from "expo-router";
import { WebView } from "react-native-webview";
import { getWebAppBaseUrl } from "../../src/bootstrap/webAppUrl";
import { webViewDevLoggingProps } from "../../src/bootstrap/webViewDevLogging";
import { useThemeColors } from "../../src/theme/ThemeContext";
import { spacing, typography } from "../../src/theme/tokens";
import { resolveWebToolSlug } from "../../src/navigation/webToolSlug";

export default function ToolWebScreen() {
  const { tool } = useLocalSearchParams<{ tool: string }>();
  const c = useThemeColors();
  const base = getWebAppBaseUrl();
  const toolSlug = typeof tool === "string" ? tool.trim() : "";
  const webSlug = resolveWebToolSlug(toolSlug);
  const uri = useMemo(() => {
    if (!base || !webSlug) return "";
    return `${base}/tools/${encodeURIComponent(webSlug)}`;
  }, [base, webSlug]);

  return (
    <>
      <Stack.Screen
        options={{ title: String(tool ?? "Tool"), headerShown: true }}
      />
      <View style={[styles.flex, { backgroundColor: c.bg }]}>
        {!uri ? (
          <View style={styles.center}>
            <Text style={[styles.msg, { color: c.text }]}>
              {/* Landing here for a tool that has a native screen means the
                  static route was not in the bundle — restart Metro with
                  `--clear`. Saying so beats blaming the env var. */}
              {toolSlug && !webSlug
                ? `"${toolSlug}" isn't available in this build. Restart the dev server with --clear, or update the app.`
                : "Set EXPO_PUBLIC_WEB_APP_URL in your build env to load tools."}
            </Text>
          </View>
        ) : (
          <WebView
            source={{ uri }}
            {...webViewDevLoggingProps()}
            startInLoadingState
            renderLoading={() => (
              <View style={styles.center}>
                <LoadingSpinner size="lg" />
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
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  msg: { fontSize: typography.sm, textAlign: "center", lineHeight: 22 },
});
