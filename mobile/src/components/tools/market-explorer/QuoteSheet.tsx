import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useThemeColors } from "../../../theme/ThemeContext";
import { spacing, typography, radius } from "../../../theme/tokens";
import KeyboardAwareScrollView from "../../../components/ui/KeyboardAwareScrollView";
import {
  formatPrice,
  formatChangePct,
  formatLargeNumber,
} from "../../../types/market-explorer";
import type { QuoteDetail } from "../../../types/market-explorer";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const SNAP = SCREEN_HEIGHT * 0.6;

export type TrackRealHoldingInput = {
  quantity: number;
  purchasePrice: number;
  purchaseDate: string;
};

type Props = {
  quote: QuoteDetail | null;
  visible: boolean;
  loading: boolean;
  /** Shown when live quote failed or returned no price */
  quoteWarning?: string | null;
  onClose: () => void;
  onConfirmBuy: (amount: number) => Promise<void>;
  onTrackReal?: (input: TrackRealHoldingInput) => Promise<void>;
};

type SheetMode = "idle" | "virtual" | "real";

function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function QuoteSheet({
  quote,
  visible,
  loading,
  quoteWarning,
  onClose,
  onConfirmBuy,
  onTrackReal,
}: Props) {
  const c = useThemeColors();
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const scrollRef = useRef<ScrollView>(null);
  const [mode, setMode] = useState<SheetMode>("idle");
  const [buyAmount, setBuyAmount] = useState("500");
  const [buyLoading, setBuyLoading] = useState(false);
  const [realQty, setRealQty] = useState("");
  const [realPrice, setRealPrice] = useState("");
  const [realDate, setRealDate] = useState(todayIso());
  const [realLoading, setRealLoading] = useState(false);
  const buyMode = mode !== "idle";

  const dismissKeyboardAndClose = () => {
    Keyboard.dismiss();
    onClose();
  };

  // Snap positions: collapsed (60%) and expanded (full-screen for buy form).
  const snapCollapsed = SCREEN_HEIGHT - SNAP;
  const snapExpanded = spacing.xl; // near top, leaves room for status bar

  // Slide sheet to expanded when buy form is open, collapsed otherwise.
  useEffect(() => {
    if (!visible) return;
    Animated.spring(translateY, {
      toValue: buyMode ? snapExpanded : snapCollapsed,
      useNativeDriver: true,
      bounciness: 2,
      speed: 14,
    }).start();
  }, [buyMode, visible, translateY, snapCollapsed, snapExpanded]);

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: visible ? snapCollapsed : SCREEN_HEIGHT,
      useNativeDriver: true,
      bounciness: 3,
    }).start();
    if (!visible) {
      Keyboard.dismiss();
      setMode("idle");
      setBuyAmount("500");
      setRealQty("");
      setRealPrice("");
      setRealDate(todayIso());
    }
  }, [visible, translateY, snapCollapsed]);

  useEffect(() => {
    if (mode === "real" && quote && !realPrice) {
      const px = Number(quote.price);
      if (Number.isFinite(px) && px > 0) {
        setRealPrice(String(px.toFixed(2)));
      }
    }
  }, [mode, quote, realPrice]);

  const handleConfirmBuy = async () => {
    const amount = Number(buyAmount);
    if (!amount || amount <= 0) return;
    setBuyLoading(true);
    try {
      await onConfirmBuy(amount);
      setMode("idle");
      setBuyAmount("500");
    } finally {
      setBuyLoading(false);
    }
  };

  const handleConfirmReal = async () => {
    if (!onTrackReal) return;
    const qty = Number(realQty);
    const px = Number(realPrice);
    if (!qty || qty <= 0 || !px || px <= 0 || !realDate) return;
    setRealLoading(true);
    try {
      await onTrackReal({
        quantity: qty,
        purchasePrice: px,
        purchaseDate: realDate,
      });
      setMode("idle");
      setRealQty("");
      setRealPrice("");
      setRealDate(todayIso());
    } finally {
      setRealLoading(false);
    }
  };

  const isUp = (quote?.change_pct ?? 0) >= 0;
  const changeColor = isUp ? c.success : c.error;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={dismissKeyboardAndClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={dismissKeyboardAndClose}>
        <View style={[styles.backdropFill, { backgroundColor: c.overlay }]} />
      </Pressable>

      <Animated.View
        style={[
          styles.sheet,
          {
            backgroundColor: c.surface,
            transform: [{ translateY }],
          },
        ]}
      >
        <View style={styles.kav}>
          <TouchableOpacity
            style={styles.handleArea}
            onPress={dismissKeyboardAndClose}
            activeOpacity={0.7}
          >
            <View style={[styles.handle, { backgroundColor: c.border }]} />
          </TouchableOpacity>

          <KeyboardAwareScrollView
            ref={scrollRef}
            keyboardActive={visible && buyMode}
            basePaddingBottom={spacing.xxxxl}
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
                      {
                        backgroundColor: c.surfaceOffset,
                        borderColor: c.border,
                      },
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
                  <View
                    style={[styles.statsGrid, { borderTopColor: c.border }]}
                  >
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

                {/* Action flow — inline, no second Modal */}
                {mode === "idle" ? (
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={[
                        styles.actionBtn,
                        styles.actionBtnSecondary,
                        { borderColor: c.border, backgroundColor: c.surface },
                      ]}
                      onPress={() => setMode("virtual")}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.actionBtnSecondaryText,
                          { color: c.text },
                        ]}
                      >
                        Practice Trade
                      </Text>
                      <Text
                        style={[styles.actionBtnHint, { color: c.textMuted }]}
                      >
                        Virtual cash
                      </Text>
                    </TouchableOpacity>
                    {onTrackReal ? (
                      <TouchableOpacity
                        style={[
                          styles.actionBtn,
                          { backgroundColor: c.primary },
                        ]}
                        onPress={() => setMode("real")}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.actionBtnPrimaryText}>
                          Track Real Holding
                        </Text>
                        <Text
                          style={[
                            styles.actionBtnHint,
                            { color: "rgba(255,255,255,0.85)" },
                          ]}
                        >
                          Add to my portfolio
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ) : mode === "virtual" ? (
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
                          Keyboard.dismiss();
                          setMode("idle");
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
                          <Text
                            style={[styles.buyActionText, { color: "#fff" }]}
                          >
                            Confirm Buy
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={[styles.buyForm, { borderColor: c.border }]}>
                    <Text style={[styles.buyFormTitle, { color: c.text }]}>
                      Track Real {quote.ticker.toUpperCase()} Holding
                    </Text>
                    <Text style={[styles.buyFormHint, { color: c.textMuted }]}>
                      Log a position you already own. It goes straight into your
                      real portfolio — no virtual cash involved.
                    </Text>
                    <Text style={[styles.buyFormLabel, { color: c.textMuted }]}>
                      Quantity owned
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
                      value={realQty}
                      onChangeText={setRealQty}
                      keyboardType="decimal-pad"
                      placeholder="e.g. 0.05"
                      placeholderTextColor={c.textFaint}
                      autoFocus
                    />
                    <Text style={[styles.buyFormLabel, { color: c.textMuted }]}>
                      Avg purchase price (per unit)
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
                      value={realPrice}
                      onChangeText={setRealPrice}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                      placeholderTextColor={c.textFaint}
                    />
                    <Text style={[styles.buyFormLabel, { color: c.textMuted }]}>
                      Purchase date (YYYY-MM-DD)
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
                      value={realDate}
                      onChangeText={setRealDate}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={c.textFaint}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <View style={styles.buyActions}>
                      <TouchableOpacity
                        onPress={() => {
                          Keyboard.dismiss();
                          setMode("idle");
                          setRealQty("");
                          setRealPrice("");
                          setRealDate(todayIso());
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
                        onPress={() => void handleConfirmReal()}
                        disabled={
                          realLoading ||
                          !Number(realQty) ||
                          !Number(realPrice) ||
                          !realDate
                        }
                        style={[
                          styles.buyActionBtn,
                          {
                            backgroundColor: c.primary,
                            opacity: realLoading ? 0.7 : 1,
                          },
                        ]}
                      >
                        {realLoading ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <Text
                            style={[styles.buyActionText, { color: "#fff" }]}
                          >
                            Add to Portfolio
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
          </KeyboardAwareScrollView>
        </View>
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
  kav: { flex: 1 },
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
  actionRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  actionBtn: {
    flex: 1,
    borderRadius: radius.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    gap: 2,
  },
  actionBtnSecondary: {
    borderWidth: 1,
  },
  actionBtnPrimaryText: {
    color: "#fff",
    fontSize: typography.sm,
    fontWeight: "700",
  },
  actionBtnSecondaryText: { fontSize: typography.sm, fontWeight: "700" },
  actionBtnHint: { fontSize: typography.xs },
  buyForm: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  buyFormTitle: { fontSize: typography.base, fontWeight: "700" },
  buyFormHint: { fontSize: typography.xs, lineHeight: 18 },
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
