import { useMemo } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Stack } from "expo-router";
import { WebView } from "react-native-webview";
import { useTranslation } from "react-i18next";
import { useTheme, useThemeColors } from "../../src/theme/ThemeContext";
import { spacing, typography } from "../../src/theme/tokens";

function buildHtml(theme: "light" | "dark", bg: string, locale: string) {
  const config = {
    feedMode: "all_symbols",
    isTransparent: false,
    displayMode: "regular",
    width: "100%",
    height: "100%",
    colorTheme: theme,
    locale,
  };
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />
<style>
  html,body { margin:0; padding:0; height:100%; background:${bg}; }
  .tradingview-widget-container { position:fixed; inset:0; }
  .tradingview-widget-container__widget { width:100%; height:calc(100% - 22px); }
  .tradingview-widget-copyright { text-align:center; font-size:11px; color:#9ca3af; line-height:22px; }
  .tradingview-widget-copyright a { color:#1d5330; text-decoration:none; }
</style>
</head>
<body>
  <div class="tradingview-widget-container">
    <div class="tradingview-widget-container__widget"></div>
    <div class="tradingview-widget-copyright">
      <a href="https://www.tradingview.com/" rel="noopener noreferrer nofollow" target="_blank">Top stories by TradingView</a>
    </div>
    <script type="text/javascript" src="https://s3.tradingview.com/external-embedding/embed-widget-timeline.js" async>
      ${JSON.stringify(config)}
    </script>
  </div>
</body>
</html>`;
}

export default function NewsContextScreen() {
  const c = useThemeColors();
  const { resolved } = useTheme();
  const { t, i18n } = useTranslation("common");
  const locale = (i18n.language || "en").split("-")[0];
  const html = useMemo(
    () => buildHtml(resolved, c.bg, locale),
    [resolved, c.bg, locale],
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: t("tools.groups.understand-world.tools.news-context.title", {
            defaultValue: "News Context",
          }),
          headerShown: true,
        }}
      />
      <View style={[styles.flex, { backgroundColor: c.bg }]}>
        <WebView
          originWhitelist={["*"]}
          source={{ html, baseUrl: "https://s3.tradingview.com" }}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
          setSupportMultipleWindows={false}
          renderLoading={() => (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={c.primary} />
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
