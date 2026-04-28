import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useTheme, useThemeColors } from "../../../theme/ThemeContext";
import { spacing, typography, radius } from "../../../theme/tokens";
import type { InsightCard as InsightCardType } from "../../../types/portfolio";

type Props = {
  card: InsightCardType;
};

export function InsightCard({ card }: Props) {
  const c = useThemeColors();
  const { resolved } = useTheme();
  const dark = resolved === "dark";
  const [expanded, setExpanded] = useState(false);

  const CONFIDENCE_COLORS: Record<string, { bg: string; text: string }> = {
    high: {
      bg: dark ? "rgba(42,115,71,0.18)" : "rgba(42,115,71,0.10)",
      text: dark ? "#2a7347" : "#1d5330",
    },
    medium: {
      bg: dark ? "rgba(251,191,36,0.14)" : "rgba(245,158,11,0.12)",
      text: dark ? "#fbbf24" : "#b45309",
    },
    low: {
      bg: dark ? "rgba(148,163,184,0.14)" : "rgba(107,114,128,0.12)",
      text: dark ? "#94a3b8" : "#6b7280",
    },
  };

  const conf = CONFIDENCE_COLORS[card.confidence] ?? CONFIDENCE_COLORS.low;

  return (
    <Pressable
      onPress={() => setExpanded((v) => !v)}
      style={[
        styles.card,
        { backgroundColor: c.surfaceElevated, borderColor: c.border },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${card.title} insight. Tap to ${expanded ? "collapse" : "expand"}.`}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: c.text }]} numberOfLines={2}>
          {card.title}
        </Text>
        <View style={[styles.confBadge, { backgroundColor: conf.bg }]}>
          <Text style={[styles.confText, { color: conf.text }]}>
            {card.confidence} confidence
          </Text>
        </View>
      </View>

      {/* Always visible: meaning */}
      <Text style={[styles.sectionLabel, { color: c.textMuted }]}>
        What it means
      </Text>
      <Text style={[styles.body, { color: c.text }]}>{card.meaning}</Text>

      {/* Expandable */}
      {expanded && (
        <>
          <View style={[styles.divider, { backgroundColor: c.border }]} />
          <Text style={[styles.sectionLabel, { color: c.textMuted }]}>
            Why it matters
          </Text>
          <Text style={[styles.body, { color: c.text }]}>{card.why}</Text>

          <Text
            style={[
              styles.sectionLabel,
              { color: c.textMuted, marginTop: spacing.sm },
            ]}
          >
            Next steps
          </Text>
          <View style={styles.stepsList}>
            {card.nextSteps.map((step, i) => (
              <View key={i} style={styles.stepRow}>
                <View
                  style={[styles.stepDot, { backgroundColor: c.primary }]}
                />
                <Text style={[styles.stepText, { color: c.textMuted }]}>
                  {step}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Expand/collapse chevron */}
      <Text style={[styles.chevron, { color: c.textFaint }]}>
        {expanded ? "▲ Less" : "▼ More"}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 260,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  title: {
    flex: 1,
    fontSize: typography.sm,
    fontWeight: "700",
    lineHeight: 18,
  },
  confBadge: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    flexShrink: 0,
  },
  confText: {
    fontSize: typography.xs,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  sectionLabel: {
    fontSize: typography.xs,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: spacing.xs,
  },
  body: {
    fontSize: typography.sm,
    lineHeight: 18,
  },
  divider: {
    height: 1,
    marginVertical: spacing.sm,
  },
  stepsList: {
    gap: spacing.xs,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  stepDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 6,
    flexShrink: 0,
  },
  stepText: {
    flex: 1,
    fontSize: typography.xs,
    lineHeight: 16,
  },
  chevron: {
    fontSize: typography.xs,
    fontWeight: "600",
    marginTop: spacing.sm,
    textAlign: "right",
  },
});
