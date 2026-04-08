import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useThemeColors } from "../../../theme/ThemeContext";
import { spacing, typography, radius } from "../../../theme/tokens";
import { formatPrice, formatChangePct } from "../../../types/market-explorer";
import type { Asset } from "../../../types/market-explorer";

type Props = { asset: Asset; onPress: () => void };

export function AssetCard({ asset, onPress }: Props) {
  const c = useThemeColors();
  const isUp = asset.change_pct >= 0;
  const changeColor = isUp ? c.success : c.error;
  const changeBg = isUp ? c.successBg : c.errorBg;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: c.surface,
          borderColor: c.border,
          opacity: pressed ? 0.88 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${asset.ticker} — ${formatPrice(asset.price)}`}
    >
      <View style={styles.left}>
        <Text style={[styles.ticker, { color: c.text }]}>
          {asset.ticker.toUpperCase()}
        </Text>
        <Text style={[styles.name, { color: c.textMuted }]} numberOfLines={1}>
          {asset.name}
        </Text>
      </View>
      <View style={styles.right}>
        <Text style={[styles.price, { color: c.text }]}>
          {formatPrice(asset.price)}
        </Text>
        <View style={[styles.changeBadge, { backgroundColor: changeBg }]}>
          <Text style={[styles.changeText, { color: changeColor }]}>
            {formatChangePct(asset.change_pct)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
  },
  left: { flex: 1, gap: spacing.xs },
  ticker: { fontSize: typography.base, fontWeight: "700" },
  name: { fontSize: typography.xs, maxWidth: 160 },
  right: { alignItems: "flex-end", gap: spacing.xs },
  price: { fontSize: typography.base, fontWeight: "700" },
  changeBadge: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  changeText: { fontSize: typography.xs, fontWeight: "700" },
});
