import React, { useCallback } from "react";
import { View, Text, Pressable, Alert, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { useThemeColors } from "../../../theme/ThemeContext";
import { spacing, typography, radius, shadows } from "../../../theme/tokens";
import {
  formatCurrency,
  formatPercent,
  ASSET_TYPE_LABELS,
} from "../../../types/portfolio";
import type { PortfolioEntry } from "../../../types/portfolio";

type Props = {
  entry: PortfolioEntry;
  onDelete: (id: string | number) => void;
};

export function HoldingCard({ entry, onDelete }: Props) {
  const c = useThemeColors();
  const isGain = (entry.gain_loss ?? 0) >= 0;
  const gainColor = isGain ? c.success : c.error;
  const gainBg = isGain ? c.successBg : c.errorBg;

  const handleLongPress = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(entry.symbol.toUpperCase(), "What would you like to do?", [
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Warning,
          );
          Alert.alert(
            "Delete holding",
            `Remove ${entry.symbol.toUpperCase()} from your portfolio?`,
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Delete",
                style: "destructive",
                onPress: () => {
                  if (entry.id != null) onDelete(entry.id);
                },
              },
            ],
          );
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [entry, onDelete]);

  return (
    <Pressable
      onLongPress={handleLongPress}
      delayLongPress={400}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: c.surface,
          borderColor: c.border,
          opacity: pressed ? 0.88 : 1,
        },
        shadows.sm,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${entry.symbol.toUpperCase()} holding. Long press for options.`}
    >
      {/* Top row */}
      <View style={styles.topRow}>
        <View style={styles.leftGroup}>
          <View style={[styles.badge, { backgroundColor: c.surfaceOffset }]}>
            <Text style={[styles.badgeText, { color: c.textMuted }]}>
              {ASSET_TYPE_LABELS[entry.asset_type] ?? entry.asset_type}
            </Text>
          </View>
          <Text style={[styles.symbol, { color: c.text }]}>
            {entry.symbol.toUpperCase()}
          </Text>
        </View>

        <View style={styles.rightGroup}>
          {entry.current_value != null ? (
            <>
              <Text style={[styles.currentValue, { color: c.text }]}>
                {formatCurrency(entry.current_value)}
              </Text>
              <View style={[styles.gainBadge, { backgroundColor: gainBg }]}>
                <Text style={[styles.gainText, { color: gainColor }]}>
                  {isGain ? "▲" : "▼"}{" "}
                  {formatPercent(entry.gain_loss_percentage ?? 0, 1)}
                </Text>
              </View>
            </>
          ) : (
            <Text style={[styles.noPrice, { color: c.textFaint }]}>
              No live price
            </Text>
          )}
        </View>
      </View>

      {/* Bottom row */}
      <View style={[styles.bottomRow, { borderTopColor: c.border }]}>
        <MetaItem
          label="Qty"
          value={String(entry.quantity)}
          color={c.textMuted}
        />
        <MetaItem
          label="Buy price"
          value={formatCurrency(entry.purchase_price)}
          color={c.textMuted}
        />
        {entry.gain_loss != null && (
          <MetaItem
            label="P&L"
            value={`${(entry.gain_loss ?? 0) >= 0 ? "+" : "−"}${formatCurrency(Math.abs(entry.gain_loss ?? 0))}`}
            color={gainColor}
          />
        )}
        {entry.purchase_date && (
          <MetaItem
            label="Bought"
            value={entry.purchase_date}
            color={c.textMuted}
          />
        )}
      </View>
    </Pressable>
  );
}

function MetaItem({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  const c = useThemeColors();
  return (
    <View style={styles.metaItem}>
      <Text style={[styles.metaLabel, { color: c.textFaint }]}>{label}</Text>
      <Text style={[styles.metaValue, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: spacing.lg,
  },
  leftGroup: {
    gap: spacing.xs,
  },
  badge: {
    alignSelf: "flex-start",
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: typography.xs,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  symbol: {
    fontSize: typography.md,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  rightGroup: {
    alignItems: "flex-end",
    gap: spacing.xs,
  },
  currentValue: {
    fontSize: typography.md,
    fontWeight: "700",
  },
  gainBadge: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  gainText: {
    fontSize: typography.xs,
    fontWeight: "600",
  },
  noPrice: {
    fontSize: typography.xs,
    fontStyle: "italic",
  },
  bottomRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    borderTopWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  metaItem: {
    gap: 2,
  },
  metaLabel: {
    fontSize: typography.xs,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  metaValue: {
    fontSize: typography.sm,
    fontWeight: "600",
  },
});
