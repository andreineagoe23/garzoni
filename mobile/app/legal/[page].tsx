import { useCallback, useMemo, useState } from "react";
import {
  Linking,
  StyleSheet,
  Text,
  View,
} from "react-native";
import LoadingSpinner from "../../src/components/ui/LoadingSpinner";
import { Stack, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { WebView } from "react-native-webview";
import { getWebAppBaseUrl } from "../../src/bootstrap/webAppUrl";
import { webViewDevLoggingProps } from "../../src/bootstrap/webViewDevLogging";
import { useThemeColors } from "../../src/theme/ThemeContext";
import { spacing, typography } from "../../src/theme/tokens";
import { Button } from "../../src/components/ui";
import type { TFunction } from "i18next";

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

function titleFor(slug: string, t: TFunction<"common">): string {
  const s = slug.toLowerCase();
  if (s.includes("privacy")) return t("legalMobile.titlePrivacy");
  if (s.includes("cookie")) return t("legalMobile.titleCookies");
  if (s.includes("terms")) return t("legalMobile.titleTerms");
  if (s.includes("disclaimer") || s.includes("financial"))
    return t("legalMobile.titleDisclaimer");
  return t("legalMobile.titleDefault");
}

export default function LegalPageScreen() {
  const { page } = useLocalSearchParams<{ page: string }>();
  const c = useThemeColors();
  const { t } = useTranslation("common");
  const base = getWebAppBaseUrl();
  const path = PAGE_PATH[page?.toLowerCase() ?? ""] ?? `/${page ?? ""}`;
  const uri = useMemo(() => {
    if (!base) return "";
    return `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
  }, [base, path]);

  const publicLegalUrl = useMemo(
    () => `https://www.garzoni.app${path.startsWith("/") ? path : `/${path}`}`,
    [path],
  );

  const [webKey, setWebKey] = useState(0);
  const [loadFailed, setLoadFailed] = useState(false);

  const openExternal = useCallback(() => {
    const target = uri || publicLegalUrl;
    if (target) void Linking.openURL(target);
  }, [uri, publicLegalUrl]);

  const retry = useCallback(() => {
    setLoadFailed(false);
    setWebKey((k) => k + 1);
  }, []);

  return (
    <>
      <Stack.Screen options={{ title: titleFor(page ?? "", t) }} />
      <View style={[styles.flex, { backgroundColor: c.bg }]}>
        {!uri ? (
          <View style={styles.center}>
            <Text style={[styles.msg, { color: c.text }]}>
              {t("legalMobile.configureBody")}
            </Text>
            <Button variant="secondary" size="sm" onPress={openExternal}>
              {t("legalMobile.openInBrowser")}
            </Button>
          </View>
        ) : loadFailed ? (
          <View style={styles.center}>
            <Text style={[styles.title, { color: c.text }]}>
              {t("legalMobile.loadErrorTitle")}
            </Text>
            <Text style={[styles.msg, { color: c.textMuted }]}>
              {t("legalMobile.loadErrorBody")}
            </Text>
            <View style={styles.row}>
              <Button variant="secondary" size="sm" onPress={retry}>
                {t("legalMobile.retry")}
              </Button>
              <Button variant="ghost" size="sm" onPress={openExternal}>
                {t("legalMobile.openInBrowser")}
              </Button>
            </View>
          </View>
        ) : (
          <WebView
            key={webKey}
            source={{ uri }}
            {...webViewDevLoggingProps()}
            startInLoadingState
            onError={() => setLoadFailed(true)}
            onHttpError={() => setLoadFailed(true)}
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
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: {
    fontSize: typography.md,
    fontWeight: "700",
    textAlign: "center",
  },
  msg: { fontSize: typography.sm, textAlign: "center", lineHeight: 22 },
  row: {
    flexDirection: "row",
    gap: spacing.md,
    flexWrap: "wrap",
    justifyContent: "center",
  },
});
