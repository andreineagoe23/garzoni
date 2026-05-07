import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "../../../theme/ThemeContext";
import { spacing, typography, radius } from "../../../theme/tokens";
import {
  formatPrice,
  formatChangePct,
  formatLargeNumber,
} from "../../../types/market-explorer";
import type { QuoteDetail } from "../../../types/market-explorer";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const SNAP = SCREEN_HEIGHT * 0.6;

type Props = {
  quote: QuoteDetail | null;
  visible: boolean;
  loading: boolean;
  /** Shown when live quote failed or returned no price */
  quoteWarning?: string | null;
  onClose: () => void;
  onConfirmBuy: (amount: number) => Promise<void>;
};

export function QuoteSheet({
  quote,
  visible,
  loading,
  quoteWarning,
  onClose,
  onConfirmBuy,
}: Props) {
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const [buyMode, setBuyMode] = useState(false);
  const [buyAmount, setBuyAmount] = useState("500");
  const [buyLoading, setBuyLoading] = useState(false);

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: visible ? SCREEN_HEIGHT - SNAP : SCREEN_HEIGHT,
      useNativeDriver: true,
      bounciness: 3,
    }).start();
    if (!visible) {
      setBuyMode(false);
      setBuyAmount("500");
    }
  }, [visible, translateY]);

  const handleConfirmBuy = async () => {
    const amount = Number(buyAmount);
    if (!amount || amount <= 0) return;
    setBuyLoading(true);
    try {
      await onConfirmBuy(amount);
      setBuyMode(false);
      setBuyAmount("500");
    } finally {
      setBuyLoading(false);
    }
  };

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
          {
            backgroundColor: c.surface,
            transform: [{ translateY }],
            paddingBottom: insets.bottom,
          },
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
          keyboardShouldPersistTaps="handled"
        >
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={c.primary} />
              <Text style={[styles.loadingText, { color: c.textMuted }]}>
                Loading quote…
              </Text>
            </View>
          ) : quote ? (
            <>
              {quoteWarning ? (
                <View
                  style={[
                    styles.warnBanner,
                    { backgroundColor: c.surfaceOffset, borderColor: c.border },
                  ]}
                >
                  <Text style={[styles.warnText, { color: c.textMuted }]}>
                    {quoteWarning}
                  </Text>
                </View>
              ) : null}
              {/* Header */}
              <View style={styles.header}>
                <View>
                  <Text style={[styles.ticker, { color: c.text }]}>
                    {quote.ticker.toUpperCase()}
                  </Text>
                  <Text style={[styles.name, { color: c.textMuted }]}>
                    {quote.name !== quote.ticker ? quote.name : ""}
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

              {/* Stats grid */}
              {(quote.open != null ||
                quote.high != null ||
                quote.low != null ||
                quote.volume != null ||
                quote.market_cap != null) && (
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
              )}

              {/* Buy flow — inline, no second Modal */}
              {!buyMode ? (
                <TouchableOpacity
                  style={[styles.buyBtn, { backgroundColor: c.primary }]}
                  onPress={() => setBuyMode(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.buyBtnText}>Buy with Virtual Cash</Text>
                </TouchableOpacity>
              ) : (
                <View style={[styles.buyForm, { borderColor: c.border }]}>
                  <Text style={[styles.buyFormTitle, { color: c.text }]}>
                    Buy {quote.ticker.toUpperCase()} with Virtual Cash
                  </Text>
                  <Text style={[styles.buyFormLabel, { color: c.textMuted }]}>
                    Dollar amount to spend
                  </Text>
                  <TextInput
                    style={[
                      styles.buyInput,
                      {
                        color: c.text,
                        borderColor: c.border,
                        backgroundColor: c.bg,
                      },
                    ]}
                    value={buyAmount}
                    onChangeText={setBuyAmount}
                    keyboardType="numeric"
                    placeholder="500"
                    placeholderTextColor={c.textFaint}
                    selectTextOnFocus
                    autoFocus
                  />
                  <View style={styles.buyActions}>
                    <TouchableOpacity
                      onPress={() => {
                        setBuyMode(false);
                        setBuyAmount("500");
                      }}
                      style={[
                        styles.buyActionBtn,
                        { borderColor: c.border, borderWidth: 1 },
                      ]}
                    >
                      <Text
                        style={[styles.buyActionText, { color: c.textMuted }]}
                      >
                        Cancel
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => void handleConfirmBuy()}
                      disabled={buyLoading || !Number(buyAmount)}
                      style={[
                        styles.buyActionBtn,
                        {
                          backgroundColor: c.primary,
                          opacity: buyLoading ? 0.7 : 1,
                        },
                      ]}
                    >
                      {buyLoading ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text style={[styles.buyActionText, { color: "#fff" }]}>
                          Confirm Buy
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
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
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  loadingText: { fontSize: typography.sm },
  warnBanner: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  warnText: { fontSize: typography.sm, lineHeight: 20 },
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
  buyBtnText: { color: "#fff", fontSize: typography.sm, fontWeight: "700" },
  buyForm: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  buyFormTitle: { fontSize: typography.base, fontWeight: "700" },
  buyFormLabel: {
    fontSize: typography.xs,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  buyInput: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: typography.base,
  },
  buyActions: { flexDirection: "row", gap: spacing.sm },
  buyActionBtn: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    alignItems: "center",
  },
  buyActionText: { fontSize: typography.sm, fontWeight: "700" },
});
