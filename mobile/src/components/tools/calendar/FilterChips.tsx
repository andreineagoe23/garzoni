import React from "react";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import * as Haptics from "expo-haptics";
import { useThemeColors } from "../../../theme/ThemeContext";
import { spacing, typography, radius } from "../../../theme/tokens";
import type { FilterOption } from "../../../types/economic-calendar";
import { IMPACT_COLORS } from "../../../types/economic-calendar";

type Props = {
  active: FilterOption;
  onChange: (f: FilterOption) => void;
};

const OPTIONS: { value: FilterOption; label: string }[] = [
  { value: "all", label: "All" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

export function FilterChips({ active, onChange }: Props) {
  const c = useThemeColors();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroller}
      contentContainerStyle={styles.row}
    >
      {OPTIONS.map((opt) => {
        const isActive = active === opt.value;
        const accentColor =
          opt.value === "all"
            ? c.primary
            : (IMPACT_COLORS[opt.value as keyof typeof IMPACT_COLORS] ??
              c.primary);

        return (
          <Pressable
            key={opt.value}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onChange(opt.value);
            }}
            style={[
              styles.chip,
              {
                backgroundColor: isActive
                  ? accentColor + "20"
                  : c.surfaceOffset,
                borderColor: isActive ? accentColor : c.border,
              },
            ]}
          >
            <Text
              style={[
                styles.label,
                { color: isActive ? accentColor : c.textMuted },
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Horizontal ScrollViews default to `flexGrow: 1`; hug the content so this
  // never steals leftover vertical space when dropped into a flex column.
  scroller: { flexGrow: 0, flexShrink: 0 },
  row: {
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xs,
  },
  chip: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
  },
  label: {
    fontSize: typography.xs,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
});
