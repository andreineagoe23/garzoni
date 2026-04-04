import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { spacing, typography } from "../../theme/tokens";
import { useThemeColors } from "../../theme/ThemeContext";

type HeartBarProps = {
  hearts: number;
  maxHearts: number;
  countdownLabel?: string | null;
};

function HeartIcon({ filled, heart, heartEmpty }: { filled: boolean; heart: string; heartEmpty: string }) {
  return (
    <Text style={[styles.heart, { color: filled ? heart : heartEmpty }]}>♥</Text>
  );
}

export default function HeartBar({
  hearts,
  maxHearts,
  countdownLabel,
}: HeartBarProps) {
  const c = useThemeColors();

  return (
    <View style={styles.row}>
      {Array.from({ length: maxHearts }, (_, i) => (
        <HeartIcon
          key={i}
          filled={i < hearts}
          heart={c.heart}
          heartEmpty={c.heartEmpty}
        />
      ))}
      {countdownLabel ? (
        <Text style={[styles.countdown, { color: c.textMuted }]}>{countdownLabel}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  heart: { fontSize: typography.lg },
  countdown: {
    fontSize: typography.xs,
    marginLeft: spacing.sm,
  },
});
