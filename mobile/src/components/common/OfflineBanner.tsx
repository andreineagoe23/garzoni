import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { useTranslation } from "react-i18next";
import { spacing, typography } from "../../theme/tokens";
import { useThemeColors } from "../../theme/ThemeContext";

export default function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  const c = useThemeColors();
  const { t } = useTranslation("common");

  useEffect(() => {
    const sub = NetInfo.addEventListener((state) => {
      setOffline(state.isConnected === false);
    });
    void NetInfo.fetch().then((s) => setOffline(s.isConnected === false));
    return () => sub();
  }, []);

  if (!offline) return null;

  return (
    <View
      style={[styles.banner, { backgroundColor: c.error }]}
      accessibilityRole="alert"
    >
      <Text style={[styles.text, { color: c.white }]}>
        {t("mobile.offlineBanner.message")}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  text: {
    fontSize: typography.sm,
    fontWeight: "600",
    textAlign: "center",
  },
});
