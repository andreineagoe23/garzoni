import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack } from "expo-router";
import { WebView } from "react-native-webview";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import { useTheme, useThemeColors } from "../../../src/theme/ThemeContext";
import { spacing, typography, radius } from "../../../src/theme/tokens";

const INVESTING_PIP_CALC_BASE = "https://ssltools.investing.com/pip-calculator";
const FOREX_OPEN_URL = "https://www.investing.com/tools/forex-pip-calculator";

type Tab = "crypto" | "forex";

function buildTradingViewHtml(theme: "light" | "dark", locale: string): string {
  const widgetConfig = {
    width: "100%",
    height: "500",
    symbol: "BITSTAMP:BTCUSD",
    interval: "D",
    timezone: "Europe/London",
    theme,
    style: "1",
    locale,
    withdateranges: true,
    allow_symbol_change: true,
    watchlist: [
      "BITSTAMP:BTCUSD",
      "COINBASE:ETHUSD",
      "COINBASE:SOLUSD",
      "BINANCE:XRPUSD",
      "BINANCE:ADAUSD",
    ],
    details: true,
    calendar: false,
    support_host: "https://www.tradingview.com",
  };
  const json = JSON.stringify(widgetConfig).replace(/</g, "\\u003c");
  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
<style>html,body{margin:0;padding:0;background:${theme === "dark" ? "#131722" : "#fff"};}</style>
</head><body>
<div class="tradingview-widget-container" style="height:500px;width:100%">
  <div class="tradingview-widget-container__widget" style="height:100%;width:100%"></div>
</div>
<script src="https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js" async>
${json}
</script>
</body></html>`;
}

export default function CurrencyToolsScreen() {
  const { t, i18n } = useTranslation("common");
  const c = useThemeColors();
  const { resolved } = useTheme();
  const [tab, setTab] = useState<Tab>("crypto");
  const [cryptoError, setCryptoError] = useState(false);
  const [forexError, setForexError] = useState(false);

  const lang = i18n.language?.toLowerCase().startsWith("ro")
    ? "ro"
    : i18n.language?.toLowerCase().startsWith("es")
      ? "es"
      : "en";

  const cryptoHtml = useMemo(
    () => buildTradingViewHtml(resolved === "dark" ? "dark" : "light", lang),
    [resolved, lang],
  );

  const forexUri = useMemo(
    () => `${INVESTING_PIP_CALC_BASE}/index.php?force_lang=51`,
    [],
  );

  const setTabCrypto = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTab("crypto");
    setCryptoError(false);
  }, []);

  const setTabForex = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTab("forex");
    setForexError(false);
  }, []);

  const openForexExternal = useCallback(() => {
    void Linking.openURL(FOREX_OPEN_URL);
  }, []);

  const openTradingView = useCallback(() => {
    void Linking.openURL("https://www.tradingview.com/");
  }, []);

  return (
    <>
      <Stack.Screen
        options={{ title: t("tools.entries.crypto-tools.title") }}
      />
      <View style={[styles.root, { backgroundColor: c.bg }]}>
        <View style={[styles.segWrap, { backgroundColor: c.surfaceOffset }]}>
          <Pressable
            onPress={setTabCrypto}
            style={[
              styles.segBtn,
              tab === "crypto" && { backgroundColor: c.surface },
              { borderColor: c.border },
            ]}
          >
            <Text
              style={[
                styles.segText,
                { color: tab === "crypto" ? c.primary : c.textMuted },
              ]}
            >
              {t("tools.crypto.tabLabel")}
            </Text>
          </Pressable>
          <Pressable
            onPress={setTabForex}
            style={[
              styles.segBtn,
              tab === "forex" && { backgroundColor: c.surface },
              { borderColor: c.border },
            ]}
          >
            <Text
              style={[
                styles.segText,
                { color: tab === "forex" ? c.primary : c.textMuted },
              ]}
            >
              {t("tools.forex.tabLabel")}
            </Text>
          </Pressable>
        </View>

        <Text style={[styles.sub, { color: c.textMuted }]}>
          {tab === "crypto"
            ? t("tools.crypto.subtitle")
            : t("tools.forex.subtitle")}
        </Text>

        {tab === "crypto" ? (
          <View style={[styles.webWrap, { borderColor: c.border }]}>
            {cryptoError ? (
              <View style={styles.errBox}>
                <Text style={[styles.errTitle, { color: c.error }]}>
                  {t("tools.crypto.errors.loadFailed")}
                </Text>
                <Text style={[styles.errHelp, { color: c.textMuted }]}>
                  {t("tools.crypto.errors.loadFailedHelp")}
                </Text>
                <Pressable
                  onPress={openTradingView}
                  style={[styles.outLink, { borderColor: c.primary }]}
                >
                  <Text style={[styles.outLinkText, { color: c.primary }]}>
                    {t("tools.crypto.errors.openNewTab")}
                  </Text>
                </Pressable>
              </View>
            ) : (
              <WebView
                originWhitelist={["*"]}
                source={{ html: cryptoHtml }}
                style={styles.web}
                onError={() => setCryptoError(true)}
                onHttpError={() => setCryptoError(true)}
                startInLoadingState
                renderLoading={() => (
                  <View style={styles.center}>
                    <ActivityIndicator size="large" color={c.primary} />
                  </View>
                )}
                setSupportMultipleWindows={false}
              />
            )}
          </View>
        ) : (
          <View style={[styles.webWrap, { borderColor: c.border }]}>
            {forexError ? (
              <View style={styles.errBox}>
                <Text style={[styles.errTitle, { color: c.error }]}>
                  {t("tools.forex.loadFailed")}
                </Text>
                <Pressable
                  onPress={openForexExternal}
                  style={[styles.outLink, { borderColor: c.primary }]}
                >
                  <Text style={[styles.outLinkText, { color: c.primary }]}>
                    {t("tools.forex.openExternal")}
                  </Text>
                </Pressable>
              </View>
            ) : (
              <WebView
                source={{ uri: forexUri }}
                style={styles.web}
                onError={() => setForexError(true)}
                onHttpError={() => setForexError(true)}
                startInLoadingState
                renderLoading={() => (
                  <View style={styles.center}>
                    <ActivityIndicator size="large" color={c.primary} />
                  </View>
                )}
                setSupportMultipleWindows={false}
              />
            )}
          </View>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: spacing.lg },
  segWrap: {
    flexDirection: "row",
    borderRadius: radius.lg,
    padding: 4,
    gap: 4,
    marginBottom: spacing.md,
  },
  segBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  segText: { fontSize: typography.sm, fontWeight: "700" },
  sub: { fontSize: typography.sm, lineHeight: 20, marginBottom: spacing.md },
  webWrap: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: "hidden",
    minHeight: 420,
  },
  web: { flex: 1, backgroundColor: "transparent" },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  errBox: { padding: spacing.xl, gap: spacing.md },
  errTitle: { fontSize: typography.md, fontWeight: "700" },
  errHelp: { fontSize: typography.sm, lineHeight: 20 },
  outLink: {
    alignSelf: "flex-start",
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  outLinkText: { fontSize: typography.sm, fontWeight: "700" },
});
