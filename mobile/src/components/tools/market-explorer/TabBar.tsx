import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '../../../theme/ThemeContext';
import { spacing, typography, radius } from '../../../theme/tokens';
import { TAB_LABELS } from '../../../types/market-explorer';
import type { MarketTab } from '../../../types/market-explorer';

type Props = { active: MarketTab; onChange: (t: MarketTab) => void };

const TABS: MarketTab[] = ['stocks', 'crypto', 'forex'];

export function TabBar({ active, onChange }: Props) {
  const c = useThemeColors();
  return (
    <View style={[styles.row, { backgroundColor: c.surfaceOffset, borderColor: c.border }]}>
      {TABS.map((tab) => {
        const isActive = active === tab;
        return (
          <Pressable
            key={tab}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onChange(tab);
            }}
            style={[
              styles.tab,
              isActive && { backgroundColor: c.surface },
              isActive && { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2, elevation: 1 },
            ]}
          >
            <Text style={[styles.label, { color: isActive ? c.text : c.textMuted }]}>
              {TAB_LABELS[tab]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 3,
    gap: 3,
  },
  tab: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  label: { fontSize: typography.sm, fontWeight: '600' },
});
