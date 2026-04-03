import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "../../theme/tokens";

type HeartBarProps = {
  hearts: number;
  maxHearts: number;
  countdownLabel?: string | null;
};

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <Text style={[styles.heart, { color: filled ? colors.heart : colors.heartEmpty }]}>
      ♥
    </Text>
  );
}

export default function HeartBar({
  hearts,
  maxHearts,
  countdownLabel,
}: HeartBarProps) {
  return (
    <View style={styles.row}>
      {Array.from({ length: maxHearts }, (_, i) => (
        <HeartIcon key={i} filled={i < hearts} />
      ))}
      {countdownLabel ? (
        <Text style={styles.countdown}>{countdownLabel}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  heart: { fontSize: typography.lg },
  countdown: {
    fontSize: typography.xs,
    color: colors.textMuted,
    marginLeft: spacing.sm,
  },
});
