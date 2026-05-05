import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import LoadingSpinner from "../../src/components/ui/LoadingSpinner";
import { Stack } from "expo-router";
import { WebView } from "react-native-webview";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../src/theme/ThemeContext";
import { useThemeColors } from "../../src/theme/ThemeContext";
import { spacing, typography } from "../../src/theme/tokens";

function buildHtml(theme: "light" | "dark", bg: string) {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />
<style>
  html,body { margin:0; padding:0; height:100%; background:${bg}; }
  #wrap { position:fixed; inset:0; }
  tv-economic-map { display:block; width:100%; height:100%; }
</style>
</head>
<body>
  <div id="wrap">
    <tv-economic-map theme="${theme}"></tv-economic-map>
  </div>
  <script type="module" src="https://widgets.tradingview-widget.com/w/en/tv-economic-map.js"></script>
</body>
</html>`;
}

export default function EconomicMapScreen() {
  const c = useThemeColors();
  const { resolved } = useTheme();
  const { t } = useTranslation("common");
  const html = useMemo(() => buildHtml(resolved, c.bg), [resolved, c.bg]);

  return (
    <>
      <Stack.Screen
        options={{
          title: t("tools.groups.understand-world.tools.economic-map.title", {
            defaultValue: "Economic Map",
          }),
          headerShown: true,
        }}
      />
      <View style={[styles.flex, { backgroundColor: c.bg }]}>
        <WebView
          originWhitelist={["*"]}
          source={{ html, baseUrl: "https://widgets.tradingview-widget.com" }}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
          setSupportMultipleWindows={false}
          renderLoading={() => (
            <View style={styles.center}>
              <LoadingSpinner size="lg" />
            </View>
          )}
          style={{ backgroundColor: c.bg }}
        />
        <Text style={[styles.disclaimer, { color: c.textMuted }]}>
          {t("tools.disclaimer.educationalOnly")}
        </Text>
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
  disclaimer: {
    fontSize: typography.xs,
    textAlign: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
});
