import { useMemo } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { WebView } from "react-native-webview";
import { getWebAppBaseUrl } from "../../src/bootstrap/webAppUrl";
import { webViewDevLoggingProps } from "../../src/bootstrap/webViewDevLogging";
import { useThemeColors } from "../../src/theme/ThemeContext";
import { spacing, typography } from "../../src/theme/tokens";

export default function ToolWebScreen() {
  const { tool } = useLocalSearchParams<{ tool: string }>();
  const c = useThemeColors();
  const base = getWebAppBaseUrl();
  const uri = useMemo(() => {
    if (!base || !tool) return "";
    return `${base}/tools/${encodeURIComponent(tool)}`;
  }, [base, tool]);

  return (
    <>
      <Stack.Screen
        options={{ title: String(tool ?? "Tool"), headerShown: true }}
      />
      <View style={[styles.flex, { backgroundColor: c.bg }]}>
        {!uri ? (
          <View style={styles.center}>
            <Text style={[styles.msg, { color: c.text }]}>
              Set EXPO_PUBLIC_WEB_APP_URL in your build env to load tools.
            </Text>
          </View>
        ) : (
          <WebView
            source={{ uri }}
            {...webViewDevLoggingProps()}
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
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  msg: { fontSize: typography.sm, textAlign: "center", lineHeight: 22 },
});
