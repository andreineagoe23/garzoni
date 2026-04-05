import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useThemeColors } from '../../../theme/ThemeContext';
import { spacing, typography, radius, shadows } from '../../../theme/tokens';
import { formatCurrency } from '../../../types/savings-calculator';
import type { SavingsResult } from '../../../types/savings-calculator';

type Props = { result: SavingsResult; goalAmount: number };

export function ResultSummary({ result, goalAmount }: Props) {
  const c = useThemeColors();
  const goalMet = goalAmount > 0 && result.futureValue >= goalAmount;

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }, shadows.md]}>
      {/* Primary stat */}
      <View style={styles.primaryStat}>
        <Text style={[styles.primaryLabel, { color: c.textMuted }]}>Future Value</Text>
        <Text style={[styles.primaryValue, { color: c.primary }]}>
          {formatCurrency(result.futureValue)}
        </Text>
        {goalAmount > 0 && (
          <View
            style={[
              styles.goalBadge,
              { backgroundColor: goalMet ? c.successBg : c.errorBg },
            ]}
          >
            <Text style={[styles.goalBadgeText, { color: goalMet ? c.success : c.error }]}>
              {goalMet ? '✓ Goal reached' : `${formatCurrency(goalAmount - result.futureValue)} short of goal`}
            </Text>
          </View>
        )}
      </View>

      {/* Stats row */}
      <View style={[styles.statsRow, { borderTopColor: c.border }]}>
        <StatItem label="Total Contributed" value={formatCurrency(result.totalContributed)} color={c.text} muted={c.textMuted} />
        <StatItem label="Interest Earned" value={formatCurrency(result.interestEarned)} color={c.success} muted={c.textMuted} />
        {result.monthsToGoal != null && (
          <StatItem
            label="Months to Goal"
            value={`${result.monthsToGoal}mo`}
            color={c.primary}
            muted={c.textMuted}
          />
        )}
      </View>
    </View>
  );
}

function StatItem({ label, value, color, muted }: { label: string; value: string; color: string; muted: string }) {
  return (
    <View style={styles.statItem}>
      <Text style={[styles.statLabel, { color: muted }]}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
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
  primaryStat: { alignItems: 'center', gap: spacing.sm },
  primaryLabel: { fontSize: typography.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
  primaryValue: { fontSize: typography.hero, fontWeight: '800', letterSpacing: -1 },
  goalBadge: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  goalBadgeText: { fontSize: typography.xs, fontWeight: '700' },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    paddingTop: spacing.lg,
  },
  statItem: { alignItems: 'center', gap: spacing.xs },
  statLabel: { fontSize: typography.xs, textTransform: 'uppercase', letterSpacing: 0.3 },
  statValue: { fontSize: typography.sm, fontWeight: '700' },
});
