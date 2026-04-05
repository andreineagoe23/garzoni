import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { spacing, typography, radius } from '../../../theme/tokens';

type Props = {
  feasible: boolean;
  warnings: string[];
};

export function RiskBadge({ feasible, warnings }: Props) {
  const level = warnings.length === 0 ? 'low' : warnings.length === 1 ? 'medium' : 'high';

  const config = {
    low: { label: 'Low Risk', bg: 'rgba(46,125,50,0.12)', color: '#2e7d32' },
    medium: { label: 'Medium Risk', bg: 'rgba(245,158,11,0.12)', color: '#b45309' },
    high: { label: 'High Risk', bg: 'rgba(239,68,68,0.12)', color: '#dc2626' },
  }[level];

  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <Text style={[styles.label, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  label: {
    fontSize: typography.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
