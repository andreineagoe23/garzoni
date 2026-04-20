import { StyleSheet, Text, View } from "react-native";
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

export default function OnboardingCompletionOverlay({
  xp,
  coins,
  onContinue,
}: Props) {
  const c = useThemeColors();
  const { t } = useTranslation("common");

  return (
    <View style={styles.completionOverlay}>
      <View style={styles.mascotBlock}>
        <MascotWithMessage
          situation="onboarding_complete"
          embedded
          mascotSize={72}
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
          <View
            style={[
              styles.rewardBadge,
              { backgroundColor: c.surface, borderColor: c.primary },
            ]}
          >
            <Text style={[styles.rewardValue, { color: c.primary }]}>
              +{xp}
            </Text>
            <Text style={[styles.rewardLabel, { color: c.textMuted }]}>
              {t("onboarding.completionOverlay.xp")}
            </Text>
          </View>
        ) : null}
        {coins > 0 ? (
          <View
            style={[
              styles.rewardBadge,
              { backgroundColor: c.surface, borderColor: c.accent },
            ]}
          >
            <Text style={[styles.rewardValue, { color: c.accent }]}>
              +{coins}
            </Text>
            <Text style={[styles.rewardLabel, { color: c.textMuted }]}>
              {t("onboarding.completionOverlay.coins")}
            </Text>
          </View>
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
  mascotBlock: { marginBottom: spacing.sm },
  completionTitle: {
    fontSize: typography.xxl,
    fontWeight: "700",
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  completionSub: {
    fontSize: typography.base,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: spacing.xxl,
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
    borderWidth: 1,
    ...shadows.sm,
  },
  rewardValue: {
    fontSize: typography.xl,
    fontWeight: "700",
  },
  rewardLabel: {
    fontSize: typography.xs,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 2,
  },
  completionBtn: { width: "100%" },
});
