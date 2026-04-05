import { StyleSheet, Text, View } from "react-native";
import { Button } from "../../ui";
import { colors, radius, shadows, spacing, typography } from "../../../theme/tokens";

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
  return (
    <View style={styles.completionOverlay}>
      <Text style={styles.completionEmoji}>🎉</Text>
      <Text style={styles.completionTitle}>You're all set!</Text>
      <Text style={styles.completionSub}>
        We've personalised your learning path based on your goals.
      </Text>
      <View style={styles.rewardRow}>
        {xp > 0 ? (
          <View style={styles.rewardBadge}>
            <Text style={styles.rewardValue}>+{xp}</Text>
            <Text style={styles.rewardLabel}>XP</Text>
          </View>
        ) : null}
        {coins > 0 ? (
          <View style={[styles.rewardBadge, styles.rewardBadgeGold]}>
            <Text style={styles.rewardValue}>+{coins}</Text>
            <Text style={styles.rewardLabel}>Coins</Text>
          </View>
        ) : null}
      </View>
      <Button onPress={onContinue} style={styles.completionBtn}>
        Start learning
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  completionOverlay: { alignItems: "center", width: "100%", paddingHorizontal: spacing.lg },
  completionEmoji: { fontSize: 72 },
  completionTitle: {
    fontSize: typography.xxl,
    fontWeight: "700",
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  completionSub: {
    fontSize: typography.base,
    color: colors.textMuted,
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
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary,
    ...shadows.sm,
  },
  rewardBadgeGold: { borderColor: colors.accent },
  rewardValue: {
    fontSize: typography.xl,
    fontWeight: "700",
    color: colors.primaryDark,
  },
  rewardLabel: {
    fontSize: typography.xs,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 2,
  },
  completionBtn: { width: "100%" },
});
