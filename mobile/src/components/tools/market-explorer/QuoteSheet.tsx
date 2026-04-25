import React, { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useThemeColors } from "../../../theme/ThemeContext";
import { spacing, typography, radius } from "../../../theme/tokens";
import {
  formatPrice,
  formatChangePct,
  formatLargeNumber,
} from "../../../types/market-explorer";
import type { QuoteDetail } from "../../../types/market-explorer";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const SNAP = SCREEN_HEIGHT * 0.55;

type Props = {
  quote: QuoteDetail | null;
  visible: boolean;
  loading: boolean;
  onClose: () => void;
  onBuyVirtual?: () => void;
};

export function QuoteSheet({
  quote,
  visible,
  loading,
  onClose,
  onBuyVirtual,
}: Props) {
  const c = useThemeColors();
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: visible ? SCREEN_HEIGHT - SNAP : SCREEN_HEIGHT,
      useNativeDriver: true,
      bounciness: 3,
    }).start();
  }, [visible, translateY]);

  const isUp = (quote?.change_pct ?? 0) >= 0;
  const changeColor = isUp ? c.success : c.error;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={[styles.backdropFill, { backgroundColor: c.overlay }]} />
      </Pressable>

      <Animated.View
        style={[
          styles.sheet,
          { backgroundColor: c.surface, transform: [{ translateY }] },
        ]}
      >
        <TouchableOpacity
          style={styles.handleArea}
          onPress={onClose}
          activeOpacity={0.7}
        >
          <View style={[styles.handle, { backgroundColor: c.border }]} />
        </TouchableOpacity>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View style={styles.loadingRow}>
              <Text style={[styles.loadingText, { color: c.textMuted }]}>
                Loading quote…
              </Text>
            </View>
          ) : quote ? (
            <>
              <View style={styles.header}>
                <View>
                  <Text style={[styles.ticker, { color: c.text }]}>
                    {quote.ticker.toUpperCase()}
                  </Text>
                  <Text style={[styles.name, { color: c.textMuted }]}>
                    {quote.name}
                  </Text>
                </View>
                <View style={styles.priceGroup}>
                  <Text style={[styles.price, { color: c.text }]}>
                    {formatPrice(quote.price)}
                  </Text>
                  <Text style={[styles.change, { color: changeColor }]}>
                    {formatChangePct(quote.change_pct)}
                  </Text>
                </View>
              </View>

              <View style={[styles.statsGrid, { borderTopColor: c.border }]}>
                {quote.open != null && (
                  <QuoteStat
                    label="Open"
                    value={formatPrice(quote.open)}
                    colors={c}
                  />
                )}
                {quote.high != null && (
                  <QuoteStat
                    label="High"
                    value={formatPrice(quote.high)}
                    colors={c}
                  />
                )}
                {quote.low != null && (
                  <QuoteStat
                    label="Low"
                    value={formatPrice(quote.low)}
                    colors={c}
                  />
                )}
                {quote.volume != null && (
                  <QuoteStat
                    label="Volume"
                    value={formatLargeNumber(quote.volume)}
                    colors={c}
                  />
                )}
                {quote.market_cap != null && (
                  <QuoteStat
                    label="Mkt Cap"
                    value={formatLargeNumber(quote.market_cap)}
                    colors={c}
                  />
                )}
              </View>
              {onBuyVirtual && (
                <TouchableOpacity
                  style={[styles.buyBtn, { backgroundColor: c.primary }]}
                  onPress={onBuyVirtual}
                  activeOpacity={0.8}
                >
                  <Text style={styles.buyBtnText}>Buy with Virtual Cash</Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <Text style={[styles.loadingText, { color: c.textMuted }]}>
              No data available.
            </Text>
          )}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

function QuoteStat({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useThemeColors>;
}) {
  return (
    <View style={statStyles.item}>
      <Text style={[statStyles.label, { color: colors.textMuted }]}>
        {label}
      </Text>
      <Text style={[statStyles.value, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  item: { gap: spacing.xs, minWidth: "45%" },
  label: {
    fontSize: typography.xs,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  value: { fontSize: typography.base, fontWeight: "700" },
});

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, justifyContent: "flex-end" },
  backdropFill: { flex: 1 },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: SCREEN_HEIGHT,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    overflow: "hidden",
  },
  handleArea: { alignItems: "center", paddingVertical: spacing.md },
  handle: { width: 36, height: 4, borderRadius: 2 },
  content: { padding: spacing.xl, gap: spacing.xl },
  loadingRow: { alignItems: "center", paddingVertical: spacing.xl },
  loadingText: { fontSize: typography.sm },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  ticker: { fontSize: typography.xl, fontWeight: "800" },
  name: { fontSize: typography.sm, marginTop: spacing.xs },
  priceGroup: { alignItems: "flex-end", gap: spacing.xs },
  price: { fontSize: typography.xl, fontWeight: "800" },
  change: { fontSize: typography.base, fontWeight: "700" },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.lg,
    borderTopWidth: 1,
    paddingTop: spacing.lg,
  },
  buyBtn: {
    borderRadius: radius.xl,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  buyBtnText: {
    color: "#fff",
    fontSize: typography.sm,
    fontWeight: "700",
  },
});
