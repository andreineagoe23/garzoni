import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import MascotWithMessage from "../../common/MascotWithMessage";
import { Button } from "../../ui";
import { useThemeColors } from "../../../theme/ThemeContext";
import { radius, shadows, spacing, typography } from "../../../theme/tokens";

type Props = {
  xp: number;
  coins: number;
  onContinue: () => void;
};

function useSpringIn(delay = 0) {
  const scale = useRef(new Animated.Value(0.4)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 10,
        bounciness: 14,
        delay,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 240,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, scale, opacity]);
  return { transform: [{ scale }], opacity };
}

export default function OnboardingCompletionOverlay({
  xp,
  coins,
  onContinue,
}: Props) {
  const c = useThemeColors();
  const { t } = useTranslation("common");

  const xpStyle = useSpringIn(120);
  const coinsStyle = useSpringIn(240);

  return (
    <View style={styles.completionOverlay}>
      <View style={styles.sparkleRow}>
        <Text style={styles.sparkle}>✨</Text>
        <Text style={[styles.sparkle, styles.sparkleBig]}>🎉</Text>
        <Text style={styles.sparkle}>✨</Text>
      </View>
      <View style={styles.mascotBlock}>
        <MascotWithMessage
          situation="onboarding_complete"
          embedded
          mascotSize={88}
          rotationKey={xp + coins}
        />
      </View>
      <Text style={[styles.completionTitle, { color: c.text }]}>
        {t("onboarding.completionOverlay.title")}
      </Text>
      <Text style={[styles.completionSub, { color: c.textMuted }]}>
        {t("onboarding.completionOverlay.subtitle")}
      </Text>
      <View style={styles.rewardRow}>
        {xp > 0 ? (
          <Animated.View
            style={[
              styles.rewardBadge,
              { backgroundColor: c.surface, borderColor: c.primary },
              xpStyle,
            ]}
          >
            <Text style={[styles.rewardValue, { color: c.primary }]}>
              +{xp}
            </Text>
            <Text style={[styles.rewardLabel, { color: c.textMuted }]}>
              {t("onboarding.completionOverlay.xp")}
            </Text>
          </Animated.View>
        ) : null}
        {coins > 0 ? (
          <Animated.View
            style={[
              styles.rewardBadge,
              { backgroundColor: c.surface, borderColor: c.accent },
              coinsStyle,
            ]}
          >
            <Text style={[styles.rewardValue, { color: c.accent }]}>
              +{coins}
            </Text>
            <Text style={[styles.rewardLabel, { color: c.textMuted }]}>
              {t("onboarding.completionOverlay.coins")}
            </Text>
          </Animated.View>
        ) : null}
      </View>
      <Button onPress={onContinue} style={styles.completionBtn}>
        {t("onboarding.completionOverlay.startLearning")}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  completionOverlay: {
    alignItems: "center",
    width: "100%",
    paddingHorizontal: spacing.lg,
  },
  sparkleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  sparkle: { fontSize: 28, lineHeight: 32 },
  sparkleBig: { fontSize: 44, lineHeight: 48 },
  mascotBlock: { marginBottom: spacing.sm },
  completionTitle: {
    fontSize: typography.xxl,
    fontWeight: "800",
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    letterSpacing: -0.3,
    textAlign: "center",
  },
  completionSub: {
    fontSize: typography.base,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: spacing.xxl,
    maxWidth: 340,
  },
  rewardRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.xxl,
  },
  rewardBadge: {
    alignItems: "center",
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1.5,
    minWidth: 96,
    ...shadows.sm,
  },
  rewardValue: {
    fontSize: typography.xl,
    fontWeight: "800",
  },
  rewardLabel: {
    fontSize: typography.xs,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 2,
  },
  completionBtn: { width: "100%" },
});
