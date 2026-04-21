import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { consumeWelcomeHeaderPending } from "../../auth/firstRunFlags";
import { useThemeColors } from "../../theme/ThemeContext";
import { spacing, typography } from "../../theme/tokens";

const VISIBLE_MS = 6000;
const FADE_MS = 400;

type Props = {
  displayName?: string;
};

export default function DashboardHeaderMobile({ displayName }: Props) {
  const { t } = useTranslation("common");
  const c = useThemeColors();
  const [show, setShow] = useState<null | boolean>(null);
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;
    let hideTimer: ReturnType<typeof setTimeout> | null = null;

    void (async () => {
      const pending = await consumeWelcomeHeaderPending();
      if (cancelled) return;
      if (!pending) {
        setShow(false);
        return;
      }
      setShow(true);
      Animated.timing(opacity, {
        toValue: 1,
        duration: FADE_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      hideTimer = setTimeout(() => {
        Animated.timing(opacity, {
          toValue: 0,
          duration: FADE_MS,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (finished && !cancelled) setShow(false);
        });
      }, VISIBLE_MS);
    })();

    return () => {
      cancelled = true;
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [opacity]);

  if (!show) return null;

  return (
    <Animated.View style={[styles.row, { opacity }]}>
      <View style={[styles.avatar, { backgroundColor: c.primary }]}>
        <Text style={styles.avatarEmoji} accessibilityLabel="">
          👋
        </Text>
      </View>
      <View style={styles.textCol}>
        <Text style={[styles.title, { color: c.text }]}>
          {displayName
            ? t("dashboard.header.welcomeBackName", { name: displayName })
            : `${t("dashboard.header.welcomeBack")}!`}
        </Text>
        <Text style={[styles.sub, { color: c.textMuted }]}>
          {t("dashboard.header.yourCoachSubtitle")}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarEmoji: { fontSize: 22 },
  textCol: { flex: 1, minWidth: 0 },
  title: { fontSize: typography.xl, fontWeight: "800" },
  sub: { fontSize: typography.sm, marginTop: 4, lineHeight: 20 },
});
