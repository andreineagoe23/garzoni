import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useThemeColors } from "../../../theme/ThemeContext";
import { spacing, typography, radius, shadows } from "../../../theme/tokens";
import { RiskBadge } from "./RiskBadge";
import type { RealityCheckResult } from "../../../types/reality-check";
import { formatCurrency } from "../../../types/reality-check";

type Props = {
  result: RealityCheckResult;
  goalName: string;
};

export function ResultCard({ result, goalName }: Props) {
  const c = useThemeColors();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: c.surface, borderColor: c.border },
        shadows.md,
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.goalName, { color: c.text }]} numberOfLines={1}>
          {goalName || "Your Goal"}
        </Text>
        <RiskBadge feasible={result.feasible} warnings={result.warnings} />
      </View>

      {/* Progress bar */}
      <View style={styles.progressSection}>
        <View style={styles.progressLabelRow}>
          <Text style={[styles.progressLabel, { color: c.textMuted }]}>
            Progress
          </Text>
          <Text style={[styles.progressPct, { color: c.text }]}>
            {result.progressPct.toFixed(1)}%
          </Text>
        </View>
        <View
          style={[styles.progressTrack, { backgroundColor: c.surfaceOffset }]}
        >
          <View
            style={[
              styles.progressFill,
              {
                backgroundColor: c.primary,
                width: `${Math.min(result.progressPct, 100)}%` as any,
              },
            ]}
          />
        </View>
      </View>

      {/* Key numbers */}
      <View style={[styles.statsRow, { borderTopColor: c.border }]}>
        <StatItem
          label="Required/mo"
          value={formatCurrency(result.requiredMonthly)}
          color={c.text}
          muted={c.textMuted}
        />
        <StatItem
          label="Surplus (low)"
          value={formatCurrency(result.lowSurplus)}
          color={
            result.lowSurplus >= result.requiredMonthly ? c.success : c.error
          }
          muted={c.textMuted}
        />
        <StatItem
          label="Surplus (high)"
          value={formatCurrency(result.highSurplus)}
          color={
            result.highSurplus >= result.requiredMonthly ? c.success : c.error
          }
          muted={c.textMuted}
        />
      </View>

      {/* Timeline estimate */}
      {result.expectedMonths != null && (
        <View
          style={[
            styles.timelineRow,
            { backgroundColor: c.surfaceOffset, borderRadius: radius.md },
          ]}
        >
          <TimelineItem
            label="Best case"
            value={result.bestMonths}
            color={c.success}
            muted={c.textMuted}
          />
          <TimelineItem
            label="Expected"
            value={result.expectedMonths}
            color={c.text}
            muted={c.textMuted}
          />
          <TimelineItem
            label="Worst case"
            value={result.worstMonths}
            color={c.error}
            muted={c.textMuted}
          />
        </View>
      )}

      {/* Warnings */}
      {result.warnings.map((w, i) => (
        <View
          key={i}
          style={[
            styles.warningBox,
            { backgroundColor: c.errorBg, borderColor: c.error },
          ]}
        >
          <Text style={[styles.warningText, { color: c.error }]}>⚠ {w}</Text>
        </View>
      ))}
    </View>
  );
}

function StatItem({
  label,
  value,
  color,
  muted,
}: {
  label: string;
  value: string;
  color: string;
  muted: string;
}) {
  return (
    <View style={styles.statItem}>
      <Text style={[styles.statLabel, { color: muted }]}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </View>
  );
}

function TimelineItem({
  label,
  value,
  color,
  muted,
}: {
  label: string;
  value: number | null;
  color: string;
  muted: string;
}) {
  return (
    <View style={styles.timelineItem}>
      <Text style={[styles.timelineMonths, { color }]}>
        {value != null ? `${value}mo` : "—"}
      </Text>
      <Text style={[styles.timelineLabel, { color: muted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
  },
  goalName: {
    fontSize: typography.lg,
    fontWeight: "700",
    flex: 1,
  },
  progressSection: { gap: spacing.xs },
  progressLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  progressLabel: {
    fontSize: typography.xs,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  progressPct: { fontSize: typography.xs, fontWeight: "700" },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    paddingTop: spacing.lg,
  },
  statItem: { alignItems: "center", gap: spacing.xs },
  statLabel: {
    fontSize: typography.xs,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  statValue: { fontSize: typography.sm, fontWeight: "700" },
  timelineRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    padding: spacing.md,
  },
  timelineItem: { alignItems: "center", gap: spacing.xs },
  timelineMonths: { fontSize: typography.md, fontWeight: "700" },
  timelineLabel: { fontSize: typography.xs },
  warningBox: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  warningText: { fontSize: typography.sm },
});
