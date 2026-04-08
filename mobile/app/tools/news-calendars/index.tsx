import React, { useMemo, useState } from "react";
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
import { useTheme, useThemeColors } from "../../../src/theme/ThemeContext";
import { spacing, typography, radius } from "../../../src/theme/tokens";

const INVESTING_CALENDAR_BASE = "https://sslecal2.investing.com";
const CALENDAR_OPEN_URL = "https://www.investing.com/economic-calendar/";

export default function NewsCalendarsScreen() {
  const { t } = useTranslation("common");
  const c = useThemeColors();
  const { resolved } = useTheme();
  const [failed, setFailed] = useState(false);

  const uri = useMemo(
    () =>
      `${INVESTING_CALENDAR_BASE}?theme=${resolved === "dark" ? "dark" : "light"}&calendarType=week&size=8&width=100%25&height=600`,
    [resolved],
  );

  return (
    <>
      <Stack.Screen options={{ title: t("tools.calendarEmbed.title") }} />
      <View style={[styles.root, { backgroundColor: c.bg }]}>
        <Text style={[styles.sub, { color: c.textMuted }]}>
          {t("tools.calendarEmbed.subtitle")}
        </Text>
        <View style={[styles.webWrap, { borderColor: c.border }]}>
          {failed ? (
            <View style={styles.errBox}>
              <Text style={[styles.errText, { color: c.textMuted }]}>
                {t("tools.calendar.errors.loadFailedHelp")}
              </Text>
              <Pressable
                onPress={() => void Linking.openURL(CALENDAR_OPEN_URL)}
                style={[styles.link, { borderColor: c.primary }]}
              >
                <Text style={[styles.linkText, { color: c.primary }]}>
                  {t("tools.calendar.errors.openNewTab")}
                </Text>
              </Pressable>
            </View>
          ) : (
            <WebView
              source={{ uri }}
              style={styles.web}
              onError={() => setFailed(true)}
              onHttpError={() => setFailed(true)}
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
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: spacing.lg },
  sub: { fontSize: typography.sm, lineHeight: 20, marginBottom: spacing.md },
  webWrap: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: "hidden",
    minHeight: 520,
  },
  web: { flex: 1 },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  errBox: { padding: spacing.lg, gap: spacing.md },
  errText: { fontSize: typography.sm, lineHeight: 22 },
  link: {
    alignSelf: "flex-start",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  linkText: { fontSize: typography.sm, fontWeight: "700" },
});
