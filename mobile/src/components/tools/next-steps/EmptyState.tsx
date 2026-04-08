import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useThemeColors } from "../../../theme/ThemeContext";
import { spacing, typography } from "../../../theme/tokens";

export function EmptyState() {
  const c = useThemeColors();
  return (
    <View style={styles.wrapper}>
      <Text style={styles.icon}>🎉</Text>
      <Text style={[styles.title, { color: c.text }]}>All done for today!</Text>
      <Text style={[styles.body, { color: c.textMuted }]}>
        Come back tomorrow for new personalized steps.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: "center", gap: spacing.md, padding: spacing.xxxxl },
  icon: { fontSize: 56 },
  title: { fontSize: typography.xl, fontWeight: "700" },
  body: { fontSize: typography.sm, textAlign: "center", lineHeight: 20 },
});
